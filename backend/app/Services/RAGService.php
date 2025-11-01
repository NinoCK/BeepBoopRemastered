<?php

namespace App\Services;

use App\Models\Document;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class RAGService
{
    protected $llmService;
    protected $documentsPath;

    public function __construct(LLMService $llmService)
    {
        $this->llmService = $llmService;
        $this->documentsPath = config('llm.rag.documents_path');
    }

    /**
     * Upload and process a document for RAG
     */
    public function uploadDocument(UploadedFile $file): Document
    {
        $filename = time() . '_' . $file->getClientOriginalName();
        $path = $file->storeAs('documents', $filename);

        $document = Document::create([
            'name' => $file->getClientOriginalName(),
            'filename' => $filename,
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'path' => $path,
            'status' => 'processing',
        ]);

        // Process the document asynchronously (in a real app, use queues)
        $this->processDocument($document);

        return $document;
    }

    /**
     * Process a document to extract text and create chunks
     */
    public function processDocument(Document $document): void
    {
        try {
            $content = $this->extractTextContent($document);
            $chunks = $this->createTextChunks($content);
            $embeddings = $this->generateEmbeddings($chunks);

            $document->update([
                'content' => $content,
                'chunks' => $chunks,
                'embeddings' => $embeddings,
                'status' => 'ready',
            ]);

            Log::info('Document processed successfully', ['document_id' => $document->id]);

        } catch (\Exception $e) {
            $document->update(['status' => 'failed']);
            Log::error('Document processing failed', [
                'document_id' => $document->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Query documents using RAG
     */
    public function query(string $query, int $limit = 5): string
    {
        $relevantDocuments = $this->findRelevantDocuments($query, $limit);
        
        if ($relevantDocuments->isEmpty()) {
            return $this->llmService->generateResponse($query);
        }

        $context = $relevantDocuments->map(function ($doc) {
            return "Document: {$doc->name}\nContent: {$doc->content}";
        })->toArray();

        return $this->llmService->generateResponse($query, $context);
    }

    /**
     * Find relevant documents for a query
     */
    protected function findRelevantDocuments(string $query, int $limit = 5)
    {
        // Simple keyword-based search for now
        // In a production app, you'd use vector similarity search
        return Document::where('status', 'ready')
            ->where(function ($q) use ($query) {
                $keywords = explode(' ', strtolower($query));
                foreach ($keywords as $keyword) {
                    $q->orWhere('content', 'LIKE', "%{$keyword}%");
                }
            })
            ->limit($limit)
            ->get();
    }

    /**
     * Extract text content from a document
     */
    protected function extractTextContent(Document $document): string
    {
        $filePath = Storage::path($document->path);
        
        switch ($document->mime_type) {
            case 'text/plain':
                return file_get_contents($filePath);
            
            case 'application/pdf':
                // In a real app, you'd use a PDF parsing library
                return "PDF content extraction not implemented. File: {$document->name}";
            
            case 'application/msword':
            case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                // In a real app, you'd use a Word document parsing library
                return "Word document content extraction not implemented. File: {$document->name}";
            
            default:
                return "Unsupported file type: {$document->mime_type}";
        }
    }

    /**
     * Create text chunks from content
     */
    protected function createTextChunks(string $content): array
    {
        $chunkSize = config('llm.rag.chunk_size', 1000);
        $overlapSize = config('llm.rag.overlap_size', 200);

        $chunks = [];
        $words = explode(' ', $content);
        $totalWords = count($words);

        for ($i = 0; $i < $totalWords; $i += $chunkSize - $overlapSize) {
            $chunk = implode(' ', array_slice($words, $i, $chunkSize));
            if (!empty(trim($chunk))) {
                $chunks[] = $chunk;
            }
        }

        return $chunks;
    }

    /**
     * Generate embeddings for text chunks
     */
    protected function generateEmbeddings(array $chunks): array
    {
        $embeddings = [];
        
        foreach ($chunks as $chunk) {
            $embeddings[] = $this->llmService->generateEmbeddings($chunk);
        }

        return $embeddings;
    }

    /**
     * Get all ready documents
     */
    public function getDocuments()
    {
        return Document::where('status', 'ready')->get();
    }

    /**
     * Delete a document
     */
    public function deleteDocument(int $documentId): bool
    {
        $document = Document::find($documentId);
        
        if (!$document) {
            return false;
        }

        Storage::delete($document->path);
        $document->delete();

        return true;
    }
}