# Backend Testing Enhancement Plan

## Overview

This document defines the phased testing strategy for the EpiLink NestJS backend. The goal is full test coverage across unit, integration, and E2E layers, integrated into GitHub Actions CI.

**Stack:** NestJS 11, TypeORM, PostgreSQL, BullMQ, Redis, Jest 29, Supertest

---

## Current State

| Layer | Files | Status |
|-------|-------|--------|
| Unit tests | 9 `.spec.ts` files | Partial — auth, cache, storage, analytics, chatbot, events, notifications, users |
| Integration tests | 0 | Not implemented |
| E2E tests | 1 (`app.e2e-spec.ts`) | Health check only |
| Coverage threshold | None enforced | — |
| CI test run | Commented out | Disabled |

---

## Phase 1 Completion Summary (2026-04-23)

| Item | Status |
|------|--------|
| Jest config — coverage thresholds (`coverageThreshold`) | ✅ Done |
| Jest config — coverage exclusions (entities, DTOs, migrations, etc.) | ✅ Done |
| Jest config — `moduleNameMapper` for `src/` path alias | ✅ Done |
| `@faker-js/faker` installed | ✅ Done |
| `jest-mock-extended` installed | ✅ Done |
| `src/test/factories/user.factory.ts` | ✅ Done |
| `src/test/factories/task.factory.ts` | ✅ Done |
| `src/test/factories/district.factory.ts` | ✅ Done |
| `src/test/mocks/typeorm.mock.ts` | ✅ Done |
| `src/test/mocks/redis.mock.ts` | ✅ Done |
| `src/test/mocks/bullmq.mock.ts` | ✅ Done |
| `src/test/mocks/config.mock.ts` | ✅ Done |
| `test/setup.ts` | ✅ Done |
| `test/helpers/database.helper.ts` | ✅ Done |
| `test/helpers/auth.helper.ts` | ✅ Done |
| `test/jest-e2e.json` updated with setup file + path alias | ✅ Done |
| Pre-existing test failures fixed (`events.gateway.spec.ts`, `users.service.spec.ts`) | ✅ Done |
| All 95 existing tests passing | ✅ Done |

---

## Target Coverage Goals

| Layer | Target |
|-------|--------|
| Statements | ≥ 80% |
| Branches | ≥ 75% |
| Functions | ≥ 80% |
| Lines | ≥ 80% |

---

## Phase 1 — Test Infrastructure & Configuration ✅ COMPLETE

**Goal:** Establish a solid test foundation before writing any tests.

### 1.1 Jest Configuration Enhancement

Update `package.json` jest config to add coverage thresholds, path aliases, and a global setup file:

```json
"jest": {
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "collectCoverageFrom": [
    "**/*.(t|j)s",
    "!**/*.module.ts",
    "!**/main.ts",
    "!**/migrations/**",
    "!**/*.dto.ts",
    "!**/*.entity.ts",
    "!**/*.decorator.ts",
    "!**/seed/**"
  ],
  "coverageDirectory": "../coverage",
  "coverageThresholds": {
    "global": {
      "statements": 80,
      "branches": 75,
      "functions": 80,
      "lines": 80
    }
  },
  "testEnvironment": "node",
  "moduleNameMapper": {
    "^src/(.*)$": "<rootDir>/$1"
  }
}
```

### 1.2 Test Utilities Setup

Create `src/test/` directory with shared test utilities:

**`src/test/factories/user.factory.ts`**
- Factory function returning a mock `User` entity with sensible defaults
- Accepts partial overrides via spread

**`src/test/factories/task.factory.ts`**
- Factory for `Task` entity with all required fields populated
- Supports status variants (pending, in_progress, completed)

**`src/test/factories/district.factory.ts`**
- Factory for `District` entity used in analytics tests

**`src/test/mocks/typeorm.mock.ts`**
- Reusable mock repository factory: `createMockRepository<T>()`
- Mocks: `find`, `findOne`, `findOneBy`, `save`, `create`, `update`, `delete`, `remove`, `count`, `createQueryBuilder`

**`src/test/mocks/redis.mock.ts`**
- Mock for `CACHE_MANAGER` token
- Mocks: `get`, `set`, `del`, `reset`

**`src/test/mocks/bullmq.mock.ts`**
- Mock for BullMQ `Queue` injection token
- Mocks: `add`, `getJob`, `getJobs`

