import React, { useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { User, Bot, Clock, ChevronDown, ChevronRight, Brain, Copy, Check, Edit2 } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

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
  onEditMessage?: (messageId: number, newContent: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onEditMessage }) => {
  const isUser = message.sender === 'user';
  const isSystem = message.sender === 'system';
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const hasThinking = message.metadata?.has_thinking && message.metadata?.thinking;
  
  // Get model name from metadata, with fallback to "AI Assistant"
  const getModelName = () => {
    if (message.metadata?.model) {
      // Format model name: remove version tags for display (e.g., "llama2:7b" -> "llama2")
      return message.metadata.model.split(':')[0];
    }
    return 'AI Assistant';
  };

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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleEdit = () => {
    if (onEditMessage && message.id) {
      // This will trigger editing mode in parent
      onEditMessage(message.id, message.content);
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
        <div className="relative group w-auto max-w-full">
          <Card className={`p-4 w-auto max-w-full ${
            isUser 
              ? 'bg-blue/10 border-blue/20' 
              : 'bg-surface1 border-surface2'
          }`}>
            <div className="message-bubble-content">
              <MarkdownRenderer content={message.content} />
            </div>
          </Card>
          
          {/* Action buttons - shown on hover */}
          <div className={`absolute ${isUser ? 'left-2 top-2' : 'right-2 top-2'} opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10`}>
            {!isUser && (
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
            )}
            {isUser && onEditMessage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                className="h-7 w-7 p-0 bg-blue/20 hover:bg-blue/30 border border-blue/30 text-blue"
                title="Edit message"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;

