# Task-Centric Chat Module — Implementation Plan

## Overview

A persistent, real-time messaging feature scoped to individual operational tasks, enabling supervisors and PHIs to exchange contextual communications without leaving the platform. Messages are permanently stored, role-gated, and delivered instantly via the existing Socket.io infrastructure.

---

## Architecture Summary

| Layer | Approach |
|-------|----------|
| **Persistence** | New `task_messages` PostgreSQL table via TypeORM migration |
| **Real-time delivery** | Extend existing Socket.io `/events` namespace with `chat:*` events |
| **Access control** | Guard: only task creator (supervisor), assigned PHI, and admin can read/write |
| **File attachments** | Reuse existing `/upload/evidence` S3 pipeline |
| **Unread counts** | `message_reads` join table + Redis cache per `{userId, taskId}` |
| **Socket.io scaling** | Redis adapter (`@socket.io/redis-adapter`) on existing Redis instance |
| **Frontend** | Slide-over panel rendered inside each task detail page/modal |

---

## Phase 1 — Database Layer

**Goal:** Persistent schema for messages and read receipts, zero changes to existing tables.

### 1.1 `TaskMessage` Entity

Create `/backend/src/tasks/entities/task-message.entity.ts`

```typescript
@Entity('task_messages')
export class TaskMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ nullable: true })
  attachmentUrl: string;   // S3 key (nullable)

  @Column({ nullable: true })
  attachmentType: string;  // 'image' | 'document' (nullable)

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @Column()
  taskId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column()
  senderId: string;

  @Column({ default: false })
  isSystemMessage: boolean;  // for status-change audit entries (future)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Virtual: populated at query time
  readBy?: MessageRead[];
}
```

### 1.2 `MessageRead` Entity

Create `/backend/src/tasks/entities/message-read.entity.ts`

```typescript
@Entity('message_reads')
@Unique(['messageId', 'userId'])
export class MessageRead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  messageId: string;

  @ManyToOne(() => TaskMessage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: TaskMessage;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  readAt: Date;
}
```

### 1.3 TypeORM Migration

Generate via: `npm run migration:generate -- CreateTaskMessages`

Key indexes to include:
- `CREATE INDEX idx_task_messages_task_id ON task_messages(task_id)`
- `CREATE INDEX idx_task_messages_created_at ON task_messages(task_id, created_at DESC)`
- `CREATE INDEX idx_message_reads_user_id ON message_reads(user_id, message_id)`

### 1.4 Task Entity — Add Relation

In `/backend/src/tasks/entities/task.entity.ts`, add:

```typescript
@OneToMany(() => TaskMessage, (msg) => msg.task)
messages: TaskMessage[];
```

**Deliverables:** 2 new entities, 1 migration, 1 relation update

---

## Phase 2 — Backend API & WebSocket Events

**Goal:** REST endpoints for history + pagination, Socket.io events for real-time delivery, guards for access control.

### 2.1 Access Control Guard

Create `/backend/src/tasks/guards/task-participant.guard.ts`

Logic:
1. Extract `taskId` from route params
2. Fetch task (creator + assigned PHI)
3. Allow if `req.user.id === task.createdById || req.user.id === task.assignedPhiId || req.user.role === UserRole.ADMIN`
4. Throw `ForbiddenException` otherwise

### 2.2 DTOs

**`CreateMessageDto`**
```typescript
export class CreateMessageDto {
  @IsString() @MinLength(1) @MaxLength(2000)
  content: string;

  @IsOptional() @IsString()
  attachmentUrl?: string;

  @IsOptional() @IsIn(['image', 'document'])
  attachmentType?: string;
}
```

**`GetMessagesQueryDto`**
```typescript
export class GetMessagesQueryDto {
  @IsOptional() @IsNumberString()
  limit?: number;   // default 50

  @IsOptional() @IsString()
  before?: string;  // message UUID — cursor for pagination
}
```

**`MessageResponseDto`** (outbound shape)
```typescript
{
  id, taskId, content, attachmentUrl, attachmentType,
  sender: { id, name, role, avatarUrl },
  isSystemMessage, createdAt,
  readBy: [{ userId, readAt }]
}
```

