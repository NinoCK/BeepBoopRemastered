import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Bot, Brain, ChevronDown, ChevronRight, Loader2, Copy, Check } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface StreamingMessageProps {
  thinkingContent: string;
  mainContent: string;
  isThinking: boolean;
  isComplete: boolean;
  modelName?: string;
}

const StreamingMessageBubble: React.FC<StreamingMessageProps> = ({
  thinkingContent,
  mainContent,
  isThinking,
  isComplete,
  modelName = 'AI Assistant'
}) => {
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [displayedThinking, setDisplayedThinking] = useState('');
  const [displayedContent, setDisplayedContent] = useState('');
  const [copied, setCopied] = useState(false);

  // Show thinking content immediately as it comes in during thinking
  useEffect(() => {
    if (isThinking) {
      setDisplayedThinking(thinkingContent);
    } else if (thinkingContent.length > displayedThinking.length) {
      // Typing effect for completed thinking content
      const timer = setTimeout(() => {
        setDisplayedThinking(thinkingContent.slice(0, displayedThinking.length + 2));
      }, 15);
      return () => clearTimeout(timer);
    }
  }, [thinkingContent, displayedThinking, isThinking]);

  // Show main content immediately as it streams in
  useEffect(() => {
    if (!isThinking) {
      setDisplayedContent(mainContent);
    }
  }, [mainContent, isThinking]);

  const formatTime = () => {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const hasThinking = thinkingContent.length > 0;
  
  // Format model name: remove version tags for display (e.g., "llama2:7b" -> "llama2")
  const formattedModelName = modelName.includes(':') ? modelName.split(':')[0] : modelName;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="flex justify-start mb-6 streaming-message">
      <div className="flex flex-col items-start max-w-[75%] w-auto">
        {/* Header with icon and metadata */}
        <div className="flex items-center mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full flex-shrink-0 bg-accent text-white">
              <Bot className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-subtext1 whitespace-nowrap">
              {formattedModelName}
            </span>
            <span className="text-xs text-subtext0 whitespace-nowrap">
              {formatTime()}
            </span>
          </div>
        </div>
        
        {/* Thinking Panel - compact and independent */}
        {hasThinking && (
          <div className="mb-3 max-w-full">
            <Card className={`thinking-panel overflow-hidden transition-all duration-300 ${
              isThinkingExpanded ? 'w-auto max-w-full' : 'w-fit max-w-[min(300px,100%)] min-w-[200px]'
            }`}>
              <Button
                variant="ghost"
                onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                className="thinking-header w-full justify-between px-3 py-2 h-auto hover:bg-surface1 flex-shrink-0"
              >
                <div className="flex items-center space-x-2">
                  <Brain className={`w-4 h-4 text-accent ${isThinking ? 'brain-thinking' : ''}`} />
                  <span className="text-sm font-medium text-subtext1">
                    {isThinking ? `Model is thinking...` : `Model thought process`}
                  </span>
                  {isThinking && (
                    <Loader2 className="w-3 h-3 animate-spin text-accent" />
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-subtext1 thinking-expand-arrow ${isThinkingExpanded ? 'rotate-180' : ''}`} />
              </Button>
              
              <div className={`thinking-panel-content ${isThinkingExpanded ? 'expanded' : 'collapsed'}`}>
                <div className="px-3 pb-3">
                  <div className="border-t border-surface2 pt-3">
                    <div className="thinking-content p-3">
                      <div className="whitespace-pre-wrap break-words text-xs">
                        {displayedThinking}
                        {isThinking && displayedThinking === thinkingContent && (
                          <span className="thinking-cursor" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Main Message Content - constrained width */}
        {(mainContent.length > 0 || !isThinking) && (
          <div className="relative group w-auto max-w-full">
            <Card className="p-4 bg-surface1 border-surface2 w-auto max-w-full">
              <div className="message-bubble-content">
                <MarkdownRenderer content={displayedContent} />
                {!isComplete && !isThinking && displayedContent.length > 0 && (
                  <span className="inline-block w-2 h-4 bg-accent ml-1 animate-pulse" />
                )}
              </div>
            </Card>
            
            {/* Copy button - shown on hover and when content is available */}
            {displayedContent.length > 0 && (
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-7 w-7 p-0 bg-surface2/90 hover:bg-surface2 border border-surface2 text-text hover:text-accent"
                  title="Copy response"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Loading indicator when thinking and no content yet */}
        {isThinking && mainContent.length === 0 && (
          <Card className="p-4 bg-surface1 border-surface2 w-auto">
            <div className="flex items-center space-x-2 text-subtext1">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse delay-75"></div>
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse delay-150"></div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StreamingMessageBubble;