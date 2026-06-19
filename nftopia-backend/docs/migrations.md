# Database Migration Strategy

NFTopia Backend uses explicit database migrations for production schema changes. Application startup does not run migrations.

## Goals

- Prevent concurrent schema changes during rolling deploys and scale-up events.
- Keep production schema history in the `migrations` table.
- Block deployment if migrations fail.
- Keep background jobs from starting against a partially updated schema.

## Commands

```bash
npm run migration:run
npm run migration:revert
npm run migration:create -- src/database/migrations/AddExampleColumn
npm run migration:generate -- src/database/migrations/AddExampleColumn
```

## How `migration:run` Works

1. Acquires a Redis lock using `MIGRATION_LOCK_KEY`.
2. Sets a 5 minute lock TTL by default with `MIGRATION_LOCK_TTL_MS=300000`.
3. Applies legacy SQL files from `migrations/*.sql` that are not yet recorded.
4. Runs pending TypeORM migrations from `src/database/migrations`.
5. Releases the Redis lock even when the run fails.

If another instance already owns the lock, the command exits cleanly without applying schema changes.

## Deployment Flow

1. Build and test the backend.
2. Run `npm run migration:run` in CI/CD before deploying new application instances.
3. Only continue to the deployment stage when migrations succeed.
4. Start application instances after the schema is current.

The readiness probe reports `schema: down` when production still has unapplied migrations. `IndexerService` waits for schema readiness before starting ledger ingestion.

## Creating Migrations

- Use `migration:generate` when entity changes can be expressed as a TypeORM diff.
- Use `migration:create` for hand-written migrations or operational SQL.
- Keep destructive changes reversible when possible.
- Test migrations against a staging or ephemeral database before production rollout.

## Rollback Plan

1. If a TypeORM migration fails before commit, the transaction is rolled back automatically.
2. If a deployed release must be rolled back, run `npm run migration:revert` only for the most recent TypeORM migration when it has a safe `down` implementation.
3. Legacy SQL migrations in `migrations/*.sql` are treated as forward-only. Roll them back with a compensating migration instead of editing history.
4. If a migration partially applies outside a transaction, stop the deployment, inspect the `migrations` table, and create a corrective migration before retrying.

## Monitoring

- Migration commands log every applied migration to stdout/stderr for CI collection.
- A failed migration exits non-zero so CI/CD can stop the rollout.
- Readiness checks surface pending schema work through `/health/ready`.
