import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import MessageBubble from './MessageBubble';
import StreamingMessageBubble from './StreamingMessageBubble';
import RAGDocumentsPanel from './RAGDocumentsPanel';
import { Send, Loader2, FileText, Search, Brain, X, Edit2 } from 'lucide-react';
import api from '../lib/api';
import { useAppLogging } from '../contexts/AppLoggingContext';

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
  const { addLog } = useAppLogging();
  
  const [chat, setChat] = useState<Chat | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingThinking, setStreamingThinking] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [ragPanelOpen, setRagPanelOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const generationStartTimeRef = useRef<number | null>(null);
  const currentModelRef = useRef<string | null>(null);

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
      addLog({
        level: 'info',
        category: 'ui',
        message: `Chat selected: ${currentChatId}`,
        source: 'ChatWindow',
        context: { chatId: currentChatId }
      });
      fetchChat();
    } else if (!currentChatId) {
      // No chat selected, show welcome message immediately
      setInitialLoading(false);
    }
  }, [currentChatId, addLog]);

  // Messages loaded successfully

  const fetchChat = async () => {
    if (!currentChatId) return;
    
    try {
      setInitialLoading(true);
      addLog({
        level: 'info',
        category: 'api',
        message: `Fetching chat: ${currentChatId}`,
        source: 'ChatWindow',
        context: { chatId: currentChatId }
      });
      const response = await api.get(`/chat/${currentChatId}`);
      setChat(response.data);
      addLog({
        level: 'success',
        category: 'api',
        message: `Chat loaded: ${response.data.title || `Chat ${currentChatId}`} (${response.data.messages.length} messages)`,
        source: 'ChatWindow',
        context: { chatId: currentChatId, messageCount: response.data.messages.length }
      });
    } catch (error) {
      console.error('Failed to fetch chat:', error);
      addLog({
        level: 'error',
        category: 'api',
        message: `Failed to fetch chat: ${currentChatId}`,
        source: 'ChatWindow',
        context: { chatId: currentChatId, error: error instanceof Error ? error.message : 'Unknown error' }
      });
    } finally {
      setInitialLoading(false);
    }
  };

  const handleEditMessage = (messageId: number, currentContent: string) => {
    // Just set the input for editing - don't delete anything yet
    setInput(currentContent);
    setEditingMessageId(messageId);
    
    addLog({
      level: 'info',
      category: 'ui',
      message: `Starting to edit message ${messageId}`,
      source: 'ChatWindow',
      context: { messageId }
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentChatId || loading || isStreaming) return;

    const userMessage = input.trim();
    const isEditing = editingMessageId !== null;
    const messageIdToEdit = editingMessageId;
    
    setInput('');
    setEditingMessageId(null);
    setIsStreaming(true);
    setStreamingThinking('');
    setStreamingContent('');
    setIsThinking(false);
    
    addLog({
      level: 'info',
      category: 'ui',
      message: `${isEditing ? 'Editing' : 'User'} message sent: ${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}`,
      source: 'ChatWindow',
      context: { chatId: currentChatId, messageLength: userMessage.length, isEditing, messageIdToEdit }
    });

    // Add user message to chat immediately
    const tempUserMessage = {
      id: Date.now(),
      sender: 'user' as const,
      content: userMessage,
      sent_at: new Date().toISOString(),
    };

    setChat(prevChat => {
      if (!prevChat) return null;
      
      if (isEditing && messageIdToEdit) {
        // When editing, remove all messages after the edited one and replace it
        const messageIndex = prevChat.messages.findIndex(m => m.id === messageIdToEdit);
        if (messageIndex === -1) {
          // Message not found, just add as new
          return {
            ...prevChat,
            messages: [...prevChat.messages, tempUserMessage]
          };
        }
        
        const deletedCount = prevChat.messages.length - messageIndex - 1;
        addLog({
          level: 'info',
          category: 'ui',
          message: `Removed ${deletedCount} messages after edited message`,
          source: 'ChatWindow',
          context: { messageIdToEdit, messageIndex, deletedCount }
        });
        
        // Remove everything after the edited message, and add the new temp message
        return {
          ...prevChat,
          messages: [...prevChat.messages.slice(0, messageIndex), tempUserMessage]
        };
      } else {
        // Normal new message
        return {
          ...prevChat,
          messages: [...prevChat.messages, tempUserMessage]
        };
      }
    });

    try {
      // Fetch current model before starting generation
      let currentModel = 'unknown';
      try {
        const modelResponse = await api.get('/models/current');
        if (modelResponse.data.success) {
          currentModel = modelResponse.data.model;
          currentModelRef.current = currentModel;
          setCurrentModel(currentModel);
        }
      } catch (modelError) {
        console.warn('Failed to fetch current model:', modelError);
      }
      
      // Track generation start time
      generationStartTimeRef.current = Date.now();
      
      addLog({
        level: 'info',
        category: 'api',
        message: `Starting streaming request for chat: ${currentChatId}`,
        source: 'ChatWindow',
        context: { chatId: currentChatId, messageLength: userMessage.length }
      });
      
      // Log model generation start
      addLog({
        level: 'info',
        category: 'model',
        message: `Model generation started: ${currentModel}`,
        source: 'ChatWindow',
        context: { model: currentModel, chatId: currentChatId }
      });
      
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
      
      addLog({
        level: 'success',
        category: 'api',
        message: `Streaming connection established for chat: ${currentChatId}`,
        source: 'ChatWindow',
        context: { chatId: currentChatId, status: response.status }
      });

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
                  // Calculate generation time
                  const generationEndTime = Date.now();
                  const generationTime = generationStartTimeRef.current 
                    ? generationEndTime - generationStartTimeRef.current 
                    : null;
                  const generationTimeSeconds = generationTime ? (generationTime / 1000).toFixed(2) : null;
                  const modelName = currentModelRef.current || 'unknown';
                  
                  // Log model generation completion
                  if (generationTimeSeconds) {
                    addLog({
                      level: 'success',
                      category: 'model',
                      message: `Model generation completed: ${modelName} (${generationTimeSeconds}s)`,
                      source: 'ChatWindow',
                      context: { 
                        model: modelName, 
                        chatId: currentChatId,
                        generationTime: `${generationTimeSeconds}s`,
                        generationTimeMs: generationTime
                      }
                    });
                  }
                  
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
                  generationStartTimeRef.current = null;
                  currentModelRef.current = null;
                  
                  addLog({
                    level: 'success',
                    category: 'api',
                    message: `Streaming complete for chat: ${currentChatId}`,
                    source: 'ChatWindow',
                    context: { chatId: currentChatId }
                  });
                  
                  addLog({
                    level: 'debug',
                    category: 'ui',
                    message: 'Messages updated after streaming',
                    source: 'ChatWindow',
                    context: { chatId: currentChatId }
                  });
                  
                  onMessagesUpdate?.();
                  return; // Exit the loop
                  
                case 'error':
                  console.error('Streaming error:', data.error);
                  addLog({
                    level: 'error',
                    category: 'api',
                    message: `Streaming error for chat: ${currentChatId} - ${data.error}`,
                    source: 'ChatWindow',
                    context: { chatId: currentChatId, error: data.error }
                  });
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
      
      // Reset generation tracking on error
      generationStartTimeRef.current = null;
      currentModelRef.current = null;
      
      addLog({
        level: 'error',
        category: 'api',
        message: `Failed to start streaming for chat: ${currentChatId}`,
        source: 'ChatWindow',
        context: { chatId: currentChatId, error: error instanceof Error ? error.message : 'Unknown error' }
      });
      
      addLog({
        level: 'error',
        category: 'model',
        message: `Model generation failed to start`,
        source: 'ChatWindow',
        context: { chatId: currentChatId, error: error instanceof Error ? error.message : 'Unknown error' }
      });
      
      setIsStreaming(false);
      
      // Fallback to regular API call
      handleFallbackMessage(userMessage, currentChatId, tempUserMessage);
    }
  };

  // Fallback function for when streaming fails
  const handleFallbackMessage = async (userMessage: string, chatId: number, tempUserMessage: any) => {
    // Fetch current model and track generation time for fallback
    let currentModel = 'unknown';
    try {
      const modelResponse = await api.get('/models/current');
      if (modelResponse.data.success) {
        currentModel = modelResponse.data.model;
        setCurrentModel(currentModel);
      }
    } catch (modelError) {
      console.warn('Failed to fetch current model:', modelError);
    }
    
    const fallbackStartTime = Date.now();
    
    addLog({
      level: 'info',
      category: 'model',
      message: `Model generation started (fallback): ${currentModel}`,
      source: 'ChatWindow',
      context: { model: currentModel, chatId: chatId }
    });
    
    try {
      // Using fallback API call
      setLoading(true);
      const response = await api.post('/chat', {
        message: userMessage,
        chat_id: chatId
      });

      // Calculate generation time for fallback
      const fallbackEndTime = Date.now();
      const fallbackGenerationTime = ((fallbackEndTime - fallbackStartTime) / 1000).toFixed(2);
      
      addLog({
        level: 'success',
        category: 'model',
        message: `Model generation completed (fallback): ${currentModel} (${fallbackGenerationTime}s)`,
        source: 'ChatWindow',
        context: { 
          model: currentModel, 
          chatId: chatId,
          generationTime: `${fallbackGenerationTime}s`,
          generationTimeMs: fallbackEndTime - fallbackStartTime
        }
      });

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
      });
      onMessagesUpdate?.();
    } catch (error) {
      console.error('Fallback message failed:', error);
      addLog({
        level: 'error',
        category: 'model',
        message: `Model generation failed (fallback): ${currentModel}`,
        source: 'ChatWindow',
        context: { model: currentModel, chatId: chatId, error: error instanceof Error ? error.message : 'Unknown error' }
      });
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
              <MessageBubble 
                key={message.id} 
                message={message} 
                onEditMessage={handleEditMessage}
              />
            ))}
            
            {/* Streaming Message */}
            {isStreaming && (
              <StreamingMessageBubble
                thinkingContent={streamingThinking}
                mainContent={streamingContent}
                isThinking={isThinking}
                isComplete={false}
                modelName={currentModel || undefined}
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
                        {`Model is thinking...`}
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
        {editingMessageId && (
          <div className="mb-2 p-2 bg-yellow/10 border border-yellow/20 rounded-md flex items-center justify-between">
            <span className="text-sm text-yellow flex items-center">
              <Edit2 className="w-3 h-3 mr-1" />
              Editing message
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingMessageId(null);
                setInput('');
              }}
              className="h-6 w-6 p-0 hover:bg-yellow/20 text-yellow"
              title="Cancel editing"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
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
            <Button
              data-rag-button
              variant="ghost"
              size="sm"
              onClick={() => setRagPanelOpen(!ragPanelOpen)}
              className="h-auto py-1 px-2 text-xs hover:bg-surface2 flex items-center"
            >
              <FileText className="w-3 h-3 mr-1" />
              RAG Documents
              {ragPanelOpen && <span className="ml-1">↑</span>}
            </Button>
            <span className="flex items-center">
              <Search className="w-3 h-3 mr-1" />
              Web search available
            </span>
          </div>
        </div>
      </div>

      {/* RAG Documents Panel */}
      <RAGDocumentsPanel 
        isOpen={ragPanelOpen} 
        onClose={() => setRagPanelOpen(false)} 
      />
    </div>
  );
};

export default ChatWindow;