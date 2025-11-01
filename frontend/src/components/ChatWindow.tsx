import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import MessageBubble from './MessageBubble';
import StreamingMessageBubble from './StreamingMessageBubble';
import { Send, Loader2, FileText, Search, Brain } from 'lucide-react';
import api from '../lib/api';

interface Message {
  id: number;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  sent_at: string;
  metadata?: {
    thinking?: string;
    has_thinking?: boolean;
    [key: string]: any;
  };
}

interface Chat {
  id: number;
  title: string;
  messages: Message[];
}

interface ChatWindowProps {
  chatId?: number;
  onMessagesUpdate?: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chatId, onMessagesUpdate }) => {
  const { id } = useParams();
  const currentChatId = chatId || (id ? parseInt(id) : null);
  
  const [chat, setChat] = useState<Chat | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingThinking, setStreamingThinking] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    // Use a small timeout to ensure the DOM is updated
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat?.messages]);

  useEffect(() => {
    if (currentChatId && currentChatId.toString() !== 'new') {
      fetchChat();
    }
  }, [currentChatId]);

  // Messages loaded successfully

  const fetchChat = async () => {
    if (!currentChatId) return;
    
    try {
      setInitialLoading(true);
      const response = await api.get(`/chat/${currentChatId}`);
      setChat(response.data);
    } catch (error) {
      console.error('Failed to fetch chat:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentChatId || loading || isStreaming) return;

    const userMessage = input.trim();
    setInput('');
    setIsStreaming(true);
    setStreamingThinking('');
    setStreamingContent('');
    setIsThinking(false);

    // Add user message to chat immediately
    const tempUserMessage = {
      id: Date.now(),
      sender: 'user' as const,
      content: userMessage,
      sent_at: new Date().toISOString(),
    };

    setChat(prevChat => {
      if (!prevChat) return null;
      return {
        ...prevChat,
        messages: [...prevChat.messages, tempUserMessage]
      };
    });

    try {
      const response = await fetch(`${api.defaults.baseURL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          message: userMessage,
          chat_id: currentChatId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          setIsStreaming(false);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'thinking_start':
                  setIsThinking(true);
                  break;
                  
                case 'thinking':
                  setStreamingThinking(prev => prev + data.content);
                  break;
                  
                case 'thinking_end':
                  setIsThinking(false);
                  break;
                  
                case 'content':
                  setStreamingContent(prev => prev + data.content);
                  break;
                  
                case 'complete':
                  // Update with final messages from server
                  setChat(prevChat => {
                    if (!prevChat) return null;
                    
                    // Remove temp user message and add official messages
                    const messagesWithoutTemp = prevChat.messages.filter(m => m.id !== tempUserMessage.id);
                    return {
                      ...prevChat,
                      messages: [
                        ...messagesWithoutTemp,
                        data.user_message,
                        data.assistant_message
                      ]
                    };
                  });
                  
                  setIsStreaming(false);
                  setStreamingThinking('');
                  setStreamingContent('');
                  onMessagesUpdate?.();
                  return; // Exit the loop
                  
                case 'error':
                  console.error('Streaming error:', data.error);
                  setIsStreaming(false);
                  return; // Exit the loop
              }
            } catch (parseError) {
              console.error('Failed to parse streaming data:', parseError);
            }
          }
        }
      }

    } catch (error) {
      console.error('Failed to start streaming:', error);
      setIsStreaming(false);
      
      // Fallback to regular API call
      handleFallbackMessage(userMessage, currentChatId, tempUserMessage);
    }
  };

  // Fallback function for when streaming fails
  const handleFallbackMessage = async (userMessage: string, chatId: number, tempUserMessage: any) => {
    try {
      // Using fallback API call
      setLoading(true);
      const response = await api.post('/chat', {
        message: userMessage,
        chat_id: chatId
      });

      // Fallback response received

      setChat(prevChat => {
        if (!prevChat) return null;
        
        // Remove temp user message and add official messages
        const messagesWithoutTemp = prevChat.messages.filter(m => m.id !== tempUserMessage.id);
        return {
          ...prevChat,
          messages: [
            ...messagesWithoutTemp,
            response.data.user_message,
            response.data.assistant_message
          ]
        };
      });      onMessagesUpdate?.();
    } catch (error) {
      console.error('Fallback message failed:', error);
      setInput(userMessage); // Restore input
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };

  if (initialLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-surface0 overflow-hidden">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-accent" />
          <p className="text-subtext1">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (!currentChatId) {
    return (
      <div className="h-full flex items-center justify-center bg-surface0 overflow-hidden">
        <div className="text-center max-w-md p-4">
          <div className="mb-6">
            <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-2xl font-bold text-text mb-2">
              Welcome to Personal AI Assistant
            </h2>
            <p className="text-subtext1">
              Start a new conversation or select an existing chat from the sidebar.
            </p>
          </div>
          
          <div className="space-y-4 text-left">
            <Card className="p-4 bg-surface1 border-surface2">
              <h3 className="font-semibold text-text mb-2">Features:</h3>
              <ul className="text-sm text-subtext1 space-y-1">
                <li>• Chat with local AI models</li>
                <li>• Document-based Q&A (RAG)</li>
                <li>• Web search integration</li>
                <li>• Real-time terminal logs</li>
                <li className="flex items-center">
                  • AI thinking process visualization
                  <Brain className="w-3 h-3 ml-1 text-accent" />
                </li>
              </ul>
            </Card>
            
            <Card className="p-4 bg-accent/5 border-accent/20">
              <h3 className="font-semibold text-accent mb-2 flex items-center">
                <Brain className="w-4 h-4 mr-2" />
                AI Thinking Feature
              </h3>
              <p className="text-sm text-subtext1 mb-2">
                This AI assistant supports models with thinking capabilities (like DeepSeek R1).
              </p>
              <ul className="text-xs text-subtext0 space-y-1">
                <li>• Watch AI think in real-time as it processes your questions</li>
                <li>• Expand thinking panels to see the reasoning process</li>
                <li>• Thinking content appears in <code className="bg-surface2 px-1 rounded">&lt;think&gt;</code> tags</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-surface0 overflow-hidden">
      {/* Chat Header */}
      {chat && (
        <div className="flex-shrink-0 p-4 border-b border-surface2 bg-surface1">
          <h2 className="text-lg font-semibold text-text truncate">
            {chat.title}
          </h2>
          <p className="text-sm text-subtext1">
            {chat.messages.length} messages
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {chat?.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            
            {/* Streaming Message */}
            {isStreaming && (
              <StreamingMessageBubble
                thinkingContent={streamingThinking}
                mainContent={streamingContent}
                isThinking={isThinking}
                isComplete={false}
              />
            )}
            
            {/* Fallback Loading */}
            {loading && !isStreaming && (
              <div className="flex justify-start mb-6">
                <div className="max-w-[80%] mr-12">
                  <div className="flex items-center mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 rounded-full bg-accent text-white">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                      <span className="text-sm font-medium text-subtext1">
                        AI Assistant is thinking...
                      </span>
                    </div>
                  </div>
                  <Card className="p-4 bg-surface1 border-surface2">
                    <div className="flex items-center space-x-2 text-subtext1">
                      <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-accent rounded-full animate-pulse delay-75"></div>
                      <div className="w-2 h-2 bg-accent rounded-full animate-pulse delay-150"></div>
                    </div>
                  </Card>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-surface2 bg-surface1">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message... (Press Enter to send)"
            className="flex-1 bg-surface0 border-surface2 text-text placeholder:text-subtext0"
            disabled={loading || isStreaming}
          />
          <Button 
            type="submit" 
            disabled={!input.trim() || loading || isStreaming}
            className="bg-accent hover:bg-accent/80 text-white"
          >
            {(loading || isStreaming) ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
        
        <div className="flex items-center justify-between mt-2 text-xs text-subtext0">
          <span>Press Shift+Enter for new line</span>
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <FileText className="w-3 h-3 mr-1" />
              RAG enabled
            </span>
            <span className="flex items-center">
              <Search className="w-3 h-3 mr-1" />
              Web search available
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;