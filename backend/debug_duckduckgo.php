<?php

require_once __DIR__ . '/vendor/autoload.php';

use Illuminate\Foundation\Application;
use GuzzleHttp\Client;

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== DuckDuckGo Direct Debug ===\n\n";

try {
    // Test direct HTTP request to DuckDuckGo
    echo "1. Testing direct HTTP request to DuckDuckGo...\n";
    
    $client = new Client();
    $url = 'https://html.duckduckgo.com/html/';
    $query = 'Laravel framework';
    
    echo "URL: $url\n";
    echo "Query: $query\n\n";
    
    $response = $client->get($url, [
        'query' => [
            'q' => $query,
            'kl' => 'us-en',
            's' => '0',
            'dc' => '10',
            'v' => 'l',
            'o' => 'json',
            'api' => 'd.js'
        ],
        'headers' => [
            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language' => 'en-US,en;q=0.5',
            'Accept-Encoding' => 'gzip, deflate',
            'DNT' => '1',
            'Connection' => 'keep-alive',
            'Upgrade-Insecure-Requests' => '1',
        ],
        'timeout' => 10,
        'verify' => false,
        'curl' => [
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
        ]
    ]);
    
    $statusCode = $response->getStatusCode();
    $html = $response->getBody()->getContents();
    
    echo "✓ HTTP request successful\n";
    echo "Status Code: $statusCode\n";
    echo "Response Length: " . strlen($html) . " chars\n";
    echo "Content Type: " . $response->getHeaderLine('Content-Type') . "\n\n";
    
    // Check if we got HTML content
    if (strpos($html, '<html') !== false) {
        echo "✓ Received HTML content\n";
        
        // Look for search results
        if (strpos($html, 'result') !== false || strpos($html, 'web-result') !== false) {
            echo "✓ Found potential search results in HTML\n";
            
            // Show a sample of the HTML
            echo "\nFirst 500 chars of HTML:\n";
            echo substr($html, 0, 500) . "...\n\n";
            
            // Try to parse with DOMDocument
            $dom = new DOMDocument();
            libxml_use_internal_errors(true);
            $dom->loadHTML($html);
            libxml_clear_errors();
            
            $xpath = new DOMXPath($dom);
            
            // Try different selectors for DuckDuckGo results
            $selectors = [
                '.result',
                '.web-result',
                '.result__body',
                '.links_main',
                'a[href*="uddg"]',
                '.result-link',
                'h2 a',
                '.result-title a'
            ];
            
            foreach ($selectors as $selector) {
                echo "Trying selector: $selector\n";
                try {
                    // Convert CSS selector to XPath
                    $xpathQuery = '';
                    if (strpos($selector, '.') === 0) {
                        // Class selector
                        $class = substr($selector, 1);
                        $xpathQuery = "//*[contains(@class, '$class')]";
                    } elseif (strpos($selector, 'a[href') === 0) {
                        // Attribute selector
                        $xpathQuery = "//a[contains(@href, 'uddg')]";
                    } else {
                        // Element selector
                        $xpathQuery = "//$selector";
                    }
                    
                    $nodes = $xpath->query($xpathQuery);
                    if ($nodes !== false && $nodes->length > 0) {
                        echo "  ✓ Found " . $nodes->length . " elements\n";
                        
                        // Show first few results
                        for ($i = 0; $i < min(3, $nodes->length); $i++) {
                            $node = $nodes->item($i);
                            echo "  Result $i: " . substr(trim($node->textContent), 0, 100) . "...\n";
                        }
                    } else {
                        echo "  ❌ No elements found\n";
                    }
                } catch (Exception $e) {
                    echo "  ❌ Error: " . $e->getMessage() . "\n";
                }
            }
            
        } else {
            echo "❌ No search results found in HTML\n";
            echo "HTML might be a captcha or error page\n";
            
            // Check for common error indicators
            if (strpos($html, 'captcha') !== false) {
                echo "❌ Detected CAPTCHA in response\n";
            }
            if (strpos($html, 'blocked') !== false) {
                echo "❌ Detected blocking message\n";
            }
            if (strpos($html, 'rate limit') !== false) {
                echo "❌ Detected rate limiting\n";
            }
        }
        
    } else {
        echo "❌ Did not receive HTML content\n";
        echo "Response content: " . substr($html, 0, 200) . "...\n";
    }

} catch (\Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . ":" . $e->getLine() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}

echo "\n=== Debug Complete ===\n";
