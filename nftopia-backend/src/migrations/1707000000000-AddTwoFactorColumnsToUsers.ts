import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTwoFactorColumnsToUsers1707000000000
  implements MigrationInterface
{
  name = 'AddTwoFactorColumnsToUsers1707000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "two_factor_secret"       TEXT        DEFAULT NULL,
        ADD COLUMN "is_two_factor_enabled"   BOOLEAN     NOT NULL DEFAULT FALSE,
        ADD COLUMN "two_factor_backup_codes" TEXT        DEFAULT NULL,
        ADD COLUMN "two_factor_enabled_at"   TIMESTAMP   DEFAULT NULL,
        ADD COLUMN "two_factor_disabled_at"  TIMESTAMP   DEFAULT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN "two_factor_secret",
        DROP COLUMN "is_two_factor_enabled",
        DROP COLUMN "two_factor_backup_codes",
        DROP COLUMN "two_factor_enabled_at",
        DROP COLUMN "two_factor_disabled_at"
    `);
  }
}
