import React, { useState, useRef } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Edit2, Link as LinkIcon } from 'lucide-react';
import * as Icons from 'lucide-react';
import type { Shortcut } from '../lib/api';

interface ShortcutCardProps {
  shortcut: Shortcut;
  onEdit: (shortcut: Shortcut) => void;
}

const ShortcutCard: React.FC<ShortcutCardProps> = ({ shortcut, onEdit }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isLongPress, setIsLongPress] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartTime = useRef<number | null>(null);

  // Get icon component from lucide-react
  const getIcon = (iconName: string | null) => {
    if (!iconName) {
      return LinkIcon;
    }
    
    try {
      // Convert icon name to PascalCase and get from lucide-react
      const IconComponent = (Icons as any)[iconName];
      if (IconComponent && typeof IconComponent === 'function') {
        return IconComponent;
      }
    } catch (error) {
      console.warn(`Icon "${iconName}" not found, using default Link icon`);
    }
    
    return LinkIcon;
  };

  const IconComponent = getIcon(shortcut.icon);

  const handleClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking the edit button
    if ((e.target as HTMLElement).closest('.edit-button')) {
      return;
    }
    
    // Open in new tab
    window.open(shortcut.url, '_blank', 'noopener,noreferrer');
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(shortcut);
  };

  // Handle long press for mobile
  const handleTouchStart = () => {
    touchStartTime.current = Date.now();
    longPressTimer.current = setTimeout(() => {
      setIsLongPress(true);
      onEdit(shortcut);
    }, 500); // 500ms long press
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    // If it was a quick tap (not long press), navigate
    if (touchStartTime.current && Date.now() - touchStartTime.current < 500) {
      window.open(shortcut.url, '_blank', 'noopener,noreferrer');
    }
    
    touchStartTime.current = null;
    setTimeout(() => setIsLongPress(false), 100);
  };

  return (
    <Card
      className="relative aspect-square cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="h-full flex flex-col items-center justify-center p-4 relative">
        {/* Edit button - appears on hover or long press */}
        {(isHovered || isLongPress) && (
          <Button
            variant="ghost"
            size="icon"
            className="edit-button absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            onClick={handleEdit}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        )}

        {/* Icon */}
        <div className="flex-1 flex items-center justify-center mb-2">
          <IconComponent className="h-12 w-12 text-foreground" />
        </div>

        {/* Name */}
        <div className="text-center text-sm font-medium text-foreground line-clamp-2">
          {shortcut.name}
        </div>
      </div>
    </Card>
  );
};

export default ShortcutCard;

