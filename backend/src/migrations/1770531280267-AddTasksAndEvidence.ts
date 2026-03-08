import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTasksAndEvidence1770531280267 implements MigrationInterface {
  name = 'AddTasksAndEvidence1770531280267';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums for tasks
    await queryRunner.query(
      `CREATE TYPE "public"."tasks_type_enum" AS ENUM('cleanup', 'fogging', 'inspection', 'investigation')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tasks_status_enum" AS ENUM('pending', 'assigned', 'in_progress', 'submitted', 'verified', 'completed', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tasks_priority_enum" AS ENUM('low', 'medium', 'high', 'urgent')`,
    );

    // Create tasks table
    await queryRunner.query(`
            CREATE TABLE "tasks" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "type" "public"."tasks_type_enum" NOT NULL DEFAULT 'inspection',
                "status" "public"."tasks_status_enum" NOT NULL DEFAULT 'pending',
                "priority" "public"."tasks_priority_enum" NOT NULL DEFAULT 'medium',
                "title" character varying NOT NULL,
                "description" text,
                "address" character varying,
                "latitude" numeric(10,7),
                "longitude" numeric(10,7),
                "due_date" TIMESTAMP,
                "notes" text,
                "rejection_reason" text,
                "district_id" integer NOT NULL,
                "assigned_phi_id" uuid,
                "created_by_id" uuid NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "assigned_at" TIMESTAMP,
                "submitted_at" TIMESTAMP,
                "completed_at" TIMESTAMP,
                CONSTRAINT "PK_tasks" PRIMARY KEY ("id")
            )
        `);

    // Create enum for evidence
    await queryRunner.query(
      `CREATE TYPE "public"."evidence_status_enum" AS ENUM('pending', 'approved', 'rejected')`,
    );

    // Create evidence table
    await queryRunner.query(`
            CREATE TABLE "evidence" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "image_url" character varying NOT NULL,
                "notes" text,
                "latitude" numeric(10,7),
                "longitude" numeric(10,7),
                "status" "public"."evidence_status_enum" NOT NULL DEFAULT 'pending',
                "rejection_reason" text,
                "task_id" uuid NOT NULL,
                "submitted_by_id" uuid NOT NULL,
                "verified_by_id" uuid,
                "submitted_at" TIMESTAMP NOT NULL DEFAULT now(),
                "verified_at" TIMESTAMP,
                CONSTRAINT "PK_evidence" PRIMARY KEY ("id")
            )
        `);

    // Add foreign keys for tasks
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_district" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_assigned_phi" FOREIGN KEY ("assigned_phi_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Add foreign keys for evidence
    await queryRunner.query(
      `ALTER TABLE "evidence" ADD CONSTRAINT "FK_evidence_task" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "evidence" ADD CONSTRAINT "FK_evidence_submitted_by" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "evidence" ADD CONSTRAINT "FK_evidence_verified_by" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    await queryRunner.query(
      `ALTER TABLE "evidence" DROP CONSTRAINT "FK_evidence_verified_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "evidence" DROP CONSTRAINT "FK_evidence_submitted_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "evidence" DROP CONSTRAINT "FK_evidence_task"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_assigned_phi"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_district"`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE "evidence"`);
    await queryRunner.query(`DROP TABLE "tasks"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "public"."evidence_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."tasks_priority_enum"`);
    await queryRunner.query(`DROP TYPE "public"."tasks_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."tasks_type_enum"`);
  }
}
