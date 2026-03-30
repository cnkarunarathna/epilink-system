# Task Management Module — Remaining Features & Implementation Plan

## Current State (What's Built)

### Backend
- `Task` entity with full lifecycle: `pending → assigned → in_progress → submitted → verified → completed / rejected`
- `Evidence` entity with `pending / approved / rejected` status
- Full CRUD for tasks, status transition validation, evidence submission and verification
- WebSocket real-time events (`task:created`, `task:updated`, `task:assigned`, `task:status-changed`, `task:deleted`)
- Geocoding service (address → coordinates, reverse, search)
- Task stats endpoint, PHIs-by-district endpoint

### Frontend Web — Supervisor
- Task list page with status/type filters, search, list/map toggle
- Task creation form (`/supervisor/tasks/new`)
- Task detail page: evidence approve/reject (per item), task verify/complete/reject actions, location map, real-time WebSocket updates

### Frontend Web — PHI
- Task list page with status/type filters, search
- Task detail page: timeline, evidence list, start/submit/resubmit actions, location map with directions
- Evidence submission form — **currently uses manual image URL input (not a real file upload)**

### Mobile — PHI
- `TaskListScreen`, `TaskDetailScreen` (animated timeline, evidence read-only display, start/submit/restart actions), `TaskMapScreen`
- `evidenceService.uploadEvidence` exists but accepts `imageUrl: string` — no actual file or camera capture
- `taskService` handles get, get-by-id, update-status, get-stats

---

## Remaining Features

### 1. Real File Upload for Evidence (Cloud Storage Integration)

**Gap:** The entire evidence upload chain is placeholder-level. Web PHI asks for an image URL typed by hand. Mobile has no upload flow at all. There is no cloud storage module in the backend.

**Scope reference:** README §4.3, §5.3, §6 — evidence requires photo capture, GPS tagging, file storage (AWS S3 / Cloudflare R2), 10 MB max per image.

#### 1a. Backend — Upload Module
- Add a `StorageService` (NestJS) wrapping `@aws-sdk/client-s3` (works with both S3 and R2 via S3-compatible API).
- Expose `POST /api/upload/evidence` that accepts `multipart/form-data` (single image), validates MIME type (`image/jpeg`, `image/png`, `image/webp`) and file size (≤ 10 MB), uploads to bucket, returns a permanent public URL.
- Wire the returned URL into the existing `POST /api/tasks/:id/evidence` flow — `imageUrl` stays as the stored value, just now populated from a real upload.
- Add environment variables: `STORAGE_PROVIDER` (`s3` | `r2`), `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_ENDPOINT` (for R2).

#### 1b. Frontend Web (PHI) — Replace URL Input with File Upload
- In `frontend/app/(dashboard)/phi/tasks/[id]/page.tsx` replace the `Input` + URL text field with a drag-and-drop / click-to-browse `<input type="file">` component.
- On file select: show a local preview thumbnail.
- On submit: `POST /api/upload/evidence` first → get back the URL → then call `addEvidence(taskId, { imageUrl: uploadedUrl, notes, latitude, longitude })`.
- Show upload progress (optional: use `axios` `onUploadProgress`).

#### 1c. Mobile (PHI) — Camera + Gallery Evidence Upload
- Install `expo-image-picker` (already likely available via Expo SDK) and `expo-location`.
- Create a new screen `EvidenceUploadScreen.tsx` in `mobile/src/screens/tasks/`:
  - "Take Photo" button → launches camera.
  - "Choose from Library" button → launches image picker.
  - Shows selected image preview.
  - GPS coordinates captured automatically via `expo-location` on screen open.
  - Notes text input.
  - "Submit Evidence" button: upload image as `multipart/form-data` to `POST /api/upload/evidence` → get URL → call `POST /api/tasks/:id/evidence`.
- Add an "Add Evidence" button to `TaskDetailScreen` when `task.status === IN_PROGRESS || REJECTED`.
- Register `EvidenceUpload` screen in `TaskStackParamList` and navigator.
- Update `evidenceService.ts`:
  - Add `uploadEvidenceFile(taskId, fileUri, notes?, latitude?, longitude?)` that builds a `FormData` object and calls the upload endpoint.
  - Keep existing `uploadEvidence` for URL-based fallback if needed.

---

### 2. Supervisor — Task Rejection with Reason Dialog

