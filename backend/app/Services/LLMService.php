<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Illuminate\Support\Facades\Log;

class LLMService
{
    protected $client;
    protected $endpoint;
    protected $model;
    protected $timeout;

    public function __construct()
    {
        $this->client = new Client();
        $this->endpoint = config('llm.endpoint');
        $this->model = \Illuminate\Support\Facades\Cache::get('selected_model', config('llm.model'));
        $this->timeout = config('llm.timeout');
    }

    /**
     * Generate a response from the LLM
     */
    public function generateResponse(string $prompt, array $context = []): array
    {
        try {
            // For Ollama API
            $payload = [
                'model' => $this->model,
                'prompt' => $this->buildPrompt($prompt, $context),
                'stream' => false,
                'options' => [
                    'temperature' => config('llm.temperature', 0.7),
                    'num_predict' => config('llm.max_tokens', 2048),
                ]
            ];

            Log::info('LLM Request', ['payload' => $payload]);

            $response = $this->client->post($this->endpoint, [
                'json' => $payload,
                'timeout' => $this->timeout,
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                ],
            ]);

            $responseData = json_decode($response->getBody()->getContents(), true);
            
            Log::info('LLM Response', ['response' => $responseData]);

            $fullResponse = $responseData['response'] ?? 'Sorry, I could not generate a response.';
            
            // Extract thinking content and final response
            return $this->extractThinkingContent($fullResponse);

        } catch (RequestException $e) {
            Log::error('LLM Service Error', [
                'error' => $e->getMessage(),
                'response' => $e->hasResponse() ? $e->getResponse()->getBody()->getContents() : null
            ]);

            return [
                'content' => 'Sorry, I encountered an error while processing your request. Please make sure your local LLM server is running.',
                'thinking' => null
            ];
        }
    }

    /**
     * Extract thinking content from response
     */
    public function extractThinkingContent(string $response): array
    {
        // Extract thinking content between <think> and </think> tags
        $thinkingPattern = '/<think>(.*?)<\/think>/s';
        $thinking = null;
        $content = $response;

        if (preg_match($thinkingPattern, $response, $matches)) {
            $thinking = trim($matches[1]);
            // Remove the thinking tags from the main content
            $content = preg_replace($thinkingPattern, '', $response);
            $content = trim($content);
        }

        // Also check for other common thinking patterns
        $alternativePatterns = [
            '/<thinking>(.*?)<\/thinking>/s',
            '/\*thinking\*(.*?)\*\/thinking\*/s',
            '/```thinking(.*?)```/s'
        ];

        foreach ($alternativePatterns as $pattern) {
            if (preg_match($pattern, $response, $matches)) {
                $thinking = trim($matches[1]);
                $content = preg_replace($pattern, '', $response);
                $content = trim($content);
                break;
            }
        }

        return [
            'content' => $content ?: 'No response generated.',
            'thinking' => $thinking
        ];
    }

    /**
     * Build the prompt with context
     */
    protected function buildPrompt(string $prompt, array $context = []): string
    {
        $systemPrompt = "You are a helpful AI assistant. You provide clear, accurate, and helpful responses.";
        
        if (!empty($context)) {
            $systemPrompt .= "\n\nContext information:\n" . implode("\n", $context);
        }

        return $systemPrompt . "\n\nUser: " . $prompt . "\nAssistant:";
    }

    /**
     * Generate embeddings for text (placeholder for future implementation)
     */
    public function generateEmbeddings(string $text): array
    {
        // This would typically call an embedding model
        // For now, return a simple hash-based representation
        return [hash('sha256', $text)];
    }

    /**
     * Generate a streaming response from the LLM
     */
    public function generateStreamingResponse(string $prompt, array $context = [])
    {
        try {
            $payload = [
                'model' => $this->model,
                'prompt' => $this->buildPrompt($prompt, $context),
                'stream' => true,
                'options' => [
                    'temperature' => config('llm.temperature', 0.7),
                    'num_predict' => config('llm.max_tokens', 2048),
                ]
            ];

            $response = $this->client->post($this->endpoint, [
                'json' => $payload,
                'timeout' => $this->timeout,
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                ],
                'stream' => true
            ]);

            return $response->getBody();

        } catch (RequestException $e) {
            Log::error('LLM Streaming Service Error', [
                'error' => $e->getMessage(),
                'response' => $e->hasResponse() ? $e->getResponse()->getBody()->getContents() : null
            ]);
            return null;
        }
    }

    /**
     * Check if the LLM service is available
     */
    public function isAvailable(): bool
    {
        try {
            // For Ollama, we need to check a different endpoint
            $healthEndpoint = str_replace('/api/generate', '/api/tags', $this->endpoint);
            $response = $this->client->get($healthEndpoint, [
                'timeout' => 5,
            ]);
            
            return $response->getStatusCode() === 200;
        } catch (RequestException $e) {
            Log::warning('LLM Service Availability Check Failed', [
                'endpoint' => $this->endpoint,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }
}