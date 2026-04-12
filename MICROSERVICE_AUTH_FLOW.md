# Microservice Authentication — Implementation Plan

## Architecture Overview

```
Browser
  │  httpOnly cookie: access_token (JWT)
  ▼
NestJS Backend (:3001)          ← sole JWT validator + RBAC enforcer
  │
  │  Headers on every outbound call:
  │    x-internal-service-key: <per-service secret>
  │    x-user-id: <id>
  │    x-user-role: admin | supervisor | viewer
  │    x-user-district: <district>
  │    x-request-id: <trace UUID>
  │
  ├──→ ML Service (:8000)           validates x-internal-service-key
  ├──→ Route Optimizer (:8001)      validates x-internal-service-key
  ├──→ Explain Analytics (:8010)    validates x-internal-service-key + x-user-role
  └──→ Chatbot (:8004)              validates x-internal-service-key
```

**Core principle:** The NestJS backend is the only service that validates user JWTs. Every service
behind it communicates via internal service keys. User claims are forwarded as plain headers
(not as JWT) so Python services can enforce their own RBAC without needing the JWT secret.

---

## Current State Audit

| Boundary | Auth | Gap |
|---|---|---|
| Browser → NestJS | JWT in `localStorage` | XSS can steal token |
| NestJS → ML Service | None | Fully open |
| NestJS → Route Optimizer | None | Fully open |
| NestJS → Explain Analytics | `x-internal-api-key` (RAG/ETL only) | Insight endpoints unprotected |
| NestJS → Chatbot | None | Fully open |
| Python services CORS | `allow_origins=["*"]` | Unnecessary browser surface |
| JWT secret | Hardcoded fallback | Predictable in dev/staging |

---

## Phase 1 — Close Open Service Endpoints (P0, ~1 day)

**Goal:** Ensure no Python microservice accepts unauthenticated requests.  
**Scope:** ML Service, Route Optimizer, Chatbot. No frontend changes.

### 1.1 — Add per-service keys to environment config

Add the following to your `.env` and `docker-compose.yml`:

```env
# .env
ML_SERVICE_KEY=ml-svc-<generate-32-char-random>
ROUTE_OPTIMIZER_KEY=route-svc-<generate-32-char-random>
EXPLAIN_ANALYTICS_KEY=explain-svc-<generate-32-char-random>
CHATBOT_KEY=chatbot-svc-<generate-32-char-random>
```

```yaml
# docker-compose.yml additions
ml-model:
  environment:
    SERVICE_KEY: ${ML_SERVICE_KEY}

route-optimizer:
  environment:
    SERVICE_KEY: ${ROUTE_OPTIMIZER_KEY}

explain-analytics:
  environment:
    SERVICE_KEY: ${EXPLAIN_ANALYTICS_KEY}   # replaces EXPLAIN_BACKEND_SERVICE_KEY

chatbot-service:
  environment:
    SERVICE_KEY: ${CHATBOT_KEY}
```

### 1.2 — Create shared auth dependency for Python services

Create this file in each Python microservice (or a shared internal package):

```python
# shared/auth.py  (copy into ml-model/, route-optimizer/, chatbot-service/, explain-analytics/src/)
import os
import hmac
from fastapi import Header, HTTPException

_SERVICE_KEY = os.getenv("SERVICE_KEY", "")

async def require_internal_key(x_internal_service_key: str = Header(...)):
    """Validates that the caller is the authorised NestJS backend."""
    if not _SERVICE_KEY:
        raise RuntimeError("SERVICE_KEY env var is not set — refusing to start unprotected.")
    if not hmac.compare_digest(_SERVICE_KEY, x_internal_service_key):
        raise HTTPException(status_code=403, detail="Forbidden")
```

> Using `hmac.compare_digest` prevents timing-based attacks compared to `==`.

### 1.3 — Apply the dependency globally in each FastAPI app

```python
# ml-model/app.py
from shared.auth import require_internal_key
from fastapi import FastAPI, Depends

app = FastAPI(dependencies=[Depends(require_internal_key)])
```

```python
# route-optimizer/app.py  — same pattern
app = FastAPI(dependencies=[Depends(require_internal_key)])
```

```python
# chatbot-service/main.py  — same pattern
# Remove the existing optional X-Admin-Key approach for admin endpoints;
# replace with the service key + x-user-role pattern (Phase 3).
app = FastAPI(dependencies=[Depends(require_internal_key)])
```

