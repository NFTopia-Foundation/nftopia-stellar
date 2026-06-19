import { readdir } from 'fs/promises';
import { readFile } from 'fs/promises';
import { basename, join } from 'path';
import { DataSource } from 'typeorm';
import {
  LEGACY_SQL_MIGRATIONS_DIR,
  MIGRATIONS_TABLE_NAME,
} from './typeorm.config';

type LegacySqlMigration = {
  filePath: string;
  name: string;
  timestamp: number;
};

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

function parseMigrationName(fileName: string): LegacySqlMigration {
  const name = basename(fileName, '.sql');
  const [timestampToken] = name.split('_');
  const timestamp = parseInt(timestampToken, 10);

  return {
    filePath: join(LEGACY_SQL_MIGRATIONS_DIR, fileName),
    name,
    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
  };
}

export async function ensureMigrationsTable(dataSource: DataSource) {
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE_NAME}" (
      "id" SERIAL PRIMARY KEY,
      "timestamp" bigint NOT NULL,
      "name" character varying NOT NULL
    )
  `);
}

export async function getLegacySqlMigrations(): Promise<LegacySqlMigration[]> {
  const files = await readdir(LEGACY_SQL_MIGRATIONS_DIR);

  return files
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort()
    .map(parseMigrationName);
}

export async function getAppliedMigrationNames(
  dataSource: DataSource,
): Promise<Set<string>> {
  await ensureMigrationsTable(dataSource);
  const rows = toMigrationNameRows(
    await dataSource.query(`SELECT "name" FROM "${MIGRATIONS_TABLE_NAME}"`),
  );

  return new Set(rows.map((row) => row.name));
}

export async function getPendingLegacySqlMigrations(dataSource: DataSource) {
  const [migrations, applied] = await Promise.all([
    getLegacySqlMigrations(),
    getAppliedMigrationNames(dataSource),
  ]);

  return migrations.filter((migration) => !applied.has(migration.name));
}

export async function runPendingLegacySqlMigrations(dataSource: DataSource) {
  const pending = await getPendingLegacySqlMigrations(dataSource);

  for (const migration of pending) {
    const queryRunner = dataSource.createQueryRunner();
    const sql = await readFile(migration.filePath, 'utf8');

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(sql);
      await queryRunner.query(
        `INSERT INTO "${MIGRATIONS_TABLE_NAME}" ("timestamp", "name") VALUES ($1, $2)`,
        [migration.timestamp, migration.name],
      );
      await queryRunner.commitTransaction();
      console.log(
        `[migrations] Applied legacy SQL migration ${migration.name}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  return pending.length;
}
