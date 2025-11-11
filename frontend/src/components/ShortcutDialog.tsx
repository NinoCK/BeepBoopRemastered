import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Trash2 } from 'lucide-react';
import type { Shortcut, ClockWidgetSettings, WeatherWidgetSettings } from '../lib/api';

interface ShortcutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcut: Shortcut | null;
  onSave: (data: { name?: string; url?: string; icon?: string; type?: 'shortcut' | 'widget'; widget_type?: 'clock' | 'weather'; settings?: string }) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
}

const ShortcutDialog: React.FC<ShortcutDialogProps> = ({
  open,
  onOpenChange,
  shortcut,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('');
  const [type, setType] = useState<'shortcut' | 'widget'>('shortcut');
  const [widgetType, setWidgetType] = useState<'clock' | 'weather'>('clock');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = shortcut !== null;

  useEffect(() => {
    if (shortcut) {
      setName(shortcut.name ?? '');
      setUrl(shortcut.url || '');
      setIcon(shortcut.icon || '');
      setType(shortcut.type || 'shortcut');
      setWidgetType(shortcut.widget_type || 'clock');
    } else {
      setName('');
      setUrl('');
      setIcon('');
      setType('shortcut');
      setWidgetType('clock');
    }
    setError(null);
  }, [shortcut, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation - name is only required for shortcuts, not widgets
    if (type === 'shortcut' && !name.trim()) {
      setError('Name is required for shortcuts');
      return;
    }

    // For regular shortcuts, URL is required
    if (type === 'shortcut' && !url.trim()) {
      setError('URL is required for shortcuts');
      return;
    }

    // Validate URL format for shortcuts
    if (type === 'shortcut' && url.trim()) {
      try {
        new URL(url);
      } catch {
        setError('Please enter a valid URL (e.g., https://example.com)');
        return;
      }
    }

    // For widgets, create default settings based on widget type
    let settings: string | undefined;
    if (type === 'widget') {
      if (widgetType === 'clock') {
        const clockSettings: ClockWidgetSettings = {
          timeFormat: '12h',
          dateFormat: 'full',
          size: '1x1',
        };
        settings = JSON.stringify(clockSettings);
      } else if (widgetType === 'weather') {
        const weatherSettings: WeatherWidgetSettings = {
          temperatureUnit: 'C',
          locationMethod: 'gps',
          size: '1x1',
        };
        settings = JSON.stringify(weatherSettings);
      }
    }

    setLoading(true);
    try {
      const saveData: any = {
        type: type,
        icon: icon.trim() || undefined,
      };

      // Name - required for shortcuts, optional for widgets
      if (type === 'shortcut') {
        saveData.name = name.trim();
        saveData.url = url.trim();
      } else {
        // Widget - name is optional, send null if empty
        saveData.name = name.trim() || null;
        saveData.url = null;
        saveData.widget_type = widgetType;
        saveData.settings = settings;
      }

      await onSave(saveData);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save shortcut');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!shortcut || !onDelete) return;

    if (!confirm('Are you sure you want to delete this shortcut?')) {
      return;
    }

    setLoading(true);
    try {
      await onDelete(shortcut.id);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to delete shortcut');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Shortcut' : 'Create Shortcut or Widget'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the shortcut details below.'
              : 'Enter the details for your new shortcut or widget.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Name Field - only for shortcuts */}
            {type === 'shortcut' && (
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Google"
                  disabled={loading}
                  required
                />
              </div>
            )}

            {/* Type Selection - only when creating new */}
            {!isEditMode && (
              <div className="grid gap-2">
                <Label htmlFor="type">Type</Label>
                <Select value={type} onValueChange={(value: 'shortcut' | 'widget') => setType(value)}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shortcut">Shortcut</SelectItem>
                    <SelectItem value="widget">Widget</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Widget Type Selection - only when creating widget */}
            {!isEditMode && type === 'widget' && (
              <div className="grid gap-2">
                <Label htmlFor="widgetType">Widget Type</Label>
                <Select value={widgetType} onValueChange={(value: 'clock' | 'weather') => setWidgetType(value)}>
                  <SelectTrigger id="widgetType">
                    <SelectValue placeholder="Select widget type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clock">Clock Widget</SelectItem>
                    <SelectItem value="weather">Weather Widget</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* URL Field - only for shortcuts */}
            {type === 'shortcut' && (
              <div className="grid gap-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  disabled={loading}
                  required={type === 'shortcut'}
                />
              </div>
            )}

            {/* Icon Field - only for shortcuts */}
            {type === 'shortcut' && (
              <div className="grid gap-2">
                <Label htmlFor="icon">Icon (optional)</Label>
                <Input
                  id="icon"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="e.g., Link, Home, Settings or https://example.com/icon.png"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Enter a Lucide icon name (e.g., Link, Home, Settings, Github) or an image URL (e.g., https://example.com/icon.png). Leave empty for default.
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between">
            <div>
              {isEditMode && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ShortcutDialog;

