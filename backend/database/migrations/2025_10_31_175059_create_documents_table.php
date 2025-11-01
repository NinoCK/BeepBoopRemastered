<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('filename');
            $table->string('mime_type');
            $table->integer('size');
            $table->string('path');
            $table->longText('content')->nullable(); // Extracted text content
            $table->json('chunks')->nullable(); // Text chunks for RAG
            $table->json('embeddings')->nullable(); // Vector embeddings
            $table->enum('status', ['processing', 'ready', 'failed'])->default('processing');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
