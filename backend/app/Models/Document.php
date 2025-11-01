<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    protected $fillable = [
        'name',
        'filename',
        'mime_type',
        'size',
        'path',
        'content',
        'chunks',
        'embeddings',
        'status',
    ];

    protected $casts = [
        'chunks' => 'array',
        'embeddings' => 'array',
    ];

    public function isReady(): bool
    {
        return $this->status === 'ready';
    }

    public function isProcessing(): bool
    {
        return $this->status === 'processing';
    }

    public function hasFailed(): bool
    {
        return $this->status === 'failed';
    }
}
