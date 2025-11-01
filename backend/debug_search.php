<?php

require_once __DIR__ . '/vendor/autoload.php';

use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Log;

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== SearchService Debug Script ===\n\n";

try {
    // Test SearchService instantiation
    echo "1. Testing SearchService instantiation...\n";
    $searchService = app(\App\Services\SearchService::class);
    echo "✓ SearchService created successfully\n\n";

    // Test configuration
    echo "2. Testing configuration...\n";
    $status = $searchService->getStatus();
    echo "Provider: " . $status['provider'] . "\n";
    echo "Configured: " . ($status['configured'] ? 'Yes' : 'No') . "\n";
    echo "Fetch Content: " . ($status['fetch_content'] ? 'Yes' : 'No') . "\n";
    echo "Max Results: " . $status['max_results'] . "\n\n";

    // Test DuckDuckGoScraper
    echo "3. Testing DuckDuckGoScraper...\n";
    $scraper = app(\App\Services\DuckDuckGoScraper::class);
    echo "✓ DuckDuckGoScraper created successfully\n";
    
    $scraperStats = $scraper->getStats();
    echo "Rate limit: " . $scraperStats['rate_limit'] . " requests per " . $scraperStats['time_window'] . "\n";
    echo "Current requests: " . $scraperStats['requests_made'] . "\n\n";

    // Test WebContentFetcher
    echo "4. Testing WebContentFetcher...\n";
    $contentExtractor = app(\App\Services\ContentExtractor::class);
    $fetcher = app(\App\Services\WebContentFetcher::class);
    echo "✓ WebContentFetcher created successfully\n";
    
    $fetcherStats = $fetcher->getStats();
    echo "Max content length: " . $fetcherStats['max_content_length'] . "\n";
    echo "Timeout: " . $fetcherStats['timeout'] . "s\n\n";

    // Test a simple search
    echo "5. Testing simple search...\n";
    $testQuery = "Laravel framework";
    echo "Searching for: '$testQuery'\n";
    
    $results = $searchService->search($testQuery);
    
    if (!empty($results['error'])) {
        echo "❌ Search failed: " . $results['error'] . "\n";
    } else {
        echo "✓ Search completed successfully\n";
        echo "Results found: " . count($results['results'] ?? []) . "\n";
        echo "Source: " . ($results['source'] ?? 'unknown') . "\n";
        
        if (!empty($results['results'])) {
            echo "First result: " . $results['results'][0]['title'] . "\n";
            echo "URL: " . $results['results'][0]['url'] . "\n";
        }
    }

} catch (\Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . ":" . $e->getLine() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}

echo "\n=== Debug Complete ===\n";
