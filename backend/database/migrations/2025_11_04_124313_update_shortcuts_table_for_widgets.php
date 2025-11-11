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
            // Make name and url nullable for widgets
            $table->string('name')->nullable()->change();
            $table->string('url')->nullable()->change();
            
            // Add widget support columns
            $table->string('type')->default('shortcut')->after('icon'); // 'shortcut' or 'widget'
            $table->string('widget_type')->nullable()->after('type'); // 'clock' or 'weather' for widgets
            $table->text('settings')->nullable()->after('widget_type'); // JSON string with widget settings
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shortcuts', function (Blueprint $table) {
            // Remove widget columns
            $table->dropColumn(['type', 'widget_type', 'settings']);
            
            // Revert name and url to non-nullable (if needed)
            $table->string('name')->nullable(false)->change();
            $table->string('url')->nullable(false)->change();
        });
    }
};