```python
# explain-analytics/src/explain_analytics/main.py
# Apply globally — this replaces the per-endpoint x-internal-api-key checks.
app = FastAPI(dependencies=[Depends(require_internal_key)])
```

### 1.4 — Update NestJS to send the correct key per service

Update `backend/src/analytics/analytics.service.ts` and any other service callers:

```typescript
// backend/src/analytics/analytics.service.ts
private mlHeaders(): Record<string, string> {
  return { 'x-internal-service-key': process.env.ML_SERVICE_KEY };
}

private explainHeaders(): Record<string, string> {
  return { 'x-internal-service-key': process.env.EXPLAIN_ANALYTICS_KEY };
}
```

```typescript
// backend/src/tasks/route.service.ts
private routeHeaders(): Record<string, string> {
  return { 'x-internal-service-key': process.env.ROUTE_OPTIMIZER_KEY };
}
```

Pass these headers into every `axios.post` / `fetch` call replacing the previous ad-hoc header logic.

### 1.5 — Health check exemption

Health check endpoints should be reachable by Docker without a service key (for orchestration liveness probes):

```python
# Place the health route BEFORE the global dependency is applied, or exclude it:
app = FastAPI()

@app.get("/health")  # no auth — registered first
async def health(): return {"status": "ok"}

# Then add the auth dependency to the main router
api_router = APIRouter(dependencies=[Depends(require_internal_key)])
app.include_router(api_router)
```

### Phase 1 Verification Checklist

- [ ] `curl http://localhost:8000/predict` → `403 Forbidden`
- [ ] `curl http://localhost:8001/optimize` → `403 Forbidden`
- [ ] `curl http://localhost:8010/v1/insights/explain` → `403 Forbidden`
- [ ] `curl http://localhost:8000/health` → `200 OK` (no key needed)
- [ ] NestJS analytics endpoint still works end-to-end with a valid user JWT

---

## Phase 2 — Move JWT to httpOnly Cookie (P1, ~0.5 day)

**Goal:** Eliminate XSS-based JWT theft from `localStorage`.  
**Scope:** NestJS auth endpoints + Next.js frontend API client.

### 2.1 — NestJS: set cookie on login, clear on logout

```typescript
// backend/src/auth/auth.controller.ts
import { Response } from 'express';

@Post('login')
async login(
  @Body() dto: LoginDto,
  @Res({ passthrough: true }) res: Response,
) {
  const result = await this.authService.login(dto);
  res.cookie('access_token', result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24h in ms
    path: '/',
  });
  // Return user info but NOT the token
  return { user: result.user };
}

@Post('logout')
logout(@Res({ passthrough: true }) res: Response) {
  res.clearCookie('access_token', { path: '/' });
  return { message: 'Logged out' };
}
```

### 2.2 — NestJS: extract JWT from cookie instead of Authorization header

```typescript
// backend/src/auth/strategies/jwt.strategy.ts
import { ExtractJwt } from 'passport-jwt';
import { Request } from 'express';

JwtFromRequest: ExtractJwt.fromExtractors([
  (req: Request) => req?.cookies?.access_token ?? null,
]),
```

Enable cookie parsing in `backend/src/main.ts`:

```typescript
import * as cookieParser from 'cookie-parser';
app.use(cookieParser());
```

Install the package: `npm install cookie-parser @types/cookie-parser`

### 2.3 — NestJS: enable credentials CORS

```typescript
// backend/src/main.ts
app.enableCors({
  origin: process.env.NEXT_FRONTEND_URL,
  credentials: true,   // required for cookies
});
```

### 2.4 — Frontend: remove token from localStorage, enable credentials

```typescript
// frontend/lib/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  withCredentials: true,  // send the httpOnly cookie automatically
});

// Remove the request interceptor that injects Authorization header
// Remove all localStorage.getItem('accessToken') reads
// The 401 response interceptor stays — redirect to login on session expiry
```

Remove all `localStorage.setItem` / `localStorage.getItem` calls for the token across the frontend.

### Phase 2 Verification Checklist

- [ ] After login, browser DevTools → Application → Cookies shows `access_token` with `HttpOnly` flag
- [ ] `access_token` does NOT appear in localStorage
- [ ] Authenticated API calls succeed (cookie is sent automatically)
- [ ] On logout, the cookie is cleared and subsequent calls return `401`
- [ ] XSS test: `document.cookie` does not reveal `access_token`

