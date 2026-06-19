import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getPendingLegacySqlMigrations } from './legacy-sql-migrations';

type SchemaStatus = {
  ready: boolean;
  pendingLegacyMigrations: string[];
  pendingTypeOrmMigrations: boolean;
};

@Injectable()
export class SchemaReadinessService {
  private readonly logger = new Logger(SchemaReadinessService.name);

  constructor(private readonly dataSource: DataSource) {}

  isEnforced(): boolean {
    return (
      process.env.NODE_ENV === 'production' ||
      process.env.REQUIRE_SCHEMA_READY === 'true'
    );
  }

  async getSchemaStatus(): Promise<SchemaStatus> {
    if (!this.dataSource.isInitialized) {
      return {
        ready: false,
        pendingLegacyMigrations: [],
        pendingTypeOrmMigrations: false,
      };
    }

    if (!this.isEnforced()) {
      return {
        ready: true,
        pendingLegacyMigrations: [],
        pendingTypeOrmMigrations: false,
      };
    }

    const pendingLegacy = await getPendingLegacySqlMigrations(this.dataSource);
    const pendingTypeOrmMigrations = await this.dataSource.showMigrations();

    return {
      ready: pendingLegacy.length === 0 && pendingTypeOrmMigrations === false,
      pendingLegacyMigrations: pendingLegacy.map((migration) => migration.name),
      pendingTypeOrmMigrations,
    };
  }

  async waitUntilReady(options?: {
    intervalMs?: number;
    timeoutMs?: number;
  }): Promise<boolean> {
    if (!this.isEnforced()) {
      return true;
    }

    const intervalMs = options?.intervalMs ?? 5000;
    const timeoutMs = options?.timeoutMs ?? 300000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const status = await this.getSchemaStatus();
      if (status.ready) {
        return true;
      }

      this.logger.warn(
        `Schema not ready yet; pending legacy migrations=${status.pendingLegacyMigrations.join(', ') || 'none'}, pending TypeORM migrations=${status.pendingTypeOrmMigrations}`,
      );
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return false;
  }
}
