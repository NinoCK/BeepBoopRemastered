<?php

namespace App\Http\Controllers;

use App\Services\LLMService;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class ModelController extends Controller
{
    protected $client;
    protected $ollamaBaseUrl;

    public function __construct()
    {
        $this->client = new Client();
        $this->ollamaBaseUrl = str_replace('/api/generate', '', config('llm.endpoint'));
    }

    /**
     * Get list of installed models
     */
    public function listModels(): JsonResponse
    {
        try {
            $response = $this->client->get($this->ollamaBaseUrl . '/api/tags', [
                'timeout' => 10,
                'headers' => [
                    'Accept' => 'application/json',
                ],
            ]);

            $data = json_decode($response->getBody()->getContents(), true);
            
            $models = collect($data['models'] ?? [])->map(function ($model) {
                return [
                    'name' => $model['name'],
                    'modified_at' => $model['modified_at'] ?? null,
                    'size' => $model['size'] ?? 0,
                    'digest' => $model['digest'] ?? null,
                    'details' => $model['details'] ?? null,
                ];
            });

            return response()->json([
                'success' => true,
                'models' => $models
            ]);

        } catch (RequestException $e) {
            Log::error('Failed to fetch models', [
                'error' => $e->getMessage(),
                'endpoint' => $this->ollamaBaseUrl . '/api/tags'
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch models. Make sure Ollama is running.',
                'models' => []
            ], 500);
        }
    }

    /**
     * Get currently selected model
     */
    public function getCurrentModel(): JsonResponse
    {
        $currentModel = Cache::get('selected_model', config('llm.model', 'llama2'));
        
        return response()->json([
            'success' => true,
            'model' => $currentModel
        ]);
    }

    /**
     * Set current model
     */
    public function setCurrentModel(Request $request): JsonResponse
    {
        $request->validate([
            'model' => 'required|string'
        ]);

        $modelName = $request->input('model');
        
        // Store in cache for immediate use
        Cache::put('selected_model', $modelName, now()->addDays(30));
        
        // Log the model change
        Log::info('Model changed', [
            'new_model' => $modelName,
            'user_agent' => $request->userAgent()
        ]);

        return response()->json([
            'success' => true,
            'model' => $modelName,
            'message' => "Model changed to {$modelName}"
        ]);
    }

    /**
     * Validate model name format
     */
    private function validateModelName(string $modelName): bool
    {
        // Basic validation: alphanumeric, colons, dashes, underscores, dots
        return preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/', $modelName) === 1;
    }

    /**
     * Pull/install a model (streaming version)
     */
    public function streamPullModel(Request $request)
    {
        $request->validate([
            'model' => 'required|string'
        ]);

        $modelName = $request->input('model');

        // Validate model name format
        if (!$this->validateModelName($modelName)) {
            return response()->stream(function () use ($modelName) {
                echo "data: " . json_encode([
                    'type' => 'error',
                    'message' => "Invalid model name format: {$modelName}. Model names should contain only alphanumeric characters, dots, colons, hyphens, and underscores."
                ]) . "\n\n";
            }, 200, [
                'Content-Type' => 'text/event-stream',
                'Cache-Control' => 'no-cache',
                'Connection' => 'keep-alive',
                'X-Accel-Buffering' => 'no'
            ]);
        }

        return response()->stream(function () use ($modelName) {
            // Set unlimited execution time for long downloads
            set_time_limit(0);
            
            // Disable output buffering to ensure real-time streaming
            if (ob_get_level()) {
                ob_end_clean();
            }
            
            try {
                // Start the pull process with streaming
                $response = $this->client->post($this->ollamaBaseUrl . '/api/pull', [
                    'json' => [
                        'name' => $modelName,
                        'stream' => true
                    ],
                    'stream' => true,
                    'timeout' => 1800, // 30 minutes timeout for large models
                    'read_timeout' => 1800, // 30 minutes read timeout
                    'connect_timeout' => 30, // 30 seconds connect timeout
                    'headers' => [
                        'Content-Type' => 'application/json',
                        'Accept' => 'application/json',
                    ],
                ]);

                $body = $response->getBody();
                $buffer = '';
                $lastProgress = 0;
                $startTime = microtime(true);

                echo "data: " . json_encode([
                    'type' => 'status',
                    'message' => "Starting download of {$modelName}..."
                ]) . "\n\n";
                flush();

                $lastActivityTime = microtime(true);
                $noDataCount = 0;
                $lastStatusSent = '';
                
                while (!$body->eof()) {
                    $chunk = $body->read(1024);
                    if (empty($chunk)) {
                        $noDataCount++;
                        
                        // Check if we've been without data for too long
                        $currentTime = microtime(true);
                        if ($currentTime - $lastActivityTime > 120) { // 2 minutes without data
                            echo "data: " . json_encode([
                                'type' => 'error',
                                'message' => "Download timed out - no data received for 2 minutes. Please try again."
                            ]) . "\n\n";
                            flush();
                            return;
                        }
                        
                        // Small sleep to prevent busy waiting
                        usleep(100000); // 100ms
                        continue;
                    }
                    
                    // Reset activity tracking when we receive data
                    $lastActivityTime = microtime(true);
                    $noDataCount = 0;

                    $buffer .= $chunk;
                    $lines = explode("\n", $buffer);
                    $buffer = array_pop($lines); // Keep incomplete line in buffer

                    foreach ($lines as $line) {
                        $line = trim($line);
                        if (empty($line)) {
                            continue;
                        }

                        try {
                            $data = json_decode($line, true);
                            if (!$data) {
                                continue;
                            }

                            // Handle different Ollama response types
                            if (isset($data['status'])) {
                                $status = $data['status'];
                                
                                if ($status === 'success') {
                                    echo "data: " . json_encode([
                                        'type' => 'complete',
                                        'model' => $modelName,
                                        'message' => "Successfully downloaded {$modelName}"
                                    ]) . "\n\n";
                                    flush();
                                    return;
                                }

                                // Send status update only if status actually changed
                                $friendlyStatus = $this->getFriendlyStatus($status);
                                if ($friendlyStatus !== $lastStatusSent) {
                                    echo "data: " . json_encode([
                                        'type' => 'status',
                                        'message' => $friendlyStatus
                                    ]) . "\n\n";
                                    flush();
                                    $lastStatusSent = $friendlyStatus;
                                }

                                // Handle progress for any pulling status that has progress data
                                if (strpos($status, 'pulling') === 0 && isset($data['completed']) && isset($data['total'])) {
                                    $completed = $data['completed'];
                                    $total = $data['total'];
                                    $percentage = $total > 0 ? ($completed / $total) * 100 : 0;
                                    
                                    // Calculate download speed
                                    $currentTime = microtime(true);
                                    $elapsed = $currentTime - $startTime;
                                    $speed = $elapsed > 0 ? $completed / $elapsed : 0;
                                    $speedFormatted = $this->formatBytes($speed) . '/s';

                                    // Only send progress updates if percentage changed significantly
                                    if (abs($percentage - $lastProgress) >= 0.5) {
                                        echo "data: " . json_encode([
                                            'type' => 'progress',
                                            'completed' => $completed,
                                            'total' => $total,
                                            'percentage' => round($percentage, 1),
                                            'speed' => $speedFormatted
                                        ]) . "\n\n";
                                        flush();
                                        $lastProgress = $percentage;
                                    }
                                }
                            }

                            if (isset($data['error'])) {
                                $errorMessage = $data['error'];
                                
                                // Apply user-friendly error message transformation
                                if (strpos($errorMessage, 'file does not exist') !== false || 
                                    strpos($errorMessage, 'pull model manifest') !== false) {
                                    $errorMessage = "Model '{$modelName}' not found in Ollama library. Please check the model name and try again.\n\nSuggestions:\n• For Qwen models, try: qwen2.5:0.5b, qwen2.5:1.5b, qwen2.5:3b, qwen2.5:7b\n• Visit https://ollama.com/library to browse available models";
                                } elseif (strpos($errorMessage, 'not found') !== false) {
                                    $errorMessage = "Model '{$modelName}' not found in Ollama library. Please check the model name and try again.";
                                }
                                
                                echo "data: " . json_encode([
                                    'type' => 'error',
                                    'message' => $errorMessage
                                ]) . "\n\n";
                                flush();
                                return;
                            }

                        } catch (\Exception $e) {
                            // Skip malformed JSON lines
                            continue;
                        }
                    }
                }

                // If we reach here without success, it might be an error
                echo "data: " . json_encode([
                    'type' => 'error',
                    'message' => "Download completed but no success confirmation received"
                ]) . "\n\n";
                flush();

            } catch (RequestException $e) {
                $errorMessage = $e->getMessage();
                
                // Parse specific error messages
                if ($e->hasResponse()) {
                    $responseBody = $e->getResponse()->getBody()->getContents();
                    $responseData = json_decode($responseBody, true);
                    if ($responseData && isset($responseData['error'])) {
                        $errorMessage = $responseData['error'];
                    }
                }

                // Check for common error patterns and provide user-friendly messages
                if (strpos($errorMessage, 'file does not exist') !== false || 
                    strpos($errorMessage, 'pull model manifest') !== false) {
                    $errorMessage = "Model '{$modelName}' not found in Ollama library. Please check the model name and try again.\n\nSuggestions:\n• For Qwen models, try: qwen2.5:0.5b, qwen2.5:1.5b, qwen2.5:3b, qwen2.5:7b\n• Visit https://ollama.com/library to browse available models";
                } elseif (strpos($errorMessage, 'not found') !== false || strpos($errorMessage, '404') !== false) {
                    $errorMessage = "Model '{$modelName}' not found in Ollama library. Please check the model name and try again.";
                } elseif (strpos($errorMessage, 'Connection refused') !== false) {
                    $errorMessage = "Cannot connect to Ollama service. Please make sure Ollama is running.";
                }

                Log::error('Failed to pull model', [
                    'model' => $modelName,
                    'error' => $e->getMessage(),
                    'response' => $e->hasResponse() ? $e->getResponse()->getBody()->getContents() : null
                ]);

                echo "data: " . json_encode([
                    'type' => 'error',
                    'message' => $errorMessage
                ]) . "\n\n";
                flush();
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no'
        ]);
    }

    /**
     * Convert Ollama status to user-friendly message
     */
    private function getFriendlyStatus(string $status): string
    {
        if ($status === 'pulling manifest') {
            return 'Checking model information...';
        }
        
        if (strpos($status, 'pulling') === 0) {
            return 'Downloading model layers...';
        }
        
        if ($status === 'verifying sha256 digest') {
            return 'Verifying download integrity...';
        }
        
        if ($status === 'writing manifest') {
            return 'Finalizing installation...';
        }
        
        if ($status === 'success') {
            return 'Installation completed successfully!';
        }
        
        // Default: capitalize first letter
        return ucfirst($status);
    }

    /**
     * Format bytes to human readable format
     */
    private function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        
        $bytes /= pow(1024, $pow);
        
        return round($bytes, 1) . ' ' . $units[$pow];
    }

    /**
     * Pull/install a model (legacy non-streaming version)
     */
    public function pullModel(Request $request): JsonResponse
    {
        $request->validate([
            'model' => 'required|string'
        ]);

        $modelName = $request->input('model');

        try {
            // Start the pull process (this is asynchronous in Ollama)
            $response = $this->client->post($this->ollamaBaseUrl . '/api/pull', [
                'json' => [
                    'name' => $modelName,
                    'stream' => false
                ],
                'timeout' => 300, // 5 minutes timeout for model downloads
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                ],
            ]);

            $data = json_decode($response->getBody()->getContents(), true);

            Log::info('Model pull initiated', [
                'model' => $modelName,
                'response' => $data
            ]);

            return response()->json([
                'success' => true,
                'message' => "Started pulling model: {$modelName}",
                'model' => $modelName
            ]);

        } catch (RequestException $e) {
            Log::error('Failed to pull model', [
                'model' => $modelName,
                'error' => $e->getMessage(),
                'response' => $e->hasResponse() ? $e->getResponse()->getBody()->getContents() : null
            ]);

            return response()->json([
                'success' => false,
                'message' => "Failed to pull model: {$modelName}. " . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a model
     */
    public function deleteModel(Request $request): JsonResponse
    {
        $request->validate([
            'model' => 'required|string'
        ]);

        $modelName = $request->input('model');

        // Don't allow deleting the currently selected model
        $currentModel = Cache::get('selected_model', config('llm.model'));
        if ($modelName === $currentModel) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete the currently selected model. Please select a different model first.'
            ], 400);
        }

        try {
            $response = $this->client->delete($this->ollamaBaseUrl . '/api/delete', [
                'json' => [
                    'name' => $modelName
                ],
                'timeout' => 30,
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                ],
            ]);

            Log::info('Model deleted', [
                'model' => $modelName
            ]);

            return response()->json([
                'success' => true,
                'message' => "Model {$modelName} deleted successfully"
            ]);

        } catch (RequestException $e) {
            Log::error('Failed to delete model', [
                'model' => $modelName,
                'error' => $e->getMessage(),
                'response' => $e->hasResponse() ? $e->getResponse()->getBody()->getContents() : null
            ]);

            return response()->json([
                'success' => false,
                'message' => "Failed to delete model: {$modelName}. " . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get model information
     */
    public function getModelInfo(Request $request): JsonResponse
    {
        $request->validate([
            'model' => 'required|string'
        ]);

        $modelName = $request->input('model');

        try {
            $response = $this->client->post($this->ollamaBaseUrl . '/api/show', [
                'json' => [
                    'name' => $modelName
                ],
                'timeout' => 10,
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                ],
            ]);

            $data = json_decode($response->getBody()->getContents(), true);

            return response()->json([
                'success' => true,
                'model_info' => $data
            ]);

        } catch (RequestException $e) {
            Log::error('Failed to get model info', [
                'model' => $modelName,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => "Failed to get model information for: {$modelName}"
            ], 500);
        }
    }

    /**
     * Check Ollama service status
     */
    public function getServiceStatus(): JsonResponse
    {
        try {
            $response = $this->client->get($this->ollamaBaseUrl . '/api/version', [
                'timeout' => 5,
            ]);

            $data = json_decode($response->getBody()->getContents(), true);

            return response()->json([
                'success' => true,
                'status' => 'running',
                'version' => $data['version'] ?? 'unknown'
            ]);

        } catch (RequestException $e) {
            return response()->json([
                'success' => false,
                'status' => 'offline',
                'message' => 'Ollama service is not running'
            ], 503);
        }
    }
}