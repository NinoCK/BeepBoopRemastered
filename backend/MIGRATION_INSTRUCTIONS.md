# Migration Instructions for Shortcuts

## Run the Migration

To create the shortcuts table in your database, run the following command from the backend directory:

```bash
cd personal-ai-assistant/backend
php artisan migrate
```

Or if you're already in the backend directory:

```bash
php artisan migrate
```

This will create the `shortcuts` table with the following structure:
- `id` (primary key)
- `name` (string)
- `url` (string)
- `icon` (string, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

## Verify Migration

After running the migration, you can verify it was successful by checking:

1. The database should have a `shortcuts` table
2. The API endpoints should work:
   - GET `/api/shortcuts` - List all shortcuts
   - POST `/api/shortcuts` - Create a shortcut
   - PUT `/api/shortcuts/{id}` - Update a shortcut
   - DELETE `/api/shortcuts/{id}` - Delete a shortcut

## Troubleshooting

If you get a 500 error after running the migration:
1. Check the Laravel logs: `storage/logs/laravel.log`
2. Verify the database connection in `.env`
3. Ensure the SQLite database file exists: `database/database.sqlite`

