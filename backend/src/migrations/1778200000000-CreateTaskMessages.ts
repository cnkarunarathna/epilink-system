import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskMessages1778200000000 implements MigrationInterface {
  name = 'CreateTaskMessages1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create task_messages table
    await queryRunner.query(`
      CREATE TABLE "task_messages" (
        "id"                UUID          NOT NULL DEFAULT uuid_generate_v4(),
        "content"           TEXT          NOT NULL,
        "attachment_url"    VARCHAR,
        "attachment_type"   VARCHAR,
        "task_id"           UUID          NOT NULL,
        "sender_id"         UUID          NOT NULL,
        "is_system_message" BOOLEAN       NOT NULL DEFAULT false,
        "created_at"        TIMESTAMP     NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMP     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_task_messages" PRIMARY KEY ("id")
      )
    `);

    // Foreign key: task_messages → tasks (CASCADE DELETE)
    await queryRunner.query(`
      ALTER TABLE "task_messages"
        ADD CONSTRAINT "FK_task_messages_task"
        FOREIGN KEY ("task_id")
        REFERENCES "tasks"("id")
        ON DELETE CASCADE
    `);

    // Foreign key: task_messages → users
    await queryRunner.query(`
      ALTER TABLE "task_messages"
        ADD CONSTRAINT "FK_task_messages_sender"
        FOREIGN KEY ("sender_id")
        REFERENCES "users"("id")
        ON DELETE NO ACTION
    `);

    // Indexes for task_messages
    await queryRunner.query(`
      CREATE INDEX "idx_task_messages_task_id"
        ON "task_messages"("task_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_task_messages_created_at"
        ON "task_messages"("task_id", "created_at" DESC)
    `);

    // Create message_reads table
    await queryRunner.query(`
      CREATE TABLE "message_reads" (
        "id"         UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "message_id" UUID      NOT NULL,
        "user_id"    UUID      NOT NULL,
        "read_at"    TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message_reads" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_message_reads_message_user" UNIQUE ("message_id", "user_id")
      )
    `);

    // Foreign key: message_reads → task_messages (CASCADE DELETE)
    await queryRunner.query(`
      ALTER TABLE "message_reads"
        ADD CONSTRAINT "FK_message_reads_message"
        FOREIGN KEY ("message_id")
        REFERENCES "task_messages"("id")
        ON DELETE CASCADE
    `);

    // Foreign key: message_reads → users (CASCADE DELETE)
    await queryRunner.query(`
      ALTER TABLE "message_reads"
        ADD CONSTRAINT "FK_message_reads_user"
        FOREIGN KEY ("user_id")
        REFERENCES "users"("id")
        ON DELETE CASCADE
    `);

    // Index for message_reads
    await queryRunner.query(`
      CREATE INDEX "idx_message_reads_user_id"
        ON "message_reads"("user_id", "message_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_message_reads_user_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "message_reads"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_task_messages_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_task_messages_task_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "task_messages"`);
  }
}
