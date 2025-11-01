<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Message;
use App\Services\LLMService;

class FixMessage24 extends Command
{
    protected $signature = 'fix:message24';
    protected $description = 'Fix message 24 with malformed thinking tags';

    public function handle()
    {
        $message = Message::find(24);
        
        if (!$message) {
            $this->error('Message 24 not found');
            return 1;
        }

        $this->info("Current content: " . $message->content);
        
        // Check if it has opening but no closing tag
        if (strpos($message->content, '<think>') !== false && strpos($message->content, '</think>') === false) {
            $this->info("Found malformed thinking tag - adding closing tag");
            
            // Find where the thinking section ends and the main response begins
            $content = $message->content;
            
            // Look for the pattern where the thinking ends and the response begins
            // In this case, it seems to be after the line "keeping things positive."
            // and before "Hello again!"
            
            $fixed = preg_replace(
                '/(<think>.*?keeping things positive\.)\s*\n\s*\n(Hello again!.*)/s',
                '$1</think>$2', 
                $content
            );
            
            if ($fixed !== $content) {
                $this->info("Fixed content: " . $fixed);
                
                // Now extract thinking properly
                $llmService = new LLMService();
                $extracted = $llmService->extractThinkingContent($fixed);
                
                $message->update([
                    'content' => $extracted['content'],
                    'metadata' => [
                        'thinking' => $extracted['thinking'],
                        'has_thinking' => !is_null($extracted['thinking'])
                    ]
                ]);
                
                $this->info("✓ Fixed message 24 successfully");
            } else {
                $this->error("Could not fix the content automatically");
            }
        }

        return 0;
    }
}