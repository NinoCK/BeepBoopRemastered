<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Shortcut extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'url',
        'icon',
        'type',
        'widget_type',
        'settings',
        'display_order',
        'span_columns',
        'span_rows',
        'grid_column',
        'grid_row',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

