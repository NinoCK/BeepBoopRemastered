import React, { createContext, useContext, useState, useCallback } from 'react';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'error' | 'warning' | 'debug' | 'success';
  category: 'system' | 'model' | 'chat' | 'api' | 'ui' | 'notification';
  message: string;
  context?: any;
  source?: string;
}

interface AppLoggingContextType {
  logs: LogEntry[];
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  getLogsByCategory: (category: LogEntry['category']) => LogEntry[];
  getLogsByLevel: (level: LogEntry['level']) => LogEntry[];
}

const AppLoggingContext = createContext<AppLoggingContextType | undefined>(undefined);

export const AppLoggingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((log: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const newLog: LogEntry = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    setLogs(prev => {
      const updated = [...prev, newLog];
      // Keep only the last 500 logs to prevent memory issues
      return updated.slice(-500);
    });

    // Console logging for development
    const logMethod = log.level === 'error' ? 'error' : log.level === 'warning' ? 'warn' : 'log';
    console[logMethod](`[${log.category.toUpperCase()}] ${log.message}`, log.context || '');
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const getLogsByCategory = useCallback((category: LogEntry['category']) => {
    return logs.filter(log => log.category === category);
  }, [logs]);

  const getLogsByLevel = useCallback((level: LogEntry['level']) => {
    return logs.filter(log => log.level === level);
  }, [logs]);

  return (
    <AppLoggingContext.Provider value={{
      logs,
      addLog,
      clearLogs,
      getLogsByCategory,
      getLogsByLevel
    }}>
      {children}
    </AppLoggingContext.Provider>
  );
};

export const useAppLogging = () => {
  const context = useContext(AppLoggingContext);
  if (context === undefined) {
    throw new Error('useAppLogging must be used within an AppLoggingProvider');
  }
  return context;
};