**`src/test/mocks/config.mock.ts`**
- Mock `ConfigService` returning test environment values

### 1.3 Add Dev Dependencies

```bash
npm install --save-dev @faker-js/faker jest-mock-extended
```

- `@faker-js/faker` — realistic test data generation
- `jest-mock-extended` — type-safe mock objects without manual interface duplication

### 1.4 E2E Test Database Setup

Create `test/jest-e2e.json` update and `test/setup.ts` global setup:

- Spin up an in-process PostgreSQL using `pg-mem` or a Docker Compose service for CI
- Run migrations before the suite, truncate tables between tests
- Provide `getTestDataSource()` helper for integration tests

**Files to create:**
- `test/setup.ts` — global beforeAll/afterAll hooks
- `test/helpers/database.helper.ts` — DataSource factory pointing at test DB
- `test/helpers/auth.helper.ts` — `getAuthToken(app, role)` for E2E auth

---

## Phase 2 — Unit Tests: Core Services ✅ COMPLETE

**Goal:** Cover the primary business logic services with isolated unit tests.

## Phase 2 Completion Summary (2026-04-23)

| Item | Status |
|------|--------|
| `src/tasks/tasks.service.spec.ts` — 27 tests (create, findAll cache, filters, findOne, update, updateStatus transitions, assignTask, remove, getStats, addEvidence, getPhisByDistrict) | ✅ Done |
| `src/tasks/task-messages.service.spec.ts` — 19 tests (sendMessage, sendSystemMessage, getMessages, markRead UUID validation, getUnreadCount, toggleReaction, broadcastToDistrict) | ✅ Done |
| `src/email/email.service.spec.ts` — 10 tests (disabled skip, single/array recipients, opt-out check, sendToRole, error resilience) | ✅ Done |
| `src/reports/reports.service.spec.ts` — 14 tests (listReports filters, getReport, generateReport, approveReport, getDownloadUrl, deleteReport) | ✅ Done |
| `src/test/mocks/typeorm.mock.ts` — added `extends ObjectLiteral` constraint, removed invalid `set` from QueryBuilder mock | ✅ Fixed |
| All 171 tests passing (76 new + 95 pre-existing) | ✅ Done |

---

### 2.1 Auth Service (`src/auth/auth.service.spec.ts`)

**Existing:** Partial. Expand to full coverage.

| Test Case | Description |
|-----------|-------------|
| `login` — valid credentials | Returns access token + sets cookie |
| `login` — wrong password | Throws `UnauthorizedException` |
| `login` — user not found | Throws `UnauthorizedException` |
| `validateUser` — valid | Returns user without password |
| `validateUser` — bcrypt mismatch | Returns null |
| `getCurrentUser` — valid JWT payload | Returns user entity |
| `getCurrentUser` — user deleted | Throws `UnauthorizedException` |
| Token generation | `JwtService.sign` called with correct payload |

**Mock dependencies:** `UsersService`, `JwtService`, `bcrypt`

### 2.2 Users Service (`src/users/users.service.spec.ts`)

**Existing:** Partial. Expand to full coverage.

| Test Case | Description |
|-----------|-------------|
| `create` — success | Hashes password, saves entity |
| `create` — duplicate email | Throws `ConflictException` |
| `findAll` | Returns paginated array |
| `findOne` — found | Returns user |
| `findOne` — not found | Throws `NotFoundException` |
| `findByEmail` | Returns user or null |
| `update` — success | Merges fields, saves |
| `update` — password change | Re-hashes password |
| `remove` — success | Calls repository delete |
| `remove` — not found | Throws `NotFoundException` |

**Mock dependencies:** `UserRepository` (via mock factory)

### 2.3 Tasks Service (`src/tasks/tasks.service.spec.ts`)

**Existing:** Not implemented. Create from scratch.

| Test Case | Description |
|-----------|-------------|
| `create` | Geocodes location, saves task, emits socket event |
| `findAll` — no filters | Returns all tasks for user |
| `findAll` — by status | Applies WHERE filter |
| `findAll` — by district | Applies district filter |
| `findOne` — found | Returns task with relations |
| `findOne` — not found | Throws `NotFoundException` |
| `update` — owner | Updates and emits event |
| `update` — non-owner | Throws `ForbiddenException` |
| `remove` — success | Deletes and notifies |
| `assignUser` | Adds participant, sends push notification |
| `removeUser` | Removes participant |

