import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSystemSettings1781000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id                        SERIAL PRIMARY KEY,
        organization              VARCHAR(255)  NOT NULL DEFAULT 'Ministry of Health, Sri Lanka',
        timezone                  VARCHAR(100)  NOT NULL DEFAULT 'Asia/Colombo',
        maintenance_mode          BOOLEAN       NOT NULL DEFAULT FALSE,
        public_dashboard          BOOLEAN       NOT NULL DEFAULT TRUE,
        notify_high_risk_alerts   BOOLEAN       NOT NULL DEFAULT TRUE,
        notify_weekly_reports     BOOLEAN       NOT NULL DEFAULT TRUE,
        admin_email               VARCHAR(255)  NOT NULL DEFAULT 'admin@health.lk',
        session_timeout_enabled   BOOLEAN       NOT NULL DEFAULT TRUE,
        session_timeout_minutes   INT           NOT NULL DEFAULT 30,
        login_audit_logs          BOOLEAN       NOT NULL DEFAULT TRUE,
        min_password_length       INT           NOT NULL DEFAULT 8,
        auto_scrape_pdfs          BOOLEAN       NOT NULL DEFAULT TRUE,
        weather_integration       BOOLEAN       NOT NULL DEFAULT TRUE,
        auto_run_predictions      BOOLEAN       NOT NULL DEFAULT TRUE,
        auto_model_retraining     BOOLEAN       NOT NULL DEFAULT TRUE,
        updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);

    // Seed the single settings row
    await queryRunner.query(`
      INSERT INTO system_settings DEFAULT VALUES
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS system_settings`);
  }
}
