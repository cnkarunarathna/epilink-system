import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRouteOrderToTasks1743724800000 implements MigrationInterface {
  name = 'AddRouteOrderToTasks1743724800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD COLUMN "route_order" INTEGER`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN "route_order"`,
    );
  }
}
