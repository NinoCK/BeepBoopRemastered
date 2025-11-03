<?php

namespace App\Http\Controllers;

use App\Models\Shortcut;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class ShortcutController extends Controller
{
    /**
     * Get all shortcuts
     */
    public function index(): JsonResponse
    {
        try {
            $shortcuts = Shortcut::orderBy('created_at', 'desc')->get();
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
            $validator = Validator::make($request->all(), [
                'name' => 'required|string|max:255',
                'url' => ['required', 'string', 'max:500', function ($attribute, $value, $fail) {
                    // Accept URLs with or without protocol
                    if (!filter_var($value, FILTER_VALIDATE_URL) && !filter_var('https://' . $value, FILTER_VALIDATE_URL)) {
                        $fail('The URL must be a valid URL.');
                    }
                }],
                'icon' => 'nullable|string|max:100',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Ensure URL has protocol
            $url = $request->url;
            if (!preg_match('/^https?:\/\//', $url)) {
                $url = 'https://' . $url;
            }

            $shortcut = Shortcut::create([
                'name' => $request->name,
                'url' => $url,
                'icon' => $request->icon ?? 'Link',
            ]);

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
        $shortcut = Shortcut::find($id);

        if (!$shortcut) {
            return response()->json(['error' => 'Shortcut not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'url' => 'sometimes|required|url|max:500',
            'icon' => 'nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $shortcut->update($request->only(['name', 'url', 'icon']));

        return response()->json($shortcut);
    }

    /**
     * Delete a shortcut
     */
    public function destroy(int $id): JsonResponse
    {
        $shortcut = Shortcut::find($id);

        if (!$shortcut) {
            return response()->json(['error' => 'Shortcut not found'], 404);
        }

        $shortcut->delete();

        return response()->json(['message' => 'Shortcut deleted successfully']);
    }
}

