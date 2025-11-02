import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { MessageSquare, Trash2, Clock, X } from 'lucide-react';
import api from '../lib/api';
import { useAppLogging } from '../contexts/AppLoggingContext';

interface Chat {
  id: number;
  title: string;
  updated_at: string;
  latest_message?: {
    content: string;
    sender: string;
  };
}

interface ChatSidebarProps {
  onNewChat?: () => void;
  refreshTrigger?: number;
  onClose?: () => void;
  isMobile?: boolean;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ 
  onNewChat, 
  refreshTrigger = 0, 
  onClose, 
  isMobile = false 
}) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const { id: activeId } = useParams();
  const { addLog } = useAppLogging();

  const fetchChats = async () => {
    try {
      addLog({
        level: 'info',
        category: 'ui',
        message: 'Fetching chat list',
        source: 'ChatSidebar'
      });
      const response = await api.get('/chat');
      setChats(response.data);
      addLog({
        level: 'success',
        category: 'ui',
        message: `Chat list loaded: ${response.data.length} chat(s)`,
        source: 'ChatSidebar',
        context: { count: response.data.length }
      });
    } catch (error) {
      console.error('Failed to fetch chats:', error);
      addLog({
        level: 'error',
        category: 'ui',
        message: 'Failed to fetch chat list',
        source: 'ChatSidebar',
        context: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  const deleteChat = async (chatId: number, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (confirm('Are you sure you want to delete this chat?')) {
      addLog({
        level: 'warning',
        category: 'ui',
        message: `Deleting chat: ${chatId}`,
        source: 'ChatSidebar',
        context: { chatId }
      });
      try {
        await api.delete(`/chat/${chatId}`);
        setChats(chats.filter(chat => chat.id !== chatId));
        addLog({
          level: 'success',
          category: 'ui',
          message: `Chat deleted: ${chatId}`,
          source: 'ChatSidebar',
          context: { chatId }
        });
      } catch (error) {
        console.error('Failed to delete chat:', error);
        addLog({
          level: 'error',
          category: 'ui',
          message: `Failed to delete chat: ${chatId}`,
          source: 'ChatSidebar',
          context: { chatId, error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="w-64 sidebar p-4">
        <div className="text-center text-subtext1">Loading chats...</div>
      </div>
    );
  }

  return (
    <div className="sidebar-resizable flex flex-col relative min-w-[240px] max-w-[350px] w-64 md:resize-x overflow-auto bg-surface0 border-r border-surface2 h-full">
      <div className="p-4 border-b border-surface2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-text">Chat History</h2>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-surface2 text-subtext1">
              {chats.length}
            </Badge>
            {isMobile && onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-subtext1 hover:text-text hover:bg-surface2 p-1 h-auto"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        <Button
          onClick={() => {
            console.log('Sidebar New Chat button clicked');
            addLog({
              level: 'info',
              category: 'ui',
              message: 'New chat button clicked from sidebar',
              source: 'ChatSidebar'
            });
            if (onNewChat) {
              onNewChat();
            } else {
              console.error('onNewChat function not provided to ChatSidebar');
            }
          }}
          className="w-full bg-accent hover:bg-accent/80 text-white"
          size="sm"
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {chats.length === 0 ? (
            <div className="text-center text-subtext1 py-8">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No chats yet</p>
              <p className="text-sm">Start a new conversation!</p>
            </div>
          ) : (
            <div className="animate-in slide-in-from-left duration-300">
              {chats.map((chat, index) => (
                <Link
                  key={chat.id}
                  to={`/chat/${chat.id}`}
                  onClick={() => {
                    addLog({
                      level: 'info',
                      category: 'ui',
                      message: `Chat selected from sidebar: ${chat.id}`,
                      source: 'ChatSidebar',
                      context: { chatId: chat.id, title: chat.title }
                    });
                    if (isMobile && onClose) {
                      onClose(); // Close sidebar on mobile when chat is selected
                    }
                  }}
                  className={`block mb-2 p-3 rounded-lg transition-all duration-200 group hover:bg-surface2 chat-item ${
                    activeId === chat.id.toString() ? 'bg-surface2 border border-accent/30 chat-active' : ''
                  }`}
                  style={{
                    animationDelay: `${index * 50}ms`,
                    animationFillMode: 'both'
                  }}
                >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-sm font-medium text-text mb-1 chat-title">
                      {chat.title}
                    </h3>
                    {chat.latest_message && (
                      <div className="relative overflow-hidden mr-4">
                        <p className="text-xs text-subtext1 whitespace-nowrap chat-subtitle">
                          {chat.latest_message.sender === 'user' ? 'You: ' : 'AI: '}
                          {chat.latest_message.content}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center mt-2 text-xs text-subtext0">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatTime(chat.updated_at)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto hover:bg-red/20 hover:text-red"
                    onClick={(e) => deleteChat(chat.id, e)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Link>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ChatSidebar;