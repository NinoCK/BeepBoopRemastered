<?php

use App\Http\Controllers\ChatController;
use App\Http\Controllers\RAGController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\ModelController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// Chat routes
Route::prefix('chat')->group(function () {
    Route::get('/', [ChatController::class, 'index']);
    Route::post('/new', [ChatController::class, 'create']);
    Route::get('/logs', [ChatController::class, 'logs']); // Move logs before {id} route
    Route::get('/{id}', [ChatController::class, 'show']);
    Route::delete('/{id}', [ChatController::class, 'destroy']);
    Route::post('/', [ChatController::class, 'handle']);
    Route::post('/stream', [ChatController::class, 'stream']);
});

// RAG routes
Route::prefix('rag')->group(function () {
    Route::post('/upload', [RAGController::class, 'upload']);
    Route::post('/query', [RAGController::class, 'query']);
    Route::get('/documents', [RAGController::class, 'documents']);
    Route::delete('/documents/{id}', [RAGController::class, 'destroy']);
});

// Search routes
Route::prefix('search')->group(function () {
    Route::post('/', [SearchController::class, 'search']);
    Route::get('/status', [SearchController::class, 'status']);
});

// Model management routes
Route::prefix('models')->group(function () {
    Route::get('/', [ModelController::class, 'listModels']);
    Route::get('/current', [ModelController::class, 'getCurrentModel']);
    Route::post('/current', [ModelController::class, 'setCurrentModel']);
    Route::post('/pull', [ModelController::class, 'pullModel']);
    Route::delete('/delete', [ModelController::class, 'deleteModel']);
    Route::post('/info', [ModelController::class, 'getModelInfo']);
    Route::get('/status', [ModelController::class, 'getServiceStatus']);
});

// Test routes
Route::get('/test', function () {
    return response()->json([
        'status' => 'ok',
        'message' => 'API is working',
        'timestamp' => now(),
        'llm_model' => config('llm.model'),
        'llm_endpoint' => config('llm.endpoint')
    ]);
});

// Test thinking route
Route::post('/test/thinking', function () {
    return response()->stream(function () {
        // Simulate thinking
        echo "data: " . json_encode(['type' => 'thinking_start']) . "\n\n";
        flush();
        
        $thinkingText = "Let me think about this question carefully. The user is asking about testing the thinking capability. I should provide a comprehensive answer that demonstrates how this feature works.\n\nFirst, I need to analyze what they want to know:\n1. How the thinking process works\n2. How it's displayed in the UI\n3. What makes this useful\n\nThis is a good opportunity to show the step-by-step reasoning that happens before I provide my final answer.";
        
        foreach (str_split($thinkingText, 2) as $chunk) {
            echo "data: " . json_encode(['type' => 'thinking', 'content' => $chunk]) . "\n\n";
            flush();
            usleep(25000); // 25ms delay for faster demo
        }
        
        echo "data: " . json_encode(['type' => 'thinking_end']) . "\n\n";
        flush();
        
        $responseText = "Perfect! The thinking capability is working as expected. As you can see, the AI model can show its reasoning process in real-time before providing the final response.\n\nThis feature is particularly useful with models like DeepSeek R1 that naturally include <think> tags in their responses. The system automatically:\n\n• Extracts thinking content from model responses\n• Displays it in an expandable panel with a brain icon\n• Shows the thinking process in real-time during streaming\n• Allows you to collapse/expand to see the reasoning when needed\n\nTry asking a complex question to see how the AI breaks down its thinking process!";
        
        foreach (str_split($responseText, 3) as $chunk) {
            echo "data: " . json_encode(['type' => 'content', 'content' => $chunk]) . "\n\n";
            flush();
            usleep(20000); // 20ms delay
        }
        
        echo "data: " . json_encode([
            'type' => 'complete',
            'user_message' => [
                'id' => 999,
                'sender' => 'user',
                'content' => 'Test thinking stream capability',
                'sent_at' => now()->toISOString()
            ],
            'assistant_message' => [
                'id' => 1000,
                'sender' => 'assistant',
                'content' => $responseText,
                'metadata' => [
                    'thinking' => $thinkingText,
                    'has_thinking' => true
                ],
                'sent_at' => now()->toISOString()
            ]
        ]) . "\n\n";
        
    }, 200, [
        'Content-Type' => 'text/event-stream',
        'Cache-Control' => 'no-cache',
        'Connection' => 'keep-alive',
        'X-Accel-Buffering' => 'no'
    ]);
});

// Test regular thinking extraction
Route::post('/test/extract', function () {
    $testResponse = "<think>This is a test thinking process. Let me analyze this step by step: 1) First I need to understand the request, 2) Then formulate a response, 3) Finally provide a clear answer.</think>This is the main response after thinking about it carefully.";
    
    $llmService = app(\App\Services\LLMService::class);
    $extracted = $llmService->extractThinkingContent($testResponse);
    
    return response()->json([
        'original' => $testResponse,
        'extracted' => $extracted,
        'thinking_found' => !is_null($extracted['thinking'])
    ]);
});

// Test problematic content from message 24
Route::get('/test/problematic', function () {
    $problematicContent = '<think>
Okay, so the user greeted me withhello again." I should respond in a friendly welcoming manner to keep the conversation going. Maybe can say something like, "Hello again!\'s up?" That sounds good because it acknowledges greeting and introduces myself while keeping things positive.
</think>

Hello again! What\'s up?';
    
    $llmService = app(\App\Services\LLMService::class);
    $extracted = $llmService->extractThinkingContent($problematicContent);
    
    return response()->json([
        'original' => $problematicContent,
        'extracted' => $extracted,
        'thinking_found' => !is_null($extracted['thinking']),
        'content_length' => strlen($problematicContent),
        'patterns_tested' => [
            'main_pattern' => preg_match('/<think>(.*?)<\/think>/s', $problematicContent),
            'thinking_pattern' => preg_match('/<thinking>(.*?)<\/thinking>/s', $problematicContent),
        ]
    ]);
});

// Check actual message 24 content
Route::get('/test/message24', function () {
    $message = \App\Models\Message::find(24);
    $llmService = app(\App\Services\LLMService::class);
    $extracted = $llmService->extractThinkingContent($message->content);
    
    return response()->json([
        'message_id' => $message->id,
        'original_content' => $message->content,
        'content_length' => strlen($message->content),
        'has_opening_think' => strpos($message->content, '<think>') !== false,
        'has_closing_think' => strpos($message->content, '</think>') !== false,
        'extracted' => $extracted,
        'thinking_found' => !is_null($extracted['thinking']),
        'patterns_tested' => [
            'main_pattern' => preg_match('/<think>(.*?)<\/think>/s', $message->content),
            'thinking_pattern' => preg_match('/<thinking>(.*?)<\/thinking>/s', $message->content),
        ]
    ]);
});