**Mock dependencies:** `TaskRepository`, `EventsGateway`, `GeocodingService`, `PushNotificationService`, `CacheHelperService`

### 2.4 Task Messages Service (`src/tasks/task-messages.service.spec.ts`)

**Existing:** Not implemented.

| Test Case | Description |
|-----------|-------------|
| `create` | Saves message, broadcasts via WebSocket |
| `findAll` | Returns paginated messages with read status |
| `markAsRead` | Upserts MessageRead record |
| `addReaction` | Saves reaction, prevents duplicates |
| `removeReaction` | Deletes reaction |

**Mock dependencies:** `TaskMessageRepository`, `MessageReadRepository`, `MessageReactionRepository`, `EventsGateway`

### 2.5 Analytics Service (`src/analytics/analytics.service.spec.ts`)

**Existing:** Partially implemented. Expand coverage.

| Test Case | Description |
|-----------|-------------|
| `getDistrictStats` | Aggregates cases by district |
| `getWeeklyTrend` | Returns week-over-week delta |
| `getHeatmapData` | Returns geo-coded case density |
| `getCasesByPeriod` | Filters by date range |
| Cache hit | Returns cached result, skips DB query |
| Cache miss | Queries DB, stores result in cache |

**Mock dependencies:** `DengueCaseRepository`, `DistrictRepository`, `CacheHelperService`

### 2.6 Reports Service (`src/reports/reports.service.spec.ts`)

**Existing:** Not implemented.

| Test Case | Description |
|-----------|-------------|
| `getWeeklyReport` — found | Returns stored report |
| `getWeeklyReport` — not found | Throws `NotFoundException` |
| `createWeeklyReport` | Aggregates data, saves record |
| `generatePdf` | Calls `ReportPdfGenerator.generate` |
| `listReports` | Returns paginated list |

**Mock dependencies:** `WeeklyReportRepository`, `ReportPdfGenerator`, `AnalyticsService`

### 2.7 Email Service (`src/email/email.service.spec.ts`)

**Existing:** Not implemented.

| Test Case | Description |
|-----------|-------------|
| `sendEmail` | Adds job to BullMQ queue |
| `sendTaskAssignment` | Builds correct template context |
| `sendDigestEmail` | Sends digest with correct recipients |
| `logEmail` — success | Persists EmailLog with status "sent" |
| `logEmail` — failure | Persists EmailLog with status "failed" |

**Mock dependencies:** `BullMQ Queue`, `EmailLogRepository`, `ConfigService`

### 2.8 Storage Service (`src/storage/storage.service.spec.ts`)

**Existing:** Partially implemented. Expand to full coverage.

| Test Case | Description |
|-----------|-------------|
| `uploadFile` — valid image | Calls S3 PutObject |
| `uploadFile` — invalid type | Throws `BadRequestException` |
| `uploadFile` — over size limit | Throws `BadRequestException` |
| `getPresignedUrl` | Returns signed URL |
| `deleteFile` | Calls S3 DeleteObject |

**Mock dependencies:** `S3Client` (via jest.mock), `ConfigService`

---

## Phase 3 — Unit Tests: Controllers & Guards ✅ COMPLETE

## Phase 3 Completion Summary (2026-04-24)

| Item | Status |
|------|--------|
| `src/auth/auth.controller.spec.ts` — 5 tests (login cookie+token, UnauthorizedException propagation, getCurrentUser, logout) | ✅ Done |
| `src/users/users.controller.spec.ts` — 14 tests (create, createPhi with/without district, findAll, getStats, findOne, update, toggleStatus, remove, notification-preferences self vs other vs admin) | ✅ Done |
| `src/tasks/tasks.controller.spec.ts` — 15 tests (create, findAll filter parsing, getStats, getPhisByDistrict, findOne, update, updateStatus force-flag role check, assignTask, remove, addEvidence, getEvidence) | ✅ Done |
| `src/auth/guards/jwt-auth.guard.spec.ts` — 4 tests (defined, delegates to parent, propagates UnauthorizedException) | ✅ Done |
| `src/auth/guards/roles.guard.spec.ts` — 5 tests (no metadata → allow, matching role → allow, missing role → deny, checks both handler+class metadata) | ✅ Done |
| `src/tasks/guards/task-participant.guard.spec.ts` — 7 tests (no taskId, admin bypass, creator access, assignedPHI access, non-participant → ForbiddenException, missing task → NotFoundException) | ✅ Done |
| `src/events/events.gateway.spec.ts` expanded — +39 new tests (task emit helpers, chat emit helpers, handleChatJoin/Leave/Typing) | ✅ Done |
| All 244 tests passing (73 new + 171 pre-existing) | ✅ Done |

