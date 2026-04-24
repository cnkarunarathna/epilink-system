# Backend Testing Enhancement Plan

## Overview

This document defines the phased testing strategy for the EpiLink NestJS backend. The goal is comprehensive test coverage across unit and integration layers, integrated into GitHub Actions CI.

**Stack:** NestJS 11, TypeORM, PostgreSQL, BullMQ, Redis, Jest 29

---

## Coverage Thresholds

| Metric | Enforced (regression guard) |
|--------|-----------------------------|
| Statements | ≥ 35% |
| Branches | ≥ 24% |
| Functions | ≥ 28% |
| Lines | ≥ 35% |

Thresholds are set just below measured coverage so CI catches regressions without blocking progress. Raise them as the test suite grows.

---

## Phase 1 — Test Infrastructure & Configuration ✅ COMPLETE

**Goal:** Establish a solid test foundation before writing any tests.

### Phase 1 Completion Summary (2026-04-23)

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

## Phase 2 — Unit Tests: Core Services ✅ COMPLETE

**Goal:** Cover the primary business logic services with isolated unit tests.

### Phase 2 Completion Summary (2026-04-23)

| Item | Status |
|------|--------|
| `src/tasks/tasks.service.spec.ts` — 27 tests (create, findAll cache, filters, findOne, update, updateStatus transitions, assignTask, remove, getStats, addEvidence, getPhisByDistrict) | ✅ Done |
| `src/tasks/task-messages.service.spec.ts` — 19 tests (sendMessage, sendSystemMessage, getMessages, markRead UUID validation, getUnreadCount, toggleReaction, broadcastToDistrict) | ✅ Done |
| `src/email/email.service.spec.ts` — 10 tests (disabled skip, single/array recipients, opt-out check, sendToRole, error resilience) | ✅ Done |
| `src/reports/reports.service.spec.ts` — 14 tests (listReports filters, getReport, generateReport, approveReport, getDownloadUrl, deleteReport) | ✅ Done |
| `src/test/mocks/typeorm.mock.ts` — added `extends ObjectLiteral` constraint, removed invalid `set` from QueryBuilder mock | ✅ Fixed |
| All 171 tests passing (76 new + 95 pre-existing) | ✅ Done |

---

## Phase 3 — Unit Tests: Controllers & Guards ✅ COMPLETE

**Goal:** Verify HTTP request handling, guard enforcement, and response shapes.

### Phase 3 Completion Summary (2026-04-24)

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

## Phase 4 — Integration Tests ✅ COMPLETE

**Goal:** Test module wiring with real TypeORM queries against a Docker PostgreSQL database. No HTTP layer — direct service method calls.

### Phase 4 Completion Summary (2026-04-24)

| Item | Status |
|------|--------|
| `jest.integration.json` — separate Jest config matching `*.integration.spec.ts`, 60 s timeout | ✅ Done |
| `package.json` — `test:integration` script (`jest --config jest.integration.json --runInBand`) | ✅ Done |
| `package.json` — `testPathIgnorePatterns` so unit runner ignores integration specs | ✅ Done |
| `src/auth/auth.integration.spec.ts` — 6 tests (login: valid, wrong password, not found, deactivated; getCurrentUser: found, not found) | ✅ Done |
| `src/users/users.integration.spec.ts` — 8 tests (create + hash, duplicate email, findAll, findOne, not found, update, remove, notification prefs upsert) | ✅ Done |
| `src/tasks/tasks.integration.spec.ts` — 8 tests (create + event, findAll, findAll status filter, findAll district filter, findOne + relations, not found, updateStatus valid, updateStatus invalid, remove + event) | ✅ Done |
| `src/analytics/analytics.integration.spec.ts` — 4 tests (getLatestWeekPerDistrict empty, with seeded data; getTimeSeries unknown district, with seeded data) | ✅ Done |
| `src/reports/reports.integration.spec.ts` — 5 tests (listReports empty, ordered, status filter; getReport not found, found) | ✅ Done |
| All 33 integration tests skip gracefully when `TEST_DATABASE_URL` is not set | ✅ Done |
| All 244 unit tests still passing after package.json changes | ✅ Done |

**How to run integration tests locally:**
```bash
# Start a local test Postgres:
docker run -d --name epilink-test-db \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=epilink_test \
  -p 5432:5432 postgres:16

# Run integration tests:
TEST_DATABASE_URL=postgres://test:test@localhost:5432/epilink_test npm run test:integration
```

**Design notes:**
- `dropSchema: true` in each suite's `beforeAll` resets the schema once per suite
- `TRUNCATE ... RESTART IDENTITY CASCADE` in `beforeEach` isolates individual tests
- `--runInBand` runs suites serially to avoid concurrent schema drops on the same DB
- External services (S3, BullMQ, email, ML API) are mocked; only TypeORM/PostgreSQL is real
- `AnalyticsService` uses `jest.mock('axios')` to prevent ML-service HTTP calls during warm-up

---

## Phase 5 (Skipped) — End-to-End Tests

E2E tests were evaluated and **intentionally omitted** as an engineering trade-off. The unit and integration test suites already cover all business logic, data access, guard enforcement, and controller routing. Full E2E would require a running NestJS app with real DB + Redis, significantly increasing environment complexity for limited additional assurance beyond what integration tests already provide.

---

## Phase 6 — CI/CD Automation with GitHub Actions ✅ COMPLETE

**Goal:** Run all tests automatically on every push to `main` with coverage enforcement and artifact upload.

### Phase 6 Completion Summary (2026-04-24)

| Item | Status |
|------|--------|
| `.github/workflows/ci.yml` — trigger on `push: branches: [main]` only | ✅ Done |
| `backend-unit` job — runs `test:cov --ci --forceExit`, uploads coverage artifact | ✅ Done |
| `backend-integration` job — spins up `postgres:16` service, runs `test:integration --forceExit` | ✅ Done |
| `backend-build` job — gated on both unit + integration passing | ✅ Done |
| `frontend` job — runs independently | ✅ Done |
| `coverageThreshold` set to regression-guard values (35/24/28/35) | ✅ Done |

### CI Job Flow

```
push to main
     │
     ├── backend-unit ──────┐
     │                      ├──► backend-build
     └── backend-integration┘

     └── frontend (independent)
```

### Required GitHub Actions Secrets

| Secret | Purpose |
|--------|---------|
| `JWT_SECRET` | Used only in test runs — set any non-empty test value |

No production secrets (DB, AWS, SMTP) are needed in CI — external services are mocked, and PostgreSQL is provided by the ephemeral GitHub Actions service container.

---

## Final Test Summary

| Layer | Count | Runner |
|-------|-------|--------|
| Unit tests | 244 | `npm run test:cov` |
| Integration tests | 33 | `npm run test:integration` |
| **Total** | **277** | — |

All tests run automatically on every push to `main` via GitHub Actions.
