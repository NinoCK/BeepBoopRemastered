<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('shortcuts', function (Blueprint $table) {
            if (!Schema::hasColumn('shortcuts', 'grid_column')) {
                $table->unsignedTinyInteger('grid_column')->default(1)->after('span_rows');
            }

            if (!Schema::hasColumn('shortcuts', 'grid_row')) {
                $table->unsignedTinyInteger('grid_row')->default(1)->after('grid_column');
            }
        });

        $columnsPerRow = 6;
        $index = 0;
        $shortcuts = DB::table('shortcuts')
            ->orderBy('display_order')
            ->orderBy('id')
            ->get(['id']);

        foreach ($shortcuts as $shortcut) {
            $column = ($index % $columnsPerRow) + 1;
            $row = intdiv($index, $columnsPerRow) + 1;

            DB::table('shortcuts')
                ->where('id', $shortcut->id)
                ->update([
                    'grid_column' => $column,
                    'grid_row' => $row,
                ]);

            $index++;
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shortcuts', function (Blueprint $table) {
            if (Schema::hasColumn('shortcuts', 'grid_row')) {
                $table->dropColumn('grid_row');
            }

            if (Schema::hasColumn('shortcuts', 'grid_column')) {
                $table->dropColumn('grid_column');
            }
        });
    }
};
