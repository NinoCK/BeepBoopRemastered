import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Plus, Loader2, Edit2, Check } from 'lucide-react';
import WeatherTimeWidget from '../components/WeatherTimeWidget';
import ShortcutCard from '../components/ShortcutCard';
import ShortcutDialog from '../components/ShortcutDialog';
import { shortcutsApi, type Shortcut } from '../lib/api';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';

const STORAGE_KEY = 'shortcuts_order';

const Dashboard: React.FC = () => {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 0, // Start dragging immediately, no delay
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch shortcuts on mount
  useEffect(() => {
    fetchShortcuts();
  }, []);

  const fetchShortcuts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await shortcutsApi.getAll();
      // Restore order from localStorage if available
      const savedOrder = localStorage.getItem(STORAGE_KEY);
      if (savedOrder) {
        try {
          const orderIds: number[] = JSON.parse(savedOrder);
          const orderedShortcuts = orderIds
            .map((id) => data.find((s) => s.id === id))
            .filter((s): s is Shortcut => s !== undefined);
          // Add any new shortcuts that weren't in the saved order
          const newShortcuts = data.filter((s) => !orderIds.includes(s.id));
          setShortcuts([...orderedShortcuts, ...newShortcuts]);
        } catch (e) {
          // If parsing fails, use default order
          setShortcuts(data);
        }
      } else {
        setShortcuts(data);
      }
    } catch (err: any) {
      console.error('Failed to fetch shortcuts:', err);
      setError('Failed to load shortcuts. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const saveOrder = (newShortcuts: Shortcut[]) => {
    const orderIds = newShortcuts.map((s) => s.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orderIds));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setShortcuts((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        saveOrder(newItems);
        return newItems;
      });
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
        const newShortcut = await shortcutsApi.create(data);
        // Add new shortcut to the end of the list and save order
        setShortcuts((prev) => {
          const updated = [...prev, newShortcut];
          saveOrder(updated);
          return updated;
        });
        return; // Don't refetch, we already added it
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
      // Remove from local state and update order
      setShortcuts((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        saveOrder(updated);
        return updated;
      });
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
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsEditMode(!isEditMode)}
              variant={isEditMode ? 'default' : 'outline'}
              className="gap-2"
            >
              {isEditMode ? (
                <>
                  <Check className="h-4 w-4" />
                  Done
                </>
              ) : (
                <>
                  <Edit2 className="h-4 w-4" />
                  Edit
                </>
              )}
            </Button>
            <Button onClick={handleCreateShortcut} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Shortcut
            </Button>
          </div>
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={shortcuts.map((s) => s.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                {shortcuts.map((shortcut) => (
                  <ShortcutCard
                    key={shortcut.id}
                    shortcut={shortcut}
                    onEdit={handleEditShortcut}
                    isEditMode={isEditMode}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
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

