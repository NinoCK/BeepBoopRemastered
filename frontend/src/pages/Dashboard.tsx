import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import WeatherTimeWidget from '../components/WeatherTimeWidget';
import ShortcutCard from '../components/ShortcutCard';
import ShortcutDialog from '../components/ShortcutDialog';
import { shortcutsApi, type Shortcut } from '../lib/api';

const Dashboard: React.FC = () => {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch shortcuts on mount
  useEffect(() => {
    fetchShortcuts();
  }, []);

  const fetchShortcuts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await shortcutsApi.getAll();
      setShortcuts(data);
    } catch (err: any) {
      console.error('Failed to fetch shortcuts:', err);
      setError('Failed to load shortcuts. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShortcut = () => {
    setEditingShortcut(null);
    setDialogOpen(true);
  };

  const handleEditShortcut = (shortcut: Shortcut) => {
    setEditingShortcut(shortcut);
    setDialogOpen(true);
  };

  const handleSaveShortcut = async (data: { name: string; url: string; icon?: string }) => {
    try {
      if (editingShortcut) {
        // Update existing shortcut
        await shortcutsApi.update(editingShortcut.id, data);
      } else {
        // Create new shortcut
        await shortcutsApi.create(data);
      }
      // Refresh shortcuts list
      await fetchShortcuts();
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to save shortcut');
    }
  };

  const handleDeleteShortcut = async (id: number) => {
    try {
      await shortcutsApi.delete(id);
      // Refresh shortcuts list
      await fetchShortcuts();
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to delete shortcut');
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingShortcut(null);
  };

  return (
    <div className="h-full flex flex-col overflow-auto p-6">
      {/* Weather & Time Widget */}
      <WeatherTimeWidget />

      {/* Shortcuts Section */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-foreground">Shortcuts</h2>
          <Button onClick={handleCreateShortcut} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Shortcut
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && shortcuts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-6xl mb-4 opacity-50">🔗</div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No shortcuts yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first shortcut to get started
            </p>
            <Button onClick={handleCreateShortcut} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Shortcut
            </Button>
          </div>
        )}

        {/* Shortcuts Grid */}
        {!loading && !error && shortcuts.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {shortcuts.map((shortcut) => (
              <ShortcutCard
                key={shortcut.id}
                shortcut={shortcut}
                onEdit={handleEditShortcut}
              />
            ))}
          </div>
        )}
      </div>

      {/* Shortcut Dialog */}
      <ShortcutDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        shortcut={editingShortcut}
        onSave={handleSaveShortcut}
        onDelete={editingShortcut ? handleDeleteShortcut : undefined}
      />
    </div>
  );
};

export default Dashboard;

