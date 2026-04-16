import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMessageReactions1778300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE message_reactions (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id   UUID         NOT NULL,
        user_id      UUID         NOT NULL,
        emoji        VARCHAR(10)  NOT NULL,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT fk_reaction_message FOREIGN KEY (message_id)
          REFERENCES task_messages(id) ON DELETE CASCADE,
        CONSTRAINT fk_reaction_user FOREIGN KEY (user_id)
          REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT uq_message_user_emoji UNIQUE (message_id, user_id, emoji)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS message_reactions`);
  }
}
