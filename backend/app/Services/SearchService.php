<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Illuminate\Support\Facades\Log;

class SearchService
{
    protected $client;
    protected $provider;
    protected $apiKey;
    protected $maxResults;

    public function __construct()
    {
        $this->client = new Client();
        $this->provider = config('llm.search.provider');
        $this->apiKey = config('llm.search.api_key');
        $this->maxResults = config('llm.search.max_results', 5);
    }

    /**
     * Perform a web search
     */
    public function search(string $query): array
    {
        if (!$this->apiKey) {
            return [
                'error' => 'Search API key not configured',
                'results' => []
            ];
        }

        try {
            switch ($this->provider) {
                case 'tavily':
                    return $this->searchTavily($query);
                
                case 'serper':
                    return $this->searchSerper($query);
                
                default:
                    return $this->mockSearch($query);
            }

        } catch (RequestException $e) {
            Log::error('Search Service Error', [
                'provider' => $this->provider,
                'query' => $query,
                'error' => $e->getMessage()
            ]);

            return [
                'error' => 'Search service temporarily unavailable',
                'results' => []
            ];
        }
    }

    /**
     * Search using Tavily API
     */
    protected function searchTavily(string $query): array
    {
        $response = $this->client->post('https://api.tavily.com/search', [
            'json' => [
                'api_key' => $this->apiKey,
                'query' => $query,
                'search_depth' => 'basic',
                'include_answer' => true,
                'max_results' => $this->maxResults,
            ],
            'timeout' => 30,
        ]);

        $data = json_decode($response->getBody()->getContents(), true);

        return [
            'query' => $query,
            'answer' => $data['answer'] ?? null,
            'results' => array_map(function ($result) {
                return [
                    'title' => $result['title'] ?? '',
                    'url' => $result['url'] ?? '',
                    'content' => $result['content'] ?? '',
                    'score' => $result['score'] ?? 0,
                ];
            }, $data['results'] ?? [])
        ];
    }

    /**
     * Search using Serper API
     */
    protected function searchSerper(string $query): array
    {
        $response = $this->client->post('https://google.serper.dev/search', [
            'json' => [
                'q' => $query,
                'num' => $this->maxResults,
            ],
            'headers' => [
                'X-API-KEY' => $this->apiKey,
                'Content-Type' => 'application/json',
            ],
            'timeout' => 30,
        ]);

        $data = json_decode($response->getBody()->getContents(), true);

        return [
            'query' => $query,
            'answer' => $data['answerBox']['answer'] ?? null,
            'results' => array_map(function ($result) {
                return [
                    'title' => $result['title'] ?? '',
                    'url' => $result['link'] ?? '',
                    'content' => $result['snippet'] ?? '',
                    'score' => 1, // Serper doesn't provide scores
                ];
            }, $data['organic'] ?? [])
        ];
    }

    /**
     * Mock search for testing without API key
     */
    protected function mockSearch(string $query): array
    {
        return [
            'query' => $query,
            'answer' => "This is a mock search result for: {$query}. Please configure a real search API key for actual web search functionality.",
            'results' => [
                [
                    'title' => "Mock Result 1 for: {$query}",
                    'url' => 'https://example.com/result1',
                    'content' => "This is mock content for the search query: {$query}. Configure SEARCH_API_KEY in your .env file to enable real web search.",
                    'score' => 0.9,
                ],
                [
                    'title' => "Mock Result 2 for: {$query}",
                    'url' => 'https://example.com/result2',
                    'content' => "Another mock search result. Real search results will appear here once you set up the search API.",
                    'score' => 0.8,
                ],
            ]
        ];
    }

    /**
     * Generate a response using search results
     */
    public function searchAndAnswer(string $query, LLMService $llmService): string
    {
        $searchResults = $this->search($query);

        if (!empty($searchResults['error'])) {
            return $llmService->generateResponse($query);
        }

        $context = [];
        
        if (!empty($searchResults['answer'])) {
            $context[] = "Direct answer: " . $searchResults['answer'];
        }

        foreach ($searchResults['results'] as $result) {
            $context[] = "Source: {$result['title']} ({$result['url']})\nContent: {$result['content']}";
        }

        $prompt = "Based on the following search results, please provide a comprehensive answer to the user's question.\n\nUser question: {$query}";

        return $llmService->generateResponse($prompt, $context);
    }

    /**
     * Check if search service is configured
     */
    public function isConfigured(): bool
    {
        return !empty($this->apiKey) && in_array($this->provider, ['tavily', 'serper']);
    }
}