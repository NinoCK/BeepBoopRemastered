<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\SearchService;

class TestSearch extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'test:search {query}';

    /**
     * The console command description.
     */
    protected $description = 'Test the search functionality';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $query = $this->argument('query');
        $searchService = new SearchService();
        
        $this->info("Testing search for: {$query}");
        $this->info("Provider: " . config('llm.search.provider'));
        
        $results = $searchService->search($query);
        
        if (!empty($results['error'])) {
            $this->error("Error: " . $results['error']);
            return 1;
        }
        
        $this->info("Found " . count($results['results']) . " results:");
        
        foreach ($results['results'] as $index => $result) {
            $this->line("");
            $this->line("Result " . ($index + 1) . ":");
            $this->line("Title: " . $result['title']);
            $this->line("URL: " . $result['url']);
            $this->line("Content: " . substr($result['content'], 0, 200) . "...");
            if (isset($result['has_full_content'])) {
                $this->line("Full content: " . ($result['has_full_content'] ? 'Yes' : 'No'));
            }
        }
        
        return 0;
    }
}
