import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const ADVISORY_LOCK_KEY = 8675309; // deterministic app-wide lock key

@Injectable()
export class MigrationLockService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MigrationLockService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    if (process.env.RUN_MIGRATIONS !== 'true') return;

    await this.runWithAdvisoryLock();
  }

  private async runWithAdvisoryLock(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      this.logger.log('Acquiring PostgreSQL advisory lock for migrations…');
      await queryRunner.query(
        `SELECT pg_advisory_lock($1)`,
        [ADVISORY_LOCK_KEY],
      );
      this.logger.log('Advisory lock acquired — running pending migrations');

      const migrations = await this.dataSource.runMigrations({
        transaction: 'each',
      });

      if (migrations.length === 0) {
        this.logger.log('No pending migrations to run');
      } else {
        this.logger.log(
          `Ran ${migrations.length} migration(s): ${migrations.map((m) => m.name).join(', ')}`,
        );
      }
    } catch (err) {
      this.logger.error('Migration failed', err instanceof Error ? err.stack : String(err));
      throw err;
    } finally {
      await queryRunner.query(
        `SELECT pg_advisory_unlock($1)`,
        [ADVISORY_LOCK_KEY],
      );
      this.logger.log('Advisory lock released');
      await queryRunner.release();
    }
  }
}
