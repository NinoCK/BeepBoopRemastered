<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use DOMDocument;
use DOMXPath;

class DuckDuckGoScraper
{
    protected $client;
    protected $rateLimit;
    protected $rateLimitKey = 'ddg_search_rate_limit';

    public function __construct()
    {
        $this->client = new Client([
            'timeout' => 15,
            'verify' => false, // Disable SSL verification for development
            'headers' => [
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language' => 'en-US,en;q=0.9',
                'Accept-Encoding' => 'gzip, deflate, br',
                'Connection' => 'keep-alive',
                'Upgrade-Insecure-Requests' => '1',
                'Sec-Fetch-Dest' => 'document',
                'Sec-Fetch-Mode' => 'navigate',
                'Sec-Fetch-Site' => 'none',
                'Cache-Control' => 'max-age=0',
            ]
        ]);
        $this->rateLimit = config('llm.search.rate_limit', 10);
    }

    /**
     * Search DuckDuckGo and return results
     */
    public function search(string $query, int $maxResults = 10): array
    {
        if (!$this->checkRateLimit()) {
            return [
                'error' => 'Rate limit exceeded. Please wait before making another search.',
                'results' => []
            ];
        }

        try {
            // Check cache first
            $cacheKey = 'ddg_search_' . md5($query);
            $cached = Cache::get($cacheKey);
            if ($cached) {
                return $cached;
            }

            $searchUrl = 'https://html.duckduckgo.com/html/';
            
            // Add a small delay to be respectful
            usleep(500000); // 0.5 seconds
            
            $response = $this->client->get($searchUrl, [
                'query' => [
                    'q' => $query,
                    'kl' => 'us-en', // Language/region
                ],
                'allow_redirects' => true,
                'http_errors' => false, // Don't throw exceptions on 4xx/5xx
            ]);
            
            // Check if we got blocked
            if ($response->getStatusCode() === 403) {
                Log::warning('DuckDuckGo blocked request', ['query' => $query]);
                return [
                    'error' => 'Search temporarily blocked. Please try again later.',
                    'results' => []
                ];
            }
            
            if ($response->getStatusCode() !== 200) {
                Log::warning('DuckDuckGo returned non-200 status', [
                    'query' => $query,
                    'status' => $response->getStatusCode()
                ]);
                return [
                    'error' => 'Search service returned error: ' . $response->getStatusCode(),
                    'results' => []
                ];
            }

            $html = $response->getBody()->getContents();
            $results = $this->parseSearchResults($html, $maxResults);

            $searchResults = [
                'query' => $query,
                'results' => $results,
                'total_results' => count($results)
            ];

            // Cache results for 10 minutes
            Cache::put($cacheKey, $searchResults, 600);

            $this->incrementRateLimit();
            
            return $searchResults;

        } catch (RequestException $e) {
            Log::error('DuckDuckGo Search Error', [
                'query' => $query,
                'error' => $e->getMessage()
            ]);

            return [
                'error' => 'Search temporarily unavailable',
                'results' => []
            ];
        }
    }

    /**
     * Parse HTML search results
     */
    protected function parseSearchResults(string $html, int $maxResults): array
    {
        $results = [];
        
        // Suppress warnings for malformed HTML
        libxml_use_internal_errors(true);
        
        $dom = new DOMDocument();
        $dom->loadHTML($html);
        $xpath = new DOMXPath($dom);

        // DuckDuckGo HTML structure: results are in divs with class "result"
        $resultNodes = $xpath->query('//div[contains(@class, "result")]');

        $count = 0;
        foreach ($resultNodes as $node) {
            if ($count >= $maxResults) {
                break;
            }

            $result = $this->extractResultData($xpath, $node);
            if ($result && !empty($result['url'])) {
                $results[] = $result;
                $count++;
            }
        }

        libxml_clear_errors();
        
        return $results;
    }

    /**
     * Extract data from a single result node
     */
    protected function extractResultData(DOMXPath $xpath, $node): ?array
    {
        try {
            // Extract title and URL from the link
            $titleNode = $xpath->query('.//a[contains(@class, "result__a")]', $node)->item(0);
            if (!$titleNode) {
                return null;
            }

            $title = trim($titleNode->textContent);
            $url = $titleNode->getAttribute('href');

            // Clean up the URL (DuckDuckGo sometimes uses redirect URLs)
            if (strpos($url, '/l/?uddg=') !== false) {
                // Extract the actual URL from DuckDuckGo's redirect
                parse_str(parse_url($url, PHP_URL_QUERY), $params);
                $url = $params['uddg'] ?? $url;
            }

            // Extract snippet/description
            $snippetNode = $xpath->query('.//a[contains(@class, "result__snippet")]', $node)->item(0);
            $snippet = $snippetNode ? trim($snippetNode->textContent) : '';

            // If no snippet in the link, try to find it in other elements
            if (empty($snippet)) {
                $snippetNode = $xpath->query('.//div[contains(@class, "result__snippet")]', $node)->item(0);
                $snippet = $snippetNode ? trim($snippetNode->textContent) : '';
            }

            return [
                'title' => $title,
                'url' => $url,
                'snippet' => $snippet,
                'source' => 'duckduckgo'
            ];

        } catch (\Exception $e) {
            Log::warning('Error extracting result data', [
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Check if we're within rate limits
     */
    protected function checkRateLimit(): bool
    {
        $requests = Cache::get($this->rateLimitKey, 0);
        return $requests < $this->rateLimit;
    }

    /**
     * Increment rate limit counter
     */
    protected function incrementRateLimit(): void
    {
        $requests = Cache::get($this->rateLimitKey, 0);
        Cache::put($this->rateLimitKey, $requests + 1, 60); // Reset every minute
    }

    /**
     * Get current rate limit status
     */
    public function getRateLimitStatus(): array
    {
        $requests = Cache::get($this->rateLimitKey, 0);
        return [
            'requests_made' => $requests,
            'limit' => $this->rateLimit,
            'remaining' => max(0, $this->rateLimit - $requests),
            'reset_in_seconds' => Cache::get($this->rateLimitKey) ? 60 : 0
        ];
    }
}
