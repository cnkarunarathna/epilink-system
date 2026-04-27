# AI Chat History Feature — Implementation Plan

> Goal: Add a ChatGPT/Gemini-style conversation history sidebar to the existing admin analytics AI chat, enabling admins to create, resume, rename, and delete named chat sessions.

---

## Architecture Overview (Existing System)

| Layer | Technology | Current Role |
|-------|-----------|--------------|
| Frontend | Next.js 16 + React 19 | `FloatingChatBubble.tsx` — single active session only |
| Backend API | NestJS 11 | Proxies to Python, routes: `POST /analytics/explain/:district/chat`, `GET /analytics/chat/:sessionId/history`, `DELETE /analytics/chat/:sessionId` |
| AI Service | FastAPI (Python) | Gemini 2.0 Flash multi-turn chat; Redis-backed session store (`epilink:chat:{uuid}`, 2-hour TTL, auto-compression at 20 messages) |
| Session Store | Redis | Volatile — messages lost after 2-hour TTL |
| DB | PostgreSQL | No analytics chat metadata persisted yet |

**The core gap**: Redis sessions are ephemeral (2-hour TTL). There is no user-level conversation list, no persistent titles, and no way to resume an old session from a fresh page load.

---

## What Already Exists (Reuse, Don't Rebuild)

- `chatWithAgent(district, message, sessionId?)` — frontend service fn
- `getChatHistory(sessionId)` — frontend service fn  
- `deleteChatSession(sessionId)` — frontend service fn
- `POST /analytics/explain/:district/chat` + `GET /analytics/chat/:sessionId/history` + `DELETE /analytics/chat/:sessionId` — NestJS routes
- `SessionService` in Python (`create_session`, `get_messages`, `append_messages`, `delete_session`)
- JWT user attribution (`sub`, `email`, `role`) passed as service headers to Python

---

## Phase 1 — Persist Conversation Metadata to PostgreSQL ✅ COMPLETE

**Goal**: Every chat session owned by an admin is durably recorded in the database (title, district, session_id, timestamps). Redis still holds message content; Postgres holds the index.

### 1.1 — Database Migration

Create a new TypeORM migration: `1778300000000-CreateAnalyticsChatSessions.ts`

```sql
CREATE TABLE analytic_chat_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   VARCHAR(255) NOT NULL UNIQUE,   -- Redis key suffix
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  district     VARCHAR(255) NOT NULL,
  title        VARCHAR(500) NOT NULL DEFAULT 'New Chat',
  turn_count   INTEGER NOT NULL DEFAULT 0,
  is_archived  BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_acs_user_id   ON analytic_chat_sessions(user_id);
CREATE INDEX idx_acs_session_id ON analytic_chat_sessions(session_id);
CREATE INDEX idx_acs_updated_at ON analytic_chat_sessions(updated_at DESC);
```

**Files to create/edit**:
- `backend/src/migrations/1778300000000-CreateAnalyticsChatSessions.ts` — new migration
- `backend/src/entities/analytic-chat-session.entity.ts` — new TypeORM entity

### 1.2 — TypeORM Entity

