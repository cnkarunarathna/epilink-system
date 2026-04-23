import { faker } from '@faker-js/faker';
import {
  Task,
  TaskStatus,
  TaskType,
  TaskPriority,
} from '../../tasks/entities/task.entity';
import { createMockUser } from './user.factory';
import { createMockDistrict } from './district.factory';

export function createMockTask(overrides: Partial<Task> = {}): Task {
  const creator = createMockUser();
  const district = createMockDistrict();

  return {
    id: faker.string.uuid(),
    type: TaskType.INSPECTION,
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    title: faker.lorem.sentence({ min: 3, max: 8 }),
    description: faker.lorem.paragraph(),
    address: faker.location.streetAddress(),
    latitude: parseFloat(faker.location.latitude({ max: 10, min: 5 })),
    longitude: parseFloat(faker.location.longitude({ max: 82, min: 79 })),
    dueDate: faker.date.future(),
    notes: null,
    rejectionReason: null,
    district,
    districtId: district.id,
    assignedPhi: null,
    assignedPhiId: null,
    createdBy: creator,
    createdById: creator.id,
    evidence: [],
    messages: [],
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    assignedAt: null,
    submittedAt: null,
    completedAt: null,
    routeOrder: null,
    ...overrides,
  } as Task;
}

export function createMockTaskWithStatus(
  status: TaskStatus,
  overrides: Partial<Task> = {},
): Task {
  const timestamps: Partial<Task> = {};
  if (status === TaskStatus.ASSIGNED) {
    timestamps.assignedAt = faker.date.recent();
  } else if (status === TaskStatus.SUBMITTED) {
    timestamps.assignedAt = faker.date.past();
    timestamps.submittedAt = faker.date.recent();
  } else if (status === TaskStatus.COMPLETED) {
    timestamps.assignedAt = faker.date.past();
    timestamps.submittedAt = faker.date.past();
    timestamps.completedAt = faker.date.recent();
  }
  return createMockTask({ status, ...timestamps, ...overrides });
}