---

**Goal:** Verify HTTP request handling, DTO validation, guard enforcement, and response shapes.

### 3.1 Auth Controller (`src/auth/auth.controller.spec.ts`)

| Test Case | Description |
|-----------|-------------|
| `POST /auth/login` — success | Calls `AuthService.login`, returns 200 |
| `POST /auth/login` — bad body | ValidationPipe rejects, returns 400 |
| `POST /auth/logout` | Clears cookie, returns 200 |
| `GET /auth/me` | Returns current user via `@CurrentUser` |

**Mock dependencies:** `AuthService`

### 3.2 Users Controller (`src/users/users.controller.spec.ts`)

| Test Case | Description |
|-----------|-------------|
| `GET /users` | Returns user list (Admin role only) |
| `GET /users/:id` | Returns single user |
| `PATCH /users/:id` | Updates user |
| `DELETE /users/:id` | Removes user (Admin only) |
| Role guard enforcement | Non-admin gets 403 |

**Mock dependencies:** `UsersService`

### 3.3 Tasks Controller (`src/tasks/tasks.controller.spec.ts`)

| Test Case | Description |
|-----------|-------------|
| `POST /tasks` | Validates `CreateTaskDto`, calls service |
| `GET /tasks` | Returns list with query filters |
| `GET /tasks/:id` | Returns single task |
| `PATCH /tasks/:id` | Validates `UpdateTaskDto`, calls service |
| `DELETE /tasks/:id` | Calls service delete |
| `POST /tasks/:id/assign` | Assigns user to task |

**Mock dependencies:** `TasksService`

### 3.4 JWT Auth Guard (`src/auth/guards/jwt-auth.guard.spec.ts`)

| Test Case | Description |
|-----------|-------------|
| Valid JWT | `canActivate` returns true |
| Missing JWT | Throws `UnauthorizedException` |
| Expired JWT | Throws `UnauthorizedException` |
| Malformed JWT | Throws `UnauthorizedException` |

### 3.5 Roles Guard (`src/auth/guards/roles.guard.spec.ts`)

| Test Case | Description |
|-----------|-------------|
| User has required role | Returns true |
| User lacks required role | Throws `ForbiddenException` |
| No roles metadata | Defaults to allow |

### 3.6 Task Participant Guard (`src/tasks/guards/task-participant.guard.spec.ts`)

| Test Case | Description |
|-----------|-------------|
| User is task participant | Returns true |
| User is not participant | Throws `ForbiddenException` |
| Task not found | Throws `NotFoundException` |

### 3.7 Events Gateway (`src/events/events.gateway.spec.ts`)

**Existing:** Partially implemented. Expand coverage.

| Test Case | Description |
|-----------|-------------|
| `handleConnection` | Authenticates JWT from socket handshake |
| `handleDisconnect` | Removes socket from room |
| `joinTaskRoom` | Adds socket to task-specific room |
| `emit` — authenticated | Broadcasts to correct room |
| `handleConnection` — invalid JWT | Disconnects socket |

---

## Phase 4 — Integration Tests

**Goal:** Test module wiring with real TypeORM queries against an in-memory or Docker PostgreSQL database. No HTTP layer — direct service method calls.

### Setup

Use `@nestjs/testing` `Test.createTestingModule()` with a real TypeORM `DataSource` pointing at the test database:

```typescript
// test/helpers/database.helper.ts
export async function createTestDataSource(): Promise<DataSource> {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.TEST_DATABASE_URL,
    entities: [/* all entities */],
    synchronize: true,
    dropSchema: true,
  });
  return ds.initialize();
}
```

Each integration test suite should:
1. Initialize the module with real repositories
2. Run within a transaction and roll back after each test (fastest isolation)
3. Use entity factories to seed required data