```typescript
// backend/src/entities/analytic-chat-session.entity.ts
@Entity('analytic_chat_sessions')
export class AnalyticChatSession {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) sessionId: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user: User;
  @Column() district: string;
  @Column({ default: 'New Chat' }) title: string;
  @Column({ default: 0 }) turnCount: number;
  @Column({ default: false }) isArchived: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

### 1.3 — NestJS Service Changes

**File**: `backend/src/analytics/analytics.service.ts`

Extend `chatWithAgent()`:
1. After the Python service returns a `session_id`, upsert a row in `analytic_chat_sessions`.
2. On the very first turn (`turn_count === 1`), run auto-title generation (Phase 2).
3. Keep `turn_count` in sync with Python's `turn_count` field from `ChatResponse`.

Extend `deleteChatSession()`:
- After calling the Python delete endpoint, hard-delete (or soft-archive) the `analytic_chat_sessions` row.

New method `getUserSessions(user)`:
- Returns paginated list of `analytic_chat_sessions` for the requesting admin, ordered by `updated_at DESC`.

New method `renameSession(sessionId, title, user)`:
- Updates `title` in `analytic_chat_sessions`.

**Ownership enforcement on existing routes** — extend `getChatHistory()` and `deleteChatSession()` to validate ownership before proxying to Redis/Python:
```typescript
const session = await this.sessionRepo.findOne({
  where: { sessionId, user: { id: user.id } }
});
if (!session) throw new ForbiddenException(); // prevents cross-admin access
```
This closes the gap where any admin could read/delete another admin's session by knowing the UUID.

**Files to edit**:
- `backend/src/analytics/analytics.service.ts`
- `backend/src/analytics/analytics.module.ts` — inject `AnalyticChatSession` repository

### 1.4 — NestJS Controller Changes

**File**: `backend/src/analytics/analytics.controller.ts`

Add routes:
```
GET    /analytics/chat/sessions              → getUserSessions()
PATCH  /analytics/chat/:sessionId/title      → renameSession()
```

All new routes: `@Roles(UserRole.ADMIN)` + `@UseGuards(JwtAuthGuard, RolesGuard)`.

**Deliverable**: Every new chat session is now durably stored in Postgres. History survives past Redis TTL (messages are still in Redis while TTL is alive; only metadata is in Postgres for now).

---

## Phase 2 — Auto-Title Generation ✅ COMPLETE

**Goal**: Name each conversation automatically from the first user message so the sidebar list is readable (like ChatGPT's auto-generated titles).

### 2.1 — Python Service: Title Generation Endpoint

**File**: `explain-analytics/src/explain_analytics/main.py`

Add a lightweight endpoint:

```python
POST /v1/insights/chat/{session_id}/title

