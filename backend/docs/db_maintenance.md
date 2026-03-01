# Database Maintenance Guide

## Exporting User Data (Backup)

Before any destructive DB operation (migrations, schema changes, full reset), **always export first**:

```bash
docker compose exec api python -m app.db_export_import export /app/backup_$(date +%Y%m%d).json
```

Then copy the file out of the container:

```bash
docker cp $(docker compose ps -q api):/app/backup_YYYYMMDD.json ./backups/
```

## Importing User Data (Restore)

After re-creating the DB and running seeds:

```bash
# 1. Re-seed exercises
docker compose exec api python -m app.seed_data

# 2. Import user data
docker compose exec api python -m app.db_export_import import /app/backup_YYYYMMDD.json
```

## What Gets Exported

| Table         | Exported? | Notes                             |
| ------------- | --------- | --------------------------------- |
| `users`       | ✅ Yes     | Including hashed passwords        |
| `routines`    | ✅ Yes     | Including days/exercises JSON     |
| `sessions`    | ✅ Yes     | Both drafts and completed         |
| `sets`        | ✅ Yes     | All set data                      |
| `exercises`   | ❌ No      | System exercises are re-seeded    |
| `sync_events` | ❌ No      | Transient, not needed for restore |

## Full DB Reset Procedure

```bash
# 1. Export current data
docker compose exec api python -m app.db_export_import export /app/backup.json

# 2. Stop containers
docker compose down

# 3. Remove the DB volume (DESTRUCTIVE)
docker volume rm gym-ai-tracker_postgres_data

# 4. Restart (creates fresh DB)
docker compose up -d

# 5. Run migrations
docker compose exec api alembic upgrade head

# 6. Re-seed exercises
docker compose exec api python -m app.seed_data

# 7. Restore user data
docker compose exec api python -m app.db_export_import import /app/backup.json
```

## Import Behavior

- **Users**: Skipped if the email already exists (no duplicates).
- **Routines/Sessions/Sets**: Skipped if the primary key ID already exists.  
- ID mappings are maintained so FK relationships stay valid.
- The import is safe to run multiple times (idempotent).
