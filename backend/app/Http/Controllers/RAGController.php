<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Services\RAGService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class RAGController extends Controller
{
    protected $ragService;

    public function __construct(RAGService $ragService)
    {
        $this->ragService = $ragService;
    }

    /**
     * Upload a document for RAG processing
     */
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'document' => 'required|file|mimes:txt,pdf,doc,docx|max:10240', // 10MB max
        ]);

        try {
            $document = $this->ragService->uploadDocument($request->file('document'));

            return response()->json([
                'message' => 'Document uploaded successfully',
                'document' => $document,
            ], 201);

        } catch (\Exception $e) {
            Log::error('Document upload error', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to upload document'
            ], 500);
        }
    }

    /**
     * Query documents using RAG
     */
    public function query(Request $request): JsonResponse
    {
        $request->validate([
            'query' => 'required|string',
            'limit' => 'nullable|integer|min:1|max:10',
        ]);

        try {
            $response = $this->ragService->query(
                $request->query,
                $request->limit ?? 5
            );

            return response()->json([
                'query' => $request->query,
                'response' => $response,
            ]);

        } catch (\Exception $e) {
            Log::error('RAG query error', [
                'error' => $e->getMessage(),
                'query' => $request->query ?? null,
            ]);

            return response()->json([
                'error' => 'Failed to process query'
            ], 500);
        }
    }

    /**
     * Get all documents (including processing and failed ones)
     */
    public function documents(): JsonResponse
    {
        try {
            // Get all documents, not just ready ones
            $documents = Document::orderBy('created_at', 'desc')->get();

            return response()->json([
                'documents' => $documents,
            ]);

        } catch (\Exception $e) {
            Log::error('Get documents error', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to retrieve documents'
            ], 500);
        }
    }

    /**
     * Delete a document
     */
    public function destroy(int $id): JsonResponse
    {
        try {
            $success = $this->ragService->deleteDocument($id);

            if (!$success) {
                return response()->json(['error' => 'Document not found'], 404);
            }

            return response()->json([
                'message' => 'Document deleted successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Document deletion error', [
                'error' => $e->getMessage(),
                'document_id' => $id,
            ]);

            return response()->json([
                'error' => 'Failed to delete document'
            ], 500);
        }
    }
}