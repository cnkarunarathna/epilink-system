import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetOtpToUsers1781100000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_reset_otp  VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS password_reset_expiry TIMESTAMPTZ NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS password_reset_otp,
        DROP COLUMN IF EXISTS password_reset_expiry
    `);
  }
}
