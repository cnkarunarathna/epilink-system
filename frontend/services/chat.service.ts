import axios from "axios";

axios.defaults.withCredentials = true;

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_BASE = RAW_BASE.endsWith("/api") ? RAW_BASE : `${RAW_BASE}/api`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MessageSenderDto {
  id: string;
  name: string;
  role: string;
}

export interface MessageReadDto {
  userId: string;
  readAt: string;
}

export interface MessageReactionDto {
  emoji: string;
  userId: string;
}

export interface MessageResponseDto {
  id: string;
  taskId: string;
  content: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  sender: MessageSenderDto;
  isSystemMessage: boolean;
  createdAt: string;
  readBy: MessageReadDto[];
  reactions: MessageReactionDto[];
}

export interface CreateMessageDto {
  content: string;
  attachmentUrl?: string;
  attachmentType?: "image" | "document";
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function fetchMessages(
  taskId: string,
  params?: { limit?: number; before?: string },
): Promise<MessageResponseDto[]> {
  const res = await axios.get<MessageResponseDto[]>(
    `${API_BASE}/tasks/${taskId}/messages`,
    { params, withCredentials: true },
  );
  return res.data;
}

export async function sendMessage(
  taskId: string,
  dto: CreateMessageDto,
): Promise<MessageResponseDto> {
  const res = await axios.post<MessageResponseDto>(
    `${API_BASE}/tasks/${taskId}/messages`,
    dto,
    { withCredentials: true },
  );
  return res.data;
}

export async function markMessagesRead(
  taskId: string,
  messageIds: string[],
): Promise<void> {
  await axios.patch(
    `${API_BASE}/tasks/${taskId}/messages/read`,
    { messageIds },
    { withCredentials: true },
  );
}

export async function fetchUnreadCount(taskId: string): Promise<number> {
  const res = await axios.get<{ count: number }>(
    `${API_BASE}/tasks/${taskId}/messages/unread`,
    { withCredentials: true },
  );
  return res.data.count;
}

export async function fetchUnreadBatch(
  taskIds: string[],
): Promise<Record<string, number>> {
  if (taskIds.length === 0) return {};
  const res = await axios.post<Record<string, number>>(
    `${API_BASE}/tasks/messages/unread-batch`,
    { taskIds },
    { withCredentials: true },
  );
  return res.data;
}

export async function uploadChatAttachment(
  file: File,
  onUploadProgress?: (percent: number) => void,
): Promise<{ url: string; key: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await axios.post<{ url: string; key: string }>(
    `${API_BASE}/upload/evidence`,
    formData,
    {
      withCredentials: true,
      onUploadProgress: onUploadProgress
        ? (e) => {
            const percent = e.total
              ? Math.round((e.loaded * 100) / e.total)
              : 0;
            onUploadProgress(percent);
          }
        : undefined,
    },
  );
  return res.data;
}

// ─── 6.2 Message Search ───────────────────────────────────────────────────────

export async function searchMessages(
  taskId: string,
  q: string,
): Promise<MessageResponseDto[]> {
  const res = await axios.get<MessageResponseDto[]>(
    `${API_BASE}/tasks/${taskId}/messages/search`,
    { params: { q }, withCredentials: true },
  );
  return res.data;
}

// ─── 6.3 Message Reactions ────────────────────────────────────────────────────

export async function toggleReaction(
  taskId: string,
  messageId: string,
  emoji: string,
): Promise<{ action: "added" | "removed"; reactions: MessageReactionDto[] }> {
  const res = await axios.post<{
    action: "added" | "removed";
    reactions: MessageReactionDto[];
  }>(
    `${API_BASE}/tasks/${taskId}/messages/${messageId}/reactions`,
    { emoji },
    { withCredentials: true },
  );
  return res.data;
}

// ─── 6.5 Supervisor Broadcast ─────────────────────────────────────────────────

export async function broadcastToDistrict(
  districtName: string,
  content: string,
): Promise<void> {
  await axios.post(
    `${API_BASE}/tasks/messages/broadcast`,
    { districtName, content },
    { withCredentials: true },
  );
}
