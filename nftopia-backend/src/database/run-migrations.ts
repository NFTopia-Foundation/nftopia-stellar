import 'dotenv/config';
import { DataSource } from 'typeorm';
import migrationDataSource, { MIGRATIONS_TABLE_NAME } from './typeorm.config';
import {
  ensureMigrationsTable,
  getLegacySqlMigrations,
  runPendingLegacySqlMigrations,
} from './legacy-sql-migrations';
import { RedisMigrationLock } from './migration-lock';

type MigrationNameRow = {
  name: string;
};

function toMigrationNameRows(value: unknown): MigrationNameRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rows: MigrationNameRow[] = [];

  for (const item of value as unknown[]) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const row = item as Record<string, unknown>;
    const name = row.name;

    if (typeof name === 'string') {
      rows.push({ name });
    }
  }

  return rows;
}

async function runTypeOrmMigrations(dataSource: DataSource) {
  const executed = await dataSource.runMigrations({ transaction: 'each' });
  if (executed.length === 0) {
    console.log('[migrations] No pending TypeORM migrations');
    return;
  }

  for (const migration of executed) {
    console.log(`[migrations] Applied TypeORM migration ${migration.name}`);
  }
}

async function revertTypeOrmMigration(dataSource: DataSource) {
  await ensureMigrationsTable(dataSource);

  const rows = toMigrationNameRows(
    await dataSource.query(
      `SELECT "name" FROM "${MIGRATIONS_TABLE_NAME}" ORDER BY "id" DESC LIMIT 1`,
    ),
  );
  const lastMigrationName = rows[0]?.name;

  if (!lastMigrationName) {
    console.log('[migrations] No applied migrations to revert');
    return;
  }

  const legacyMigrationNames = new Set(
    (await getLegacySqlMigrations()).map((migration) => migration.name),
  );
  const isLegacyMigration = legacyMigrationNames.has(lastMigrationName);

  if (isLegacyMigration) {
    throw new Error(
      `Cannot revert legacy SQL migration "${lastMigrationName}" automatically. Create a compensating migration instead.`,
    );
  }

  await dataSource.undoLastMigration({ transaction: 'each' });
  console.log(`[migrations] Reverted TypeORM migration ${lastMigrationName}`);
}

async function main() {
  const command = process.argv[2] || 'run';
  const lock = new RedisMigrationLock();
  const acquired = await lock.acquire();

  if (!acquired) {
    console.log(
      '[migrations] Another instance is already running migrations; exiting without error',
    );
    process.exit(0);
  }

  try {
    await migrationDataSource.initialize();
    await ensureMigrationsTable(migrationDataSource);

    if (command === 'run') {
      const legacyAppliedCount =
        await runPendingLegacySqlMigrations(migrationDataSource);
      if (legacyAppliedCount === 0) {
        console.log('[migrations] No pending legacy SQL migrations');
      }
      await runTypeOrmMigrations(migrationDataSource);
      return;
    }

    if (command === 'revert') {
      await revertTypeOrmMigration(migrationDataSource);
      return;
    }

    throw new Error(`Unsupported migration command: ${command}`);
  } finally {
    if (migrationDataSource.isInitialized) {
      await migrationDataSource.destroy();
    }
    await lock.release();
  }
}

void main().catch((error) => {
  console.error('[migrations] Migration command failed', error);
  process.exit(1);
});
