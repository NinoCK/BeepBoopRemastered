<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use DOMDocument;
use DOMXPath;

class WebContentFetcher
{
    protected $client;
    protected $maxContentLength;
    protected $timeout;

    public function __construct()
    {
        $this->client = new Client([
            'timeout' => 10,
            'verify' => false, // Disable SSL verification for development
            'headers' => [
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language' => 'en-US,en;q=0.9',
                'Accept-Encoding' => 'gzip, deflate, br',
                'Connection' => 'keep-alive',
            ]
        ]);
        $this->maxContentLength = config('llm.search.max_content_length', 3000);
        $this->timeout = 10;
    }

    /**
     * Fetch and extract content from a URL
     */
    public function fetchContent(string $url): array
    {
        // Validate URL
        if (!$this->isValidUrl($url)) {
            return [
                'success' => false,
                'error' => 'Invalid URL',
                'content' => '',
                'title' => '',
                'word_count' => 0
            ];
        }

        // Check cache first
        $cacheKey = 'web_content_' . md5($url);
        $cached = Cache::get($cacheKey);
        if ($cached) {
            return $cached;
        }

        try {
            $response = $this->client->get($url, [
                'timeout' => $this->timeout,
                'allow_redirects' => [
                    'max' => 3,
                    'strict' => true,
                    'referer' => true,
                ]
            ]);

            $html = $response->getBody()->getContents();
            $contentData = $this->extractContent($html, $url);

            // Cache for 1 hour
            Cache::put($cacheKey, $contentData, 3600);

            return $contentData;

        } catch (RequestException $e) {
            Log::warning('Failed to fetch content', [
                'url' => $url,
                'error' => $e->getMessage()
            ]);

            return [
                'success' => false,
                'error' => 'Failed to fetch content: ' . $e->getMessage(),
                'content' => '',
                'title' => '',
                'word_count' => 0
            ];
        }
    }

    /**
     * Extract and clean content from HTML
     */
    protected function extractContent(string $html, string $url): array
    {
        // Suppress warnings for malformed HTML
        libxml_use_internal_errors(true);

        $dom = new DOMDocument();
        $dom->loadHTML($html);
        $xpath = new DOMXPath($dom);

        // Extract title
        $title = $this->extractTitle($xpath);

        // Extract main content
        $content = $this->extractMainContent($xpath);

        // Clean and process content
        $cleanContent = $this->cleanContent($content);
        $truncatedContent = $this->truncateContent($cleanContent);

        libxml_clear_errors();

        return [
            'success' => true,
            'error' => null,
            'content' => $truncatedContent,
            'title' => $title,
            'word_count' => str_word_count($truncatedContent),
            'url' => $url
        ];
    }

    /**
     * Extract page title
     */
    protected function extractTitle(DOMXPath $xpath): string
    {
        $titleNode = $xpath->query('//title')->item(0);
        if ($titleNode) {
            return trim($titleNode->textContent);
        }

        // Fallback to h1
        $h1Node = $xpath->query('//h1')->item(0);
        if ($h1Node) {
            return trim($h1Node->textContent);
        }

        return 'Untitled';
    }

    /**
     * Extract main content from the page
     */
    protected function extractMainContent(DOMXPath $xpath): string
    {
        $content = '';

        // Try different content selectors in order of preference
        $contentSelectors = [
            '//article',
            '//main',
            '//div[contains(@class, "content")]',
            '//div[contains(@class, "article")]',
            '//div[contains(@class, "post")]',
            '//div[contains(@id, "content")]',
            '//div[contains(@id, "main")]',
            '//body'
        ];

        foreach ($contentSelectors as $selector) {
            $nodes = $xpath->query($selector);
            if ($nodes->length > 0) {
                $content = $this->extractTextFromNode($nodes->item(0));
                if (strlen($content) > 200) { // Only use if we get substantial content
                    break;
                }
            }
        }

        return $content;
    }

