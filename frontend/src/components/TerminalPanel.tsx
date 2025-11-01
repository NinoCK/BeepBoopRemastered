import React, { useEffect, useState, useRef } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Terminal, ChevronUp, Trash2, Activity, Download, Bot, CheckCircle, XCircle, Clock, AlertTriangle, Info, Settings, MessageSquare, Zap } from 'lucide-react';
import { useAppLogging } from '../contexts/AppLoggingContext';
import type { LogEntry } from '../contexts/AppLoggingContext';

const TerminalPanel: React.FC = () => {
  const { logs, clearLogs, addLog } = useAppLogging();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'system' | 'model' | 'api' | 'ui'>('all');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollAreaRef.current && isExpanded) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [logs, isExpanded]);

  // Add initial system log
  useEffect(() => {
    addLog({
      level: 'info',
      category: 'system',
      message: 'Terminal initialized and ready',
      source: 'TerminalPanel'
    });
  }, [addLog]);

  // Filter logs based on active tab
  const filteredLogs = activeTab === 'all' 
    ? logs 
    : logs.filter(log => log.category === activeTab);

  const formatTime = (timestamp: Date | string) => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red bg-red/10 border-red/20';
      case 'warning':
        return 'text-yellow bg-yellow/10 border-yellow/20';
      case 'info':
        return 'text-blue bg-blue/10 border-blue/20';
      case 'debug':
        return 'text-subtext1 bg-surface2/50 border-surface2';
      default:
        return 'text-text bg-surface2/50 border-surface2';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'debug':
        return '🔧';
      default:
        return '📝';
    }
  };

  return (
    <div className="terminal-panel">
      {/* Terminal Header */}
      <div className="bg-surface1 border-b border-surface2">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center space-x-3">
            <Terminal className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-text">System Terminal</h3>
            <Badge 
              variant={isConnected ? "default" : "destructive"} 
              className={isConnected ? "bg-green/20 text-green border-green/30" : ""}
            >
              <Activity className="w-3 h-3 mr-1" />
              {isConnected ? 'Live' : 'Offline'}
            </Badge>
            {filteredLogs.length > 0 && (
              <Badge variant="secondary" className="bg-surface2 text-subtext1">
                {filteredLogs.length} events
              </Badge>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearLogs}
              className="text-subtext1 hover:text-text hover:bg-surface2"
              disabled={logs.length === 0}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-subtext1 hover:text-text hover:bg-surface2"
            >
              <ChevronUp className={`w-4 h-4 terminal-chevron ${isExpanded ? 'expanded' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        {isExpanded && (
          <div className="flex items-center px-3 pb-2 space-x-1 border-b border-surface2/50">
            {[
              { key: 'all', label: 'All', icon: Terminal },
              { key: 'system', label: 'System', icon: Settings },
              { key: 'model', label: 'Models', icon: Bot },
              { key: 'api', label: 'API', icon: Zap },
              { key: 'ui', label: 'UI', icon: MessageSquare }
            ].map(({ key, label, icon: Icon }) => (
              <Button
                key={key}
                variant={activeTab === key ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(key as typeof activeTab)}
                className={`text-xs px-2 py-1 h-6 ${
                  activeTab === key 
                    ? 'bg-surface2 text-text' 
                    : 'text-subtext1 hover:text-text hover:bg-surface2/50'
                }`}
              >
                <Icon className="w-3 h-3 mr-1" />
                {label}
                <Badge 
                  variant="outline" 
                  className="ml-1 text-xs px-1 py-0 h-4 bg-surface0 border-surface2"
                >
                  {key === 'all' ? logs.length : logs.filter(log => log.category === key).length}
                </Badge>
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Terminal Content */}
      <div 
        className={`terminal-content ${
          isExpanded ? 'expanded' : 'collapsed'
        }`}
      >
        <div className="h-64">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="p-3 space-y-2 font-mono text-xs">
              {filteredLogs.length === 0 ? (
                <div className="text-center text-subtext1 py-8">
                  <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No {activeTab === 'all' ? 'system' : activeTab} logs available</p>
                  <p className="text-xs mt-1">Logs will appear here as the system operates</p>
                </div>
              ) : (
                filteredLogs.slice(-50).map((log, index) => (
                  <Card 
                    key={log.id} 
                    className={`p-3 border terminal-log-item ${getLevelColor(log.level)}`}
                    style={{ '--item-index': index } as React.CSSProperties}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getLevelIcon(log.level)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant="outline" 
                              className={`text-xs px-1 py-0 ${getLevelColor(log.level)}`}
                            >
                              {log.level.toUpperCase()}
                            </Badge>
                            <Badge 
                              variant="secondary" 
                              className="text-xs px-1 py-0 bg-surface2 text-subtext1"
                            >
                              {log.category.toUpperCase()}
                            </Badge>
                            {log.source && (
                              <span className="text-xs text-subtext0">
                                [{log.source}]
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-subtext0 font-mono">
                            {formatTime(log.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-text break-words leading-relaxed">
                          {log.message}
                        </p>
                        {log.context && (
                          <details className="mt-2">
                            <summary className="text-xs text-subtext1 cursor-pointer hover:text-text select-none">
                              View context details
                            </summary>
                            <pre className="text-xs text-subtext0 mt-1 p-2 bg-surface0/50 rounded border border-surface2 overflow-x-auto">
                              {JSON.stringify(log.context, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Collapsed Status Bar */}
      <div 
        className={`terminal-status-bar ${!isExpanded && logs.length > 0 ? 'visible' : 'hidden'}`}
      >
        <div className="p-2 bg-surface0">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-subtext1">Latest:</span>
              {logs[logs.length - 1] && (
                <>
                  <Badge 
                    variant="outline" 
                    className={`text-xs px-1 py-0 ${getLevelColor(logs[logs.length - 1].level)}`}
                  >
                    {logs[logs.length - 1].level.toUpperCase()}
                  </Badge>
                  <span className="text-text truncate max-w-xs">
                    {logs[logs.length - 1].message}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-surface2 text-subtext1">
                {logs.length} total
              </Badge>
              <span className="text-subtext0 font-mono">
                {logs.length > 0 && formatTime(logs[logs.length - 1]?.timestamp)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerminalPanel;