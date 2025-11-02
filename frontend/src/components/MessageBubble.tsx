import React, { useState, useMemo } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { User, Bot, Clock, ChevronDown, ChevronRight, Brain } from 'lucide-react';
import CodeBlock from './CodeBlock';
import { parseCodeBlocks } from '../utils/parseCodeBlocks';

interface Message {
  id?: number;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  sent_at: string;
  metadata?: {
    thinking?: string;
    has_thinking?: boolean;
    [key: string]: any;
  };
}

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.sender === 'user';
  const isSystem = message.sender === 'system';
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  
  const hasThinking = message.metadata?.has_thinking && message.metadata?.thinking;
  
  // Get model name from metadata, with fallback to "AI Assistant"
  const getModelName = () => {
    if (message.metadata?.model) {
      // Format model name: remove version tags for display (e.g., "llama2:7b" -> "llama2")
      return message.metadata.model.split(':')[0];
    }
    return 'AI Assistant';
  };

  // Parse message content for code blocks
  const messageSegments = useMemo(() => {
    return parseCodeBlocks(message.content);
  }, [message.content]);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSenderIcon = () => {
    switch (message.sender) {
      case 'user':
        return <User className="w-4 h-4" />;
      case 'assistant':
        return <Bot className="w-4 h-4" />;
      case 'system':
        return <Clock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getSenderColor = () => {
    switch (message.sender) {
      case 'user':
        return 'bg-blue text-white';
      case 'assistant':
        return 'bg-accent text-white';
      case 'system':
        return 'bg-yellow text-base';
      default:
        return 'bg-surface2 text-text';
    }
  };

  if (isSystem) {
    return (
      <div className="flex justify-center mb-4">
        <Badge variant="secondary" className="bg-yellow/20 text-yellow border-yellow/30">
          <Clock className="w-3 h-3 mr-1" />
          {message.content}
        </Badge>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%] w-auto`}>
        {/* Header with icon and metadata */}
        <div className={`flex items-center mb-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`flex items-center gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`p-1.5 rounded-full flex-shrink-0 ${getSenderColor()}`}>
              {getSenderIcon()}
            </div>
            <span className="text-sm font-medium text-subtext1 whitespace-nowrap">
              {isUser ? 'You' : getModelName()}
            </span>
            <span className="text-xs text-subtext0 whitespace-nowrap">
              {formatTime(message.sent_at)}
            </span>
          </div>
        </div>
        
        {/* Thinking Panel (only for assistant messages) - compact and independent */}
        {!isUser && hasThinking && (
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
                  <Brain className="w-4 h-4 text-accent" />
                  <span className="text-sm font-medium text-subtext1">
                    AI thought process
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-subtext1 thinking-expand-arrow ${isThinkingExpanded ? 'rotate-180' : ''}`} />
              </Button>
              
              <div className={`thinking-panel-content ${isThinkingExpanded ? 'expanded' : 'collapsed'}`}>
                <div className="px-3 pb-3">
                  <div className="border-t border-surface2 pt-3">
                    <div className="thinking-content p-3">
                      <div className="whitespace-pre-wrap break-words text-xs">
                        {message.metadata?.thinking}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Main Message Content - constrained width */}
        <Card className={`p-4 w-auto max-w-full ${
          isUser 
            ? 'bg-blue/10 border-blue/20' 
            : 'bg-surface1 border-surface2'
        }`}>
          <div className="prose prose-sm max-w-none text-text message-bubble-content">
            {messageSegments.map((segment, index) => {
              if (segment.type === 'code') {
                return (
                  <CodeBlock
                    key={`code-${index}`}
                    code={segment.code}
                    language={segment.language}
                  />
                );
              } else {
                return (
                  <p key={`text-${index}`} className="whitespace-pre-wrap break-words m-0 mb-2 last:mb-0">
                    {segment.content}
                  </p>
                );
              }
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MessageBubble;

