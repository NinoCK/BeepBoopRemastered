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
import { Search, Navigation } from 'lucide-react';
import type { WeatherWidgetSettings } from '../lib/api';

interface WeatherWidgetSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: WeatherWidgetSettings;
  onSave: (settings: WeatherWidgetSettings) => Promise<void>;
}

const WeatherWidgetSettingsDialog: React.FC<WeatherWidgetSettingsDialogProps> = ({
  open,
  onOpenChange,
  settings,
  onSave,
}) => {
  const [temperatureUnit, setTemperatureUnit] = useState<'C' | 'F'>(settings.temperatureUnit);
  const [locationMethod, setLocationMethod] = useState<'gps' | 'manual'>(settings.locationMethod);
  const [manualLocation, setManualLocation] = useState<string>(settings.manualLocation || '');
  const [size, setSize] = useState<'1x1' | '2x2' | '1x2' | '2x1'>(settings.size || '1x1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTemperatureUnit(settings.temperatureUnit);
      setLocationMethod(settings.locationMethod);
      setManualLocation(settings.manualLocation || '');
      setSize(settings.size || '1x1');
      setError(null);
    }
  }, [settings, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onSave({
        temperatureUnit,
        locationMethod,
        manualLocation: locationMethod === 'manual' ? manualLocation.trim() : undefined,
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
          <DialogTitle>Weather Widget Settings</DialogTitle>
          <DialogDescription>
            Configure the weather widget display and location settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Temperature Unit Setting */}
            <div className="grid gap-2">
              <Label htmlFor="temperatureUnit">Temperature Unit</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={temperatureUnit === 'C' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTemperatureUnit('C')}
                  className="flex-1"
                >
                  Celsius (°C)
                </Button>
                <Button
                  type="button"
                  variant={temperatureUnit === 'F' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTemperatureUnit('F')}
                  className="flex-1"
                >
                  Fahrenheit (°F)
                </Button>
              </div>
            </div>

            {/* Location Method Setting */}
            <div className="grid gap-2">
              <Label htmlFor="locationMethod">Location Method</Label>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant={locationMethod === 'gps' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLocationMethod('gps')}
                  className="flex-1"
                >
                  <Navigation className="h-3 w-3 mr-1.5" />
                  GPS
                </Button>
                <Button
                  type="button"
                  variant={locationMethod === 'manual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLocationMethod('manual')}
                  className="flex-1"
                >
                  <Search className="h-3 w-3 mr-1.5" />
                  Manual
                </Button>
              </div>
              {locationMethod === 'manual' && (
                <div>
                  <Input
                    placeholder="Enter city name"
                    value={manualLocation}
                    onChange={(e) => setManualLocation(e.target.value)}
                    className="flex-1"
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Tip: Add country code (e.g., "Athens, Gr")
                  </p>
                </div>
              )}
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

export default WeatherWidgetSettingsDialog;

