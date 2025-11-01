<?php

require_once __DIR__ . '/vendor/autoload.php';

use GuzzleHttp\Client;

echo "=== DuckDuckGo Content Analysis ===\n\n";

try {
    $client = new Client();
    $url = 'https://html.duckduckgo.com/html/';
    $query = 'Laravel framework';
    
    $response = $client->get($url, [
        'query' => [
            'q' => $query,
        ],
        'headers' => [
            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        ],
        'timeout' => 10,
        'verify' => false,
        'curl' => [
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
        ]
    ]);
    
    $html = $response->getBody()->getContents();
    
    echo "Response HTML:\n";
    echo "=================\n";
    echo $html;
    echo "\n=================\n";

} catch (\Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}

echo "\n=== Analysis Complete ===\n";
