import React, { useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import HeaderBar from './components/HeaderBar';
import ChatSidebar from './components/ChatSidebar';
import TerminalPanel from './components/TerminalPanel';
import NotificationContainer from './components/NotificationContainer';
import { ModelOperationProvider } from './contexts/ModelOperationContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AppLoggingProvider, useAppLogging } from './contexts/AppLoggingContext';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import api, { setApiLogger } from './lib/api';

const LoadingScreen: React.FC = () => (
  <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground">
    <div className="flex flex-col items-center space-y-4">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
      <p className="text-base font-medium">Loading...</p>
    </div>
  </div>
);

const ProtectedRoute: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
};

const PublicRoute: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

const AuthenticatedLayout: React.FC = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  const { addLog } = useAppLogging();

  useEffect(() => {
    setApiLogger(addLog);

    addLog({
      level: 'info',
      category: 'system',
      message: 'Application initialized',
      source: 'App',
      context: { version: '1.0.0', environment: 'development' },
    });

    addLog({
      level: 'info',
      category: 'system',
      message: 'Context providers initialized',
      source: 'App',
    });
  }, [addLog]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarVisible(false);
      }
      addLog({
        level: 'debug',
        category: 'ui',
        message: `Device mode detected: ${mobile ? 'mobile' : 'desktop'}`,
        source: 'App',
        context: { isMobile: mobile, width: window.innerWidth },
      });
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [addLog]);

  const handleNewChat = async () => {
    try {
      addLog({
        level: 'info',
        category: 'ui',
        message: 'Creating new chat',
        source: 'App',
      });

      const response = await api.post('/chat/new', {
        title: 'New Chat',
      });

      const newChat = response.data;

      addLog({
        level: 'success',
        category: 'ui',
        message: `New chat created: ${newChat.title || `Chat ${newChat.id}`}`,
        source: 'App',
        context: { chatId: newChat.id, title: newChat.title },
      });

      navigate(`/chat/${newChat.id}`);
      setRefreshTrigger((prev) => prev + 1);
    } catch (error: any) {
      addLog({
        level: 'error',
        category: 'ui',
        message: 'Failed to create new chat',
        source: 'App',
        context: { error: error.message || 'Unknown error' },
      });

      alert('Failed to create new chat. Please check if the backend server is running.');
    }
  };

  return (
    <div className="flex h-full flex-col chat-container">
      <NotificationContainer />
      <HeaderBar
        onNewChat={handleNewChat}
        onToggleSidebar={() => {
          setSidebarVisible(!sidebarVisible);
          addLog({
            level: 'debug',
            category: 'ui',
            message: `Sidebar ${!sidebarVisible ? 'opened' : 'closed'}`,
            source: 'App',
          });
        }}
      />
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {!isMobile && (
          <div
            className={`sidebar-container z-10 overflow-hidden transition-all duration-300 ease-in-out ${
              sidebarVisible ? 'w-auto translate-x-0 opacity-100' : 'w-0 -translate-x-full opacity-0'
            }`}
          >
            <ChatSidebar onNewChat={handleNewChat} refreshTrigger={refreshTrigger} />
          </div>
        )}

        {isMobile && (
          <>
            <div
              className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
                sidebarVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
              onClick={() => setSidebarVisible(false)}
            />
            <div
              className={`fixed left-0 top-0 z-50 h-full transition-transform duration-300 ease-in-out ${
                sidebarVisible ? 'translate-x-0' : '-translate-x-full'
              }`}
            >
              <ChatSidebar
                onNewChat={() => {
                  handleNewChat();
                  setSidebarVisible(false);
                }}
                refreshTrigger={refreshTrigger}
                onClose={() => setSidebarVisible(false)}
                isMobile={true}
              />
            </div>
          </>
        )}

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
      <div className="flex-shrink-0">
        <TerminalPanel />
      </div>
    </div>
  );
};

const AppRoutes: React.FC = () => (
  <Routes>
    <Route element={<PublicRoute />}>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Route>

    <Route element={<ProtectedRoute />}>
      <Route element={<AuthenticatedLayout />}>
        <Route index element={<Chat />} />
        <Route path="chat/:id" element={<Chat />} />
        <Route path="settings" element={<Settings />} />
        <Route path="dashboard" element={<Dashboard />} />
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const AppWithProviders: React.FC = () => {
  return (
    <AppLoggingProvider>
      <NotificationProvider>
        <ModelOperationProvider>
          <Router>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
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