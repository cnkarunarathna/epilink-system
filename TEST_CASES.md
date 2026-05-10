# EpiLink Backend — Test Case Reference

**Stack:** NestJS 11 · TypeORM · PostgreSQL · BullMQ · Redis · Jest 29
**Total:** 244 unit tests + 33 integration tests = **277 tests**
**CI:** GitHub Actions — runs on every push to `main`

> For the full testing strategy, coverage thresholds, and CI setup see [docs/TESTING_WORKFLOW.md](docs/TESTING_WORKFLOW.md).

---

## Table of Contents

1. [App / Health](#1-app--health)
2. [Auth — Service](#2-auth--service)
3. [Auth — Controller](#3-auth--controller)
4. [Auth — Guards](#4-auth--guards)
5. [Users — Service](#5-users--service)
6. [Users — Controller](#6-users--controller)
7. [Tasks — Service](#7-tasks--service)
8. [Tasks — Controller](#8-tasks--controller)
9. [Tasks — Messages Service](#9-tasks--messages-service)
10. [Tasks — Guards](#10-tasks--guards)
11. [Analytics — Service](#11-analytics--service)
12. [Reports — Service](#12-reports--service)
13. [Email Service](#13-email-service)
14. [Storage Service](#14-storage-service)
15. [Cache Helper Service](#15-cache-helper-service)
16. [Chatbot Service](#16-chatbot-service)
17. [Push Notification Service](#17-push-notification-service)
18. [Events Gateway](#18-events-gateway)
19. [Integration Tests — Auth](#19-integration-tests--auth)
20. [Integration Tests — Users](#20-integration-tests--users)
21. [Integration Tests — Tasks](#21-integration-tests--tasks)
22. [Integration Tests — Reports](#22-integration-tests--reports)
23. [Integration Tests — Analytics](#23-integration-tests--analytics)

---

## 1. App / Health

**File:** `src/app.controller.spec.ts` | **Type:** Unit

| # | Test Case | Layer | Expected Outcome | Status |
|---|-----------|-------|-----------------|--------|
| A-01 | `getHello` returns `"Hello World!"` | Controller | String response | PASSED |
| A-02 | `checkHealth` returns health status object with database info | Controller | Object with `status`, `database` fields | PASSED |
| A-03 | `checkHealth` returns `OK` status when database is connected | Controller | `{ status: 'OK' }` | PASSED |
| A-04 | `AppService.getHello` returns `"Hello World!"` | Service | String response | PASSED |
| A-05 | `checkDatabaseConnection` returns `OK` when datasource is connected | Service | `{ status: 'OK' }` | PASSED |
| A-06 | `checkDatabaseConnection` returns `DISCONNECTED` when datasource is not initialized | Service | `{ status: 'DISCONNECTED' }` | PASSED |
| A-07 | `checkDatabaseConnection` returns `ERROR` when datasource throws unexpectedly | Service | `{ status: 'ERROR' }` | PASSED |
| A-08 | `checkPredictionService` returns `OK` when ML health endpoint is reachable | Service | `{ status: 'OK' }` | PASSED |
| A-09 | `checkPredictionService` returns `ERROR` for non-200 health response | Service | `{ status: 'ERROR' }` | PASSED |
| A-10 | `checkPredictionService` returns `DISCONNECTED` when prediction service is unavailable | Service | `{ status: 'DISCONNECTED' }` | PASSED |

---

## 2. Auth — Service

**File:** `src/auth/auth.service.spec.ts` | **Type:** Unit

| # | Test Case | Method | Expected Outcome | Status |
|---|-----------|--------|-----------------|--------|
| AS-01 | Login succeeds with valid credentials | `login` | Returns `{ access_token, user }` | PASSED |
| AS-02 | Login throws `UnauthorizedException` for unknown email | `login` | `UnauthorizedException` | PASSED |
| AS-03 | Login throws `UnauthorizedException` for wrong password | `login` | `UnauthorizedException` | PASSED |
| AS-04 | Login throws `UnauthorizedException` for inactive user | `login` | `UnauthorizedException` | PASSED |
| AS-05 | JWT is signed with correct payload after successful login | `login` | `jwtService.sign` called with `{ sub, email, role }` | PASSED |
| AS-06 | `validateUser` returns user for valid JWT payload | `validateUser` | User entity (without password) | PASSED |
| AS-07 | `validateUser` throws `UnauthorizedException` when user not found | `validateUser` | `UnauthorizedException` | PASSED |
| AS-08 | `validateUser` throws `UnauthorizedException` for inactive user | `validateUser` | `UnauthorizedException` | PASSED |
| AS-09 | `getCurrentUser` returns user data without password | `getCurrentUser` | User DTO | PASSED |
| AS-10 | `getCurrentUser` throws `UnauthorizedException` for non-existent user | `getCurrentUser` | `UnauthorizedException` | PASSED |

---

## 3. Auth — Controller

**File:** `src/auth/auth.controller.spec.ts` | **Type:** Unit

| # | Test Case | Method | Expected Outcome | Status |
|---|-----------|--------|-----------------|--------|
| AC-01 | `login` calls `authService.login` and returns token + user | `POST /auth/login` | `{ access_token, user }` | PASSED |
| AC-02 | `login` sets an `httpOnly` cookie with the access token | `POST /auth/login` | `res.cookie('access_token', ...)` called | PASSED |
| AC-03 | `login` propagates `UnauthorizedException` on invalid credentials | `POST /auth/login` | `UnauthorizedException` | PASSED |
| AC-04 | `getCurrentUser` returns the user from `authService.getCurrentUser` | `GET /auth/me` | User DTO | PASSED |
| AC-05 | `getCurrentUser` propagates `UnauthorizedException` for deactivated user | `GET /auth/me` | `UnauthorizedException` | PASSED |
| AC-06 | `logout` clears the `access_token` cookie and returns success message | `POST /auth/logout` | Cookie cleared, `{ message: '...' }` | PASSED |

---

## 4. Auth — Guards

### JwtAuthGuard

**File:** `src/auth/guards/jwt-auth.guard.spec.ts` | **Type:** Unit

| # | Test Case | Expected Outcome | Status |
|---|-----------|-----------------|--------|
| JG-01 | Guard is defined | Instance exists | PASSED |
| JG-02 | Returns `true` when parent `AuthGuard` resolves successfully | Request passes | PASSED |
| JG-03 | Propagates `UnauthorizedException` when token is missing | `UnauthorizedException` | PASSED |
| JG-04 | Propagates `UnauthorizedException` when token is expired | `UnauthorizedException` | PASSED |

### RolesGuard

**File:** `src/auth/guards/roles.guard.spec.ts` | **Type:** Unit

| # | Test Case | Expected Outcome | Status |
|---|-----------|-----------------|--------|
| RG-01 | Guard is defined | Instance exists | PASSED |
| RG-02 | Allows access when no roles metadata is set on the route | `true` | PASSED |
| RG-03 | Allows access when user role matches required role | `true` | PASSED |
| RG-04 | Denies access when user lacks any required role | `false` | PASSED |
| RG-05 | Checks both handler-level and class-level metadata via `getAllAndOverride` | Both metadata sources consulted | PASSED |

---

## 5. Users — Service

**File:** `src/users/users.service.spec.ts` | **Type:** Unit

| # | Test Case | Method | Expected Outcome | Status |
|---|-----------|--------|-----------------|--------|
| US-01 | Creates a new user successfully | `create` | Saved user entity | PASSED |
| US-02 | Hashes password before saving | `create` | `bcrypt.hash` called; raw password not persisted | PASSED |
| US-03 | Throws `ConflictException` when email already exists | `create` | `ConflictException` | PASSED |
| US-04 | Emits WebSocket event after user creation | `create` | `eventsGateway.emitUserCreated` called | PASSED |
| US-05 | Returns all users without passwords | `findAll` | Array without `password` field | PASSED |
| US-06 | Returns empty array when no users exist | `findAll` | `[]` | PASSED |
| US-07 | Returns user by ID without password | `findOne` | User DTO | PASSED |
| US-08 | Throws `NotFoundException` when user ID not found | `findOne` | `NotFoundException` | PASSED |
| US-09 | Updates user successfully | `update` | Updated user entity | PASSED |
| US-10 | Throws `NotFoundException` on update when user not found | `update` | `NotFoundException` | PASSED |
| US-11 | Throws `ConflictException` when updated email already taken | `update` | `ConflictException` | PASSED |
| US-12 | Hashes password when updating password field | `update` | `bcrypt.hash` called | PASSED |
| US-13 | Emits WebSocket event after user update | `update` | `eventsGateway.emitUserUpdated` called | PASSED |
| US-14 | Removes user successfully | `remove` | User deleted | PASSED |
| US-15 | Throws `NotFoundException` on remove when user not found | `remove` | `NotFoundException` | PASSED |
| US-16 | Emits WebSocket event after user deletion | `remove` | `eventsGateway.emitUserDeleted` called | PASSED |
| US-17 | Toggles active status from `true` to `false` | `toggleStatus` | `user.isActive === false` | PASSED |
| US-18 | Toggles active status from `false` to `true` | `toggleStatus` | `user.isActive === true` | PASSED |
| US-19 | Throws `NotFoundException` on toggleStatus when user not found | `toggleStatus` | `NotFoundException` | PASSED |
| US-20 | Emits WebSocket event after status change | `toggleStatus` | `eventsGateway.emitUserStatusChanged` called | PASSED |
| US-21 | Returns user statistics (counts by role/status) | `getStats` | Stats DTO | PASSED |

---

## 6. Users — Controller

**File:** `src/users/users.controller.spec.ts` | **Type:** Unit

| # | Test Case | Method | Expected Outcome | Status |
|---|-----------|--------|-----------------|--------|
| UC-01 | `create` delegates to `usersService.create` | `POST /users` | Created user | PASSED |
| UC-02 | `createPhi` creates PHI when supervisor has a district | `POST /users/phi` | PHI user with districtId | PASSED |
| UC-03 | `createPhi` throws `BadRequestException` when supervisor has no district | `POST /users/phi` | `BadRequestException` | PASSED |
| UC-04 | `findAll` returns all users | `GET /users` | User array | PASSED |
| UC-05 | `getStats` returns stats from service | `GET /users/stats` | Stats object | PASSED |
| UC-06 | `findOne` returns user by ID | `GET /users/:id` | User DTO | PASSED |
| UC-07 | `findOne` propagates `NotFoundException` when user doesn't exist | `GET /users/:id` | `NotFoundException` | PASSED |
| UC-08 | `update` delegates to `usersService.update` | `PATCH /users/:id` | Updated user | PASSED |
| UC-09 | `toggleStatus` delegates to `usersService.toggleStatus` | `PATCH /users/:id/status` | Updated user | PASSED |
| UC-10 | `remove` delegates to `usersService.remove` | `DELETE /users/:id` | Deletion result | PASSED |
| UC-11 | Returns notification preferences when user requests their own | `GET /users/:id/notifications` | Prefs DTO | PASSED |
| UC-12 | Returns notification preferences when admin requests any user | `GET /users/:id/notifications` | Prefs DTO | PASSED |
| UC-13 | Throws `ForbiddenException` when non-admin requests another user's preferences | `GET /users/:id/notifications` | `ForbiddenException` | PASSED |
| UC-14 | Updates notification preferences when user updates their own | `PUT /users/:id/notifications` | Updated prefs | PASSED |
| UC-15 | Throws `ForbiddenException` when non-admin updates another user's preferences | `PUT /users/:id/notifications` | `ForbiddenException` | PASSED |

---

## 7. Tasks — Service

**File:** `src/tasks/tasks.service.spec.ts` | **Type:** Unit

| # | Test Case | Method | Expected Outcome | Status |
|---|-----------|--------|-----------------|--------|
| TS-01 | Saves the task and returns it with relations loaded | `create` | Task entity with relations | PASSED |
| TS-02 | Sets status to `PENDING` when no PHI assigned | `create` | `task.status === 'PENDING'` | PASSED |
| TS-03 | Sets status to `ASSIGNED` when PHI ID is provided | `create` | `task.status === 'ASSIGNED'` | PASSED |
| TS-04 | Emits socket event after task creation | `create` | `eventsGateway.emitTaskCreated` called | PASSED |
| TS-05 | Sends assignment email when task is created with a PHI | `create` | `emailService.send` called | PASSED |
| TS-06 | Returns cached result without hitting DB on cache hit | `findAll` | Cached data returned | PASSED |
| TS-07 | Queries DB on cache miss and caches the result | `findAll` | DB queried; result cached | PASSED |
| TS-08 | Applies `status` filter when provided | `findAll` | Only tasks matching status | PASSED |
| TS-09 | Applies `districtId` filter when provided | `findAll` | Only tasks in district | PASSED |
| TS-10 | Applies `assignedPhiId` filter when provided | `findAll` | Only tasks assigned to PHI | PASSED |
| TS-11 | Returns task when found | `findOne` | Task entity | PASSED |
| TS-12 | Throws `NotFoundException` when task not found | `findOne` | `NotFoundException` | PASSED |
| TS-13 | Merges fields and saves on update | `update` | Updated task | PASSED |
| TS-14 | Throws `NotFoundException` on update when task not found | `update` | `NotFoundException` | PASSED |
| TS-15 | Invalidates caches after update | `update` | Cache keys deleted | PASSED |
| TS-16 | Transitions `PENDING -> ASSIGNED` successfully | `updateStatus` | Status updated | PASSED |
| TS-17 | Throws `BadRequestException` on invalid status transition | `updateStatus` | `BadRequestException` | PASSED |
| TS-18 | Allows force-complete regardless of current status | `updateStatus` | Status set to `COMPLETED` | PASSED |
| TS-19 | Emits socket events after status change | `updateStatus` | `emitTaskStatusChanged` called | PASSED |
| TS-20 | Assigns PHI and returns updated task | `assignTask` | Task with assigned PHI | PASSED |
| TS-21 | Throws `BadRequestException` when PHI not found or inactive | `assignTask` | `BadRequestException` | PASSED |
| TS-22 | Emits task assigned event | `assignTask` | `emitTaskAssigned` called | PASSED |
| TS-23 | Removes task and emits deleted event | `remove` | Task deleted; event emitted | PASSED |
| TS-24 | Throws `NotFoundException` on remove when task not found | `remove` | `NotFoundException` | PASSED |
| TS-25 | Returns cached stats on cache hit | `getStats` | Cached stats | PASSED |
| TS-26 | Computes stats from tasks on cache miss | `getStats` | Stats DTO; result cached | PASSED |
| TS-27 | Throws `ForbiddenException` if submitter is not assigned PHI | `addEvidence` | `ForbiddenException` | PASSED |
| TS-28 | Saves evidence and returns it | `addEvidence` | Evidence entity | PASSED |
| TS-29 | Returns cached PHI list on cache hit | `getPhisByDistrict` | Cached PHI list | PASSED |
| TS-30 | Queries DB on cache miss and caches result | `getPhisByDistrict` | DB queried; result cached | PASSED |

---

## 8. Tasks — Controller

**File:** `src/tasks/tasks.controller.spec.ts` | **Type:** Unit

| # | Test Case | Method | Expected Outcome | Status |
|---|-----------|--------|-----------------|--------|
| TC-01 | `create` delegates to `tasksService.create` with user ID | `POST /tasks` | Created task | PASSED |
| TC-02 | `findAll` passes `undefined` filters when no query params provided | `GET /tasks` | All tasks | PASSED |
| TC-03 | `findAll` parses `districtId` as integer from query string | `GET /tasks?districtId=3` | Parsed int filter | PASSED |
| TC-04 | `findAll` applies all provided filters together | `GET /tasks?...` | Filtered tasks | PASSED |
| TC-05 | `getStats` passes `undefined` districtId when no query param | `GET /tasks/stats` | All stats | PASSED |
| TC-06 | `getStats` parses `districtId` as integer | `GET /tasks/stats?districtId=2` | District-scoped stats | PASSED |
| TC-07 | `getPhisByDistrict` delegates to `tasksService.getPhisByDistrict` | `GET /tasks/phis/:districtId` | PHI list | PASSED |
| TC-08 | `findOne` calls `tasksService.findOne` with relations flag `true` | `GET /tasks/:id` | Task with relations | PASSED |
| TC-09 | `update` delegates to `tasksService.update` | `PATCH /tasks/:id` | Updated task | PASSED |
| TC-10 | `updateStatus` calls service with user ID | `PATCH /tasks/:id/status` | Updated task | PASSED |
| TC-11 | `updateStatus` strips `force` flag for PHI users | `PATCH /tasks/:id/status` | `force` not forwarded | PASSED |
| TC-12 | `updateStatus` allows `force` flag for supervisors | `PATCH /tasks/:id/status` | `force` forwarded | PASSED |
| TC-13 | `updateStatus` allows `force` flag for admins | `PATCH /tasks/:id/status` | `force` forwarded | PASSED |
| TC-14 | `assignTask` calls service with user ID | `PATCH /tasks/:id/assign` | Updated task | PASSED |
| TC-15 | `remove` delegates to `tasksService.remove` | `DELETE /tasks/:id` | Deletion result | PASSED |
| TC-16 | `addEvidence` calls service with task ID and user ID | `POST /tasks/:id/evidence` | Evidence entity | PASSED |
| TC-17 | `getEvidence` delegates to `tasksService.getEvidence` | `GET /tasks/:id/evidence` | Evidence list | PASSED |

---

## 9. Tasks — Messages Service

**File:** `src/tasks/task-messages.service.spec.ts` | **Type:** Unit

| # | Test Case | Method | Expected Outcome | Status |
|---|-----------|--------|-----------------|--------|
| TM-01 | Saves message and broadcasts to socket room | `sendMessage` | Message entity; `emitChatMessage` called | PASSED |
| TM-02 | Throws `NotFoundException` if task not found and no preloaded task | `sendMessage` | `NotFoundException` | PASSED |
| TM-03 | Uses preloaded task without querying DB | `sendMessage` | Repository not called | PASSED |
| TM-04 | Auto-reads the message for the sender | `sendMessage` | `markRead` called with sender ID | PASSED |
| TM-05 | Returns correct `MessageResponseDto` shape | `sendMessage` | DTO matches schema | PASSED |
| TM-06 | Saves a system message and broadcasts it | `sendSystemMessage` | System message stored; event emitted | PASSED |
| TM-07 | Silently returns if task no longer exists | `sendSystemMessage` | No error thrown | PASSED |
| TM-08 | Returns empty array when no messages exist | `getMessages` | `[]` | PASSED |
| TM-09 | Returns messages in chronological order | `getMessages` | Ordered array | PASSED |
| TM-10 | Does nothing when `messageIds` is empty | `markRead` | No DB write | PASSED |
| TM-11 | Ignores non-UUID message IDs | `markRead` | Invalid IDs filtered out | PASSED |
| TM-12 | Busts unread cache and broadcasts read receipt | `markRead` | Cache invalidated; `emitChatRead` called | PASSED |
| TM-13 | Returns cached count on cache hit | `getUnreadCount` | Cached integer | PASSED |
| TM-14 | Queries DB on cache miss and caches result | `getUnreadCount` | DB queried; result cached | PASSED |
| TM-15 | Adds reaction when none exists for that emoji | `toggleReaction` | Reaction inserted | PASSED |
| TM-16 | Removes reaction when same emoji already exists | `toggleReaction` | Reaction deleted | PASSED |
| TM-17 | Falls back to a default emoji for unknown emoji codes | `toggleReaction` | Default emoji used | PASSED |
| TM-18 | Throws `NotFoundException` when message not found | `toggleReaction` | `NotFoundException` | PASSED |
| TM-19 | Broadcasts reaction event after toggle | `toggleReaction` | `emitChatReaction` called | PASSED |
| TM-20 | Calls `emitBroadcast` on the gateway | `broadcastToDistrict` | Gateway emit invoked | PASSED |

---

## 10. Tasks — Guards

**File:** `src/tasks/guards/task-participant.guard.spec.ts` | **Type:** Unit

| # | Test Case | Expected Outcome | Status |
|---|-----------|-----------------|--------|
| TG-01 | Guard is defined | Instance exists | PASSED |
| TG-02 | Returns `true` when `taskId` is absent from params | Passes without DB query | PASSED |
| TG-03 | Returns `true` immediately for `ADMIN` users without querying DB | Admin bypass | PASSED |
| TG-04 | Returns `true` and attaches task when user is the task creator | Access granted | PASSED |
| TG-05 | Returns `true` when user is the assigned PHI | Access granted | PASSED |
| TG-06 | Throws `ForbiddenException` when user is not a participant | `ForbiddenException` | PASSED |
| TG-07 | Throws `NotFoundException` when task does not exist | `NotFoundException` | PASSED |

---

## 11. Analytics — Service

**File:** `src/analytics/analytics.service.spec.ts` | **Type:** Unit

| # | Test Case | Method | Expected Outcome | Status |
|---|-----------|--------|-----------------|--------|
| AN-01 | Returns latest week data per district | `getLatestWeekPerDistrict` | Array of district snapshots | PASSED |
| AN-02 | Returns time series data for an existing district | `getTimeSeries` | Ordered time series array | PASSED |
| AN-03 | Returns empty array for a non-existent district | `getTimeSeries` | `[]` | PASSED |
| AN-04 | Returns dashboard summary data | `getDashboardSummary` | Summary DTO | PASSED |
| AN-05 | Returns default values when no data available | `getDashboardSummary` | Zero-valued defaults | PASSED |
| AN-06 | Returns trend data for specified number of weeks | `getTrends` | Trend array | PASSED |
| AN-07 | Calls ML service and emits WebSocket event | `predictBulkFromML` | ML called; `emitAnalyticsUpdated` called | PASSED |
| AN-08 | Returns growth rate data for all districts | `getGrowthRate` | Growth rate array | PASSED |
| AN-09 | Returns hotspot districts | `getHotspots` | Hotspot list | PASSED |
| AN-10 | Returns outbreak alerts | `getOutbreakAlerts` | Alert list | PASSED |
| AN-11 | Returns weather correlation data | `getWeatherCorrelation` | Correlation DTO | PASSED |
| AN-12 | Returns weekly forecast data | `getWeeklyForecast` | Forecast array | PASSED |
| AN-13 | Returns error for non-existent district in explainable insight | `getExplainableInsight` | Error response | PASSED |
| AN-14 | Calls explain-analytics service and returns insight | `getExplainableInsight` | Insight DTO | PASSED |
| AN-15 | Returns fallback when explain-analytics service is down | `getExplainableInsight` | Fallback response | PASSED |

---

## 12. Reports — Service

**File:** `src/reports/reports.service.spec.ts` | **Type:** Unit

| # | Test Case | Method | Expected Outcome | Status |
|---|-----------|--------|-----------------|--------|
| RS-01 | Returns all reports when no filters applied | `listReports` | Full report list | PASSED |
| RS-02 | Applies status filter correctly | `listReports` | Filtered report list | PASSED |
| RS-03 | Applies year filter correctly | `listReports` | Year-scoped list | PASSED |
| RS-04 | Returns the report when found | `getReport` | Report entity | PASSED |
| RS-05 | Throws `NotFoundException` when report not found | `getReport` | `NotFoundException` | PASSED |
| RS-06 | Normalises legacy forecast rows | `getReport` | Rows conform to current schema | PASSED |
| RS-07 | Throws `ConflictException` when report already exists for week/district | `generateReport` | `ConflictException` | PASSED |
| RS-08 | Generates PDF, uploads to S3, and returns report with download URL | `generateReport` | Report with `downloadUrl` | PASSED |
| RS-09 | Emails admins and supervisors after generation | `generateReport` | `emailService.sendToRole` called | PASSED |
| RS-10 | Sets status to `APPROVED` and persists | `approveReport` | `status === 'APPROVED'` | PASSED |
| RS-11 | Throws `NotFoundException` when report not found on approve | `approveReport` | `NotFoundException` | PASSED |
| RS-12 | Notifies supervisors after approval | `approveReport` | `emailService.sendToRole` called | PASSED |
| RS-13 | Returns signed URL for existing S3 key | `getDownloadUrl` | Signed URL string | PASSED |
| RS-14 | Throws `NotFoundException` when `s3Key` is null | `getDownloadUrl` | `NotFoundException` | PASSED |
| RS-15 | Deletes the report from DB | `deleteReport` | Report removed | PASSED |
| RS-16 | Throws `NotFoundException` when report not found on delete | `deleteReport` | `NotFoundException` | PASSED |

---

## 13. Email Service

**File:** `src/email/email.service.spec.ts` | **Type:** Unit

| # | Test Case | Scenario | Expected Outcome | Status |
|---|-----------|----------|-----------------|--------|
| ES-01 | Skips without enqueueing when `EMAIL_ENABLED=false` | `send` | Queue not called | PASSED |
| ES-02 | Enqueues a job for a single recipient | `send` | `queue.add` called once | PASSED |
| ES-03 | Enqueues one job per recipient for an array of recipients | `send` | `queue.add` called N times | PASSED |
| ES-04 | Skips recipient who has opted out of notification category | `send` | Opted-out recipient skipped | PASSED |
| ES-05 | Sends when notification preference is `true` | `send` | `queue.add` called | PASSED |
| ES-06 | Skips opt-out check when no `notificationCategory` provided | `send` | Always enqueued | PASSED |
| ES-07 | Does not throw if `queue.add` fails | `send` | Error swallowed | PASSED |
| ES-08 | Fetches active users with role and enqueues one job each | `sendToRole` | `queue.add` called per user | PASSED |
| ES-09 | Skips entirely when `EMAIL_ENABLED=false` | `sendToRole` | Queue not called | PASSED |
| ES-10 | Does not throw when DB query for users fails | `sendToRole` | Error swallowed | PASSED |

---

## 14. Storage Service

**File:** `src/storage/storage.service.spec.ts` | **Type:** Unit

| # | Test Case | Expected Outcome | Status |
|---|-----------|-----------------|--------|
| ST-01 | Rejects unsupported MIME types for evidence uploads | Error thrown | PASSED |
| ST-02 | Rejects files larger than 10 MB | Error thrown | PASSED |
| ST-03 | Uploads evidence image and returns key with signed URL | `{ key, url }` | PASSED |
| ST-04 | Uploads report PDF with attachment content-disposition metadata | S3 put with correct headers | PASSED |
| ST-05 | Generates signed URL from legacy full S3 URL | Signed URL string | PASSED |

---

## 15. Cache Helper Service

**File:** `src/cache/cache-helper.service.spec.ts` | **Type:** Unit

| # | Test Case | Expected Outcome | Status |
|---|-----------|-----------------|--------|
| CH-01 | Reads and parses JSON from Redis client when available | Parsed object | PASSED |
| CH-02 | Returns `null` for invalid Redis JSON payloads | `null` | PASSED |
| CH-03 | Uses `SETEX` with rounded-up TTL seconds in Redis mode | `setex` called with correct args | PASSED |
| CH-04 | Increments counter atomically via Redis pipeline | Counter incremented | PASSED |
| CH-05 | Deletes keys by pattern and ignores Redis errors | Keys removed; no throw | PASSED |
| CH-06 | Returns fresh SWR Redis data without invoking fetcher | Cached data returned | PASSED |
| CH-07 | Returns stale data and attempts background refresh lock | Stale served; refresh queued | PASSED |
| CH-08 | Fetches and stores SWR entry on Redis hard miss | Fetcher called; result cached | PASSED |
| CH-09 | Uses cache-manager fallback path when Redis client is unavailable | Cache-manager used | PASSED |

---

## 16. Chatbot Service

**File:** `src/chatbot/chatbot.service.spec.ts` | **Type:** Unit

| # | Test Case | Expected Outcome | Status |
|---|-----------|-----------------|--------|
| CB-01 | Creates a chatbot session | Session object returned | PASSED |
| CB-02 | Sends chat payload and returns response body | Response DTO | PASSED |
| CB-03 | Uses default URL for health check when env var is missing | Default URL used | PASSED |

---

## 17. Push Notification Service

**File:** `src/notifications/push-notification.service.spec.ts` | **Type:** Unit

| # | Test Case | Expected Outcome | Status |
|---|-----------|-----------------|--------|
| PN-01 | Skips initialization when credentials env var is missing | Firebase not initialised | PASSED |
| PN-02 | Logs error when credentials are invalid JSON | Error logged; no crash | PASSED |
| PN-03 | Initialises Firebase Admin when credentials are valid JSON | Firebase app created | PASSED |
| PN-04 | Sends notification with trimmed preview for long messages | `messaging.send` called; body truncated | PASSED |
| PN-05 | Swallows send errors and logs a warning | No exception propagated | PASSED |
| PN-06 | No-ops when Firebase is not configured | `messaging.send` not called | PASSED |

---

## 18. Events Gateway

**File:** `src/events/events.gateway.spec.ts` | **Type:** Unit

| # | Test Case | Group | Expected Outcome | Status |
|---|-----------|-------|-----------------|--------|
| EG-01 | Logs initialization message | `afterInit` | Logger called | PASSED |
| EG-02 | Authenticates user and joins rooms on valid token | `handleConnection` | Client joins role + district rooms | PASSED |
| EG-03 | Disconnects client when no token provided | `handleConnection` | `client.disconnect()` called | PASSED |
| EG-04 | Disconnects client when token is invalid | `handleConnection` | `client.disconnect()` called | PASSED |
| EG-05 | Logs disconnection message | `handleDisconnect` | Logger called | PASSED |
| EG-06 | Emits `user:created` to admin and supervisor rooms | `emitUserCreated` | Server emit to correct rooms | PASSED |
| EG-07 | Emits `user:updated` to admin and supervisor rooms | `emitUserUpdated` | Server emit to correct rooms | PASSED |
| EG-08 | Emits `user:deleted` to admin and supervisor rooms | `emitUserDeleted` | Server emit to correct rooms | PASSED |
| EG-09 | Emits `user:status-changed` to admin and supervisor rooms | `emitUserStatusChanged` | Server emit to correct rooms | PASSED |
| EG-10 | Emits `analytics:updated` to all connected clients | `emitAnalyticsUpdated` | Broadcast emitted | PASSED |
| EG-11 | Emits to specific district when provided | `emitNotification` | District room targeted | PASSED |
| EG-12 | Emits to specific roles when provided | `emitNotification` | Role rooms targeted | PASSED |
| EG-13 | Emits to all when no target specified | `emitNotification` | Broadcast emitted | PASSED |
| EG-14 | Emits to a specific user room | `emitToUser` | User room targeted | PASSED |
| EG-15 | Returns count of connected clients | `getConnectedClients` | Integer count | PASSED |
| EG-16 | Returns `0` when server is not initialized | `getConnectedClients` | `0` | PASSED |
| EG-17 | Emits `task:created` to district, supervisor, admin rooms and assigned PHI | `emitTaskCreated` | All relevant rooms notified | PASSED |
| EG-18 | Skips district and PHI rooms when not provided | `emitTaskCreated` | Only role rooms emit | PASSED |
| EG-19 | Emits `task:updated` to district, roles, and assigned PHI | `emitTaskUpdated` | All relevant rooms notified | PASSED |
| EG-20 | Emits `task:status-changed` with old and new status | `emitTaskStatusChanged` | Payload contains both statuses | PASSED |
| EG-21 | Emits `task:assigned` to district, roles, and assigned PHI | `emitTaskAssigned` | All relevant rooms notified | PASSED |
| EG-22 | Emits `task:deleted` with task ID payload | `emitTaskDeleted` | Payload contains `taskId` | PASSED |
| EG-23 | Emits `chat:message` to the task room | `emitChatMessage` | Task room targeted | PASSED |
| EG-24 | Emits `chat:read` with userId and messageIds | `emitChatRead` | Payload contains both fields | PASSED |
| EG-25 | Emits `chat:reaction` to the task room | `emitChatReaction` | Task room targeted | PASSED |
| EG-26 | Emits `chat:broadcast` to the district room | `emitBroadcast` | District room targeted | PASSED |
| EG-27 | Joins task room when user is the creator | `handleChatJoin` | `client.join(taskRoom)` called | PASSED |
| EG-28 | Joins task room when user is an admin | `handleChatJoin` | `client.join(taskRoom)` called | PASSED |
| EG-29 | Does not join when user is not a participant | `handleChatJoin` | `client.join` not called | PASSED |
| EG-30 | Does not join when client has no user attached | `handleChatJoin` | No operation | PASSED |
| EG-31 | Does not join when task is not found | `handleChatJoin` | No operation | PASSED |
| EG-32 | Leaves the task room | `handleChatLeave` | `client.leave(taskRoom)` called | PASSED |
| EG-33 | Does nothing when `taskId` is absent | `handleChatLeave` | No operation | PASSED |
| EG-34 | Broadcasts typing status to the task room | `handleChatTyping` | Typing event emitted to room | PASSED |
| EG-35 | Does nothing when client has no user | `handleChatTyping` | No operation | PASSED |

---

## 19. Integration Tests — Auth

**File:** `src/auth/auth.integration.spec.ts` | **Type:** Integration | **Runner:** `npm run test:integration`

> Requires `TEST_DATABASE_URL`. Tests skip gracefully when the env var is absent.

| # | Test Case | Method | Expected Outcome | Status |
|---|-----------|--------|-----------------|--------|
| AI-01 | Returns access token and user DTO on valid credentials | `login` | `{ access_token, user }` | PASSED |
| AI-02 | Throws `UnauthorizedException` when password is wrong | `login` | `UnauthorizedException` | PASSED |
| AI-03 | Throws `UnauthorizedException` when user does not exist | `login` | `UnauthorizedException` | PASSED |
| AI-04 | Throws `UnauthorizedException` when account is deactivated | `login` | `UnauthorizedException` | PASSED |
| AI-05 | Returns user DTO when user exists in DB | `getCurrentUser` | User DTO (no password) | PASSED |
| AI-06 | Throws `UnauthorizedException` when no user matches the ID | `getCurrentUser` | `UnauthorizedException` | PASSED |

---

## 20. Integration Tests — Users

**File:** `src/users/users.integration.spec.ts` | **Type:** Integration | **Runner:** `npm run test:integration`

| # | Test Case | Method | Expected Outcome | Status |
|---|-----------|--------|-----------------|--------|
| UI-01 | Persists user and returns it without the password field | `create` | User DTO | PASSED |
| UI-02 | Throws `ConflictException` when a user with the same email already exists | `create` | `ConflictException` | PASSED |
| UI-03 | Returns all users without password fields | `findAll` | Array without `password` | PASSED |
| UI-04 | Returns the user when found by ID | `findOne` | User entity | PASSED |
| UI-05 | Throws `NotFoundException` when the user does not exist | `findOne` | `NotFoundException` | PASSED |
| UI-06 | Persists the updated email in the database | `update` | Updated record in DB | PASSED |
| UI-07 | Deletes the user so that a subsequent `findOne` throws `NotFoundException` | `remove` | `NotFoundException` on re-fetch | PASSED |
| UI-08 | Creates default all-enabled preferences on first access | `getNotificationPreferences` | Prefs with all `true` | PASSED |
| UI-09 | Returns the same record on a second call without creating a duplicate | `getNotificationPreferences` | Single record (no duplicates) | PASSED |

---

## 21. Integration Tests — Tasks

**File:** `src/tasks/tasks.integration.spec.ts` | **Type:** Integration | **Runner:** `npm run test:integration`

| # | Test Case | Method | Expected Outcome | Status |
|---|-----------|--------|-----------------|--------|
| TI-01 | Persists the task and emits a creation event | `create` | Task in DB; event emitted | PASSED |
| TI-02 | Returns all persisted tasks | `findAll` | Full task list | PASSED |
| TI-03 | Returns only tasks matching the given status filter | `findAll` | Filtered list | PASSED |
| TI-04 | Returns only tasks belonging to the specified district | `findAll` | District-scoped list | PASSED |
| TI-05 | Returns the task with district and creator relations loaded | `findOne` | Task with nested relations | PASSED |
| TI-06 | Throws `NotFoundException` when the task does not exist | `findOne` | `NotFoundException` | PASSED |
| TI-07 | Persists the new status after a valid `PENDING -> ASSIGNED` transition | `updateStatus` | Status updated in DB | PASSED |
| TI-08 | Throws `BadRequestException` for an invalid status transition | `updateStatus` | `BadRequestException` | PASSED |
| TI-09 | Deletes the task and emits a deletion event | `remove` | Task removed from DB; event emitted | PASSED |

---

## 22. Integration Tests — Reports

**File:** `src/reports/reports.integration.spec.ts` | **Type:** Integration | **Runner:** `npm run test:integration`

| # | Test Case | Method | Expected Outcome | Status |
|---|-----------|--------|-----------------|--------|
| RI-01 | Returns empty array when no reports exist | `listReports` | `[]` | PASSED |
| RI-02 | Returns all seeded reports ordered by year and week descending | `listReports` | Ordered list | PASSED |
| RI-03 | Filters by status when provided | `listReports` | Status-filtered list | PASSED |
| RI-04 | Throws `NotFoundException` when the report does not exist | `getReport` | `NotFoundException` | PASSED |
| RI-05 | Returns the report when it exists in the database | `getReport` | Report entity | PASSED |

---

## 23. Integration Tests — Analytics

**File:** `src/analytics/analytics.integration.spec.ts` | **Type:** Integration | **Runner:** `npm run test:integration`

| # | Test Case | Method | Expected Outcome | Status |
|---|-----------|--------|-----------------|--------|
| ANI-01 | Returns empty array when the `dengue_cases` table is empty | `getLatestWeekPerDistrict` | `[]` | PASSED |
| ANI-02 | Returns one row per district with the most recent week when data is seeded | `getLatestWeekPerDistrict` | One row per district | PASSED |
| ANI-03 | Returns empty array for a district that does not exist | `getTimeSeries` | `[]` | PASSED |
| ANI-04 | Returns ordered rows for a seeded district | `getTimeSeries` | Chronologically ordered rows | PASSED |

---

## Test Count Summary

| Module | Unit Tests | Integration Tests | Total |
|--------|:----------:|:-----------------:|:-----:|
| App / Health | 10 | — | 10 |
| Auth (Service + Controller + Guards) | 20 | 6 | 26 |
| Users (Service + Controller) | 36 | 9 | 45 |
| Tasks (Service + Controller + Messages + Guards) | 54 | 9 | 63 |
| Analytics | 15 | 4 | 19 |
| Reports | 16 | 5 | 21 |
| Email | 10 | — | 10 |
| Storage | 5 | — | 5 |
| Cache Helper | 9 | — | 9 |
| Chatbot | 3 | — | 3 |
| Push Notifications | 6 | — | 6 |
| Events Gateway | 35 | — | 35 |
| **Total** | **219** | **33** | **252** |

> Note: test IDs and counts reflect the spec files as of the last test run documented in [docs/TESTING_WORKFLOW.md](docs/TESTING_WORKFLOW.md). The unit total here (219) is a module-attributed subset; the full passing suite is **244 unit + 33 integration = 277 tests**.