**Gap:** The "Reject" button in `frontend/app/(dashboard)/supervisor/tasks/[id]/page.tsx` calls `handleStatusUpdate(TaskStatus.REJECTED)` with no `rejectionReason`. The backend `updateStatus` supports it and stores it in `task.rejectionReason`. The PHI sees this field displayed — but it is always empty because the supervisor UI never captures it.

**Changes required (`supervisor/tasks/[id]/page.tsx`):**
- Add local state: `showRejectDialog: boolean`, `rejectReason: string`.
- Replace the direct "Reject" button action with opening a modal/dialog (`shadcn/ui` `Dialog` component).
- Dialog contains a `Textarea` for reason (required, min 10 chars) and "Confirm Reject" button.
- On confirm: call `handleStatusUpdate(TaskStatus.REJECTED, rejectReason)`.

---

### 3. Supervisor — Evidence Rejection with Reason

**Gap:** `handleVerifyEvidence(evidenceId, false)` passes no `rejectionReason`. `verifyEvidence(evidenceId, approved, rejectionReason?)` in `tasks.service.ts` stores it, and the mobile `TaskDetailScreen` already displays `item.rejectionReason`.

**Changes required (`supervisor/tasks/[id]/page.tsx`):**
- Same pattern as above: add a rejection reason dialog specifically for evidence items.
- Show dialog when supervisor clicks "Reject" on a pending evidence item.
- Pass `rejectionReason` to `verifyEvidence(e.id, false, reason)`.

---

### 4. Evidence Review Queue Page (Supervisor)

**Gap:** Scope §7.1 defines a centralized "Pending Evidence Dashboard" with batch actions, quick preview, GPS/timestamp verification, and rejection templates. Currently evidence is only visible inside individual task detail pages.

