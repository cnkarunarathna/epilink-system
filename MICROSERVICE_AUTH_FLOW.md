# Microservice Authentication — Implementation Plan

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

| Option | What | No service keys? | No 3rd-party tools? | Local dev friendly? |
|---|---|---|---|---|
| **A** | Per-service keys on Python services | No | Yes | Yes |
| **B** | Traefik as edge gateway | Yes (edge only) | No | No (Docker-only) |
| **C** | NestJS as the gateway (custom) | **Yes** | **Yes** | **Yes** |

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
import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';

@Module({
  controllers: [ChatbotController],
  providers: [ChatbotService],
})
export class ChatbotModule {}
```

```typescript
// backend/src/chatbot/chatbot.service.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ChatbotService {
  private readonly url = process.env.CHATBOT_SERVICE_URL || 'http://localhost:8002';

  async createSession() {
    const res = await axios.post(`${this.url}/session`);
    return res.data;
  }

  async chat(sessionId: string, message: string) {
    const res = await axios.post(`${this.url}/chat`, { session_id: sessionId, message });
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
import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatbotService } from './chatbot.service';

// Public routes (no auth) — chatbot is public-facing
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbot: ChatbotService) {}

  @Get('health')
  health() { return this.chatbot.health(); }

  @Post('session')
  session() { return this.chatbot.createSession(); }

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

- [ ] `GET /api/chatbot/health` through NestJS returns `200`
- [ ] Chatbot widget in browser still works end-to-end
- [ ] Next.js no longer has any direct reference to `CHATBOT_SERVICE_URL`
- [ ] `frontend/app/api/chatbot/` directory deleted

---

### Step 2 — Forward user context headers from NestJS to all Python services (~3 hours)

NestJS should tell every Python service who triggered the request. This requires no shared secrets
— it's just metadata. Python services use it for RBAC and audit logging.

**2a. Create a shared header builder utility**

```typescript
// backend/src/common/service-headers.util.ts
import { v4 as uuidv4 } from 'uuid';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

export function buildServiceHeaders(user?: JwtPayload): Record<string, string> {
  const headers: Record<string, string> = {
    'x-request-id': uuidv4(),
    'content-type': 'application/json',
  };
  if (user) {
    headers['x-user-id']       = user.sub;
    headers['x-user-role']     = user.role;
    headers['x-user-district'] = user.district ?? '';
  }
  return headers;
}
```

Install uuid: `npm install uuid @types/uuid` in the backend.

**2b. Pass user through NestJS service method calls**

Controllers must pass `req.user` down to service methods. Add the `@CurrentUser()` decorator
if not already present:

```typescript
// backend/src/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);
```

Update analytics controller as an example:

```typescript
// backend/src/analytics/analytics.controller.ts
@Get('explain')
@UseGuards(JwtAuthGuard)
@Roles('admin')
async getExplainInsights(@CurrentUser() user: JwtPayload) {
  return this.analyticsService.getInsights(user);
}
```

**2c. Use the header builder in every outbound service call**

```typescript
// backend/src/analytics/analytics.service.ts
import { buildServiceHeaders } from '../common/service-headers.util';

async getInsights(user: JwtPayload) {
  const { data } = await axios.post(
    `${this.explainUrl}/v1/insights/explain`,
    payload,
    { headers: buildServiceHeaders(user) },
  );
  return data;
}

async predictBulk(features: unknown) {
  // ML service doesn't need user context for predictions — pass no user
  const { data } = await axios.post(
    `${this.mlUrl}/predict/bulk`,
    { districts: features },
    { headers: buildServiceHeaders() },  // still sends x-request-id for tracing
  );
  return data;
}
```

Apply the same pattern in `route.service.ts` and any other file that calls Python services.

#### Step 2 Verification

- [ ] Python service logs show `x-request-id` on every inbound request
- [ ] `x-user-role` is present on calls that originated from authenticated endpoints
- [ ] Unauthenticated calls (health checks, public endpoints) send only `x-request-id`

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

- [ ] Direct `curl` to explain-analytics insight endpoint with `x-user-role: supervisor` → `403`
- [ ] Direct `curl` with `x-user-role: admin` → `200` (only works because port is open in local dev)
- [ ] Admin user calling through NestJS → `200`
- [ ] Supervisor user calling through NestJS → NestJS `@Roles('admin')` guard blocks at `:3001`

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
import { ExtractJwt } from 'passport-jwt';
import { Request } from 'express';