Request:  { "first_message": str, "district": str }
Response: { "title": str }
```

Implementation: one Gemini call with a small prompt:
```
Generate a short (max 6 words) conversation title for an epidemiology chat that started with this user question in district {district}: "{first_message}". Reply with only the title, no punctuation.
```

### 2.2 — Backend: Call Title Endpoint After Turn 1

In `analytics.service.ts` inside `chatWithAgent()`:

```typescript
if (turnCount === 1) {
  // Fire-and-forget, don't block the chat response
  this.generateAndSaveTitle(sessionId, message, district, user);
}
```

`generateAndSaveTitle()` calls the Python `/v1/insights/chat/{session_id}/title` endpoint and updates the Postgres row.

**Deliverable**: Conversations in the sidebar have descriptive titles without user effort.

---

## Phase 3 — Backend APIs for Session List & Resume

**Goal**: Give the frontend everything it needs to render the history sidebar and resume old sessions.

### 3.1 — Session List API

```
GET /analytics/chat/sessions?page=1&limit=20&district=all
```

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "sessionId": "redis-uuid",
      "district": "Colombo",
      "title": "Dengue spike in July",
      "turnCount": 5,
      "createdAt": "2026-04-27T10:00:00Z",
      "updatedAt": "2026-04-27T10:15:00Z",
      "isArchived": false
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### 3.2 — Session Resume Flow

When user clicks a past session:
1. Frontend calls `GET /analytics/chat/:sessionId/history` (already exists).
2. If Redis TTL expired, Python returns empty messages → frontend shows a "Session expired, start a new one" message.
3. If Redis is alive, full message history is returned and rendered in the chat window.

**Future improvement (Phase 5)**: Persist messages to Postgres as a fallback when Redis TTL expires.

### 3.3 — Rename & Archive APIs

```
PATCH  /analytics/chat/:sessionId/title      Body: { title: string }
PATCH  /analytics/chat/:sessionId/archive    (soft-delete, isArchived = true)
DELETE /analytics/chat/:sessionId            (already exists, now also deletes Postgres row)
```

**Deliverable**: Full CRUD for conversation metadata. Frontend can now list, resume, rename, and delete sessions.

---

## Phase 4 — Frontend: History Sidebar UI

**Goal**: Redesign `FloatingChatBubble.tsx` to include a collapsible sidebar (like ChatGPT/Gemini) showing past sessions, with the ability to create, switch, rename, and delete conversations.

### 4.1 — Component Architecture

Split `FloatingChatBubble.tsx` into focused sub-components:

```
components/dashboard/analytics/
├── AIChatContainer.tsx          ← new outer shell (replaces FloatingChatBubble)
├── ChatSidebar.tsx              ← new: history list panel
├── ChatSessionItem.tsx          ← new: single row in sidebar
├── ChatWindow.tsx               ← extracted: current message thread UI
├── ChatInput.tsx                ← extracted: input bar + send button
└── FloatingChatBubble.tsx       ← keep: just the trigger button + renders AIChatContainer
```

### 4.2 — ChatSidebar.tsx

Responsibilities:
- On mount: call `GET /analytics/chat/sessions` and render grouped session list (Today / Yesterday / This Week / Older).
- "New Chat" button at the top — clears active session, starts fresh.
- Click a session → load its history + set as active session.
- Hover → show rename (pencil icon) and delete (trash icon) actions.
- Inline rename via `<input>` on pencil click → `PATCH /analytics/chat/:sessionId/title`.
- District filter dropdown (show sessions for all districts or a specific one).
- Infinite scroll or "Load more" pagination.

### 4.3 — State Management

Keep state in `AIChatContainer.tsx` using `useState` (no Redux/Zustand needed):

```typescript
const [sessions, setSessions]           = useState<ChatSessionMeta[]>([]);
const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
const [messages, setMessages]           = useState<ChatMessage[]>([]);
const [isSidebarOpen, setIsSidebarOpen] = useState(true);
const [isLoadingHistory, setIsLoadingHistory] = useState(false);
```

### 4.4 — Layout

```
┌─────────────────────────────────────────────────────────┐
│  [≡] AI Analytics Chat                         [✕]      │
├──────────────────┬──────────────────────────────────────┤
│  [+ New Chat]    │                                       │
│──────────────────│  Chat messages appear here            │
│  Today           │                                       │
│  > Dengue spike…│                                       │
│  > July trends…  │                                       │
│──────────────────│                                       │
│  Yesterday       │                                       │
│  > Colombo R₀…  │                                       │
│  > Response…     │                                       │
│──────────────────│                                       │
│  This Week       │──────────────────────────────────────│
│  > ...           │  [Type a message…]          [Send]    │
└──────────────────┴──────────────────────────────────────┘
```

- Sidebar width: `260px`, collapsible with toggle button.
- Chat window: takes remaining width.
- Full panel height: `80vh`, `max-h-[80vh]`.
- Sidebar hidden on mobile (< 768px), replaced by a back-arrow navigation.

### 4.5 — Frontend Service Additions

**File**: `frontend/services/analytics.service.ts`

Add:
```typescript
export const getUserChatSessions = async (page = 1, limit = 20, district?: string) => { ... }
export const renameChatSession = async (sessionId: string, title: string) => { ... }
export const archiveChatSession = async (sessionId: string) => { ... }
```

### 4.6 — UX Details

- New chat session → sidebar list prepends the new entry with title "New Chat" → updates to auto-generated title after turn 1.
- Clicking a session while another is active → gracefully switch (no confirmation needed unless current session has unsent input).
- Deleted session → optimistic UI removal from list.
- Expired session (Redis TTL hit) → show inline warning banner in chat window: *"This conversation has expired. Start a new chat below."*
- Keyboard shortcut: `Ctrl/Cmd + K` to focus the chat input.

**Deliverable**: Full ChatGPT-style sidebar UI. Admins can manage multiple named conversations.

---

## Phase 5 — Message Persistence Fallback (Optional, Post-MVP)

**Goal**: Persist full message content to Postgres so conversations survive Redis TTL expiration. This is a "nice to have" — the MVP (Phases 1-4) already gives full history within the 2-hour Redis window.

### 5.1 — New Table

```sql
CREATE TABLE analytic_chat_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID NOT NULL REFERENCES analytic_chat_sessions(id) ON DELETE CASCADE,
  role          VARCHAR(20) NOT NULL,   -- 'user' | 'model'
  content       TEXT NOT NULL,
  tool_calls    JSONB,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_acm_session ON analytic_chat_messages(chat_session_id, created_at);