### 2.3 `TaskMessagesService`

Create `/backend/src/tasks/task-messages.service.ts`

Key methods:

```typescript
async sendMessage(taskId: string, senderId: string, dto: CreateMessageDto): Promise<TaskMessage>
// 1. Validate task exists
// 2. Validate sender is participant (task creator or assigned PHI)
// 3. Insert TaskMessage row
// 4. Auto-create MessageRead for sender (sender has read their own message)
// 5. Emit Socket.io event: 'chat:message' to task room
// 6. Return populated message

async getMessages(taskId: string, query: GetMessagesQueryDto): Promise<TaskMessage[]>
// Cursor-based pagination, ordered DESC by createdAt
// JOIN sender + readBy

async markRead(taskId: string, userId: string, messageIds: string[]): Promise<void>
// Bulk upsert MessageRead rows
// Emit 'chat:read' event to task room

async getUnreadCount(taskId: string, userId: string): Promise<number>
// COUNT messages where sender != userId AND no read record for userId

async getUnreadCountsForUser(userId: string, taskIds: string[]): Promise<Record<string, number>>
// Batch query for task list badges
```

### 2.4 REST Endpoints

Add to existing `TasksController` or create `TaskMessagesController`:

```
POST   /tasks/:taskId/messages          → sendMessage (TaskParticipantGuard)
GET    /tasks/:taskId/messages          → getMessages (TaskParticipantGuard)
  ?limit=50&before=<cursor_uuid>
PATCH  /tasks/:taskId/messages/read     → markRead   (TaskParticipantGuard)
  Body: { messageIds: string[] }
GET    /tasks/:taskId/messages/unread   → getUnreadCount (TaskParticipantGuard)
POST   /tasks/messages/unread-batch     → getUnreadCountsForUser (JwtAuthGuard)
  Body: { taskIds: string[] }
```

### 2.5 Socket.io Events

Extend `/backend/src/events/events.gateway.ts`:

**Room strategy:** On task open, client joins `task:{taskId}`.  
**On task close / navigation away**, client leaves.

**Server → Client events:**

| Event | Payload | Recipients |
|-------|---------|------------|
| `chat:message` | `MessageResponseDto` | All in `task:{taskId}` room |
| `chat:read` | `{ taskId, userId, messageIds, readAt }` | All in `task:{taskId}` room |
| `chat:typing` | `{ taskId, userId, userName, isTyping }` | All in `task:{taskId}` room except sender |

**Client → Server events:**

| Event | Payload |
|-------|---------|
| `chat:join` | `{ taskId }` → server adds socket to `task:{taskId}` room |
| `chat:leave` | `{ taskId }` → server removes socket from room |
| `chat:typing` | `{ taskId, isTyping }` → server broadcasts to room |

**Gateway handler additions:**
```typescript
@SubscribeMessage('chat:join')
handleChatJoin(@MessageBody() data: { taskId: string }, @ConnectedSocket() client: Socket) {
  // validate JWT already done at connection
  // validate user is participant (query DB)
  client.join(`task:${data.taskId}`);
}

@SubscribeMessage('chat:leave')
handleChatLeave(@MessageBody() data: { taskId: string }, @ConnectedSocket() client: Socket) {
  client.leave(`task:${data.taskId}`);
}

@SubscribeMessage('chat:typing')
handleChatTyping(@MessageBody() data, @ConnectedSocket() client: Socket) {
  client.to(`task:${data.taskId}`).emit('chat:typing', {
    taskId: data.taskId,
    userId: client.data.user.id,
    userName: client.data.user.name,
    isTyping: data.isTyping,
  });
}
```

### 2.6 Redis Adapter — Socket.io Cross-Instance Pub/Sub

**Why:** Socket.io's default in-memory pub/sub only reaches sockets connected to the same process instance. Without this adapter, a message emitted on instance A will never reach a participant connected to instance B. Adding it now costs one config change and makes horizontal scaling a non-event later.

Install (backend):
```
npm install @socket.io/redis-adapter
```

