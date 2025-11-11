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
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import type { ClockWidgetSettings } from '../lib/api';

interface ClockWidgetSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ClockWidgetSettings;
  onSave: (settings: ClockWidgetSettings) => Promise<void>;
}

const ClockWidgetSettingsDialog: React.FC<ClockWidgetSettingsDialogProps> = ({
  open,
  onOpenChange,
  settings,
  onSave,
}) => {
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>(settings.timeFormat);
  const [dateFormat, setDateFormat] = useState<string>(settings.dateFormat);
  const [size, setSize] = useState<'1x1' | '2x2' | '1x2' | '2x1'>(settings.size || '1x1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTimeFormat(settings.timeFormat);
      setDateFormat(settings.dateFormat);
      setSize(settings.size || '1x1');
      setError(null);
    }
  }, [settings, open]);

  const dateFormatPresets = [
    { value: 'full', label: 'Full (Monday, January 1, 2024)' },
    { value: 'medium', label: 'Medium (Jan 1, 2024)' },
    { value: 'short', label: 'Short (01/01/2024)' },
    { value: 'month-day', label: 'Month Day (January 1)' },
    { value: 'day-month', label: 'Day Month (1 Jan)' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onSave({
        timeFormat,
        dateFormat,
        size,
      });
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
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
          <DialogTitle>Clock Widget Settings</DialogTitle>
          <DialogDescription>
            Configure the display format for the clock widget.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Time Format Setting */}
            <div className="grid gap-2">
              <Label htmlFor="timeFormat">Time Format</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={timeFormat === '12h' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeFormat('12h')}
                  className="flex-1"
                >
                  12 Hour
                </Button>
                <Button
                  type="button"
                  variant={timeFormat === '24h' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeFormat('24h')}
                  className="flex-1"
                >
                  24 Hour
                </Button>
              </div>
            </div>

            {/* Date Format Setting */}
            <div className="grid gap-2">
              <Label htmlFor="dateFormat">Date Format</Label>
              <Select value={dateFormat} onValueChange={setDateFormat}>
                <SelectTrigger id="dateFormat">
                  <SelectValue placeholder="Select date format" />
                </SelectTrigger>
                <SelectContent>
                  {dateFormatPresets.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Size Setting */}
            <div className="grid gap-2">
              <Label htmlFor="size">Widget Size</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={size === '1x1' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSize('1x1')}
                  className="flex-1"
                >
                  1×1
                </Button>
                <Button
                  type="button"
                  variant={size === '2x2' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSize('2x2')}
                  className="flex-1"
                >
                  2×2
                </Button>
                <Button
                  type="button"
                  variant={size === '1x2' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSize('1x2')}
                  className="flex-1"
                >
                  1×2
                </Button>
                <Button
                  type="button"
                  variant={size === '2x1' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSize('2x1')}
                  className="flex-1"
                >
                  2×1
                </Button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ClockWidgetSettingsDialog;

