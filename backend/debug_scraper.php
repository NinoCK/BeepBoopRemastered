<?php

require_once __DIR__ . '/vendor/autoload.php';

use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Log;

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== DuckDuckGo Scraper Debug ===\n\n";

try {
    // Test DuckDuckGoScraper directly
    echo "1. Testing DuckDuckGoScraper directly...\n";
    $scraper = app(\App\Services\DuckDuckGoScraper::class);
    
    $testQuery = "Laravel framework";
    echo "Searching for: '$testQuery'\n";
    
    $results = $scraper->search($testQuery);
    
    if (!empty($results['error'])) {
        echo "❌ Scraper failed: " . $results['error'] . "\n";
    } else {
        echo "✓ Scraper completed successfully\n";
        echo "Results found: " . count($results['results'] ?? []) . "\n";
        echo "Total results: " . ($results['total_results'] ?? 0) . "\n";
        echo "Source: " . ($results['source'] ?? 'unknown') . "\n";
        
        if (!empty($results['results'])) {
            echo "\nFirst few results:\n";
            foreach (array_slice($results['results'], 0, 3) as $i => $result) {
                echo ($i + 1) . ". " . $result['title'] . "\n";
                echo "   URL: " . $result['url'] . "\n";
                echo "   Snippet: " . substr($result['snippet'] ?? '', 0, 100) . "...\n\n";
            }
        }
    }

    // Test WebContentFetcher
    echo "\n2. Testing WebContentFetcher...\n";
    $contentExtractor = app(\App\Services\ContentExtractor::class);
    $fetcher = new \App\Services\WebContentFetcher($contentExtractor);
    
    $testUrl = "https://laravel.com";
    echo "Fetching content from: $testUrl\n";
    
    $content = $fetcher->fetchContent($testUrl);
    
    if (!empty($content['error'])) {
        echo "❌ Content fetcher failed: " . $content['error'] . "\n";
    } else {
        echo "✓ Content fetched successfully\n";
        echo "Title: " . $content['title'] . "\n";
        echo "Content length: " . strlen($content['content']) . " chars\n";
        echo "Word count: " . $content['word_count'] . "\n";
        echo "First 200 chars: " . substr($content['content'], 0, 200) . "...\n";
    }

    // Test ContentExtractor
    echo "\n3. Testing ContentExtractor...\n";
    $extractor = app(\App\Services\ContentExtractor::class);
    
    $testHtml = '<html><head><title>Test Page</title></head><body><h1>Main Content</h1><p>This is the main content of the page.</p><script>alert("ads");</script></body></html>';
    echo "Extracting content from sample HTML...\n";
    
    $extracted = $extractor->extractContent($testHtml);
    echo "✓ Content extracted successfully\n";
    echo "Title: " . $extracted['title'] . "\n";
    echo "Content: " . $extracted['content'] . "\n";
    echo "Method: " . $extracted['method'] . "\n";

} catch (\Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . ":" . $e->getLine() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}

echo "\n=== Debug Complete ===\n";
