import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationPreferences1780600000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id              UUID    NOT NULL UNIQUE,
        task_assigned        BOOLEAN NOT NULL DEFAULT TRUE,
        task_status_changed  BOOLEAN NOT NULL DEFAULT TRUE,
        task_reminder        BOOLEAN NOT NULL DEFAULT TRUE,
        task_overdue         BOOLEAN NOT NULL DEFAULT TRUE,
        evidence_review      BOOLEAN NOT NULL DEFAULT TRUE,
        report_ready         BOOLEAN NOT NULL DEFAULT TRUE,
        weekly_digest        BOOLEAN NOT NULL DEFAULT TRUE,
        risk_alerts          BOOLEAN NOT NULL DEFAULT TRUE,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notif_pref_user_id
        ON notification_preferences (user_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notification_preferences`);
  }
}
