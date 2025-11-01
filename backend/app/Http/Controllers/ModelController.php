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
     * Pull/install a model
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