import React from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useNotifications } from '../contexts/NotificationContext';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue" />;
      default:
        return <Info className="w-4 h-4 text-subtext1" />;
    }
  };

  const getNotificationStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'border-green/30 bg-green/10 text-green';
      case 'error':
        return 'border-red/30 bg-red/10 text-red';
      case 'warning':
        return 'border-yellow/30 bg-yellow/10 text-yellow';
      case 'info':
        return 'border-blue/30 bg-blue/10 text-blue';
      default:
        return 'border-surface2 bg-surface1 text-text';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {notifications.map((notification) => (
        <Card
          key={notification.id}
          className={`
            notification-slide-in p-4 border shadow-lg backdrop-blur-md
            ${getNotificationStyles(notification.type)}
            ${notification.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'}
            transition-all duration-300 ease-in-out
          `}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-0.5">
              {getNotificationIcon(notification.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-semibold text-text">
                  {notification.title}
                </h4>
                <div className="flex items-center space-x-2">
                  <Badge
                    variant="outline"
                    className={`text-xs px-1 py-0 ${getNotificationStyles(notification.type)}`}
                  >
                    {formatTime(notification.createdAt)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeNotification(notification.id)}
                    className="h-6 w-6 p-0 text-subtext1 hover:text-text hover:bg-surface2/50"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              
              {notification.message && (
                <p className="text-xs text-text/80 mb-2">
                  {notification.message}
                </p>
              )}

              {notification.action && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    notification.action?.onClick();
                    removeNotification(notification.id);
                  }}
                  className={`text-xs h-6 ${getNotificationStyles(notification.type)}`}
                >
                  {notification.action.label}
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default NotificationContainer;