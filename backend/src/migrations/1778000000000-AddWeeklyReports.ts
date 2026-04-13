import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWeeklyReports1778000000000 implements MigrationInterface {
  name = 'AddWeeklyReports1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "weekly_reports" (
        "id"                    UUID NOT NULL DEFAULT uuid_generate_v4(),
        "year"                  INTEGER NOT NULL,
        "week_number"           INTEGER NOT NULL,
        "start_date"            DATE NOT NULL,
        "end_date"              DATE NOT NULL,
        "title"                 VARCHAR(200) NOT NULL,
        "status"                VARCHAR(20) NOT NULL DEFAULT 'pending',
        "total_predicted_cases" INTEGER NOT NULL DEFAULT 0,
        "total_districts"       INTEGER NOT NULL DEFAULT 0,
        "high_risk_districts"   INTEGER NOT NULL DEFAULT 0,
        "report_data"           JSONB NOT NULL,
        "s3_key"                VARCHAR(500),
        "generated_at"          TIMESTAMP NOT NULL DEFAULT now(),
        "approved_at"           TIMESTAMP,
        "approved_by_id"        UUID,
        "created_by_id"         UUID,
        CONSTRAINT "PK_weekly_reports" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_weekly_reports_year_week" UNIQUE ("year", "week_number")
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "weekly_reports" ADD CONSTRAINT "FK_weekly_reports_approved_by"
       FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "weekly_reports" ADD CONSTRAINT "FK_weekly_reports_created_by"
       FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "weekly_reports" DROP CONSTRAINT "FK_weekly_reports_created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "weekly_reports" DROP CONSTRAINT "FK_weekly_reports_approved_by"`,
    );
    await queryRunner.query(`DROP TABLE "weekly_reports"`);
  }
}
