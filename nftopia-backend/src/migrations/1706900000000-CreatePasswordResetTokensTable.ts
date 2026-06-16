import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePasswordResetTokensTable1706900000000
  implements MigrationInterface
{
  name = 'CreatePasswordResetTokensTable1706900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id"          UUID              NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"     UUID              NOT NULL,
        "token_hash"  VARCHAR(64)       NOT NULL,
        "expires_at"  TIMESTAMP         NOT NULL,
        "used_at"     TIMESTAMP,
        "ip_address"  VARCHAR(45),
        "created_at"  TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_password_reset_tokens"        PRIMARY KEY ("id"),
        CONSTRAINT "UQ_password_reset_tokens_hash"   UNIQUE ("token_hash"),
        CONSTRAINT "FK_password_reset_tokens_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_password_reset_tokens_user_id"
        ON "password_reset_tokens" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_password_reset_tokens_expires_at"
        ON "password_reset_tokens" ("expires_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
  }
}
