import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFcmTokenToUsers1778400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(512) NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS fcm_token
    `);
  }
}
