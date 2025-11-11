<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class ShortcutController extends Controller
{
    private const GRID_COLUMNS = 6;
    private const MAX_GRID_COLUMNS = 12;
    private const MAX_GRID_ROWS = 24;

    /**
     * Get all shortcuts
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $shortcuts = $request->user()->shortcuts()
                ->orderBy('display_order')
                ->orderBy('created_at', 'desc')
                ->get();
            return response()->json($shortcuts);
        } catch (\Exception $e) {
            \Log::error('Shortcut index error: ' . $e->getMessage(), [
                'exception' => $e
            ]);
            
            return response()->json([
                'error' => 'Failed to fetch shortcuts',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Create a new shortcut
     */
    public function create(Request $request): JsonResponse
    {
        try {
            $type = $request->input('type', 'shortcut');
            $isWidget = $type === 'widget';

            $validator = Validator::make($request->all(), [
                'name' => $isWidget ? 'nullable|string|max:255' : 'required|string|max:255',
                'url' => $isWidget ? 'nullable|string|max:500' : ['required', 'string', 'max:500', function ($attribute, $value, $fail) {
                    // Accept URLs with or without protocol
                    if (!filter_var($value, FILTER_VALIDATE_URL) && !filter_var('https://' . $value, FILTER_VALIDATE_URL)) {
                        $fail('The URL must be a valid URL.');
                    }
                }],
                'icon' => 'nullable|string|max:1000',
                'type' => 'nullable|in:shortcut,widget',
                'widget_type' => 'nullable|in:clock,weather',
                'settings' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Prepare data
            $data = [];

            // Name - required for shortcuts, optional for widgets
            if ($isWidget) {
                // Widgets can have null name
                $data['name'] = $request->has('name') && $request->name !== null && $request->name !== '' 
                    ? $request->name 
                    : null;
            } else {
                // Shortcuts require name
                $data['name'] = $request->name;
            }

            // URL - only for shortcuts
            if (!$isWidget) {
                $url = $request->url;
                // Ensure URL has protocol
                if (!preg_match('/^https?:\/\//', $url)) {
                    $url = 'https://' . $url;
                }
                $data['url'] = $url;
            } else {
                $data['url'] = null; // Widgets don't have URLs
            }

            // Icon - optional for both
            if ($request->has('icon')) {
                $icon = $request->icon;
                $data['icon'] = (empty($icon) || trim($icon) === '') ? null : $icon;
            }

            // Widget-specific fields
            if ($isWidget) {
                $data['type'] = 'widget';
                if ($request->has('widget_type')) {
                    $data['widget_type'] = $request->widget_type;
                }
                if ($request->has('settings')) {
                    $data['settings'] = $request->settings;
                }
            } else {
                $data['type'] = 'shortcut';
            }

            // Layout defaults
            $user = $request->user();

            $nextDisplayOrder = ($user->shortcuts()->max('display_order') ?? -1) + 1;
            $data['display_order'] = $nextDisplayOrder;

            $data['grid_column'] = ($nextDisplayOrder % self::GRID_COLUMNS) + 1;
            $data['grid_row'] = intdiv($nextDisplayOrder, self::GRID_COLUMNS) + 1;

            $spans = $this->resolveSpans($data['type'] ?? 'shortcut', $data['widget_type'] ?? null, $data['settings'] ?? null);
            $data['span_columns'] = $spans['columns'];
            $data['span_rows'] = $spans['rows'];

            $shortcut = $user->shortcuts()->create($data);

            return response()->json($shortcut, 201);
        } catch (\Exception $e) {
            \Log::error('Shortcut creation error: ' . $e->getMessage(), [
                'exception' => $e,
                'request' => $request->all()
            ]);
            
            return response()->json([
                'error' => 'Failed to create shortcut',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update a shortcut
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $shortcut = $request->user()->shortcuts()->find($id);

        if (!$shortcut) {
            return response()->json(['error' => 'Shortcut not found'], 404);
        }

        $type = $request->input('type', $shortcut->type ?? 'shortcut');
        $isWidget = $type === 'widget';

        $validator = Validator::make($request->all(), [
            'name' => $isWidget ? 'nullable|string|max:255' : 'sometimes|required|string|max:255',
            'url' => $isWidget ? 'nullable|string|max:500' : 'sometimes|required|url|max:500',
            'icon' => 'nullable|string|max:1000',
            'type' => 'nullable|in:shortcut,widget',
            'widget_type' => 'nullable|in:clock,weather',
            'settings' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Prepare update data
        $updateData = [];

        // Name - only update if provided
        if ($request->has('name')) {
            $updateData['name'] = $request->name;
        } elseif ($isWidget) {
            // Widgets can have null name
            $updateData['name'] = null;
        }

        // URL - only for shortcuts
        if ($request->has('url')) {
            if (!$isWidget) {
                $updateData['url'] = $request->url;
            }
        } elseif ($isWidget) {
            $updateData['url'] = null;
        }

        // Icon
        if ($request->has('icon')) {
            $icon = $request->icon;
            $updateData['icon'] = (empty($icon) || trim($icon) === '') ? null : $icon;
        }

        // Widget-specific fields
        if ($request->has('type')) {
            $updateData['type'] = $request->type;
        }
        if ($request->has('widget_type')) {
            $updateData['widget_type'] = $request->widget_type;
        }
        if ($request->has('settings')) {
            $updateData['settings'] = $request->settings;
        }

        // Update span metadata when relevant fields change
        $shouldRecalculateSpans = $request->has('type')
            || $request->has('widget_type')
            || $request->has('settings');

        if ($shouldRecalculateSpans) {
            $spans = $this->resolveSpans(
                $updateData['type'] ?? $shortcut->type ?? 'shortcut',
                $updateData['widget_type'] ?? $shortcut->widget_type,
                $updateData['settings'] ?? $shortcut->settings
            );

            $updateData['span_columns'] = $spans['columns'];
            $updateData['span_rows'] = $spans['rows'];
        }

        $shortcut->update($updateData);

        return response()->json($shortcut->refresh());
    }

    /**
     * Delete a shortcut
     */
    public function destroy(int $id): JsonResponse
    {
        $shortcut = $request->user()->shortcuts()->find($id);

        if (!$shortcut) {
            return response()->json(['error' => 'Shortcut not found'], 404);
        }

        $shortcut->delete();

        return response()->json(['message' => 'Shortcut deleted successfully']);
    }

    /**
     * Persist dashboard layout ordering and spans
     */
    public function updateLayout(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'tiles' => 'required|array|min:1',
            'tiles.*.id' => 'required|integer|exists:shortcuts,id',
            'tiles.*.display_order' => 'required|integer|min:0',
            'tiles.*.span_columns' => 'nullable|integer|min:1|max:6',
            'tiles.*.span_rows' => 'nullable|integer|min:1|max:6',
            'tiles.*.grid_column' => 'nullable|integer|min:1|max:' . self::MAX_GRID_COLUMNS,
            'tiles.*.grid_row' => 'nullable|integer|min:1|max:' . self::MAX_GRID_ROWS,
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $tiles = $validator->validated()['tiles'];

        $user = $request->user();

        $ownedShortcutIds = $user->shortcuts()
            ->whereIn('id', collect($tiles)->pluck('id'))
            ->pluck('id')
            ->all();

        if (count($ownedShortcutIds) !== count($tiles)) {
            return response()->json([
                'error' => 'One or more tiles do not belong to the authenticated user.',
            ], 403);
        }

        DB::transaction(function () use ($tiles, $user) {
            foreach ($tiles as $tile) {
                $updates = [
                    'display_order' => $tile['display_order'],
                ];

                if (array_key_exists('span_columns', $tile)) {
                    $updates['span_columns'] = $tile['span_columns'];
                }

                if (array_key_exists('span_rows', $tile)) {
                    $updates['span_rows'] = $tile['span_rows'];
                }

                if (array_key_exists('grid_column', $tile)) {
                    $updates['grid_column'] = $tile['grid_column'];
                }

                if (array_key_exists('grid_row', $tile)) {
                    $updates['grid_row'] = $tile['grid_row'];
                }

                $user->shortcuts()->where('id', $tile['id'])->update($updates);
            }
        });

        return response()->json(['message' => 'Layout updated successfully']);
    }

    /**
     * Determine span metadata for a shortcut or widget
     */
    private function resolveSpans(string $type, ?string $widgetType, $settings): array
    {
        if ($type !== 'widget') {
            return [
                'columns' => 1,
                'rows' => 1,
            ];
        }

        $size = '1x1';

        if (is_string($settings)) {
            try {
                $settingsData = json_decode($settings, true, 512, JSON_THROW_ON_ERROR);
                if (isset($settingsData['size']) && is_string($settingsData['size'])) {
                    $size = $settingsData['size'];
                }
            } catch (\JsonException $e) {
                \Log::warning('Invalid widget settings JSON when resolving spans', [
                    'settings' => $settings,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return match ($size) {
            '2x2' => ['columns' => 2, 'rows' => 2],
            '1x2' => ['columns' => 1, 'rows' => 2],
            '2x1' => ['columns' => 2, 'rows' => 1],
            default => ['columns' => 1, 'rows' => 1],
        };
    }
}

