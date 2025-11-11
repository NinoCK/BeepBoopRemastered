<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Document extends Model
{
    protected $fillable = [
        'user_id',
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

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

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
