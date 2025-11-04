import React, { useState, useRef, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Edit2, Link as LinkIcon, GripVertical } from 'lucide-react';
import * as Icons from 'lucide-react';
import type { Shortcut } from '../lib/api';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ShortcutCardProps {
  shortcut: Shortcut;
  onEdit: (shortcut: Shortcut) => void;
  isEditMode?: boolean;
}

const ShortcutCard: React.FC<ShortcutCardProps> = ({ shortcut, onEdit, isEditMode = false }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isLongPress, setIsLongPress] = useState(false);
  const [imageError, setImageError] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartTime = useRef<number | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shortcut.id, disabled: !isEditMode });

  // Check if icon is a URL (starts with http:// or https://)
  const isIconUrl = (icon: string | null): boolean => {
    if (!icon) return false;
    return icon.startsWith('http://') || icon.startsWith('https://');
  };

  // Get icon component from lucide-react (only if not a URL)
  const getIcon = (iconName: string | null) => {
    if (!iconName || isIconUrl(iconName)) {
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
  const iconIsUrl = isIconUrl(shortcut.icon) && !imageError;
  
  // Reset image error when icon changes
  useEffect(() => {
    setImageError(false);
  }, [shortcut.icon]);

  const handleClick = (e: React.MouseEvent) => {
    // Don't navigate if in edit mode or clicking the edit button
    if (isEditMode || (e.target as HTMLElement).closest('.edit-button')) {
      return;
    }
    
    // Open in new tab
    window.open(shortcut.url, '_blank', 'noopener,noreferrer');
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(shortcut);
  };

  // Handle long press for mobile (only when not in edit mode)
  const handleTouchStart = () => {
    if (isEditMode) return; // Disable touch handlers in edit mode
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
    
    // If it was a quick tap (not long press) and not in edit mode, navigate
    if (!isEditMode && touchStartTime.current && Date.now() - touchStartTime.current < 500) {
      window.open(shortcut.url, '_blank', 'noopener,noreferrer');
    }
    
    touchStartTime.current = null;
    setTimeout(() => setIsLongPress(false), 100);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition, // Disable transition while dragging
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`relative aspect-square group ${
        isDragging
          ? 'transition-none' // No transition while dragging
          : 'transition-all duration-200'
      } ${
        isEditMode
          ? 'cursor-grab active:cursor-grabbing hover:shadow-lg hover:bg-surface2/50'
          : 'cursor-pointer hover:scale-105 hover:shadow-lg hover:bg-surface2/50'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="h-full flex flex-col items-center justify-center p-1 relative">
        {/* Drag handle - appears in edit mode */}
        {isEditMode && (
          <div
            className="absolute top-1 left-1 z-10 p-1 pointer-events-none"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        
        {/* Make entire card draggable in edit mode */}
        {isEditMode && (
          <div
            {...attributes}
            {...listeners}
            className="absolute inset-0 cursor-grab active:cursor-grabbing z-0"
          />
        )}

        {/* Edit button - appears on hover or long press when not in edit mode */}
        {!isEditMode && (isHovered || isLongPress) && (
          <Button
            variant="ghost"
            size="icon"
            className="edit-button absolute top-1 right-1 mt-1 mr-1 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
            onClick={handleEdit}
          >
            <Edit2 className="h-2 w-2" />
          </Button>
        )}

        {/* Icon - either image from URL or Lucide icon */}
        <div className="flex-1 flex items-center justify-center mb-0.5">
          {iconIsUrl && shortcut.icon ? (
            <img
              src={shortcut.icon}
              alt={shortcut.name}
              className="h-16 w-16 object-contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <IconComponent className="h-16 w-16 text-foreground" />
          )}
        </div>

        {/* Name with ellipsis and fade effect */}
        <div className="relative w-full px-1 overflow-hidden">
          <div 
            className="text-center text-xs font-medium text-foreground truncate"
            style={{
              maskImage: 'linear-gradient(to right, black 70%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, black 70%, transparent 100%)',
            }}
          >
            {shortcut.name}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ShortcutCard;