### 4.1 Auth Module Integration (`src/auth/auth.integration.spec.ts`)

| Test | Assertion |
|------|-----------|
| Register → Login flow | User created, JWT returned, cookie set |
| Login with wrong password | 401 response |
| `getCurrentUser` after login | Correct user returned from DB |
| Concurrent login attempts | Both succeed, independent tokens |

### 4.2 Users Module Integration (`src/users/users.integration.spec.ts`)

| Test | Assertion |
|------|-----------|
| Create → FindOne | Entity persisted with hashed password |
| Update email | New email reflected in DB |
| Delete → FindOne | Throws `NotFoundException` |
| FindByEmail — case insensitive | Returns correct user |

### 4.3 Tasks Module Integration (`src/tasks/tasks.integration.spec.ts`)

| Test | Assertion |
|------|-----------|
| Create task | Record in DB with geocoded coordinates |
| Assign user | Participant relation persisted |
| Update status | Status change reflected in DB |
| Delete task | Cascades to messages and evidence |
| Filter by district | Only district tasks returned |
| Filter by status | Only matching status returned |

### 4.4 Analytics Module Integration (`src/analytics/analytics.integration.spec.ts`)

| Test | Assertion |
|------|-----------|
| `getDistrictStats` with seeded data | Returns correct aggregations |
| Weekly trend with seeded cases | Delta calculation correct |
| Cache invalidation | After DB update, cache is refreshed |

### 4.5 Reports Module Integration (`src/reports/reports.integration.spec.ts`)

| Test | Assertion |
|------|-----------|
| Create weekly report | Record persisted, PDF path stored |
| Get report by week number | Returns correct report |
| List reports | Returns all, sorted descending |

---

## Phase 5 — End-to-End Tests

**Goal:** Test the full HTTP request-response cycle using Supertest against a running NestJS app connected to the test database.

### Setup

```typescript
// test/app.e2e-spec.ts pattern
beforeAll(async () => {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(/* Redis/BullMQ if needed */)
    .useValue(mockRedis)
    .compile();

  app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use(cookieParser());
  await app.init();
});
```

### 5.1 Auth E2E (`test/auth.e2e-spec.ts`)

| Endpoint | Scenario | Expected |
|----------|----------|----------|
| `POST /auth/login` | Valid credentials | 200, cookie set, user returned |
| `POST /auth/login` | Invalid password | 401 |
| `POST /auth/login` | Missing fields | 400 validation error |
| `GET /auth/me` | With valid cookie | 200, user object |
| `GET /auth/me` | Without cookie | 401 |
| `POST /auth/logout` | Authenticated | 200, cookie cleared |

### 5.2 Users E2E (`test/users.e2e-spec.ts`)

| Endpoint | Scenario | Expected |
|----------|----------|----------|
| `GET /users` | Admin role | 200, array |
| `GET /users` | Non-admin | 403 |
| `GET /users/:id` | Own profile | 200 |
| `PATCH /users/:id` | Own profile | 200, updated |
| `DELETE /users/:id` | Admin | 200 |

### 5.3 Tasks E2E (`test/tasks.e2e-spec.ts`)

| Endpoint | Scenario | Expected |
|----------|----------|----------|
| `POST /tasks` | Authenticated | 201, task created |
| `POST /tasks` | Missing required field | 400 |
| `GET /tasks` | With filters | 200, filtered list |
| `PATCH /tasks/:id` | Owner | 200, updated |
| `PATCH /tasks/:id` | Non-participant | 403 |
| `DELETE /tasks/:id` | Owner | 200 |
| `GET /tasks/:id/messages` | Participant | 200, messages |
| `POST /tasks/:id/messages` | Participant | 201, message saved |

### 5.4 Analytics E2E (`test/analytics.e2e-spec.ts`)

| Endpoint | Scenario | Expected |
|----------|----------|----------|
| `GET /analytics/districts` | Public endpoint | 200, district data |
| `GET /analytics/trend` | With date range | 200, trend data |
| `GET /analytics/heatmap` | Authenticated | 200, geo data |

### 5.5 Reports E2E (`test/reports.e2e-spec.ts`)

| Endpoint | Scenario | Expected |
|----------|----------|----------|
| `GET /reports` | Authenticated | 200, list |
| `GET /reports/:id` | Found | 200, report |
| `GET /reports/:id/pdf` | Found | 200, PDF binary |
| `POST /reports` | Admin role | 201, created |