Wire into `main.ts` (or the bootstrap function) after the NestJS app is created, using the **same Redis credentials already in the project**:

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

// After app.listen():
const pubClient = createClient({
  socket: { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) },
  password: process.env.REDIS_PASSWORD,
});
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);

const io = app.get(Server);  // retrieve the underlying Socket.io Server
io.adapter(createAdapter(pubClient, subClient));
```

No changes to gateway handlers, room logic, or event names — this is transparent to all existing socket code.

### 2.7 Redis Unread Count Cache

**Why:** `getUnreadCountsForUser` runs a `COUNT + LEFT JOIN` for every task in the list on every page load. With an indexed PostgreSQL query this is fast today, but caching it keeps the task list instantaneous as message volume grows and removes repeated DB round-trips for a value that changes infrequently.

**Cache key:** `unread:{userId}:{taskId}` → integer string  
**TTL:** No fixed TTL — invalidated on write via the two events below

**Cache lifecycle** (add to `TaskMessagesService`):

```typescript
// On sendMessage() — increment recipient's count
await redis.incr(`unread:${recipientId}:${taskId}`);

// On markRead() — delete keys for the user who read
await redis.del(`unread:${userId}:${taskId}`);

// On getUnreadCount(taskId, userId) — read-through
const cached = await redis.get(`unread:${userId}:${taskId}`);
if (cached !== null) return parseInt(cached, 10);
const count = await this.queryUnreadFromDb(taskId, userId);
await redis.set(`unread:${userId}:${taskId}`, count);
return count;

// On getUnreadCountsForUser(userId, taskIds) — pipeline multi-get
const pipeline = redis.multi();
taskIds.forEach(id => pipeline.get(`unread:${userId}:${id}`));
const results = await pipeline.exec();
// For any null (cache miss), fall back to DB and backfill cache
```

**Redis client:** Inject the existing `cache-manager` Redis store or create a dedicated `ioredis` client. The project already has Redis configured — no new infrastructure needed.

**Deliverables:** 1 guard, 3 DTOs, 1 service, 4 REST routes, 3 socket events, gateway updates, Redis adapter wired, unread count cache integrated

---

## Phase 3 — Frontend Services & State

**Goal:** API client, socket hooks, and unread-count state wiring across the app.

### 3.1 Chat API Service

Create `/frontend/src/services/chat.service.ts`

```typescript
const BASE = '/api';

export const chatService = {
  getMessages: (taskId: string, params?: { limit?: number; before?: string }) =>
    axios.get<MessageResponseDto[]>(`${BASE}/tasks/${taskId}/messages`, { params }),

  sendMessage: (taskId: string, dto: CreateMessageDto) =>
    axios.post<MessageResponseDto>(`${BASE}/tasks/${taskId}/messages`, dto),

  markRead: (taskId: string, messageIds: string[]) =>
    axios.patch(`${BASE}/tasks/${taskId}/messages/read`, { messageIds }),

  getUnreadCount: (taskId: string) =>
    axios.get<{ count: number }>(`${BASE}/tasks/${taskId}/messages/unread`),

  getUnreadBatch: (taskIds: string[]) =>
    axios.post<Record<string, number>>(`${BASE}/tasks/messages/unread-batch`, { taskIds }),

  uploadAttachment: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post<{ url: string; key: string }>(`${BASE}/upload/evidence`, formData);
  },
};
```

### 3.2 `useTaskChat` Hook

Create `/frontend/src/hooks/useTaskChat.ts`

```typescript
export function useTaskChat(taskId: string) {
  const [messages, setMessages] = useState<MessageResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const { socket } = useSocket();
  const { user } = useAuth();

  // Initial load
  useEffect(() => { loadMessages(); }, [taskId]);

  // Join/leave task room
  useEffect(() => {
    socket?.emit('chat:join', { taskId });
    return () => socket?.emit('chat:leave', { taskId });
  }, [socket, taskId]);

  // Real-time handlers
  useSocketEvent('chat:message', (msg) => {
    if (msg.taskId !== taskId) return;
    setMessages((prev) => [...prev, msg]);
    // Auto-mark as read if chat panel is open
    if (isVisible) chatService.markRead(taskId, [msg.id]);
  }, [taskId]);

  useSocketEvent('chat:read', (data) => {
    if (data.taskId !== taskId) return;
    setMessages((prev) => prev.map(m =>
      data.messageIds.includes(m.id)
        ? { ...m, readBy: [...(m.readBy ?? []), { userId: data.userId, readAt: data.readAt }] }
        : m
    ));
  }, [taskId]);

  useSocketEvent('chat:typing', (data) => {
    if (data.taskId !== taskId) return;
    setTypingUsers((prev) => {
      const filtered = prev.filter(u => u.userId !== data.userId);
      return data.isTyping ? [...filtered, { userId: data.userId, userName: data.userName }] : filtered;
    });
  }, [taskId]);

  const sendMessage = async (content: string, attachment?: { url: string; type: string }) => {
    await chatService.sendMessage(taskId, { content, ...attachment });
  };

  const loadMore = async () => { /* cursor pagination */ };

  return { messages, loading, hasMore, typingUsers, sendMessage, loadMore };
}
```

### 3.3 Unread Counts Context

Extend `AuthContext` or create `/frontend/src/contexts/UnreadContext.tsx`:

```typescript
// Provides a map: { [taskId]: unreadCount }
// Updated on: chat:message event, chat:read event, task list load
// Consumed by: task list rows (badge), task detail header

