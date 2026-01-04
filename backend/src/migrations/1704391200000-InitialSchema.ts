import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1704391200000 implements MigrationInterface {
  name = 'InitialSchema1704391200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create user role enum (if not exists)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "user_role_enum" AS ENUM ('admin', 'supervisor', 'phi', 'viewer');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create users table (if not exists)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" VARCHAR(255) UNIQUE NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "password" VARCHAR(255) NOT NULL,
        "role" "user_role_enum" DEFAULT 'viewer',
        "district" VARCHAR(255),
        "isActive" BOOLEAN DEFAULT true,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index on email (if not exists)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users"("email");
    `);

    // Note: districts, dengue_cases, weather_data tables are managed externally
    // by the ML model Python service. We skip creating them here to avoid conflicts.
    // If you need TypeORM to manage these tables, add their creation here.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop users table
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);

    // Drop user role enum
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum";`);
  }
}
