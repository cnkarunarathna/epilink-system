import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReportTypeAndCurrentCases1778100000000
  implements MigrationInterface
{
  name = 'AddReportTypeAndCurrentCases1778100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // SCHEMA-01: dedicated report_type column
    await queryRunner.query(`
      ALTER TABLE "weekly_reports"
        ADD COLUMN "report_type" VARCHAR(20) NOT NULL DEFAULT 'predicted'
    `);

    // SCHEMA-02: dedicated total_current_cases column (NULL for historical reports)
    await queryRunner.query(`
      ALTER TABLE "weekly_reports"
        ADD COLUMN "total_current_cases" INTEGER
    `);

    // Backfill both columns from the existing report_data JSONB
    await queryRunner.query(`
      UPDATE "weekly_reports"
      SET "report_type" = COALESCE(report_data->>'reportType', 'predicted')
      WHERE report_data->>'reportType' IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE "weekly_reports"
      SET "total_current_cases" = (report_data->>'totalCurrentCases')::INTEGER
      WHERE report_data->>'totalCurrentCases' IS NOT NULL
        AND report_data->>'totalCurrentCases' != 'null'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "weekly_reports" DROP COLUMN "total_current_cases"`,
    );
    await queryRunner.query(
      `ALTER TABLE "weekly_reports" DROP COLUMN "report_type"`,
    );
  }
}
