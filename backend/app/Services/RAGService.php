<?php

namespace App\Services;

use App\Models\Document;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Smalot\PdfParser\Parser as PdfParser;
use PhpOffice\PhpWord\IOFactory as PhpWordIOFactory;

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
     * Query documents using RAG and return relevant context chunks
     */
    public function getRelevantContext(string $query, int $limit = 5): array
    {
        $chunks = $this->findRelevantChunks($query, $limit);
        
        if (empty($chunks)) {
            return [];
        }

        // Format chunks for context
        $context = [];
        foreach ($chunks as $chunkData) {
            $context[] = "From document '{$chunkData['document_name']}':\n{$chunkData['chunk']}";
        }

        return $context;
    }

    /**
     * Query documents using RAG
     */
    public function query(string $query, int $limit = 5): string
    {
        $context = $this->getRelevantContext($query, $limit);
        
        if (empty($context)) {
            $response = $this->llmService->generateResponse($query);
            return is_array($response) ? $response['content'] : $response;
        }

        $response = $this->llmService->generateResponse($query, $context);
        return is_array($response) ? $response['content'] : $response;
    }

    /**
     * Find relevant documents for a query
     * Returns relevant chunks from documents using keyword matching
     */
    public function findRelevantChunks(string $query, int $limit = 5): array
    {
        $documents = Document::where('status', 'ready')->get();
        
        if ($documents->isEmpty()) {
            return [];
        }

        $relevantChunks = [];
        $keywords = array_filter(explode(' ', strtolower($query)), function($word) {
            return strlen($word) > 2; // Filter out short words
        });

        foreach ($documents as $document) {
            if (!$document->chunks || empty($document->chunks)) {
                // If no chunks, search in full content
                $content = strtolower($document->content ?? '');
                $score = 0;
                foreach ($keywords as $keyword) {
                    if (strpos($content, $keyword) !== false) {
                        $score += substr_count($content, $keyword);
                    }
                }
                
                if ($score > 0) {
                    // Use first 1000 chars as chunk
                    $chunk = substr($document->content, 0, 1000);
                    $relevantChunks[] = [
                        'document_id' => $document->id,
                        'document_name' => $document->name,
                        'chunk' => $chunk,
                        'score' => $score
                    ];
                }
            } else {
                // Search in chunks
                foreach ($document->chunks as $chunkIndex => $chunk) {
                    $chunkLower = strtolower($chunk);
                    $score = 0;
                    foreach ($keywords as $keyword) {
                        if (strpos($chunkLower, $keyword) !== false) {
                            $score += substr_count($chunkLower, $keyword);
                        }
                    }
                    
                    if ($score > 0) {
                        $relevantChunks[] = [
                            'document_id' => $document->id,
                            'document_name' => $document->name,
                            'chunk' => $chunk,
                            'score' => $score
                        ];
                    }
                }
            }
        }

        // Sort by score and limit
        usort($relevantChunks, function($a, $b) {
            return $b['score'] - $a['score'];
        });

        return array_slice($relevantChunks, 0, $limit);
    }

    /**
     * Find relevant documents for a query
     */
    protected function findRelevantDocuments(string $query, int $limit = 5)
    {
        // Use chunk-based search for better relevance
        $chunks = $this->findRelevantChunks($query, $limit);
        
        // Group by document and get unique documents
        $documentIds = array_unique(array_column($chunks, 'document_id'));
        $documents = Document::whereIn('id', $documentIds)->get();
        
        // Attach relevant chunks to documents
        foreach ($documents as $document) {
            $document->relevant_chunks = array_filter($chunks, function($chunk) use ($document) {
                return $chunk['document_id'] === $document->id;
            });
        }
        
        return $documents;
    }

    /**
     * Extract text content from a document
     */
    protected function extractTextContent(Document $document): string
    {
        $filePath = Storage::path($document->path);
        
        if (!file_exists($filePath)) {
            throw new \Exception("File not found: {$filePath}");
        }
        
        try {
            switch ($document->mime_type) {
                case 'text/plain':
                    $content = file_get_contents($filePath);
                    return $content !== false ? $content : '';
                
                case 'application/pdf':
                    return $this->extractPdfContent($filePath);
                
                case 'application/msword':
                case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                    return $this->extractWordContent($filePath);
                
                default:
                    // Try to extract based on file extension as fallback
                    $extension = strtolower(pathinfo($document->name, PATHINFO_EXTENSION));
                    
                    if ($extension === 'pdf') {
                        return $this->extractPdfContent($filePath);
                    } elseif (in_array($extension, ['doc', 'docx'])) {
                        return $this->extractWordContent($filePath);
                    } elseif ($extension === 'txt') {
                        $content = file_get_contents($filePath);
                        return $content !== false ? $content : '';
                    }
                    
                    throw new \Exception("Unsupported file type: {$document->mime_type}");
            }
        } catch (\Exception $e) {
            Log::error('Document extraction error', [
                'document_id' => $document->id,
                'file_path' => $filePath,
                'mime_type' => $document->mime_type,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Extract text from PDF file
     */
    protected function extractPdfContent(string $filePath): string
    {
        try {
            $parser = new PdfParser();
            $pdf = $parser->parseFile($filePath);
            $text = $pdf->getText();
            
            // Clean up the text
            $text = preg_replace('/\s+/', ' ', $text);
            $text = trim($text);
            
            return $text;
        } catch (\Exception $e) {
            Log::error('PDF extraction failed', [
                'file_path' => $filePath,
                'error' => $e->getMessage()
            ]);
            throw new \Exception("Failed to extract PDF content: " . $e->getMessage());
        }
    }

    /**
     * Extract text from Word document (DOC/DOCX)
     */
    protected function extractWordContent(string $filePath): string
    {
        try {
            $phpWord = PhpWordIOFactory::load($filePath);
            $text = '';
            
            foreach ($phpWord->getSections() as $section) {
                foreach ($section->getElements() as $element) {
                    if (method_exists($element, 'getText')) {
                        $text .= $element->getText() . "\n";
                    } elseif (method_exists($element, 'getRows')) {
                        // Handle tables
                        foreach ($element->getRows() as $row) {
                            foreach ($row->getCells() as $cell) {
                                foreach ($cell->getElements() as $cellElement) {
                                    if (method_exists($cellElement, 'getText')) {
                                        $text .= $cellElement->getText() . " ";
                                    }
                                }
                            }
                            $text .= "\n";
                        }
                    }
                }
            }
            
            // Clean up the text
            $text = preg_replace('/\s+/', ' ', $text);
            $text = trim($text);
            
            return $text;
        } catch (\Exception $e) {
            Log::error('Word document extraction failed', [
                'file_path' => $filePath,
                'error' => $e->getMessage()
            ]);
            throw new \Exception("Failed to extract Word document content: " . $e->getMessage());
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