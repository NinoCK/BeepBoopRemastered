<?php

return [

    /*
    |--------------------------------------------------------------------------
    | LLM Configuration
    |--------------------------------------------------------------------------
    |
    | This file contains configuration for the Local LLM service integration.
    |
    */

    'endpoint' => env('LLM_ENDPOINT', 'http://localhost:11434/api/generate'),
    'model' => env('LLM_MODEL', 'llama2'),
    'timeout' => env('LLM_TIMEOUT', 120),
    'max_tokens' => env('LLM_MAX_TOKENS', 2048),
    'temperature' => env('LLM_TEMPERATURE', 0.7),
    
    /*
    |--------------------------------------------------------------------------
    | RAG Configuration
    |--------------------------------------------------------------------------
    */
    
    'rag' => [
        'documents_path' => env('RAG_PATH', 'storage/app/documents/'),
        'chunk_size' => env('RAG_CHUNK_SIZE', 1000),
        'overlap_size' => env('RAG_OVERLAP_SIZE', 200),
    ],
    
    /*
    |--------------------------------------------------------------------------
    | Search Configuration
    |--------------------------------------------------------------------------
    */
    
    'search' => [
        'provider' => env('SEARCH_PROVIDER', 'tavily'),
        'api_key' => env('SEARCH_API_KEY'),
        'max_results' => env('SEARCH_MAX_RESULTS', 5),
    ],

];