```

### 5.2 — Write Path

After every successful Gemini response in `analytics.service.ts`:
- Insert both the user message and assistant reply into `analytic_chat_messages`.
- This runs async, non-blocking (fire-and-forget with error logging).

### 5.3 — Read Path (Resume Expired Session)

In `getChatHistory()`:
1. Try Redis first (fast path).
2. If Redis is empty/missing → query `analytic_chat_messages` from Postgres.
3. Re-hydrate Redis with the Postgres messages (restore session context).
4. Return messages to frontend.

This makes sessions effectively permanent.

---

## Phase 6 — Search & Polish

**Goal**: Power-user features and polish.

### 6.1 — Conversation Search

```
GET /analytics/chat/sessions?search=dengue
```

Backend: `WHERE title ILIKE '%dengue%'` or full-text search with `to_tsvector`.  
Frontend: Search input at the top of `ChatSidebar.tsx` with 300ms debounce.

### 6.2 — Session Export

```
GET /analytics/chat/:sessionId/export?format=pdf|json|markdown
```

Generates a downloadable conversation transcript.

### 6.3 — District Context Persistence

When resuming a session, automatically set the district selector in the parent analytics page to match the session's district. Prevents confusion when switching contexts.

### 6.4 — Unread / New Indicator

If a user navigates away mid-conversation and comes back, show an indicator that this session was last active `N minutes ago`.

---

## Implementation Order & Effort

| Phase | Description | Effort | Depends On |
|-------|-------------|--------|-----------|
| 1 | PostgreSQL metadata persistence | ✅ Done | — |
| 2 | Auto-title generation | ✅ Done | Phase 1 |
| 3 | Session list + rename/archive APIs | ~0.5 day | Phase 1 |
| 4 | Frontend sidebar UI | ~2-3 days | Phases 1-3 |
| 5 | Message persistence fallback | ~1 day | Phase 1 |
| 6 | Search & polish | ~1 day | Phases 1-4 |

**MVP = Phases 1 + 2 + 3 + 4** (~4-5 days total)

---

## Key Files Reference

| File | Change Type | Phase |
|------|------------|-------|
| `backend/src/migrations/1778300000000-CreateAnalyticsChatSessions.ts` | New | 1 |
| `backend/src/entities/analytic-chat-session.entity.ts` | New | 1 |
| `backend/src/analytics/analytics.service.ts` | Extend | 1, 2, 3 |
| `backend/src/analytics/analytics.controller.ts` | Extend | 1, 3 |
| `backend/src/analytics/analytics.module.ts` | Extend | 1 |
| `explain-analytics/src/explain_analytics/main.py` | Extend | 2 |
| `frontend/services/analytics.service.ts` | Extend | 4 |
| `frontend/components/dashboard/analytics/AIChatContainer.tsx` | New | 4 |
| `frontend/components/dashboard/analytics/ChatSidebar.tsx` | New | 4 |
| `frontend/components/dashboard/analytics/ChatSessionItem.tsx` | New | 4 |
| `frontend/components/dashboard/analytics/ChatWindow.tsx` | New (extracted) | 4 |
| `frontend/components/dashboard/analytics/ChatInput.tsx` | New (extracted) | 4 |
| `frontend/components/dashboard/analytics/FloatingChatBubble.tsx` | Refactor | 4 |
| `backend/src/migrations/1778400000000-CreateAnalyticsChatMessages.ts` | New | 5 |
| `backend/src/entities/analytic-chat-message.entity.ts` | New | 5 |

---

## Decision Notes

- **Redis stays as the primary message store** — fast, already working, handles compression. Postgres is just the index + optional fallback.
- **No Redux/Zustand** — existing codebase uses React Context only; stay consistent with `useState` in `AIChatContainer`.
- **No breaking changes** to existing Python session endpoints — all additions are new endpoints.
- **Session TTL extension**: consider raising `session_ttl_seconds` from 7200 (2h) to 86400 (24h) in `explain-analytics/src/explain_analytics/config.py` to give admins a full working day before Phase 5 message persistence is implemented.
