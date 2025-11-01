import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Settings, MessageSquare, Plus, Menu } from 'lucide-react';
import ModelSelector from './ModelSelector';

interface HeaderBarProps {
  onNewChat?: () => void;
  onToggleSidebar?: () => void;
}

const HeaderBar: React.FC<HeaderBarProps> = ({ onNewChat, onToggleSidebar }) => {
  return (
    <header className="flex items-center justify-between p-4 header-bar shadow-lg">
      <div className="flex items-center space-x-4">
        <Button
          onClick={onToggleSidebar}
          variant="ghost"
          size="sm"
          className="text-text hover:text-accent hover:bg-surface2 mr-2"
        >
          <Menu className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold text-accent flex items-center">
          <MessageSquare className="w-6 h-6 mr-2" />
          <span className="hidden sm:inline">Personal AI Assistant</span>
          <span className="sm:hidden">AI Assistant</span>
        </h1>
        <Badge variant="secondary" className="bg-surface2 text-subtext1">
          v1.0.0
        </Badge>
      </div>
      
      <div className="flex items-center space-x-2">
        <ModelSelector className="hidden sm:flex" />
        
        <Button
          onClick={() => {
            console.log('Header New Chat button clicked');
            if (onNewChat) {
              onNewChat();
            } else {
              console.error('onNewChat function not provided to HeaderBar');
            }
          }}
          variant="ghost"
          size="sm"
          className="text-text hover:text-accent hover:bg-surface2 hidden sm:flex"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
        
        <Link to="/settings">
          <Button 
            variant="ghost" 
            size="sm"
            className="text-text hover:text-accent hover:bg-surface2"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </header>
  );
};

export default HeaderBar;