---

## Phase 6 — CI/CD Automation with GitHub Actions

**Goal:** Run all tests automatically on every push and pull request with coverage enforcement and reporting.

### 6.1 Workflow Changes (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  backend-unit:
    name: Backend Unit Tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24.x
          cache: "npm"
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npm run test:cov -- --ci --reporters=default --reporters=jest-junit
        env:
          JWT_SECRET: test-secret
          NODE_ENV: test
      - uses: actions/upload-artifact@v4
        with:
          name: unit-coverage
          path: backend/coverage/

  backend-e2e:
    name: Backend E2E Tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: epilink_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        ports: ["6379:6379"]
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24.x
          cache: "npm"
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npm run test:e2e
        env:
          TEST_DATABASE_URL: postgres://test:test@localhost:5432/epilink_test
          TEST_REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret
          NODE_ENV: test

  backend-build:
    name: Backend Build
    runs-on: ubuntu-latest
    needs: [backend-unit]
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24.x
          cache: "npm"
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npm run build

  frontend:
    name: Frontend Build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24.x
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run build
        env:
          NEXT_PUBLIC_API_URL: http://localhost:3001
```

### 6.2 Required GitHub Actions Secrets

Add these secrets in GitHub repo settings → Secrets and Variables → Actions:

| Secret | Purpose |
|--------|---------|
| `JWT_SECRET` | Used only in test runs — set any test value |

No production secrets (DB, AWS, SMTP) are needed in CI — external services are mocked or use the ephemeral Docker services.

### 6.3 Coverage Reporting (Optional Enhancement)

After all phases are complete, add Codecov integration:

```yaml
- uses: codecov/codecov-action@v4
  with:
    files: backend/coverage/lcov.info
    flags: backend-unit
    fail_ci_if_error: false
```

---

## Implementation Order

| Phase | Estimated Effort | Priority |
|-------|-----------------|----------|
| Phase 1 — Infrastructure | 1 day | Critical — do first |
| Phase 2 — Core Service Unit Tests | 3 days | High |
| Phase 3 — Controllers & Guards | 2 days | High |
| Phase 6 — CI Automation | 0.5 day | High — unblocks PR checks |
| Phase 4 — Integration Tests | 3 days | Medium |
| Phase 5 — E2E Tests | 3 days | Medium |

**Recommended sequence:** Phase 1 → Phase 6 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Start with CI automation early (Phase 6) so that every new test added in Phases 2–5 is automatically verified on push.

---

## File Checklist

### New files to create

```
backend/src/test/
  factories/user.factory.ts
  factories/task.factory.ts
  factories/district.factory.ts
  mocks/typeorm.mock.ts
  mocks/redis.mock.ts
  mocks/bullmq.mock.ts
  mocks/config.mock.ts

backend/src/auth/
  auth.controller.spec.ts          (new)
  guards/jwt-auth.guard.spec.ts    (new)
  guards/roles.guard.spec.ts       (new)

backend/src/tasks/
  tasks.service.spec.ts            (new)
  tasks.controller.spec.ts         (new)
  task-messages.service.spec.ts    (new)
  guards/task-participant.guard.spec.ts (new)

backend/src/reports/
  reports.service.spec.ts          (new)

backend/src/email/
  email.service.spec.ts            (new)

backend/test/
  setup.ts                         (new)
  helpers/database.helper.ts       (new)
  helpers/auth.helper.ts           (new)
  auth.e2e-spec.ts                 (new)
  users.e2e-spec.ts                (new)
  tasks.e2e-spec.ts                (new)
  analytics.e2e-spec.ts            (new)
  reports.e2e-spec.ts              (new)
```

### Files to expand (already exist, partial coverage)

```
backend/src/auth/auth.service.spec.ts
backend/src/users/users.service.spec.ts
backend/src/analytics/analytics.service.spec.ts
backend/src/cache/cache-helper.service.spec.ts
backend/src/storage/storage.service.spec.ts
backend/src/events/events.gateway.spec.ts
```

### Files to update

```
backend/package.json               (jest config — thresholds, path mapper)
.github/workflows/ci.yml           (add test jobs, PostgreSQL service, Redis service)
test/jest-e2e.json                 (add setup file reference)
```
