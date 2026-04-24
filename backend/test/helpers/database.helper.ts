import { DataSource } from 'typeorm';
import { User } from '../../src/entities/user.entity';
import { District } from '../../src/entities/district.entity';
import { DengueCase } from '../../src/entities/dengue_case.entity';
import { WeatherData } from '../../src/entities/weather_data.entity';
import { Task } from '../../src/tasks/entities/task.entity';
import { Evidence } from '../../src/tasks/entities/evidence.entity';
import { TaskMessage } from '../../src/tasks/entities/task-message.entity';
import { MessageRead } from '../../src/tasks/entities/message-read.entity';
import { MessageReaction } from '../../src/tasks/entities/message-reaction.entity';
import { WeeklyReport } from '../../src/reports/entities/weekly-report.entity';
import { EmailLog } from '../../src/email/entities/email-log.entity';
import { NotificationPreference } from '../../src/email/entities/notification-preference.entity';

const ALL_ENTITIES = [
  User,
  District,
  DengueCase,
  WeatherData,
  Task,
  Evidence,
  TaskMessage,
  MessageRead,
  MessageReaction,
  WeeklyReport,
  EmailLog,
  NotificationPreference,
];

export async function createTestDataSource(): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'postgres',
    url:
      process.env.TEST_DATABASE_URL ||
      'postgres://test:test@localhost:5432/epilink_test',
    entities: ALL_ENTITIES,
    synchronize: true,
    dropSchema: true,
    logging: false,
  });
  return dataSource.initialize();
}

export async function clearAllTables(dataSource: DataSource): Promise<void> {
  const entities = dataSource.entityMetadatas;
  for (const entity of entities) {
    const repository = dataSource.getRepository(entity.name);
    await repository.query(
      `TRUNCATE TABLE "${entity.tableName}" RESTART IDENTITY CASCADE`,
    );
  }
}

export { ALL_ENTITIES };
