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
import { Trash2 } from 'lucide-react';
import type { Shortcut } from '../lib/api';

interface ShortcutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcut: Shortcut | null;
  onSave: (data: { name: string; url: string; icon?: string }) => Promise<void>;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = shortcut !== null;

  useEffect(() => {
    if (shortcut) {
      setName(shortcut.name);
      setUrl(shortcut.url);
      setIcon(shortcut.icon || '');
    } else {
      setName('');
      setUrl('');
      setIcon('');
    }
    setError(null);
  }, [shortcut, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!url.trim()) {
      setError('URL is required');
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    setLoading(true);
    try {
      await onSave({
        name: name.trim(),
        url: url.trim(),
        icon: icon.trim() || undefined,
      });
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
          <DialogTitle>{isEditMode ? 'Edit Shortcut' : 'Create Shortcut'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the shortcut details below.'
              : 'Enter the details for your new shortcut.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Name Field */}
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

            {/* URL Field */}
            <div className="grid gap-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                disabled={loading}
                required
              />
            </div>

            {/* Icon Field */}
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

