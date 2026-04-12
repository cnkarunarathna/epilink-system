# Microservice Authentication — Implementation Plan

---

## Plan Validation Findings

The following issues were found by reading the actual source files before implementation.
Each has been corrected in the steps below. Do not skip this section.

### Issue 1 — User object shape: `id` not `sub`

The JWT strategy's `validate()` in [backend/src/auth/strategies/jwt.strategy.ts](backend/src/auth/strategies/jwt.strategy.ts)
returns `{ id, email, role, district }`. The raw `JwtPayload` interface uses `sub`, but the
object attached to `req.user` after validation has `id`. The original plan used `user.sub` in
`buildServiceHeaders` — **corrected below to use `user.id`**.

### Issue 2 — Analytics controller has no `@Roles()` guards on explain endpoints

[backend/src/analytics/analytics.controller.ts](backend/src/analytics/analytics.controller.ts)
uses `@UseGuards(JwtAuthGuard)` at the class level but no `@Roles()` on any individual
endpoint. Any authenticated user (supervisor, viewer) can currently call `/api/analytics/explain/*`.
**The plan must add `@Roles('admin')` to explain and RAG endpoints — corrected in Step 2.**

### Issue 3 — Two frontend API clients, not one

There are two separate API clients that both inject bearer tokens from `localStorage`:

- [frontend/lib/api.ts](frontend/lib/api.ts) — axios instance (used by most services)
- [frontend/services/api/index.ts](frontend/services/api/index.ts) — raw `fetch` wrapper (used by older service layer)

Both must be updated in Step 4. The original plan only mentioned `api.ts`.

### Issue 4 — `JwtModule.register()` cannot use `ConfigService`

[backend/src/auth/auth.module.ts](backend/src/auth/auth.module.ts) uses `JwtModule.register()`
with a hardcoded secret fallback. `ConfigService.getOrThrow()` requires `JwtModule.registerAsync()`.
**Step 6 must also change the module registration — corrected below.**

### Issue 5 — Stale `x-internal-api-key` bypass in `JwtAuthGuard`

[backend/src/auth/guards/jwt-auth.guard.ts](backend/src/auth/guards/jwt-auth.guard.ts) has a
bypass that skips JWT validation if `x-internal-api-key` matches `INTERNAL_SERVICE_KEY`.
Since we are eliminating service keys, this bypass must be removed as part of cleanup.
**Added to Step 6.**

### Issue 6 — `CORS credentials: true` already set in `main.ts`

[backend/src/main.ts](backend/src/main.ts) already has `credentials: true`. Step 4 does not
need to add it — only the cookie extraction change and `cookieParser` middleware are new.

### Issue 7 — Wrong token key in `services/api/index.ts`

`uploadEvidence` and `downloadReportPdf` in [frontend/services/api/index.ts](frontend/services/api/index.ts)
read `localStorage.getItem("auth_token")` — a different key from `ACCESS_TOKEN_KEY` (`"accessToken"`).
This is a pre-existing bug. Step 4 removes all localStorage token reads, which fixes it as a side effect.

---

## Actual Call Graph (Current State)

```
Browser
  ├── /api/chatbot/*  →  Next.js API route (server-side proxy)  →  chatbot:8002
  └── /api/*          →  NestJS backend:3001
                              ├── ml-model:8000          (no auth)
                              ├── route-optimizer:8001   (no auth)
                              └── explain-analytics:8010 (partial auth)
```

Key observation: **the browser never calls Python services directly.** The chatbot is already
proxied server-side through Next.js API routes. The only direct browser target is NestJS backend.
This means NestJS is already the natural gateway — the architecture just needs to be tightened.

---

## Approach Options

| Option | What                                | No service keys? | No 3rd-party tools? | Local dev friendly? |
| ------ | ----------------------------------- | ---------------- | ------------------- | ------------------- |
| **A**  | Per-service keys on Python services | No               | Yes                 | Yes                 |
| **B**  | Traefik as edge gateway             | Yes (edge only)  | No                  | No (Docker-only)    |
| **C**  | NestJS as the gateway (custom)      | **Yes**          | **Yes**             | **Yes**             |

**Option C is the right fit for this system.** It uses what you already have, works
identically in local dev (npm scripts) and production (Docker), and requires zero new
infrastructure or service key management.

