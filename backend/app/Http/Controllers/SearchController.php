<?php

namespace App\Http\Controllers;

use App\Services\SearchService;
use App\Services\LLMService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class SearchController extends Controller
{
    protected $searchService;
    protected $llmService;

    public function __construct(SearchService $searchService, LLMService $llmService)
    {
        $this->searchService = $searchService;
        $this->llmService = $llmService;
    }

    /**
     * Perform a web search
     */
    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'query' => 'required|string',
            'answer_with_llm' => 'nullable|boolean',
        ]);

        try {
            if ($request->answer_with_llm) {
                $response = $this->searchService->searchAndAnswer(
                    $request->query,
                    $this->llmService
                );

                return response()->json([
                    'query' => $request->query,
                    'type' => 'llm_answer',
                    'response' => $response,
                ]);
            } else {
                $results = $this->searchService->search($request->query);

                return response()->json([
                    'query' => $request->query,
                    'type' => 'search_results',
                    'results' => $results,
                ]);
            }

        } catch (\Exception $e) {
            Log::error('Search error', [
                'error' => $e->getMessage(),
                'query' => $request->query ?? null,
            ]);

            return response()->json([
                'error' => 'Search service temporarily unavailable'
            ], 500);
        }
    }

    /**
     * Get search service status
     */
    public function status(): JsonResponse
    {
        return response()->json([
            'configured' => $this->searchService->isConfigured(),
            'provider' => config('llm.search.provider'),
            'status' => $this->searchService->isConfigured() ? 'ready' : 'not_configured',
        ]);
    }
}