export const UnreadContext = createContext<{
  counts: Record<string, number>;
  refreshCounts: (taskIds: string[]) => void;
  decrementCount: (taskId: string) => void;
}>({ counts: {}, refreshCounts: () => {}, decrementCount: () => {} });
```

**Deliverables:** 1 service file, 1 custom hook, 1 context

---

## Phase 4 — UI Components

**Goal:** Task-embedded chat panel with full messaging UX, unread badges in task lists.

### 4.1 Component Tree

```
TaskDetailPage / TaskDetailModal
└── ChatPanel              (/components/chat/ChatPanel.tsx)
    ├── MessageList         (/components/chat/MessageList.tsx)
    │   └── MessageBubble   (/components/chat/MessageBubble.tsx)
    ├── TypingIndicator     (/components/chat/TypingIndicator.tsx)
    └── MessageInput        (/components/chat/MessageInput.tsx)
        └── AttachmentPicker (/components/chat/AttachmentPicker.tsx)
```

### 4.2 `ChatPanel`

- **Placement:** Tab or collapsible section within existing task detail views
  - Supervisor: `TaskDetailModal` → add "Messages" tab alongside "Evidence"
  - PHI: `TaskCard` expanded view → add "Chat" tab
- **Layout:** Fixed-height scrollable message area + pinned input at bottom
- **Behaviour:**
  - Joins socket room on mount, leaves on unmount
  - Scrolls to bottom on new message
  - Marks all visible unread messages as read when panel becomes visible
  - Shows participant info: supervisor name + PHI name at top

### 4.3 `MessageBubble`

```
╔═══════════════════════════════════╗
║  Supervisor Name          10:32   ║
║  ┌─────────────────────────────┐  ║
║  │ Please check the south gate │  ║  ← Incoming (left-aligned)
║  └─────────────────────────────┘  ║
║                                   ║
║                    11:04  You  ║
║  ┌─────────────────────────────┐  ║
║  │ Done. Photo attached below  │  ║  ← Outgoing (right-aligned, accent colour)
║  └─────────────────────────────┘  ║
║            [📷 evidence_01.jpg]   ║
║                          ✓✓ Read  ║  ← Read receipt
╚═══════════════════════════════════╝
```

Props: `message`, `isOwn`, `showSenderName`, `showReadReceipt`

### 4.4 `MessageInput`

- Textarea (auto-grow, max 4 lines)
- Send button (Enter to send, Shift+Enter for newline)
- Paperclip icon → `AttachmentPicker`
- Character counter (2000 limit)
- Typing indicator emitted on keystroke with 1s debounce, cleared on send/blur
- Disabled state when task is COMPLETED or CANCELLED

### 4.5 `AttachmentPicker`

- File input restricted to: `image/jpeg, image/png, image/webp, application/pdf`
- Upload progress indicator (progress bar)
- Preview thumbnail for images before send
- Reuses existing `/upload/evidence` endpoint — no new backend needed

### 4.6 `TypingIndicator`

- Animated dots (CSS keyframes)
- Shows: `"Supervisor is typing..."` or `"John Doe is typing..."`
- Auto-hides after 3s if no further typing event received

### 4.7 Unread Badge

In `TaskCard` and task list table rows:

```tsx
<Badge variant="destructive" className="ml-2">
  {unreadCounts[task.id] > 99 ? '99+' : unreadCounts[task.id]}
