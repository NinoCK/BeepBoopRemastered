<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Message;
use App\Services\LLMService;

class FixThinkingMessages extends Command
{
    protected $signature = 'fix:thinking-messages';
    protected $description = 'Fix messages with thinking content that was not properly extracted';

    public function handle()
    {
        $llmService = new LLMService();
        
        // Find messages that contain <think> tags but don't have thinking metadata
        $problematicMessages = Message::where('sender', 'assistant')
            ->where('content', 'like', '%<think>%')
            ->get();

        $this->info("Found {$problematicMessages->count()} messages with thinking content to fix.");

        foreach ($problematicMessages as $message) {
            $this->info("Fixing message ID: {$message->id}");
            
            $extracted = $llmService->extractThinkingContent($message->content);
            
            $message->update([
                'content' => $extracted['content'],
                'metadata' => [
                    'thinking' => $extracted['thinking'],
                    'has_thinking' => !is_null($extracted['thinking'])
                ]
            ]);
            
            $this->info("✓ Fixed message {$message->id}");
        }

        $this->info("All thinking messages have been fixed!");
        return 0;
    }
}