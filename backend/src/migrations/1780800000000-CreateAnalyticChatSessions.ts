import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnalyticChatSessions1780800000000
  implements MigrationInterface
{
  name = 'CreateAnalyticChatSessions1780800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "analytic_chat_sessions" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "session_id"  VARCHAR(255) NOT NULL UNIQUE,
        "user_id"     UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "district"    VARCHAR(255) NOT NULL,
        "title"       VARCHAR(500) NOT NULL DEFAULT 'New Chat',
        "turn_count"  INTEGER NOT NULL DEFAULT 0,
        "is_archived" BOOLEAN NOT NULL DEFAULT false,
        "created_at"  TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_acs_user_id"    ON "analytic_chat_sessions"("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_acs_session_id" ON "analytic_chat_sessions"("session_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_acs_updated_at" ON "analytic_chat_sessions"("updated_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "analytic_chat_sessions"`);
  }
}
