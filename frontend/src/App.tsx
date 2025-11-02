import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import HeaderBar from './components/HeaderBar';
import ChatSidebar from './components/ChatSidebar';
import TerminalPanel from './components/TerminalPanel';
import NotificationContainer from './components/NotificationContainer';
import { ModelOperationProvider } from './contexts/ModelOperationContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AppLoggingProvider, useAppLogging } from './contexts/AppLoggingContext';
import api, { setApiLogger } from './lib/api';

const AppContent: React.FC = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  const { addLog } = useAppLogging();

  // Inject logger into API module and add startup logs
  useEffect(() => {
    setApiLogger(addLog);
    
    // Add system startup log
    addLog({
      level: 'info',
      category: 'system',
      message: 'Application initialized',
      source: 'App',
      context: { version: '1.0.0', environment: 'development' }
    });
    
    addLog({
      level: 'info',
      category: 'system',
      message: 'Context providers initialized',
      source: 'App'
    });
  }, [addLog]);

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarVisible(false); // Hide sidebar by default on mobile
      }
      addLog({
        level: 'debug',
        category: 'ui',
        message: `Device mode detected: ${mobile ? 'mobile' : 'desktop'}`,
        source: 'App',
        context: { isMobile: mobile, width: window.innerWidth }
      });
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [addLog]);

  const handleNewChat = async () => {
    try {
      console.log('Creating new chat...');
      console.log('API base URL:', api.defaults.baseURL);
      
      addLog({
        level: 'info',
        category: 'ui',
        message: 'Creating new chat',
        source: 'App'
      });
      
      const response = await api.post('/chat/new', {
        title: 'New Chat'
      });
      
      const newChat = response.data;
      console.log('New chat created:', newChat);
      
      addLog({
        level: 'success',
        category: 'ui',
        message: `New chat created: ${newChat.title || `Chat ${newChat.id}`}`,
        source: 'App',
        context: { chatId: newChat.id, title: newChat.title }
      });
      
      navigate(`/chat/${newChat.id}`);
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Failed to create new chat:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      } else if (error.request) {
        console.error('Request was made but no response received:', error.request);
      } else {
        console.error('Error message:', error.message);
      }
      
      addLog({
        level: 'error',
        category: 'ui',
        message: 'Failed to create new chat',
        source: 'App',
        context: { error: error.message || 'Unknown error' }
      });
      
      // Show user-friendly error
      alert('Failed to create new chat. Please check if the backend server is running.');
    }
  };

  return (
    <div className="h-full flex flex-col chat-container">
      <NotificationContainer />
      <HeaderBar 
        onNewChat={handleNewChat} 
        onToggleSidebar={() => {
          setSidebarVisible(!sidebarVisible);
          addLog({
            level: 'debug',
            category: 'ui',
            message: `Sidebar ${!sidebarVisible ? 'opened' : 'closed'}`,
            source: 'App'
          });
        }} 
      />
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div className={`sidebar-container transition-all duration-300 ease-in-out ${
            sidebarVisible ? 'w-auto opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full'
          } overflow-hidden z-10`}>
            <ChatSidebar onNewChat={handleNewChat} refreshTrigger={refreshTrigger} />
          </div>
        )}

        {/* Mobile Sidebar Overlay */}
        {isMobile && (
          <>
            {/* Backdrop */}
            <div 
              className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${
                sidebarVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              onClick={() => setSidebarVisible(false)}
            />
            
            {/* Sidebar */}
            <div className={`fixed left-0 top-0 h-full z-50 transition-transform duration-300 ease-in-out ${
              sidebarVisible ? 'translate-x-0' : '-translate-x-full'
            }`}>
              <ChatSidebar 
                onNewChat={() => {
                  handleNewChat();
                  setSidebarVisible(false); // Close sidebar after creating new chat on mobile
                }} 
                refreshTrigger={refreshTrigger}
                onClose={() => setSidebarVisible(false)}
                isMobile={true}
              />
            </div>
          </>
        )}

        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <Routes>
            <Route path="/" element={<Chat />} />
            <Route path="/chat/:id" element={<Chat />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
      <div className="flex-shrink-0">
        <TerminalPanel />
      </div>
    </div>
  );
};

const AppWithProviders: React.FC = () => {
  return (
    <AppLoggingProvider>
      <NotificationProvider>
        <ModelOperationProvider>
          <Router>
            <AppContent />
          </Router>
        </ModelOperationProvider>
      </NotificationProvider>
    </AppLoggingProvider>
  );
};

const App: React.FC = () => {
  return <AppWithProviders />;
};

export default App;