</Badge>
```

Consumed from `UnreadContext`.

### 4.8 Empty & Edge States

- **No messages yet:** `"No messages yet. Start the conversation."` with chat bubble icon
- **Task unassigned:** `"Assign a PHI to this task to enable messaging."` (supervisor view)
- **Task completed:** Input disabled, banner: `"This task is closed. Chat is read-only."`
- **Offline:** Toast warning using existing Sonner + disable send button

**Deliverables:** 6 new components, unread badge integrated into task list rows

---

## Phase 5 — Integration & Wiring

**Goal:** Connect all pieces; gate feature by task status; handle edge cases.

### 5.1 Task Detail Integration

**Supervisor view** (`/app/supervisor/...`):
1. Find `TaskDetailModal` or equivalent
2. Add `<Tabs>` with `Evidence` and `Messages` (or always-visible panel below details)
3. Pass `taskId` to `<ChatPanel taskId={task.id} />`
4. Show unread badge on Messages tab label

**PHI view** (`/app/phi/...`):
1. Find task detail / task card expanded view
2. Add `<ChatPanel>` section below task info
3. Mark messages read automatically when PHI opens the panel

### 5.2 Task List Unread Counts

In supervisor and PHI task list pages:
1. After loading task list, call `chatService.getUnreadBatch(taskIds)`
2. Store result in `UnreadContext`
3. Re-fetch on `chat:message` event for tasks in the list

### 5.3 Notification Banner (Header)

In the app header/navigation:
1. Show total unread chat messages badge (sum of `UnreadContext.counts`)
2. On click → navigate to the task with most recent unread message

### 5.4 Access Gating

Frontend:
- Render `<ChatPanel>` only when `task.assignedPhiId !== null`
- Disable `<MessageInput>` when `task.status === 'COMPLETED'`

Backend:
- `TaskParticipantGuard` already handles unauthorized access

### 5.5 Mobile Integration

In `/mobile/` (React Native/Expo):
- The same socket events apply — mobile clients already connect to `/events`
- Create `ChatScreen.tsx` with `FlatList` + `TextInput`
- Reuse `chat.service.ts` logic (axios already configured)
- Consider `react-native-gifted-chat` to accelerate UI development

**Deliverables:** Wired task detail pages, batch unread fetch in list pages, header badge

---

## Phase 6 — Enhancements (Post-MVP)

These features should be deferred until Phase 1–5 are stable.

### 6.1 System Messages (Audit Trail)

Automatically insert `isSystemMessage: true` messages on key status transitions:

```
"Task assigned to PHI John Doe by Supervisor Mary" (on ASSIGNED)
"PHI submitted evidence for review" (on SUBMITTED)
"Evidence approved. Task marked COMPLETED" (on COMPLETED)
"Task rejected: reason shown here" (on REJECTED)
```

- Injected by `TasksService` after status change, no sender shown
- Rendered with distinct style (centered, grey, italic)

### 6.2 Message Search

- `GET /tasks/:taskId/messages/search?q=keyword`
- Backend: `ILIKE %keyword%` on `content` column
- Frontend: search bar in chat panel header

### 6.3 Message Reactions

- Lightweight emoji reactions (thumbs up, check, etc.)
- New `message_reactions` table: `{ messageId, userId, emoji }`
- Socket event: `chat:reaction`

### 6.4 Push Notifications (Mobile)

- When `chat:message` is received, trigger FCM/APNs push if recipient is offline
- Integrate with existing notification infrastructure

### 6.5 Supervisor Broadcast Messages

- Supervisors send one message to all PHIs assigned tasks in the district
- New endpoint: `POST /districts/:districtId/broadcast`
- Emits `chat:broadcast` to `district:{districtName}` room

---

## Implementation Order (Recommended)

```
Week 1 │ Phase 1 (DB schema + migration)
       │ Phase 2 (backend API + socket events)
