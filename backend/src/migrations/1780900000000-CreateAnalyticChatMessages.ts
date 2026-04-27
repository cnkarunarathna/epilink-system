import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnalyticChatMessages1780900000000
  implements MigrationInterface
{
  name = 'CreateAnalyticChatMessages1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "analytic_chat_messages" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "chat_session_id" UUID NOT NULL REFERENCES "analytic_chat_sessions"("id") ON DELETE CASCADE,
        "role"            VARCHAR(20) NOT NULL,
        "content"         TEXT NOT NULL,
        "tool_calls"      JSONB,
        "created_at"      TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_acm_session" ON "analytic_chat_messages"("chat_session_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "analytic_chat_messages"`);
  }
}
