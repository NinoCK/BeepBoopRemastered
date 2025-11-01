import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatWindow from '../components/ChatWindow';
import api from '../lib/api';

const Chat: React.FC = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();

  const handleNewChat = async () => {
    try {
      const response = await api.post('/chat/new', {
        title: 'New Chat'
      });
      
      const newChat = response.data;
      navigate(`/chat/${newChat.id}`);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to create new chat:', error);
    }
  };

  const handleMessagesUpdate = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatWindow 
          onMessagesUpdate={handleMessagesUpdate}
        />
      </div>
    </div>
  );
};

export default Chat;