JwtFromRequest: ExtractJwt.fromExtractors([
  (req: Request) => req?.cookies?.access_token ?? null,
]),
```

Enable cookie parsing:

```typescript
// backend/src/main.ts
import * as cookieParser from 'cookie-parser';
app.use(cookieParser());
app.enableCors({
  origin: process.env.NEXT_FRONTEND_URL,
  credentials: true,  // required for cross-origin cookie
});
```

Install: `npm install cookie-parser @types/cookie-parser`

**4c. Frontend: remove localStorage, enable credentials**

```typescript
// frontend/lib/api.ts
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  withCredentials: true,  // browser sends httpOnly cookie automatically
});

// Remove: the request interceptor that injects Authorization header
// Remove: all localStorage.getItem / localStorage.setItem for the token
```

#### Step 4 Verification

- [ ] After login, `access_token` appears in browser cookies with `HttpOnly` flag
- [ ] `document.cookie` does NOT expose `access_token`
- [ ] Authenticated API calls succeed without manually attaching a token
- [ ] On logout, the cookie is cleared and subsequent calls return `401`

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

### Step 6 — Remove hardcoded secret fallbacks (~1 hour)

```typescript
// backend/src/auth/strategies/jwt.strategy.ts
// BEFORE:
secretOrKey: configService.get('JWT_SECRET') || 'epilink-super-secret-key-change-in-production',

// AFTER (throws at startup if missing — fail fast):
secretOrKey: configService.getOrThrow('JWT_SECRET'),
```

Add startup validation:

```typescript
// backend/src/main.ts
const required = ['JWT_SECRET', 'CHATBOT_SERVICE_URL', 'ML_SERVICE_URL',
                  'ROUTE_OPTIMIZER_URL', 'EXPLAIN_ANALYTICS_URL'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}
```

Also remove the hardcoded `JWT_SECRET` from `docker-compose.yml` — it should only come from `.env`:

```yaml
# docker-compose.yml
backend:
  environment:
    # JWT_SECRET: epilink-dev-jwt-secret   ← remove this line, use env_file only
```

```env
# backend/.env
JWT_SECRET=<generate a proper random secret>
```

#### Step 6 Verification

- [ ] Starting NestJS without `JWT_SECRET` in env fails at boot with a clear error
- [ ] `JWT_SECRET` does not appear as a literal value in `docker-compose.yml`

---

## Summary

| Step | What changes | Files touched | Effort |
|---|---|---|---|
| **1** | Move chatbot proxy from Next.js to NestJS | New `backend/src/chatbot/`, delete `frontend/app/api/chatbot/`, update widget | ~2 hours |
| **2** | Forward user context headers to all Python services | `service-headers.util.ts`, `analytics.service.ts`, `route.service.ts` | ~3 hours |
| **3** | Role checks in Python services using forwarded headers | `shared/context.py`, `explain-analytics/main.py` | ~2 hours |
| **4** | Move JWT to httpOnly cookie | `auth.controller.ts`, `jwt.strategy.ts`, `main.ts`, `frontend/lib/api.ts` | ~2 hours |
| **5** | Remove Python port mappings from docker-compose | `docker-compose.yml` | ~30 min |
| **6** | Remove hardcoded secret fallbacks | `jwt.strategy.ts`, `main.ts`, `docker-compose.yml`, `.env` | ~1 hour |

**Total: ~1 day.** Steps 1–3 can be done in any order. Steps 4 and 6 are independent.
Step 5 is a Docker-only change, safe to do last.

---

## Security Model by Environment

| Threat | Local dev | Production (Docker) |
|---|---|---|
| Browser calling Python services directly | Python ports open — trust by convention | Python ports removed — blocked at network level |
| Forged `x-user-role` header to Python services | Possible (port open) | Impossible (only NestJS can reach Python) |
| JWT stolen via XSS | Mitigated by Step 4 (httpOnly cookie) | Mitigated by Step 4 |
| Unauthenticated call to NestJS | Blocked by `JwtAuthGuard` | Blocked by `JwtAuthGuard` |
| Supervisor accessing admin explain-analytics endpoint | Blocked at NestJS `@Roles('admin')` | Blocked at NestJS + Python `require_admin` |
| Hardcoded secret used accidentally | Blocked at startup by Step 6 | Blocked at startup by Step 6 |

---

## What Was Considered and Why Not Chosen

| Option | Why not chosen for this system |
|---|---|
| Per-service keys (Option A) | Adds secret management overhead with no real benefit once Docker network isolation is in place |
| Traefik / third-party gateway (Option B) | Docker-only — doesn't work with npm script local dev; adds operational overhead for a problem already solved by the existing NestJS backend |
| Separate NestJS or Express gateway app | Creates two NestJS apps to maintain; the existing backend IS already the gateway conceptually |
