import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWeeklyReportSplitCaseTotals1780700000000
  implements MigrationInterface
{
  name = 'AddWeeklyReportSplitCaseTotals1780700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "weekly_reports"
        ADD COLUMN "total_actual_cases"   INTEGER,
        ADD COLUMN "total_forecast_cases" INTEGER
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "weekly_reports"
        DROP COLUMN "total_actual_cases",
        DROP COLUMN "total_forecast_cases"
    `);
  }
}
