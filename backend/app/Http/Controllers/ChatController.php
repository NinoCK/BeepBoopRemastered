<?php

namespace App\Http\Controllers;

use App\Models\Chat;
use App\Models\Message;
use App\Services\LLMService;
use App\Services\RAGService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class ChatController extends Controller
{
    protected $llmService;
    protected $ragService;

    public function __construct(LLMService $llmService, RAGService $ragService)
    {
        $this->llmService = $llmService;
        $this->ragService = $ragService;
    }

    /**
     * Get all chats for the authenticated user
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $chats = $user->chats()
            ->with('latestMessage')
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json($chats);
    }

    /**
     * Create a new chat
     */
    public function create(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'nullable|string|max:255',
        ]);

        $chat = $request->user()->chats()->create([
            'title' => $request->title ?? 'New Chat',
            'status' => 'active',
        ]);

        return response()->json($chat, 201);
    }

    /**
     * Get a specific chat with messages
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $chat = $request->user()->chats()
            ->with(['messages' => function ($query) {
                $query->orderBy('sent_at');
            }])
            ->find($id);

        if (!$chat) {
            return response()->json(['error' => 'Chat not found'], 404);
        }

        return response()->json($chat);
    }

    /**
     * Handle a chat message
     */
    public function handle(Request $request): JsonResponse
    {
        $request->validate([
            'message' => 'required|string',
            'chat_id' => 'required|exists:chats,id',
        ]);

        $user = $request->user();

        try {
            $chat = $user->chats()->findOrFail($request->chat_id);

            $this->llmService->useModelForUser($user);

            // Save user message
            $userMessage = Message::create([
                'chat_id' => $chat->id,
                'user_id' => $user->id,
                'sender' => 'user',
                'content' => $request->message,
                'sent_at' => now(),
            ]);

            // Generate chat context from recent messages
            $recentMessages = $chat->messages()
                ->orderBy('sent_at', 'desc')
                ->limit(10)
                ->get()
                ->reverse();

            $context = [];
            foreach ($recentMessages as $msg) {
                $context[] = ucfirst($msg->sender) . ": " . $msg->content;
            }

            // Get RAG context from uploaded documents
            $ragContext = $this->ragService->getRelevantContext($user, $request->message, 5);
            if (!empty($ragContext)) {
                // Prepend RAG context to chat context
                $context = array_merge([
                    "=== Relevant information from uploaded documents ==="
                ], $ragContext, [
                    "=== End of document context ==="
                ], $context);
            }

            // Generate AI response
            $responseData = $this->llmService->generateResponse($request->message, $context);

            // Get current model name
            $currentModel = $this->llmService->getModel();

            // Save assistant message with thinking content and model name
            $assistantMessage = Message::create([
                'chat_id' => $chat->id,
                'user_id' => $user->id,
                'sender' => 'assistant',
                'content' => $responseData['content'],
                'metadata' => [
                    'thinking' => $responseData['thinking'],
                    'has_thinking' => !is_null($responseData['thinking']),
                    'model' => $currentModel
                ],
                'sent_at' => now(),
            ]);

            // Update chat title if it's the first exchange
            if ($chat->messages()->count() <= 2 && $chat->title === 'New Chat') {
                $title = $this->generateChatTitle($request->message);
                $chat->update(['title' => $title]);
            }

            $chat->touch(); // Update the updated_at timestamp

            return response()->json([
                'user_message' => $userMessage,
                'assistant_message' => $assistantMessage,
                'chat' => $chat->fresh(),
            ]);

        } catch (\Exception $e) {
            Log::error('Chat handling error', [
                'error' => $e->getMessage(),
                'chat_id' => $request->chat_id ?? null,
            ]);

            return response()->json([
                'error' => 'Failed to process message'
            ], 500);
        }
    }

    /**
     * Handle streaming chat message
     */
    public function stream(Request $request)
    {
        $request->validate([
            'message' => 'required|string',
            'chat_id' => 'required|exists:chats,id',
        ]);

        $user = $request->user();

        try {
            $chat = $user->chats()->findOrFail($request->chat_id);

            $this->llmService->useModelForUser($user);

            // Save user message
            $userMessage = Message::create([
                'chat_id' => $chat->id,
                'user_id' => $user->id,
                'sender' => 'user',
                'content' => $request->message,
                'sent_at' => now(),
            ]);

            // Generate chat context from recent messages
            $recentMessages = $chat->messages()
                ->orderBy('sent_at', 'desc')
                ->limit(10)
                ->get()
                ->reverse();

            $context = [];
            foreach ($recentMessages as $msg) {
                $context[] = ucfirst($msg->sender) . ": " . $msg->content;
            }

            // Get RAG context from uploaded documents
            $ragContext = $this->ragService->getRelevantContext($user, $request->message, 5);
            if (!empty($ragContext)) {
                // Prepend RAG context to chat context
                $context = array_merge([
                    "=== Relevant information from uploaded documents ==="
                ], $ragContext, [
                    "=== End of document context ==="
                ], $context);
            }

            $currentModel = $this->llmService->getModel();
            $userId = $user->id;

            return response()->stream(function () use ($request, $context, $chat, $userMessage, $currentModel, $userId) {
                $streamBody = $this->llmService->generateStreamingResponse($request->message, $context);
                
                if (!$streamBody) {
                    echo "data: " . json_encode(['error' => 'Failed to start stream']) . "\n\n";
                    return;
                }

                $fullResponse = '';
                $thinkingContent = '';
                $mainContent = '';
                $isInThinking = false;

                while (!$streamBody->eof()) {
                    $line = $streamBody->read(1024);
                    
                    if (empty($line)) {
                        continue;
                    }

                    // Parse Ollama streaming response
                    $lines = explode("\n", $line);
                    
                    foreach ($lines as $jsonLine) {
                        if (empty(trim($jsonLine))) {
                            continue;
                        }

                        $data = json_decode($jsonLine, true);
                        if (!$data || !isset($data['response'])) {
                            continue;
                        }

                        $chunk = $data['response'];
                        $fullResponse .= $chunk;

                        // Check if we're entering or leaving thinking mode
                        if (strpos($chunk, '<think>') !== false) {
                            $isInThinking = true;
                            echo "data: " . json_encode(['type' => 'thinking_start']) . "\n\n";
                            flush();
                            continue;
                        }

                        if (strpos($chunk, '</think>') !== false) {
                            $isInThinking = false;
                            echo "data: " . json_encode(['type' => 'thinking_end']) . "\n\n";
                            flush();
                            continue;
                        }

                        // Send appropriate chunk type
                        if ($isInThinking) {
                            $thinkingContent .= $chunk;
                            echo "data: " . json_encode([
                                'type' => 'thinking',
                                'content' => $chunk
                            ]) . "\n\n";
                        } else {
                            $mainContent .= $chunk;
                            echo "data: " . json_encode([
                                'type' => 'content',
                                'content' => $chunk
                            ]) . "\n\n";
                        }

                        flush();
                    }
                }

                // Save the final message
                $responseData = $this->llmService->extractThinkingContent($fullResponse);

                $assistantMessage = Message::create([
                    'chat_id' => $chat->id,
                    'user_id' => $userId,
                    'sender' => 'assistant',
                    'content' => $responseData['content'],
                    'metadata' => [
                        'thinking' => $responseData['thinking'],
                        'has_thinking' => !is_null($responseData['thinking']),
                        'model' => $currentModel
                    ],
                    'sent_at' => now(),
                ]);

                echo "data: " . json_encode([
                    'type' => 'complete',
                    'user_message' => $userMessage,
                    'assistant_message' => $assistantMessage
                ]) . "\n\n";

            }, 200, [
                'Content-Type' => 'text/event-stream',
                'Cache-Control' => 'no-cache',
                'Connection' => 'keep-alive',
                'X-Accel-Buffering' => 'no'
            ]);

        } catch (\Exception $e) {
            Log::error('Chat streaming error', [
                'error' => $e->getMessage(),
                'chat_id' => $request->chat_id ?? null,
            ]);

            return response()->json([
                'error' => 'Failed to process streaming message'
            ], 500);
        }
    }

    /**
     * Get chat logs (for terminal display)
     */
    public function logs(): JsonResponse
    {
        try {
            $logs = [
                [
                    'timestamp' => now()->toISOString(),
                    'level' => 'info',
                    'message' => 'Chat service is running',
                    'context' => ['service' => 'chat']
                ],
                [
                    'timestamp' => now()->subMinutes(1)->toISOString(),
                    'level' => 'info',
                    'message' => 'LLM service status: ' . ($this->llmService->isAvailable() ? 'connected' : 'disconnected'),
                    'context' => ['service' => 'llm']
                ]
            ];

            return response()->json(['logs' => $logs]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to retrieve logs',
                'logs' => []
            ], 500);
        }
    }

    /**
     * Delete a chat
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $chat = $request->user()->chats()->find($id);

        if (!$chat) {
            return response()->json(['error' => 'Chat not found'], 404);
        }

        $chat->delete();

        return response()->json(['message' => 'Chat deleted successfully']);
    }

    /**
     * Generate a chat title from the first message
     */
    protected function generateChatTitle(string $message): string
    {
        $words = explode(' ', $message);
        $title = implode(' ', array_slice($words, 0, 5));
        
        if (strlen($title) > 50) {
            $title = substr($title, 0, 47) . '...';
        }

        return $title ?: 'New Chat';
    }
}