---

## Option C — NestJS as the Custom Gateway (Recommended)

### Core idea

The NestJS backend is already the sole entry point for authenticated requests. The gap is that:

1. Python services have no way to know who is calling them or who the user is
2. The chatbot proxy lives in Next.js instead of NestJS — splitting the trust boundary
3. Python ports are open in local dev with no protection

The fix: **NestJS owns all proxy responsibilities and forwards verified user context as plain
headers. Python services do their own lightweight RBAC on those headers — no shared secrets,
no third-party tools.**

### Target Architecture

```
Browser
  │  Authorization: Bearer <JWT>  (or httpOnly cookie — see Step 2)
  ▼
NestJS Backend (:3001)       ← validates JWT, sole entry point for all service calls
  │
  │  Headers on every outbound call:
  │    x-user-id: <id>
  │    x-user-role: admin | supervisor | viewer
  │    x-user-district: <district>
  │    x-request-id: <uuid>
  │
  ├──→ ml-model:8000             reads x-user-role if it needs to gate by role
  ├──→ route-optimizer:8001      reads x-user-role if it needs to gate by role
  ├──→ explain-analytics:8010    enforces x-user-role === "admin"
  └──→ chatbot:8002              (proxied from NestJS, moved from Next.js)

Next.js Frontend (:3000)
  └── /api/chatbot/*  →  removed — NestJS handles this now
```

### Why this works without service keys

In this model, Python services trust the `x-user-role` / `x-user-id` headers because:

- **Local dev:** Trust-by-convention. All calls go through NestJS. The ports are open, but
  you and your team are the only users. Acceptable for development.
- **Production (Docker):** Python services have **no `ports:` mapping** in docker-compose.
  They are unreachable from outside the Docker network. Only NestJS can call them.
  The headers are trusted because only NestJS can inject them.

The Docker network IS the security enforcement in production. The headers carry user context,
not authentication proof.

---

## Implementation Steps

### Step 1 — Move chatbot proxy from Next.js to NestJS (~2 hours)

Currently the chatbot proxy lives in three Next.js API routes:

- `frontend/app/api/chatbot/route.ts`
- `frontend/app/api/chatbot/session/route.ts`
- `frontend/app/api/chatbot/health/route.ts`

Move these into the NestJS backend so all service calls are routed through a single JWT-validated
entry point.

**1a. Create a chatbot proxy module in NestJS**

```typescript
// backend/src/chatbot/chatbot.module.ts
import { Module } from "@nestjs/common";
import { ChatbotController } from "./chatbot.controller";
import { ChatbotService } from "./chatbot.service";

@Module({
  controllers: [ChatbotController],
  providers: [ChatbotService],
})
export class ChatbotModule {}
```

```typescript
// backend/src/chatbot/chatbot.service.ts
import { Injectable } from "@nestjs/common";
import axios from "axios";

@Injectable()
export class ChatbotService {
  private readonly url =
    process.env.CHATBOT_SERVICE_URL || "http://localhost:8002";

  async createSession() {
    const res = await axios.post(`${this.url}/session`);
    return res.data;
  }

  async chat(sessionId: string, message: string) {
    const res = await axios.post(`${this.url}/chat`, {
      session_id: sessionId,
      message,
    });
    return res.data;
  }

  async health() {
    const res = await axios.get(`${this.url}/health`);
    return res.data;
  }
}
```

```typescript
// backend/src/chatbot/chatbot.controller.ts
import { Controller, Post, Get, Body, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ChatbotService } from "./chatbot.service";

// Public routes (no auth) — chatbot is public-facing
@Controller("chatbot")
export class ChatbotController {
  constructor(private readonly chatbot: ChatbotService) {}

  @Get("health")
  health() {
    return this.chatbot.health();
  }

  @Post("session")
  session() {
    return this.chatbot.createSession();
  }

  @Post()
  chat(@Body() body: { session_id: string; message: string }) {
    return this.chatbot.chat(body.session_id, body.message);
  }
}
```

**1b. Register in AppModule**

```typescript
// backend/src/app.module.ts
import { ChatbotModule } from './chatbot/chatbot.module';

@Module({
  imports: [
    // ...existing modules
    ChatbotModule,
  ],
})
```

