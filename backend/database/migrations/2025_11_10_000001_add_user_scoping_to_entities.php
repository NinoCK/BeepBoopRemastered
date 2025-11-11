<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('chats', function (Blueprint $table) {
            if (!Schema::hasColumn('chats', 'user_id')) {
                $table->foreignId('user_id')
                    ->nullable()
                    ->after('id')
                    ->constrained()
                    ->cascadeOnDelete();
            }
        });

        Schema::table('messages', function (Blueprint $table) {
            if (!Schema::hasColumn('messages', 'user_id')) {
                $table->foreignId('user_id')
                    ->nullable()
                    ->after('chat_id')
                    ->constrained()
                    ->cascadeOnDelete();
            }
        });

        Schema::table('documents', function (Blueprint $table) {
            if (!Schema::hasColumn('documents', 'user_id')) {
                $table->foreignId('user_id')
                    ->nullable()
                    ->after('id')
                    ->constrained()
                    ->cascadeOnDelete();
            }
        });

        Schema::table('shortcuts', function (Blueprint $table) {
            if (!Schema::hasColumn('shortcuts', 'user_id')) {
                $table->foreignId('user_id')
                    ->nullable()
                    ->after('id')
                    ->constrained()
                    ->cascadeOnDelete();
            }
        });

        // Attempt to backfill existing records to the earliest user to maintain access
        $defaultUserId = DB::table('users')->orderBy('id')->value('id');

        if ($defaultUserId) {
            DB::table('chats')->whereNull('user_id')->update(['user_id' => $defaultUserId]);
            DB::table('messages')->whereNull('user_id')->update(['user_id' => $defaultUserId]);
            DB::table('documents')->whereNull('user_id')->update(['user_id' => $defaultUserId]);
            DB::table('shortcuts')->whereNull('user_id')->update(['user_id' => $defaultUserId]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shortcuts', function (Blueprint $table) {
            if (Schema::hasColumn('shortcuts', 'user_id')) {
                $table->dropConstrainedForeignId('user_id');
            }
        });

        Schema::table('documents', function (Blueprint $table) {
            if (Schema::hasColumn('documents', 'user_id')) {
                $table->dropConstrainedForeignId('user_id');
            }
        });

        Schema::table('messages', function (Blueprint $table) {
            if (Schema::hasColumn('messages', 'user_id')) {
                $table->dropConstrainedForeignId('user_id');
            }
        });

        Schema::table('chats', function (Blueprint $table) {
            if (Schema::hasColumn('chats', 'user_id')) {
                $table->dropConstrainedForeignId('user_id');
            }
        });
    }
};

