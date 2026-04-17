import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailLogs1780500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient_email      VARCHAR(320)  NOT NULL,
        recipient_name       VARCHAR(255)  NULL,
        subject              VARCHAR(998)  NOT NULL,
        template_name        VARCHAR(100)  NOT NULL,
        template_data        JSONB         NULL,
        status               VARCHAR(20)   NOT NULL DEFAULT 'pending',
        error_message        TEXT          NULL,
        message_id           VARCHAR(255)  NULL,
        related_entity_type  VARCHAR(50)   NULL,
        related_entity_id    UUID          NULL,
        triggered_by_user_id UUID          NULL,
        created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        sent_at              TIMESTAMPTZ   NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_email_logs_status
        ON email_logs (status)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_email_logs_recipient
        ON email_logs (recipient_email)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_email_logs_related_entity
        ON email_logs (related_entity_type, related_entity_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_email_logs_created_at
        ON email_logs (created_at DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS email_logs`);
  }
}