**1c. Update frontend to call NestJS instead of its own API routes**

```typescript
// frontend/components/chatbot/ChatbotWidget.tsx
// BEFORE: fetch("/api/chatbot/health")
// AFTER:
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
fetch(`${API}/chatbot/health`)
fetch(`${API}/chatbot/session`, { method: 'POST' })
fetch(`${API}/chatbot`, { method: 'POST', body: ... })
```

**1d. Delete the Next.js proxy routes** (they're now redundant)

```
frontend/app/api/chatbot/route.ts         ← delete
frontend/app/api/chatbot/session/route.ts ← delete
frontend/app/api/chatbot/health/route.ts  ← delete
```

**1e. Remove CHATBOT_SERVICE_URL from frontend env**

This env var no longer belongs to the frontend — move it to the backend:

```env
# backend/.env
CHATBOT_SERVICE_URL=http://localhost:8002
```

```env
# frontend/.env — remove this line
# CHATBOT_SERVICE_URL=http://localhost:8002  ← delete
```

#### Step 1 Verification

- [x] `GET /api/chatbot/health` through NestJS returns `200`
- [x] Chatbot widget in browser still works end-to-end
- [x] Next.js no longer has any direct reference to `CHATBOT_SERVICE_URL`
- [x] `frontend/app/api/chatbot/` directory deleted

---

### Step 2 — Forward user context headers from NestJS to all Python services (~3 hours)

NestJS should tell every Python service who triggered the request. This requires no shared secrets
— it's just metadata. Python services use it for RBAC and audit logging.

**2a. Create a shared header builder utility**

> **Validation fix (Issue 1):** `req.user` after JWT validation has shape `{ id, email, role, district }`,
> NOT `{ sub, ... }`. The utility uses `user.id`, not `user.sub`.

```typescript
// backend/src/common/service-headers.util.ts
import { v4 as uuidv4 } from "uuid";

// Matches the shape returned by JwtStrategy.validate(), NOT the raw JwtPayload interface
interface ValidatedUser {
  id: string;
  email: string;
  role: string;
  district?: string;
}

export function buildServiceHeaders(
  user?: ValidatedUser,
): Record<string, string> {
  const headers: Record<string, string> = {
    "x-request-id": uuidv4(),
    "content-type": "application/json",
  };
  if (user) {
    headers["x-user-id"] = user.id; // ← id, not sub
    headers["x-user-role"] = user.role;
    headers["x-user-district"] = user.district ?? "";
  }
  return headers;
}
```

Install uuid: `npm install uuid @types/uuid` in the backend.

**2b. Add `@CurrentUser()` decorator and `@Roles()` guards to analytics controller**

> **Validation fix (Issue 2):** `analytics.controller.ts` has `@UseGuards(JwtAuthGuard)` at
> the class level but no `@Roles()` on any endpoint. Any authenticated user can call explain
> endpoints. Add `@Roles('admin')` to every endpoint that proxies to explain-analytics.

First, add the `@CurrentUser()` decorator (it doesn't exist yet — only `roles.decorator.ts` exists):

```typescript
// backend/src/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentUser = createParamDecorator(
  (_, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);
```

Then update the analytics controller for all explain-analytics-calling endpoints:

```typescript
// backend/src/analytics/analytics.controller.ts  — relevant endpoints only
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";

// Add RolesGuard at the class level alongside JwtAuthGuard
@Controller("analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  // Explain endpoints — admin only
  @Get("explain/:district")
  @Roles("admin")
  async explainInsight(
    @Param("district") district: string,
    @CurrentUser() user: ValidatedUser,
  ) {
    return this.analyticsService.getExplainableInsight(district, user);
  }

  @Get("explain/:district/ask")
  @Roles("admin")
  async askFollowUp(
    @Param("district") district: string,
    @Query("question") question: string,
    @CurrentUser() user: ValidatedUser,
  ) {
    return this.analyticsService.askFollowUpQuestion(district, question, user);
  }

  @Post("explain/:district/chat")
  @Roles("admin")
  async chatWithAgent(
    @Param("district") district: string,
    @Body() body: { message: string; sessionId?: string },
    @CurrentUser() user: ValidatedUser,
  ) {
    return this.analyticsService.chatWithAgent(
      district,
      body.message,
      body.sessionId,
      user,
    );
  }

  @Get("national-summary")
  @Roles("admin")
  async nationalSummary(
    @Query("week") week?: string,
    @CurrentUser() user?: ValidatedUser,
  ) {
    return this.analyticsService.getNationalSummary(week, user);
  }

  @Post("batch-explain")
  @Roles("admin")
  async batchExplain(
    @Body() body: { requests: any[] },
    @CurrentUser() user: ValidatedUser,
  ) {
    return this.analyticsService.batchExplain(body.requests ?? [], user);
  }

  // RAG management — admin only (these trigger ETL/seed operations)
  @Post("rag/ingest")
  @Roles("admin")
  async ragIngest(
    @Body() body: { documents: any[] },
    @CurrentUser() user: ValidatedUser,
  ) {
    return this.analyticsService.ingestRagDocuments(body.documents ?? [], user);
  }

  @Post("rag/etl/run")
  @Roles("admin")
  async etlRun(@CurrentUser() user: ValidatedUser) {
    return this.analyticsService.triggerEtlRun(user);
  }

  // All other endpoints (latest, timeseries, summary, etc.) stay as-is — no @Roles needed
}
```

**2c. Update analytics service method signatures and add headers to every outbound call**

> **Scope note:** `analytics.service.ts` calls explain-analytics in 10+ separate methods,
> each with its own inline `const explainUrl = process.env.EXPLAIN_ANALYTICS_URL || ...`.
> Every one of these must receive a `user` parameter and pass `buildServiceHeaders(user)`.
> The extract below shows the pattern — apply it to all methods.

```typescript
// backend/src/analytics/analytics.service.ts
import { buildServiceHeaders } from '../common/service-headers.util';

// Add user parameter to every method that calls explain-analytics
async getExplainableInsight(districtName: string, user: ValidatedUser) {
  // ...existing payload build code stays unchanged...
  const explainUrl = process.env.EXPLAIN_ANALYTICS_URL || 'http://localhost:8010';
  const resp = await axios.post(
    `${explainUrl}/v1/insights/explain`,
    payload,
    { headers: buildServiceHeaders(user) },   // ← add this
  );
  return resp.data;
}

// Methods that don't involve a user action (bulk predict, cache warming)
// still send x-request-id for tracing — pass no user
async predictBulkFromML() {
  const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
  const resp = await axios.post(
    `${mlUrl}/predict/bulk`,
    { districts: features },
    { headers: buildServiceHeaders() },       // ← no user, still gets x-request-id
  );
  return resp.data;
}
```

For `route.service.ts`, the route optimizer call uses `fetch()` — headers work the same way:

```typescript
// backend/src/tasks/route.service.ts
import { buildServiceHeaders } from '../common/service-headers.util';

private async fetchOptimizedOrder(durationMatrix: number[][]): Promise<number[]> {
  const response = await fetch(`${this.optimizerUrl}/optimize`, {
    method: 'POST',
    headers: buildServiceHeaders(),           // ← add this, replaces manual Content-Type
    body: JSON.stringify({ duration_matrix: durationMatrix }),
    signal: AbortSignal.timeout(5000),
  });
  // ...rest unchanged
}
```

#### Step 2 Verification

- [x] Supervisor calling `GET /api/analytics/explain/Colombo` → `403 Forbidden` from NestJS `RolesGuard`
- [x] Admin calling the same endpoint → `200 OK`
- [x] Python service logs show `x-request-id` on every inbound request
- [x] `x-user-role: admin` is present in explain-analytics server logs for admin-originated calls

---

### Step 3 — Add role checks in Python services (~2 hours)

Python services now receive `x-user-role` from NestJS. They can enforce their own RBAC
without any shared secret. The header is trusted because in production, only NestJS can reach them.

**3a. Create a shared auth helper**

Create this file once and copy it into each Python service that needs RBAC:

```python
# shared/context.py  (copy to each service that needs it)
from fastapi import Header, HTTPException
from typing import Optional

async def require_admin(x_user_role: Optional[str] = Header(default=None)):
    """Enforces admin role. Safe because only NestJS (post-JWT-validation) can reach us."""
    if x_user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")

async def require_supervisor_or_admin(x_user_role: Optional[str] = Header(default=None)):
    if x_user_role not in ("admin", "supervisor"):
        raise HTTPException(status_code=403, detail="Insufficient role")

async def get_request_context(
    x_user_id: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
    x_user_district: Optional[str] = Header(default=None),
    x_request_id: Optional[str] = Header(default=None),
):
    """Extracts forwarded user context for use in route handlers."""
    return {
        "user_id": x_user_id,
        "role": x_user_role,
        "district": x_user_district,
        "request_id": x_request_id,
    }
```

**3b. Apply to explain-analytics insight endpoints**

```python
# explain-analytics/src/explain_analytics/main.py
from shared.context import require_admin, get_request_context

@router.post("/v1/insights/explain", dependencies=[Depends(require_admin)])
async def explain_insights(
    payload: InsightRequest,
    ctx: dict = Depends(get_request_context),
):
    logger.info(f"Insight request by user={ctx['user_id']} request={ctx['request_id']}")
    ...

@router.post("/v1/insights/chat", dependencies=[Depends(require_admin)])
async def insights_chat(...): ...
```

**3c. No changes needed for ML service or route optimizer**

These services don't need RBAC — NestJS already gates access to their endpoints with
`@Roles()` guards before the call ever reaches them. They can log `x-request-id` for tracing
but don't need to enforce anything.

#### Step 3 Verification

- [x] Direct `curl` to explain-analytics insight endpoint with `x-user-role: supervisor` → `403`
- [x] Direct `curl` with `x-user-role: admin` → `200` (only works because port is open in local dev)
- [x] Admin user calling through NestJS → `200`
- [x] Supervisor user calling through NestJS → NestJS `@Roles('admin')` guard blocks at `:3001`

---

### Step 4 — Move JWT to httpOnly cookie (~2 hours)

**Current:** JWT stored in `localStorage` → vulnerable to XSS.

**4a. NestJS: set and clear cookie**

```typescript
// backend/src/auth/auth.controller.ts
import { Response } from 'express';

@Post('login')
async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
  const result = await this.authService.login(dto);
  res.cookie('access_token', result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });
  return { user: result.user };  // do not return the token
}

@Post('logout')
logout(@Res({ passthrough: true }) res: Response) {
  res.clearCookie('access_token', { path: '/' });
  return { message: 'Logged out' };
}
```

**4b. NestJS: read JWT from cookie**

```typescript
// backend/src/auth/strategies/jwt.strategy.ts
import { ExtractJwt, Strategy } from "passport-jwt";
import { Request } from "express";

super({
  jwtFromRequest: ExtractJwt.fromExtractors([
    (req: Request) => req?.cookies?.access_token ?? null,
  ]),
  ignoreExpiration: false,
  secretOrKey: process.env.JWT_SECRET, // Step 6 hardens this further
  passReqToCallback: false,
});
```

Enable cookie parsing in `main.ts` — `credentials: true` is already set, only `cookieParser` is new:

```typescript
// backend/src/main.ts  — add before app.listen()
import * as cookieParser from "cookie-parser";
app.use(cookieParser());
```

Install: `npm install cookie-parser @types/cookie-parser`

**4c. Frontend — two clients to update (Issue 3 fix)**

There are two separate API clients that both inject bearer tokens. Update both.

**Client 1 — [frontend/lib/api.ts](frontend/lib/api.ts) (axios):**

```typescript
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api",
  withCredentials: true, // browser sends httpOnly cookie automatically
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// Remove the entire request interceptor that reads localStorage and injects Authorization header.
// Keep the response interceptor for 401 handling — it still calls clearAuthStorage()
// and dispatchLogoutEvent(), which clears the user object from localStorage (not the token).
```

**Client 2 — [frontend/services/api/index.ts](frontend/services/api/index.ts) (raw fetch):**

```typescript
// fetchApi() — remove ALL localStorage token reads and Authorization header injection:
// REMOVE: const token = localStorage.getItem(ACCESS_TOKEN_KEY);
// REMOVE: if (token && isTokenExpired(token)) { ... }
// REMOVE: Authorization: `Bearer ${token}`

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: 'include',   // send the httpOnly cookie
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  // rest unchanged
}

// authService.login() — stop storing the token; only store the user object:
async login(email: string, password: string) {
  const response = await fetchApi<{ user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (response.success && response.data) {
    // The token is now in the httpOnly cookie set by NestJS
    // Only store the user object for display purposes
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.data.user));
  }
  return response;
}

// authService.logout() — call server logout to clear cookie, then clear local state:
async logout() {
  await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
  clearAuthStorage();  // clears user object from localStorage
}

// uploadEvidence and downloadReportPdf — replace localStorage.getItem("auth_token") with credentials:
// REMOVE: const token = localStorage.getItem("auth_token");
// REMOVE: Authorization header
// ADD: credentials: 'include' to the fetch options
```

**4d. Remove `tokenUtils.ts` expiry check from interceptors**

The client-side token expiry check in `api.ts` and `index.ts` (`isTokenExpired()`) can no
longer read the httpOnly cookie. Remove it — let the server's `401` response handle expiry
instead. The response interceptor's `401` handler already does this correctly.

#### Step 4 Verification

- [x] After login, `access_token` appears in browser DevTools → Application → Cookies with `HttpOnly` flag
- [x] `document.cookie` does NOT expose `access_token`
- [x] Authenticated API calls in both axios and raw-fetch paths succeed without Authorization header
- [x] On logout, the cookie is cleared server-side and subsequent calls return `401`
- [x] `uploadEvidence` and `downloadReportPdf` still work (now use `credentials: 'include'`)

---

### Step 5 — Remove exposed Python ports in Docker (~30 min)

This is the production enforcement step. In Docker, removing `ports:` makes Python services
completely unreachable from outside the internal network — no auth code needed.

```yaml
# docker-compose.yml — remove port mappings from all Python services

ml-model:
  # ports:            ← remove entirely
  #  - "8000:8000"

route-optimizer:
  # ports:            ← remove entirely
  #  - "8001:8001"

explain-analytics:
  # ports:            ← remove entirely
  #  - "8010:8010"

chatbot-service:
  # ports:            ← remove entirely
  #  - "8002:8000"
```

Keep ports on `backend` (:3001) and `frontend` (:3000) — those need to be reachable.

For local dev using npm scripts, the Python services still run on open ports — that's acceptable
since local dev is developer-only. The enforcement is at the Docker level for demo/production.

#### Step 5 Verification

- [ ] `curl http://localhost:8000/predict` fails to connect after Docker rebuild
- [ ] All functionality still works through the NestJS backend and frontend

---

### Step 6 — Remove hardcoded secret fallbacks and cleanup (~1 hour)

**6a. Change `JwtModule.register()` to `JwtModule.registerAsync()` (Issue 4 fix)**

`JwtModule.register()` evaluates at module load time before env vars may be available via
`ConfigService`. Switch to `registerAsync()` to inject `ConfigService` properly:

```typescript
// backend/src/auth/auth.module.ts
import { ConfigModule, ConfigService } from '@nestjs/config';

JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.getOrThrow<string>('JWT_SECRET'),  // throws at startup if missing
    signOptions: { expiresIn: '24h' },
  }),
}),
```

Also update `jwt.strategy.ts` to inject `ConfigService`:

```typescript
// backend/src/auth/strategies/jwt.strategy.ts
import { ConfigService } from '@nestjs/config';

constructor(private authService: AuthService, private config: ConfigService) {
  super({
    jwtFromRequest: ExtractJwt.fromExtractors([
      (req: Request) => req?.cookies?.access_token ?? null,
    ]),
    ignoreExpiration: false,
    secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
  });
}
```

**6b. Remove the `x-internal-api-key` bypass from `JwtAuthGuard` (Issue 5 fix)**

Since service keys are no longer part of the design, remove the bypass entirely:

```typescript
// backend/src/auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  canActivate(context: ExecutionContext) {
    // Removed: x-internal-api-key bypass — no longer needed
    return super.canActivate(context);
  }
}
```

**6c. Add startup validation in `main.ts`**

```typescript
// backend/src/main.ts  — add before NestFactory.create()
const required = [
  "JWT_SECRET",
  "CHATBOT_SERVICE_URL",
  "ML_SERVICE_URL",
  "ROUTE_OPTIMIZER_URL",
  "EXPLAIN_ANALYTICS_URL",
];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}
```

**6d. Remove hardcoded `JWT_SECRET` from `docker-compose.yml`**

```yaml
# docker-compose.yml — backend service environment block
backend:
  environment:
    NODE_ENV: production
    PORT: 3001
    # JWT_SECRET: epilink-dev-jwt-secret   ← REMOVE this line
    # Let it come from env_file: ./backend/.env only
```

```env
# backend/.env — replace the dev value with a proper random secret
JWT_SECRET=<generate with: openssl rand -hex 32>
```

**6e. Remove `INTERNAL_SERVICE_KEY` from `docker-compose.yml`**

This env var powered the old bypass that is now removed:

```yaml
# docker-compose.yml — backend environment block
# INTERNAL_SERVICE_KEY: epilink-internal-svc-9f3a2c8b4e1d7f6a  ← remove
```

#### Step 6 Verification

- [ ] Starting NestJS without `JWT_SECRET` set → process exits at startup with a clear error
- [ ] `JWT_SECRET` does not appear as a literal value in `docker-compose.yml`
- [ ] `curl -H "x-internal-api-key: anything" /api/analytics/districts/latest` → `401` (bypass removed)
- [ ] Normal authenticated request with valid cookie → still works

---

## Summary

| Step  | What changes                                                                                | Key files touched                                                                                                                                            | Effort     |
| ----- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| **1** | Move chatbot proxy: Next.js → NestJS                                                        | New `backend/src/chatbot/`, delete `frontend/app/api/chatbot/`, update `ChatbotWidget.tsx`                                                                   | ~2 hours   |
| **2** | `@Roles('admin')` on explain endpoints; `buildServiceHeaders` forwarded to all Python calls | `analytics.controller.ts`, `analytics.service.ts`, `route.service.ts`, new `common/service-headers.util.ts`, new `auth/decorators/current-user.decorator.ts` | ~4 hours   |
| **3** | Role checks in Python services on forwarded headers                                         | New `shared/context.py`, `explain-analytics/main.py`                                                                                                         | ~2 hours   |
| **4** | Move JWT to httpOnly cookie; update both frontend API clients                               | `auth.controller.ts`, `jwt.strategy.ts`, `main.ts`, `frontend/lib/api.ts`, `frontend/services/api/index.ts`                                                  | ~2.5 hours |
| **5** | Remove Python port mappings from docker-compose                                             | `docker-compose.yml`                                                                                                                                         | ~30 min    |
| **6** | `JwtModule.registerAsync()`, remove `x-internal-api-key` bypass, startup validation         | `auth.module.ts`, `jwt.strategy.ts`, `jwt-auth.guard.ts`, `main.ts`, `docker-compose.yml`, `backend/.env`                                                    | ~1.5 hours |

**Total: ~1.5 days.** Steps 1 and 4 are fully independent. Steps 2 and 3 are paired (3 needs 2 first).
Step 5 is Docker-only, do last. Step 6 is independent of all others.

---

## Security Model by Environment

| Threat                                                | Local dev                               | Production (Docker)                             |
| ----------------------------------------------------- | --------------------------------------- | ----------------------------------------------- |
| Browser calling Python services directly              | Python ports open — trust by convention | Python ports removed — blocked at network level |
| Forged `x-user-role` header to Python services        | Possible (port open)                    | Impossible (only NestJS can reach Python)       |
| JWT stolen via XSS                                    | Mitigated by Step 4 (httpOnly cookie)   | Mitigated by Step 4                             |
| Unauthenticated call to NestJS                        | Blocked by `JwtAuthGuard`               | Blocked by `JwtAuthGuard`                       |
| Supervisor accessing admin explain-analytics endpoint | Blocked at NestJS `@Roles('admin')`     | Blocked at NestJS + Python `require_admin`      |
| Hardcoded secret used accidentally                    | Blocked at startup by Step 6            | Blocked at startup by Step 6                    |

---

## What Was Considered and Why Not Chosen

| Option                                   | Why not chosen for this system                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-service keys (Option A)              | Adds secret management overhead with no real benefit once Docker network isolation is in place                                              |
| Traefik / third-party gateway (Option B) | Docker-only — doesn't work with npm script local dev; adds operational overhead for a problem already solved by the existing NestJS backend |
| Separate NestJS or Express gateway app   | Creates two NestJS apps to maintain; the existing backend IS already the gateway conceptually                                               |
