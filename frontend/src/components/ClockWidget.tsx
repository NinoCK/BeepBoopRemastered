import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import type { ClockWidgetSettings } from '../lib/api';

interface ClockWidgetProps {
  settings: ClockWidgetSettings;
  compact?: boolean; // For widget card display
}

const ClockWidget: React.FC<ClockWidgetProps> = ({ settings, compact = false }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: settings.timeFormat === '12h',
    });
  };

  const formatDate = (date: Date): string => {
    // Date format presets
    const formatPresets: { [key: string]: Intl.DateTimeFormatOptions } = {
      'full': {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      },
      'medium': {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      },
      'short': {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      },
      'month-day': {
        month: 'long',
        day: 'numeric',
      },
      'day-month': {
        day: 'numeric',
        month: 'short',
      },
    };

    const formatOptions = formatPresets[settings.dateFormat] || formatPresets['full'];
    return date.toLocaleDateString('en-US', formatOptions);
  };

  if (compact) {
    // Compact version for widget card
    return (
      <div className="h-full flex flex-col items-center justify-center p-2">
        <Clock className="h-8 w-8 text-muted-foreground mb-1" />
        <div className="text-lg font-mono font-semibold text-foreground">
          {formatTime(currentTime)}
        </div>
        <div className="text-xs text-muted-foreground text-center">
          {formatDate(currentTime)}
        </div>
      </div>
    );
  }

  // Full version
  return (
    <div className="flex items-center gap-3">
      <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      <div>
        <div className="text-2xl font-mono font-semibold text-foreground leading-tight">
          {formatTime(currentTime)}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDate(currentTime)}
        </div>
      </div>
    </div>
  );
};

export default ClockWidget;








