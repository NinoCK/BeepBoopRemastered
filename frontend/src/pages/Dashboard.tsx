import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Plus, Loader2, Edit2, Check, AlertCircle } from 'lucide-react';
import ShortcutCard from '../components/ShortcutCard';
import ShortcutDialog from '../components/ShortcutDialog';
import ClockWidgetSettingsDialog from '../components/ClockWidgetSettingsDialog';
import WeatherWidgetSettingsDialog from '../components/WeatherWidgetSettingsDialog';
import {
  shortcutsApi,
  type Shortcut,
  type ClockWidgetSettings,
  type WeatherWidgetSettings,
} from '../lib/api';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';

type DashboardTile = Shortcut & {
  display_order: number;
  span_columns: number;
  span_rows: number;
  grid_column: number;
  grid_row: number;
};

const GRID_COLUMNS = 6;
const MAX_GRID_ROWS = 24;
const TILE_SIZE_PX = 160;
const GRID_GAP_PX = 16; // gap-4

const getSpanFromSize = (size: string | undefined | null) => {
  switch (size) {
    case '2x2':
      return { columns: 2, rows: 2 };
    case '1x2':
      return { columns: 1, rows: 2 };
    case '2x1':
      return { columns: 2, rows: 1 };
    default:
      return { columns: 1, rows: 1 };
  }
};

const inferTileSize = (shortcut: Shortcut) => {
  if (shortcut.type !== 'widget') {
    return { columns: 1, rows: 1 };
  }

  try {
    const parsed = shortcut.settings ? JSON.parse(shortcut.settings) : {};
    return getSpanFromSize(parsed.size);
  } catch (error) {
    console.warn('Unable to parse widget settings', error);
    return { columns: 1, rows: 1 };
  }
};

const normalizeTiles = (items: Shortcut[]): DashboardTile[] => {
  return [...items]
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.id - b.id)
    .map((item, index) => {
      const span = {
        columns: Math.max(1, item.span_columns ?? inferTileSize(item).columns),
        rows: Math.max(1, item.span_rows ?? inferTileSize(item).rows),
      };

      const fallbackColumn = (index % GRID_COLUMNS) + 1;
      const fallbackRow = Math.floor(index / GRID_COLUMNS) + 1;

      const maxColumnStart = Math.max(1, GRID_COLUMNS - span.columns + 1);
      const maxRowStart = Math.max(1, MAX_GRID_ROWS - span.rows + 1);

      const normalizedColumn = item.grid_column
        ? Math.min(Math.max(1, item.grid_column), maxColumnStart)
        : Math.min(fallbackColumn, maxColumnStart);
      const normalizedRow = item.grid_row
        ? Math.min(Math.max(1, item.grid_row), maxRowStart)
        : Math.min(fallbackRow, maxRowStart);

      return {
        ...item,
        display_order: index,
        span_columns: span.columns,
        span_rows: span.rows,
        grid_column: normalizedColumn,
        grid_row: normalizedRow,
      };
    });
};