    /**
     * Extract text content from a DOM node
     */
    protected function extractTextFromNode($node): string
    {
        if (!$node) {
            return '';
        }

        // Remove unwanted elements
        $unwantedTags = ['script', 'style', 'nav', 'header', 'footer', 'aside', 'advertisement', 'ads'];
        
        $dom = $node->ownerDocument;
        $xpath = new DOMXPath($dom);

        foreach ($unwantedTags as $tag) {
            $unwantedNodes = $xpath->query('.//' . $tag, $node);
            foreach ($unwantedNodes as $unwantedNode) {
                $unwantedNode->parentNode->removeChild($unwantedNode);
            }
        }

        // Also remove nodes with unwanted classes/ids
        $unwantedSelectors = [
            './/*[contains(@class, "nav")]',
            './/*[contains(@class, "menu")]',
            './/*[contains(@class, "sidebar")]',
            './/*[contains(@class, "footer")]',
            './/*[contains(@class, "header")]',
            './/*[contains(@class, "ad")]',
            './/*[contains(@class, "advertisement")]',
            './/*[contains(@class, "social")]',
            './/*[contains(@class, "share")]',
            './/*[contains(@class, "comment")]'
        ];

        foreach ($unwantedSelectors as $selector) {
            $unwantedNodes = $xpath->query($selector, $node);
            foreach ($unwantedNodes as $unwantedNode) {
                if ($unwantedNode->parentNode) {
                    $unwantedNode->parentNode->removeChild($unwantedNode);
                }
            }
        }

        return trim($node->textContent);
    }

    /**
     * Clean extracted content
     */
    protected function cleanContent(string $content): string
    {
        // Remove extra whitespace
        $content = preg_replace('/\s+/', ' ', $content);
        
        // Remove common unwanted patterns
        $patterns = [
            '/Cookie Policy.*?Accept/i',
            '/Subscribe to.*?newsletter/i',
            '/Follow us on.*?social/i',
            '/Share this.*?article/i',
            '/Related Articles?:?/i',
            '/Advertisement/i',
        ];

        foreach ($patterns as $pattern) {
            $content = preg_replace($pattern, '', $content);
        }

        return trim($content);
    }

    /**
     * Truncate content to fit within limits
     */
    protected function truncateContent(string $content): string
    {
        if (strlen($content) <= $this->maxContentLength) {
            return $content;
        }

        // Try to truncate at sentence boundary
        $truncated = substr($content, 0, $this->maxContentLength);
        $lastPeriod = strrpos($truncated, '.');
        $lastExclamation = strrpos($truncated, '!');
        $lastQuestion = strrpos($truncated, '?');

        $lastSentence = max($lastPeriod, $lastExclamation, $lastQuestion);

        if ($lastSentence !== false && $lastSentence > $this->maxContentLength * 0.8) {
            return substr($content, 0, $lastSentence + 1);
        }

        // Fallback: truncate at word boundary
        $lastSpace = strrpos($truncated, ' ');
        if ($lastSpace !== false) {
            return substr($content, 0, $lastSpace) . '...';
        }

        return $truncated . '...';
    }

    /**
     * Validate URL
     */
    protected function isValidUrl(string $url): bool
    {
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            return false;
        }

        $parsed = parse_url($url);
        if (!isset($parsed['scheme']) || !in_array($parsed['scheme'], ['http', 'https'])) {
            return false;
        }

        // Block potentially dangerous domains
        $blockedDomains = ['localhost', '127.0.0.1', '0.0.0.0'];
        if (isset($parsed['host']) && in_array($parsed['host'], $blockedDomains)) {
            return false;
        }

        return true;
    }

    /**
     * Fetch multiple URLs concurrently
     */
    public function fetchMultipleContents(array $urls): array
    {
        $results = [];
        
        // For now, fetch sequentially to avoid overwhelming servers
        // In the future, this could be optimized with async requests
        foreach ($urls as $url) {
            $results[$url] = $this->fetchContent($url);
            
            // Small delay to be respectful
            usleep(500000); // 0.5 seconds
        }

        return $results;
    }
}