---

## Phase 3 — Forward User Claims to Microservices (P1, ~1 day)

**Goal:** Enable Python microservices to enforce their own RBAC (e.g., explain-analytics only
accepts admin calls for insight queries) without needing the JWT secret.  
**Scope:** NestJS service callers + Python service route guards.

### 3.1 — NestJS: build a shared outbound header builder

```typescript
// backend/src/common/service-headers.util.ts
import { v4 as uuidv4 } from 'uuid';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

export function buildServiceHeaders(
  serviceKey: string,
  user?: JwtPayload,
): Record<string, string> {
  const headers: Record<string, string> = {
    'x-internal-service-key': serviceKey,
    'x-request-id': uuidv4(),
  };
  if (user) {
    headers['x-user-id'] = user.sub;
    headers['x-user-role'] = user.role;
    headers['x-user-district'] = user.district ?? '';
  }
  return headers;
}
```

Install uuid if not present: `npm install uuid @types/uuid`

### 3.2 — Pass user context through NestJS service methods

Controller calls must pass the authenticated user down into service methods:

```typescript
// backend/src/analytics/analytics.controller.ts
@Get('explain')
@UseGuards(JwtAuthGuard)
@Roles('admin')
async getExplainInsights(@CurrentUser() user: JwtPayload) {
  return this.analyticsService.getInsights(user);
}
```

```typescript
// backend/src/analytics/analytics.service.ts
import { buildServiceHeaders } from '../common/service-headers.util';

async getInsights(user: JwtPayload) {
  const headers = buildServiceHeaders(process.env.EXPLAIN_ANALYTICS_KEY, user);
  const response = await axios.post(
    `${this.explainUrl}/v1/insights/explain`,
    payload,
    { headers },
  );
  return response.data;
}
```

### 3.3 — Python services: add role guard dependency

```python
# shared/auth.py — extend the existing file
from fastapi import Header, HTTPException, Depends

async def require_admin_role(x_user_role: str = Header(...)):
    if x_user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")

async def require_supervisor_or_admin(x_user_role: str = Header(...)):
    if x_user_role not in ("admin", "supervisor"):
        raise HTTPException(status_code=403, detail="Insufficient role")
```

Apply on explain-analytics insight routes:

```python
# explain-analytics — protect insight + chat endpoints
@router.post(
  "/v1/insights/explain",
  dependencies=[Depends(require_internal_key), Depends(require_admin_role)],
)
async def explain_insights(...): ...

@router.post(
  "/v1/insights/chat",
  dependencies=[Depends(require_internal_key), Depends(require_admin_role)],
)
async def insights_chat(...): ...
```

### 3.4 — Add `@CurrentUser()` decorator to NestJS if not present

```typescript
// backend/src/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);
```

### Phase 3 Verification Checklist

- [ ] Admin user calling explain-analytics insight endpoint → `200 OK`
- [ ] Supervisor user calling explain-analytics insight endpoint → `403 Forbidden`
- [ ] All Python service logs show `x-request-id` header for distributed tracing
- [ ] Removing `x-user-role` from a direct curl call → `422 Unprocessable Entity`

---

## Phase 4 — Lock Down CORS on Python Services (P2, ~0.5 day)

**Goal:** Python services should only accept calls from the NestJS backend container,
not from browsers or other network actors.  
**Scope:** All four Python microservices.

### 4.1 — Restrict origins to the backend hostname

```python
# Each Python service main.py — replace allow_origins=["*"]
import os
from fastapi.middleware.cors import CORSMiddleware

ALLOWED_ORIGINS = [
    os.getenv("ALLOWED_ORIGIN", "http://backend:3001"),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,      # no cookies cross-service
    allow_methods=["GET", "POST"],
    allow_headers=["x-internal-service-key", "x-user-id", "x-user-role",
                   "x-user-district", "x-request-id", "content-type"],
)
```

Add to each service's `docker-compose.yml`:

```yaml
ml-model:
  environment:
    ALLOWED_ORIGIN: http://backend:3001
```

### Phase 4 Verification Checklist

- [ ] Direct browser `fetch('http://localhost:8000/predict')` → CORS blocked
- [ ] NestJS → ML Service call still works (server-to-server, no CORS check)

---

## Phase 5 — Harden Secrets and Add Request Signing (P2/P3, ~1 day)

