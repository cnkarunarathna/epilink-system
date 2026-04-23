import { faker } from '@faker-js/faker';
import { User, UserRole } from '../../entities/user.entity';

const SRI_LANKA_DISTRICTS = [
  'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale',
  'Nuwara Eliya', 'Galle', 'Matara', 'Hambantota', 'Jaffna',
];

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email().toLowerCase(),
    name: faker.person.fullName(),
    password: '$2b$10$mockHashedPasswordForTestingOnly',
    role: UserRole.VIEWER,
    district: faker.helpers.arrayElement(SRI_LANKA_DISTRICTS),
    isActive: true,
    fcmToken: null,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  } as User;
}

export function createMockAdmin(overrides: Partial<User> = {}): User {
  return createMockUser({ role: UserRole.ADMIN, ...overrides });
}

export function createMockSupervisor(overrides: Partial<User> = {}): User {
  return createMockUser({ role: UserRole.SUPERVISOR, ...overrides });
}

export function createMockPhi(overrides: Partial<User> = {}): User {
  return createMockUser({ role: UserRole.PHI, ...overrides });
}