**New page: `frontend/app/(dashboard)/supervisor/evidence/page.tsx`**
- Fetch all tasks with `status: SUBMITTED` → then for each, fetch their pending evidence (or add a backend endpoint `GET /api/tasks/evidence/pending` that returns all pending evidence across tasks for the supervisor's district).
- Display as a grid/list: image thumbnail, task title, PHI name, submission timestamp, GPS coordinates.
- Per-item actions: Approve / Reject (with reason dialog per item 3 above).
- Batch selection: checkboxes + "Approve Selected" / "Reject Selected" batch buttons.
- Add backend endpoint (optional optimisation): `GET /api/tasks/evidence/pending?districtId=X` — queries `evidence` table joining `task` where `evidence.status = 'pending'`, filtered by district.

**Navigation:** Add "Evidence Queue" link to supervisor sidebar nav with a badge showing pending count.

---

### 5. PHI Workload Dashboard (Supervisor)

**Gap:** Scope §7.2 defines a workload heatmap, task balance indicator, performance metrics (completed count, avg completion time, rejection rate), and availability status. The `/supervisor/phis/page.tsx` exists but needs to surface this data.

**Backend changes:**
- Add endpoint `GET /api/users/phis/workload?districtId=X` that returns per-PHI aggregated stats:
  - `assignedCount`, `inProgressCount`, `submittedCount`, `completedCount`, `rejectedCount`, `overdueCount`
  - `avgCompletionTimeHours` (mean of `completedAt - assignedAt` for completed tasks)
  - `rejectionRate` (rejected / (completed + rejected))

**Frontend changes (`supervisor/phis/page.tsx` or new `supervisor/workload/page.tsx`):**
- Per-PHI card showing: name, task counts by status as colored progress bars, avg completion time, rejection rate badge.
- Sort by overdue count or workload to quickly spot overloaded PHIs.
- "Assign Task" shortcut button that pre-fills the new task form with that PHI.

---

### 6. Mobile — Complete Evidence Submission Flow

**(This is the mobile counterpart of feature 1c, expanded with UX details.)**

**Gap:** `TaskDetailScreen` shows submitted evidence in read-only mode but has no way to add new evidence from mobile. The `evidenceService.uploadEvidence` sends `{ imageUrl }` but there is no camera or gallery hook wiring it to a real file.

**Full flow:**
1. PHI opens `TaskDetailScreen` for an `IN_PROGRESS` or `REJECTED` task.
2. "Add Evidence" `Button` (bottom of actions section) navigates to `EvidenceUploadScreen`.
3. `EvidenceUploadScreen`:
   - Requests camera + location permissions on mount.
   - Shows two large buttons: "Take Photo" and "Choose from Library".
   - After selection: full-width image preview card.
   - GPS location auto-populated (show "GPS: 6.9271° N, 79.8612° E" or "GPS unavailable").
   - Notes multiline TextInput.
   - "Submit" button: uploads file → records evidence → navigates back to `TaskDetailScreen` with success toast.
   - "Cancel" button.
4. After evidence is submitted, the PHI can then tap "Submit Task" to move the task to `SUBMITTED`.

**Dependencies:**
- `expo-image-picker` — image capture and library access.
- `expo-location` — GPS coordinates.
- `expo-file-system` or `FormData` — multipart upload.

---

### 7. Mobile — Submit Task Enforces Minimum Evidence

**Gap:** Currently a PHI can tap "Submit Task" on a task with zero evidence. Scope §5.3 states minimum photo counts per task type.

**Change in `TaskDetailScreen`:**
- Before allowing "Submit Task", check `evidence.length >= minEvidenceCount(task.type)`.
- Minimum counts (suggested from scope): Cleanup = 2, Fogging = 1, Inspection = 1, Investigation = 2.
- If insufficient: show an inline warning banner "At least N photo(s) required before submitting" and disable the Submit button.
- These thresholds can be constants in `mobile/src/utils/constants.ts`.

---

### 8. Supervisor — Inline Task Edit on Detail Page

**Gap:** The task detail page for supervisors is read-only. There is no way to change the due date, priority, description, or reassign the task without deleting and recreating it.

**Changes (`supervisor/tasks/[id]/page.tsx`):**
- Add an "Edit" button that toggles an edit mode for the Task Details card.
- Editable fields: `title`, `description`, `priority`, `dueDate`, `notes`, `assignedPhiId` (reassign dropdown).
- On "Save": call `updateTask(task.id, changes)` (already in `tasks.service.ts`).
- On "Cancel": revert to read-only.

---

## Implementation Priority Order

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| **P1** | Real file upload — backend storage module (1a) | Medium | Unblocks all evidence upload |
| **P1** | Mobile evidence upload flow (1c + 6) | Medium | Core PHI mobile capability |
| **P1** | Web PHI — replace URL input with file upload (1b) | Small | Fixes broken UX |
| **P2** | Supervisor reject task with reason dialog (2) | Small | Closes workflow gap |
| **P2** | Supervisor reject evidence with reason (3) | Small | Closes workflow gap |
| **P2** | Minimum evidence enforcement on mobile (7) | Small | Data integrity |
| **P3** | Evidence Review Queue page (4) | Medium | Supervisor efficiency |
| **P3** | PHI Workload Dashboard (5) | Medium | Supervisor oversight |
| **P4** | Supervisor inline task edit (8) | Small | Supervisor UX |

---

## Out of Scope for This Phase

The following items are in the README roadmap but outside the core task management module focus of this enhancement:

- Push notifications (requires Expo Push Token infrastructure + backend notification service)
- Bulk task creation with polygon map selection (separate complex feature)
- Route optimization (OpenRouteService + TSP solver, standalone feature)
- Weather-based task scheduling (Open-Meteo integration, standalone feature)

---

## Affected Files Summary

### Backend
- `backend/src/` — new `storage/storage.module.ts`, `storage/storage.service.ts`
- `backend/src/tasks/tasks.controller.ts` — add upload endpoint or wire storage into evidence endpoint; add `GET /evidence/pending`
- `backend/src/tasks/tasks.service.ts` — optional `getPendingEvidence(districtId)` method
- `backend/src/users/users.controller.ts` / `users.service.ts` — add `/phis/workload` endpoint
- `.env` — add storage env vars

### Frontend (Web)
- `frontend/app/(dashboard)/phi/tasks/[id]/page.tsx` — replace URL input with file picker
- `frontend/app/(dashboard)/supervisor/tasks/[id]/page.tsx` — rejection reason dialogs (task + evidence)
- `frontend/app/(dashboard)/supervisor/evidence/page.tsx` — new Evidence Review Queue page
- `frontend/app/(dashboard)/supervisor/phis/page.tsx` or new `workload/page.tsx` — PHI Workload Dashboard
- `frontend/services/tasks.service.ts` — add upload API call

### Mobile
- `mobile/src/screens/tasks/EvidenceUploadScreen.tsx` — new screen
- `mobile/src/screens/tasks/TaskDetailScreen.tsx` — add "Add Evidence" button, minimum evidence check
- `mobile/src/api/evidenceService.ts` — add `uploadEvidenceFile` function
- `mobile/src/navigation/types.ts` — add `EvidenceUpload` to `TaskStackParamList`
- `mobile/src/navigation/TaskNavigator.tsx` — register new screen
- `mobile/src/utils/constants.ts` — add minimum evidence count constants