**Goal:** Eliminate hardcoded fallback secrets; add HMAC signing for destructive operations.  
**Scope:** NestJS + explain-analytics ETL/RAG management endpoints.

### 5.1 — Remove hardcoded secret fallbacks

```typescript
// backend/src/auth/strategies/jwt.strategy.ts
// BEFORE:
secretOrKey: configService.get('JWT_SECRET') || 'epilink-super-secret-key-change-in-production',

// AFTER:
secretOrKey: configService.getOrThrow('JWT_SECRET'),  // throws at startup if missing
```

Do the same for `INTERNAL_SERVICE_KEY` and all new `*_SERVICE_KEY` values. Add startup validation:

```typescript
// backend/src/main.ts
const requiredEnvVars = [
  'JWT_SECRET', 'ML_SERVICE_KEY', 'EXPLAIN_ANALYTICS_KEY',
  'ROUTE_OPTIMIZER_KEY', 'CHATBOT_KEY',
];
for (const key of requiredEnvVars) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}
```

### 5.2 — HMAC signing for destructive ETL/RAG operations (optional hardening)

For `POST /v1/rag/seed` and `POST /v1/rag/etl/run`, add request body signing:

```typescript
// backend/src/common/service-headers.util.ts
import { createHmac } from 'crypto';

export function signRequestBody(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

// Usage in analytics.service.ts
const body = JSON.stringify(payload);
const headers = {
  ...buildServiceHeaders(process.env.EXPLAIN_ANALYTICS_KEY, user),
  'x-signature': signRequestBody(body, process.env.EXPLAIN_ANALYTICS_KEY),
};
await axios.post(`${this.explainUrl}/v1/rag/etl/run`, body, { headers });
```

```python
# explain-analytics/src/explain_analytics/main.py
import hmac, hashlib
from fastapi import Request, HTTPException

async def verify_signature(request: Request, x_signature: str = Header(...)):
    body = await request.body()
    expected = hmac.new(
        _SERVICE_KEY.encode(), body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, x_signature):
        raise HTTPException(status_code=403, detail="Invalid request signature")

@router.post("/v1/rag/etl/run", dependencies=[
    Depends(require_internal_key),
    Depends(require_admin_role),
    Depends(verify_signature),
])
async def run_etl(...): ...
```

### 5.3 — Add JWT token rotation (refresh tokens)

The current 24-hour JWT is long-lived. Add a short-lived access token + long-lived refresh token:

```typescript
// backend/src/auth/auth.service.ts
generateTokens(payload: JwtPayload) {
  return {
    accessToken: this.jwtService.sign(payload, { expiresIn: '15m' }),
    refreshToken: this.jwtService.sign(
      { sub: payload.sub },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '7d' },
    ),
  };
}
```

- Set `access_token` cookie with `maxAge: 15 * 60 * 1000`
- Set `refresh_token` cookie with `maxAge: 7 * 24 * 60 * 60 * 1000` and `path: /api/auth/refresh`
- Add `POST /api/auth/refresh` endpoint that validates the refresh token and issues a new access token

### Phase 5 Verification Checklist

- [ ] Starting NestJS without `JWT_SECRET` throws at boot, not at runtime
- [ ] Starting any Python service without `SERVICE_KEY` throws at boot
- [ ] ETL endpoint rejects requests with a tampered body
- [ ] Access token expires after 15 min; refresh endpoint issues a new one

---

## Summary Table

| Phase | What | Files Changed | Effort |
|---|---|---|---|
| **1** | Service key auth on all Python services | All `app.py` / `main.py`, NestJS service files, `.env`, `docker-compose.yml` | ~1 day |
| **2** | Move JWT to httpOnly cookie | `auth.controller.ts`, `jwt.strategy.ts`, `main.ts`, `frontend/lib/api.ts` | ~0.5 day |
| **3** | Forward user claims, Python RBAC | `analytics.service.ts`, `route.service.ts`, Python `shared/auth.py` | ~1 day |
| **4** | Lock CORS on Python services | All Python `main.py`, `docker-compose.yml` | ~0.5 day |
| **5** | Remove hardcoded secrets, HMAC signing, refresh tokens | `jwt.strategy.ts`, `main.ts`, `auth.service.ts`, explain-analytics `main.py` | ~1 day |

**Total estimated effort: ~4 days**

Phases 1 and 2 are independent and can be done in parallel by two developers.
Phases 3 and 4 depend on Phase 1 being complete.
Phase 5 can be done any time after Phase 1.
