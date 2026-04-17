/**
 * Chat API service — task-scoped messaging
 * Mirrors the backend TaskMessages REST endpoints.
 */

import apiClient from "./client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MessageSender {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
}

export interface MessageRead {
  userId: string;
  readAt: string;
}

export interface ChatMessage {
  id: string;
  taskId: string;
  content: string;
  attachmentUrl?: string;
  attachmentType?: "image" | "document";
  sender: MessageSender;
  isSystemMessage: boolean;
  createdAt: string;
  readBy: MessageRead[];
  // Optimistic-send state (client-only, not from server)
  pending?: boolean;
  failed?: boolean;
}

export interface SendMessageDto {
  content: string;
  attachmentUrl?: string;
  attachmentType?: "image" | "document";
}

export interface GetMessagesParams {
  limit?: number;
  before?: string; // UUID cursor for pagination
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const chatService = {
  /**
   * Fetch messages for a task.
   * Returns newest-first from the server; the screen reverses to show oldest at top.
   */
  getMessages: async (
    taskId: string,
    params?: GetMessagesParams,
  ): Promise<ChatMessage[]> => {
    const response = await apiClient.get<ChatMessage[]>(
      `/tasks/${taskId}/messages`,
      { params },
    );
    return response.data;
  },

  /** Send a new text (or attachment) message. */
  sendMessage: async (
    taskId: string,
    dto: SendMessageDto,
  ): Promise<ChatMessage> => {
    const response = await apiClient.post<ChatMessage>(
      `/tasks/${taskId}/messages`,
      dto,
    );
    return response.data;
  },

  /** Mark a batch of messages as read for the current user. */
  markRead: async (taskId: string, messageIds: string[]): Promise<void> => {
    if (messageIds.length === 0) return;
    await apiClient.patch(`/tasks/${taskId}/messages/read`, { messageIds });
  },

  /** Fetch unread count for a single task. */
  getUnreadCount: async (taskId: string): Promise<number> => {
    const response = await apiClient.get<{ count: number }>(
      `/tasks/${taskId}/messages/unread`,
    );
    return response.data.count;
  },

  /**
   * Batch-fetch unread counts for multiple tasks in one request.
   * Returns a map of { [taskId]: count }.
   */
  getUnreadBatch: async (
    taskIds: string[],
  ): Promise<Record<string, number>> => {
    if (taskIds.length === 0) return {};
    const response = await apiClient.post<Record<string, number>>(
      `/tasks/messages/unread-batch`,
      { taskIds },
    );
    return response.data;
  },
};