───────┼──────────────────────────────────────
Week 2 │ Phase 3 (frontend services + hook)
       │ Phase 4 (UI components)
───────┼──────────────────────────────────────
Week 3 │ Phase 5 (integration + wiring)
       │ Testing, bug fixes, mobile integration
───────┼──────────────────────────────────────
Week 4 │ Phase 6 (select enhancements)
```

---

## File Creation Checklist

### Backend (`/backend/src/`)
- [ ] `tasks/entities/task-message.entity.ts`
- [ ] `tasks/entities/message-read.entity.ts`
- [ ] `tasks/guards/task-participant.guard.ts`
- [ ] `tasks/dto/create-message.dto.ts`
- [ ] `tasks/dto/get-messages-query.dto.ts`
- [ ] `tasks/dto/message-response.dto.ts`
- [ ] `tasks/task-messages.service.ts`
- [ ] `tasks/task-messages.controller.ts`
- [ ] `migrations/XXXXXXXXXX-CreateTaskMessages.ts`
- [ ] Update `tasks/entities/task.entity.ts` (add messages relation)
- [ ] Update `tasks/tasks.module.ts` (register entities + service)
- [ ] Update `events/events.gateway.ts` (chat:join, chat:leave, chat:typing)
- [ ] Wire `@socket.io/redis-adapter` in `main.ts`
- [ ] Add Redis unread count cache methods to `task-messages.service.ts`

### Frontend (`/frontend/src/`)
- [ ] `services/chat.service.ts`
- [ ] `hooks/useTaskChat.ts`
- [ ] `contexts/UnreadContext.tsx`
- [ ] `components/chat/ChatPanel.tsx`
- [ ] `components/chat/MessageList.tsx`
- [ ] `components/chat/MessageBubble.tsx`
- [ ] `components/chat/MessageInput.tsx`
- [ ] `components/chat/AttachmentPicker.tsx`
- [ ] `components/chat/TypingIndicator.tsx`
- [ ] Update supervisor task detail page/modal
- [ ] Update PHI task detail page/card
- [ ] Update task list rows (unread badge)
- [ ] Wrap app with `UnreadProvider`

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Message scope | Task-level only | Prevents context fragmentation; aligns with operational accountability requirement |
| Participant gate | Creator + assigned PHI + admin | Exactly mirrors existing task access pattern; no new permission concept needed |
| Delivery mechanism | Existing Socket.io `/events` namespace | Zero new infrastructure; `task:{taskId}` rooms use same pattern as `district:*` |
| Read receipts | Join table (not column on message) | Scales to multi-party reads cleanly; avoids JSONB complexity |
| Pagination | Cursor-based (UUID before param) | Stable under concurrent new messages; no page-drift |
| Attachment storage | Reuse `/upload/evidence` + S3 | Consistent with evidence handling; no new upload pipeline |
| Typing indicator | Ephemeral (socket only, not persisted) | Typing state has no historical value; persisting it would add unnecessary write load |
| Read-only on complete | Input disabled client + task status validation server | Prevents confusion after task lifecycle ends; data integrity |
| Redis adapter | `@socket.io/redis-adapter` on existing Redis instance | Transparent to all socket code; enables horizontal scaling with zero future rework |
| Unread count caching | Redis `incr`/`del` per `{userId, taskId}`, DB read-through on miss | Removes repeated COUNT queries on task list load; invalidated on exact write/read events so never stale |
| Redis scope | Adapter + unread counts only | Message content is not cached — PostgreSQL + indexes are fast enough, and caching message rows adds invalidation complexity with no measurable UX benefit |
