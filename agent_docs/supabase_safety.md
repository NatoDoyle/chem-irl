# Supabase and database safety

## Migration immutability
- Never modify an already-applied migration.
- To check whether a migration timestamp has been applied, run in the Supabase Dashboard SQL Editor:

```sql
SELECT 1
FROM supabase_migrations.schema_migrations
WHERE version = '<timestamp>';