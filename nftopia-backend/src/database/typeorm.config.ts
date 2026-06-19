import 'dotenv/config';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';

export const MIGRATIONS_TABLE_NAME = 'migrations';
export const LEGACY_SQL_MIGRATIONS_DIR = join(process.cwd(), 'migrations');

function getDatabaseConnectionOptions(
  getValue: (key: string) => string | undefined,
) {
  return {
    url: getValue('DATABASE_URL'),
    host: getValue('DB_HOST'),
    port: parseInt(getValue('DB_PORT') || '5432', 10),
    username: getValue('DB_USER'),
    password: getValue('DB_PASS') || getValue('DB_PASSWORD'),
    database: getValue('DB_NAME'),
    extra: {
      max: parseInt(getValue('DB_POOL_SIZE') || '20', 10),
      idleTimeoutMillis: parseInt(
        getValue('DB_IDLE_TIMEOUT_MS') || '30000',
        10,
      ),
      connectionTimeoutMillis: parseInt(
        getValue('DB_CONNECTION_TIMEOUT_MS') || '10000',
        10,
      ),
    },
  };
}

function getNodeEnv(getValue: (key: string) => string | undefined) {
  return getValue('NODE_ENV') || 'development';
}

export function createTypeOrmOptions(
  config: ConfigService,
): TypeOrmModuleOptions {
  const getValue = (key: string) => config.get<string>(key) || process.env[key];
  const nodeEnv = getNodeEnv(getValue);

  return {
    type: 'postgres',
    ...getDatabaseConnectionOptions(getValue),
    autoLoadEntities: true,
    synchronize: nodeEnv !== 'production',
    logging: nodeEnv === 'development',
    migrationsRun: false,
    migrationsTableName: MIGRATIONS_TABLE_NAME,
    migrations: [
      join(process.cwd(), 'src/database/migrations/*.{ts,js}'),
      join(process.cwd(), 'dist/src/database/migrations/*.{ts,js}'),
    ],
  };
}

export function createMigrationDataSourceOptions(): DataSourceOptions {
  const getValue = (key: string) => process.env[key];
  const nodeEnv = getNodeEnv(getValue);

  return {
    type: 'postgres',
    ...getDatabaseConnectionOptions(getValue),
    synchronize: false,
    logging: nodeEnv === 'development',
    entities: [
      join(process.cwd(), 'src/**/*.entity.ts'),
      join(process.cwd(), 'dist/**/*.entity.js'),
    ],
    migrationsTableName: MIGRATIONS_TABLE_NAME,
    migrations: [
      join(process.cwd(), 'src/database/migrations/*.{ts,js}'),
      join(process.cwd(), 'dist/src/database/migrations/*.{ts,js}'),
    ],
  };
}

const migrationDataSource = new DataSource(createMigrationDataSourceOptions());

export default migrationDataSource;