const Dashboard: React.FC = () => {
  const [tiles, setTiles] = useState<DashboardTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clockSettingsDialogOpen, setClockSettingsDialogOpen] = useState(false);
  const [weatherSettingsDialogOpen, setWeatherSettingsDialogOpen] = useState(false);
  const [editingTile, setEditingTile] = useState<DashboardTile | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const orderedTiles = useMemo(() => normalizeTiles(tiles), [tiles]);

  const loadTiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await shortcutsApi.getAll();
      setTiles(normalizeTiles(data));
    } catch (err) {
      console.error('Failed to load dashboard tiles', err);
      setError('Failed to load dashboard tiles. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTiles();
  }, [loadTiles]);

  const persistLayout = useCallback(async (nextTiles: DashboardTile[]) => {
    try {
      setLayoutSaving(true);
      setLayoutError(null);
      await shortcutsApi.updateLayout(
        nextTiles.map((tile, index) => ({
          id: tile.id,
          display_order: index,
          span_columns: tile.span_columns ?? inferTileSize(tile).columns,
          span_rows: tile.span_rows ?? inferTileSize(tile).rows,
          grid_column: tile.grid_column,
          grid_row: tile.grid_row,
        }))
      );
    } catch (err) {
      console.error('Failed to persist dashboard layout', err);
      setLayoutError('Could not save the new layout. Your last change might be lost.');
    } finally {
      setLayoutSaving(false);
    }
  }, []);

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const buildOccupiedMap = (list: DashboardTile[], excludeId: number) => {
    const occupied = new Set<string>();
    list.forEach((tile) => {
      if (tile.id === excludeId) return;
      const startRow = tile.grid_row ?? 1;
      const startCol = tile.grid_column ?? 1;
      for (let row = startRow; row < startRow + tile.span_rows; row += 1) {
        for (let col = startCol; col < startCol + tile.span_columns; col += 1) {
          occupied.add(`${row}:${col}`);
        }
      }
    });
    return occupied;
  };

  const isAreaFree = (
    column: number,
    row: number,
    spanCols: number,
    spanRows: number,
    occupied: Set<string>
  ) => {
    for (let r = row; r < row + spanRows; r += 1) {
      for (let c = column; c < column + spanCols; c += 1) {
        if (occupied.has(`${r}:${c}`)) {
          return false;
        }
      }
    }
    return true;
  };

  const findNearestAvailablePosition = (
    desiredColumn: number,
    desiredRow: number,
    tile: DashboardTile,
    occupied: Set<string>
  ) => {
    const maxColumnStart = Math.max(1, GRID_COLUMNS - tile.span_columns + 1);
    const maxRowStart = Math.max(1, MAX_GRID_ROWS - tile.span_rows + 1);

    let column = clamp(desiredColumn, 1, maxColumnStart);
    let row = clamp(desiredRow, 1, maxRowStart);

    if (isAreaFree(column, row, tile.span_columns, tile.span_rows, occupied)) {
      return { column, row };
    }

    // Try scanning downward in the same column first
    for (let r = row + 1; r <= maxRowStart; r += 1) {
      if (isAreaFree(column, r, tile.span_columns, tile.span_rows, occupied)) {
        return { column, row: r };
      }
    }

    // Try scanning upward in the same column
    for (let r = row - 1; r >= 1; r -= 1) {
      if (isAreaFree(column, r, tile.span_columns, tile.span_rows, occupied)) {
        return { column, row: r };
      }
    }

    // Scan other columns, prioritising those closest to the desired column
    const columnsToCheck: number[] = [];
    for (let c = 1; c <= maxColumnStart; c += 1) {
      columnsToCheck.push(c);
    }

    columnsToCheck.sort((a, b) => Math.abs(a - column) - Math.abs(b - column));

    for (const colCandidate of columnsToCheck) {
      if (colCandidate === column) continue;
      for (let r = row; r <= maxRowStart; r += 1) {
        if (isAreaFree(colCandidate, r, tile.span_columns, tile.span_rows, occupied)) {
          return { column: colCandidate, row: r };
        }
      }
      for (let r = row - 1; r >= 1; r -= 1) {
        if (isAreaFree(colCandidate, r, tile.span_columns, tile.span_rows, occupied)) {
          return { column: colCandidate, row: r };
        }
      }
    }

    // Fallback: scan entire grid from top-left
    for (let r = 1; r <= maxRowStart; r += 1) {
      for (let c = 1; c <= maxColumnStart; c += 1) {
        if (isAreaFree(c, r, tile.span_columns, tile.span_rows, occupied)) {
          return { column: c, row: r };
        }
      }
    }

    return { column, row };
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!isEditMode) return;
    const { active } = event;
    const activeId = Number(active.id);

    const activeTile = tiles.find((tile) => tile.id === activeId);
    if (!activeTile) {
      return;
    }

    const containerRect = gridRef.current?.getBoundingClientRect();
    const activeRect =
      (active.rect.current && active.rect.current.translated) || active.rect.current;

    let desiredColumn = activeTile.grid_column ?? 1;
    let desiredRow = activeTile.grid_row ?? 1;

    if (containerRect && activeRect) {
      const offsetX = activeRect.left - containerRect.left;
      const offsetY = activeRect.top - containerRect.top;

      const effectiveColumnWidth = TILE_SIZE_PX + GRID_GAP_PX;
      const effectiveRowHeight = TILE_SIZE_PX + GRID_GAP_PX;

      desiredColumn = clamp(
        Math.floor((offsetX + TILE_SIZE_PX / 2) / effectiveColumnWidth) + 1,
        1,
        GRID_COLUMNS
      );
      desiredRow = clamp(
        Math.floor((offsetY + TILE_SIZE_PX / 2) / effectiveRowHeight) + 1,
        1,
        MAX_GRID_ROWS
      );
    }

    const occupied = buildOccupiedMap(tiles, activeId);
    const { column, row } = findNearestAvailablePosition(
      desiredColumn,
      desiredRow,
      activeTile,
      occupied
    );

    if (column === activeTile.grid_column && row === activeTile.grid_row) {
      return;
    }

    const updatedTiles = tiles.map((tile) =>
      tile.id === activeId
        ? {
            ...tile,
            grid_column: column,
            grid_row: row,
          }
        : tile
    );

    const reindexedTiles = [...updatedTiles]
      .sort((a, b) =>
        a.grid_row !== b.grid_row
          ? a.grid_row - b.grid_row
          : a.grid_column !== b.grid_column
          ? a.grid_column - b.grid_column
          : a.display_order - b.display_order
      )
      .map((tile, index) => ({
        ...tile,
        display_order: index,
      }));

    setTiles(reindexedTiles);
    void persistLayout(reindexedTiles);
  };

  const handleCreateShortcut = () => {
    setEditingTile(null);
    setDialogOpen(true);
  };

  const openTileEditor = (tile: Shortcut) => {
    if (!isEditMode) return;
    const dashboardTile = tile as DashboardTile;
    setEditingTile(dashboardTile);

    if (dashboardTile.type === 'widget') {
      if (dashboardTile.widget_type === 'clock') {
        setClockSettingsDialogOpen(true);
      } else if (dashboardTile.widget_type === 'weather') {
        setWeatherSettingsDialogOpen(true);
      }
    } else {
      setDialogOpen(true);
    }
  };

  const handleSaveShortcut = async (data: {
    name?: string;
    url?: string;
    icon?: string;
    type?: 'shortcut' | 'widget';
    widget_type?: 'clock' | 'weather';
    settings?: string;
  }) => {
    try {
      if (editingTile) {
        await shortcutsApi.update(editingTile.id, data);
      } else {
        await shortcutsApi.create(data as any);
      }

      await loadTiles();
      setDialogOpen(false);
      setEditingTile(null);
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to save shortcut');
    }
  };

  const handleDeleteShortcut = async (id: number) => {
    try {
      await shortcutsApi.delete(id);
      const remaining = normalizeTiles(tiles.filter((tile) => tile.id !== id));
      setTiles(remaining);
      if (remaining.length > 0) {
        void persistLayout(remaining);
      }
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to delete shortcut');
    }
  };

  const handleSaveClockWidgetSettings = async (settings: ClockWidgetSettings) => {
    if (!editingTile) return;
    try {
      await shortcutsApi.update(editingTile.id, {
        settings: JSON.stringify(settings),
      });
      await loadTiles();
      setClockSettingsDialogOpen(false);
      setEditingTile(null);
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to save widget settings');
    }
  };

  const handleSaveWeatherWidgetSettings = async (settings: WeatherWidgetSettings) => {
    if (!editingTile) return;
    try {
      await shortcutsApi.update(editingTile.id, {
        settings: JSON.stringify(settings),
      });
      await loadTiles();
      setWeatherSettingsDialogOpen(false);
      setEditingTile(null);
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to save widget settings');
    }
  };

  const closeAllDialogs = () => {
    setDialogOpen(false);
    setClockSettingsDialogOpen(false);
    setWeatherSettingsDialogOpen(false);
    setEditingTile(null);
  };

  const getClockWidgetSettings = (): ClockWidgetSettings => {
    if (!editingTile?.settings) {
      return { timeFormat: '12h', dateFormat: 'full', size: '1x1' };
    }

    try {
      const parsed = JSON.parse(editingTile.settings);
      return {
        timeFormat: parsed.timeFormat || '12h',
        dateFormat: parsed.dateFormat || 'full',
        size: parsed.size || '1x1',
      };
    } catch {
      return { timeFormat: '12h', dateFormat: 'full', size: '1x1' };
    }
  };

  const getWeatherWidgetSettings = (): WeatherWidgetSettings => {
    if (!editingTile?.settings) {
      return { temperatureUnit: 'C', locationMethod: 'gps', size: '1x1' };
    }

    try {
      const parsed = JSON.parse(editingTile.settings);
      return {
        temperatureUnit: parsed.temperatureUnit || 'C',
        locationMethod: parsed.locationMethod || 'gps',
        manualLocation: parsed.manualLocation || '',
        size: parsed.size || '1x1',
      };
    } catch {
      return { temperatureUnit: 'C', locationMethod: 'gps', size: '1x1' };
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Arrange shortcuts and widgets the way you like. Toggle edit mode to rearrange.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsEditMode((prev) => !prev)}
            variant={isEditMode ? 'default' : 'outline'}
            className="gap-2"
          >
            {isEditMode ? (
              <>
                <Check className="h-4 w-4" />
                Exit Edit Mode
              </>
            ) : (
              <>
                <Edit2 className="h-4 w-4" />
                Edit Mode
              </>
            )}
          </Button>
          <Button onClick={handleCreateShortcut} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Shortcut
          </Button>
        </div>
      </div>

      {layoutSaving && (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving layout…
        </div>
      )}

      {layoutError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{layoutError}</span>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-lg font-medium text-destructive">{error}</p>
            <Button variant="outline" onClick={() => void loadTiles()}>
              Try again
            </Button>
          </div>
        ) : orderedTiles.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <div className="text-6xl">🧩</div>
            <p className="text-lg font-medium text-foreground">No tiles yet</p>
            <p className="max-w-md text-sm">
              Start by adding shortcuts or widgets. Tiles snap to the grid and remember their position forever.
            </p>
            <Button onClick={handleCreateShortcut} className="gap-2">
              <Plus className="h-4 w-4" />
              Add your first tile
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedTiles.map((tile) => tile.id)}
              strategy={rectSortingStrategy}
            >
              <div
                ref={gridRef}
                className="grid gap-4 auto-rows-[var(--dashboard-tile-size)] grid-cols-[repeat(6,var(--dashboard-tile-size))] justify-start"
                style={{ '--dashboard-tile-size': `${TILE_SIZE_PX}px` } as React.CSSProperties}
              >
                {orderedTiles.map((tile) => (
                  <ShortcutCard
                    key={tile.id}
                    shortcut={tile}
                    onEdit={openTileEditor}
                    isEditMode={isEditMode}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <ShortcutDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeAllDialogs();
          } else {
            setDialogOpen(true);
          }
        }}
        shortcut={editingTile ?? null}
        onSave={handleSaveShortcut}
        onDelete={editingTile ? handleDeleteShortcut : undefined}
      />

      {editingTile && editingTile.type === 'widget' && editingTile.widget_type === 'clock' && (
        <ClockWidgetSettingsDialog
          open={clockSettingsDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeAllDialogs();
            } else {
              setClockSettingsDialogOpen(true);
            }
          }}
          settings={getClockWidgetSettings()}
          onSave={handleSaveClockWidgetSettings}
        />
      )}

      {editingTile && editingTile.type === 'widget' && editingTile.widget_type === 'weather' && (
        <WeatherWidgetSettingsDialog
          open={weatherSettingsDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeAllDialogs();
            } else {
              setWeatherSettingsDialogOpen(true);
            }
          }}
          settings={getWeatherWidgetSettings()}
          onSave={handleSaveWeatherWidgetSettings}
        />
      )}
    </div>
  );
};

export default Dashboard;

