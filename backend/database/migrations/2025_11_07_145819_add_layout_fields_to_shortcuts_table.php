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
        Schema::table('shortcuts', function (Blueprint $table) {
            if (!Schema::hasColumn('shortcuts', 'display_order')) {
                $table->unsignedInteger('display_order')->default(0)->after('settings');
            }

            if (!Schema::hasColumn('shortcuts', 'span_columns')) {
                $table->unsignedTinyInteger('span_columns')->default(1)->after('display_order');
            }

            if (!Schema::hasColumn('shortcuts', 'span_rows')) {
                $table->unsignedTinyInteger('span_rows')->default(1)->after('span_columns');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shortcuts', function (Blueprint $table) {
            if (Schema::hasColumn('shortcuts', 'span_rows')) {
                $table->dropColumn('span_rows');
            }

            if (Schema::hasColumn('shortcuts', 'span_columns')) {
                $table->dropColumn('span_columns');
            }

            if (Schema::hasColumn('shortcuts', 'display_order')) {
                $table->dropColumn('display_order');
            }
        });
    }
};
