import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Settings, MessageSquare, Plus, Menu, LayoutDashboard, LogOut } from 'lucide-react';
import ModelSelector from './ModelSelector';
import { useAuth } from '../hooks/useAuth';

interface HeaderBarProps {
  onNewChat?: () => void;
  onToggleSidebar?: () => void;
}

const HeaderBar: React.FC<HeaderBarProps> = ({ onNewChat, onToggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [loggingOut, setLoggingOut] = React.useState(false);
  
  const handleSettingsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === '/settings') {
      // If already on settings page, navigate back to previous page
      // If no history exists, navigate to home
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    } else {
      navigate('/settings');
    }
  };

  const handleDashboardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === '/dashboard') {
      // If already on dashboard, navigate back to previous page or home
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    } else {
      navigate('/dashboard');
    }
  };

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out', error);
    } finally {
      setLoggingOut(false);
    }
  };

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
        {user && (
          <span className="hidden text-sm text-subtext1 sm:inline-block">
            {user.name}
          </span>
        )}
        
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
        
        <Button 
          variant="ghost" 
          size="sm"
          className={`text-text hover:text-accent hover:bg-surface2 ${location.pathname === '/dashboard' ? 'bg-surface2 text-accent' : ''}`}
          onClick={handleDashboardClick}
          title="Dashboard"
        >
          <LayoutDashboard className="w-4 h-4" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm"
          className={`text-text hover:text-accent hover:bg-surface2 ${location.pathname === '/settings' ? 'bg-surface2 text-accent' : ''}`}
          onClick={handleSettingsClick}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-text hover:text-accent hover:bg-surface2"
          onClick={handleLogout}
          disabled={loggingOut}
          title="Log out"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
};

export default HeaderBar;