import React, { useState, useRef, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Edit2, Link as LinkIcon } from 'lucide-react';
import * as Icons from 'lucide-react';
import type { Shortcut, ClockWidgetSettings, WeatherWidgetSettings } from '../lib/api';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ClockWidget from './ClockWidget';
import WeatherWidget from './WeatherWidget';

interface ShortcutCardProps {
  shortcut: Shortcut;
  onEdit: (shortcut: Shortcut) => void;
  isEditMode?: boolean;
}

const ShortcutCard: React.FC<ShortcutCardProps> = ({ shortcut, onEdit, isEditMode = false }) => {
  const [imageError, setImageError] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shortcut.id, disabled: !isEditMode });

  const spanColumns = Math.max(1, shortcut.span_columns ?? 1);
  const spanRows = Math.max(1, shortcut.span_rows ?? 1);

  const isIconUrl = (icon: string | null): boolean => {
    if (!icon) return false;
    return icon.startsWith('http://') || icon.startsWith('https://');
  };

  const getIcon = (iconName: string | null) => {
    if (!iconName || isIconUrl(iconName)) {
      return LinkIcon;
    }

    try {
      const formattedName = iconName.charAt(0).toUpperCase() + iconName.slice(1);
      const IconComponent = (Icons as any)[formattedName] ?? (Icons as any)[iconName];
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

  useEffect(() => {
    setImageError(false);
  }, [shortcut.icon]);

  const handleClick = (e: React.MouseEvent) => {
    if (isEditMode || shortcut.type === 'widget') {
      return;
    }

    if ((e.target as HTMLElement).closest('.edit-button')) {
      return;
    }

    const targetUrl = shortcut.url;
    if (typeof targetUrl === 'string' && targetUrl.length > 0) {
      window.open(targetUrl as string, '_blank', 'noopener,noreferrer');
    }
  };

  const handleEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onEdit(shortcut);
  };

  const handleTouchStart = () => {
    if (!isEditMode) return;
    longPressTimer.current = setTimeout(() => {
      handleEdit();
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // No-op; long press handled via timer
  };

  const deriveWidgetSettings = () => {
    if (shortcut.type !== 'widget') return null;

    try {
      return shortcut.settings ? JSON.parse(shortcut.settings) : {};
    } catch (error) {
      console.error('Error parsing widget settings:', error);
      return {};
    }
  };

  const widgetSettings = deriveWidgetSettings();

  const style: React.CSSProperties = {
    gridColumnStart: shortcut.grid_column ?? 1,
    gridColumnEnd: `span ${spanColumns}`,
    gridRowStart: shortcut.grid_row ?? 1,
    gridRowEnd: `span ${spanRows}`,
    aspectRatio: `${spanColumns} / ${spanRows}`,
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`relative w-full min-h-0 group overflow-hidden ${
        isDragging ? 'transition-none' : 'transition-all duration-200'
      } ${
        isEditMode
          ? 'cursor-grab active:cursor-grabbing shadow-sm hover:shadow-lg'
          : shortcut.type === 'widget'
          ? 'hover:shadow-lg'
          : 'cursor-pointer hover:scale-[1.02] hover:shadow-lg'
      }`}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      {...listeners}
      {...attributes}
    >
      <div className="h-full flex flex-col items-center justify-center p-2 relative">
        {isEditMode && (
          <Button
            variant="secondary"
            size="icon"
            className="edit-button absolute top-2 right-2 h-7 w-7 z-20"
            onClick={handleEdit}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
        )}

        {shortcut.type === 'widget' ? (
          <div className="w-full h-full flex items-center justify-center">
            {shortcut.widget_type === 'clock' ? (
              <ClockWidget
                settings={{
                  timeFormat: widgetSettings?.timeFormat ?? '12h',
                  dateFormat: widgetSettings?.dateFormat ?? 'full',
                  size: widgetSettings?.size ?? '1x1',
                }}
                compact
              />
            ) : shortcut.widget_type === 'weather' ? (
              <WeatherWidget
                settings={{
                  temperatureUnit: widgetSettings?.temperatureUnit ?? 'C',
                  locationMethod: widgetSettings?.locationMethod ?? 'gps',
                  manualLocation: widgetSettings?.manualLocation ?? '',
                  size: widgetSettings?.size ?? '1x1',
                }}
                compact
              />
            ) : (
              <div className="text-xs text-muted-foreground">Widget unavailable</div>
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 flex items-center justify-center">
              {iconIsUrl && shortcut.icon ? (
                <img
                  src={shortcut.icon ?? undefined}
                  alt={shortcut.name ?? 'Shortcut icon'}
                  className="h-16 w-16 object-contain"
                  onError={() => setImageError(true)}
                />
              ) : (
                <IconComponent className="h-16 w-16 text-foreground" />
              )}
            </div>
            <div className="mt-3 w-full px-1">
              <div className="text-center text-sm font-medium text-foreground truncate text-fade-right">
                {shortcut.name || 'Shortcut'}
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

export default ShortcutCard;

