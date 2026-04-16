"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSocket } from "@/contexts/SocketContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSocketEvent } from "@/hooks/useSocket";
import {
  fetchMessages,
  sendMessage,
  markMessagesRead,
  MessageResponseDto,
  CreateMessageDto,
} from "@/services/chat.service";

interface TypingUser {
  userId: string;
  userName: string;
}

interface ChatReadEvent {
  taskId: string;
  userId: string;
  messageIds: string[];
  readAt: string;
}

interface ChatTypingEvent {
  taskId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

export function useTaskChat(taskId: string, panelVisible = false) {
  const [messages, setMessages] = useState<MessageResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const { socket } = useSocket();
  const { user } = useAuth();

  // Track typing timeout handles for auto-clear
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // ─── Initial load ────────────────────────────────────────────────────────

  const loadMessages = useCallback(
    async (before?: string) => {
      try {
        const data = await fetchMessages(taskId, { limit: 50, before });
        if (before) {
          // Prepend older messages
          setMessages((prev) => [...data, ...prev]);
        } else {
          setMessages(data);
        }
        setHasMore(data.length === 50);
      } catch (err) {
        console.error("[useTaskChat] loadMessages error:", err);
      } finally {
        setLoading(false);
      }
    },
    [taskId],
  );

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setHasMore(true);
    loadMessages();
  }, [taskId, loadMessages]);

  // ─── Join / leave task socket room ───────────────────────────────────────

  useEffect(() => {
    if (!socket) return;
    socket.emit("chat:join", { taskId });
    return () => {
      socket.emit("chat:leave", { taskId });
    };
  }, [socket, taskId]);

  // ─── Real-time: new message ───────────────────────────────────────────────

  useSocketEvent<MessageResponseDto>(
    "chat:message",
    (msg) => {
      if (msg.taskId !== taskId) return;
      setMessages((prev) => {
        // Avoid duplicate if REST response already added it
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Auto-mark as read if the panel is open
      if (panelVisible && user && msg.sender.id !== user.id) {
        markMessagesRead(taskId, [msg.id]).catch(() => {});
      }
    },
    [taskId, panelVisible, user],
  );

  // ─── Real-time: read receipts ─────────────────────────────────────────────

  useSocketEvent<ChatReadEvent>(
    "chat:read",
    (data) => {
      if (data.taskId !== taskId) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (!data.messageIds.includes(m.id)) return m;
          const alreadyRead = m.readBy.some((r) => r.userId === data.userId);
          if (alreadyRead) return m;
          return {
            ...m,
            readBy: [...m.readBy, { userId: data.userId, readAt: data.readAt }],
          };
        }),
      );
    },
    [taskId],
  );

  // ─── Real-time: typing indicator ──────────────────────────────────────────

  useSocketEvent<ChatTypingEvent>(
    "chat:typing",
    (data) => {
      if (data.taskId !== taskId) return;

      setTypingUsers((prev) => {
        const filtered = prev.filter((u) => u.userId !== data.userId);
        return data.isTyping
          ? [...filtered, { userId: data.userId, userName: data.userName }]
          : filtered;
      });

      // Auto-clear after 3 s if no further typing event
      const existingTimer = typingTimers.current.get(data.userId);
      if (existingTimer) clearTimeout(existingTimer);

      if (data.isTyping) {
        const timer = setTimeout(() => {
          setTypingUsers((prev) =>
            prev.filter((u) => u.userId !== data.userId),
          );
          typingTimers.current.delete(data.userId);
        }, 3000);
        typingTimers.current.set(data.userId, timer);
      }
    },
    [taskId],
  );

  // Cleanup typing timers on unmount
  useEffect(() => {
    return () => {
      typingTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const send = useCallback(
    async (
      content: string,
      attachment?: { url: string; type: "image" | "document" },
    ): Promise<void> => {
      const dto: CreateMessageDto = {
        content,
        ...(attachment && {
          attachmentUrl: attachment.url,
          attachmentType: attachment.type,
        }),
      };
      await sendMessage(taskId, dto);
      // Socket broadcast will add the message via chat:message handler
    },
    [taskId],
  );

  const loadMore = useCallback(async (): Promise<void> => {
    if (!hasMore || loading) return;
    const oldest = messages[0];
    if (!oldest) return;
    await loadMessages(oldest.id);
  }, [hasMore, loading, messages, loadMessages]);

  const markVisible = useCallback(
    async (visibleMessageIds: string[]): Promise<void> => {
      if (!user || visibleMessageIds.length === 0) return;
      const unread = visibleMessageIds.filter(
        (id) =>
          messages
            .find((m) => m.id === id)
            ?.readBy.every((r) => r.userId !== user.id) ?? false,
      );
      if (unread.length === 0) return;
      await markMessagesRead(taskId, unread).catch(() => {});
    },
    [taskId, messages, user],
  );

  const emitTyping = useCallback(
    (isTyping: boolean): void => {
      socket?.emit("chat:typing", { taskId, isTyping });
    },
    [socket, taskId],
  );

  return {
    messages,
    loading,
    hasMore,
    typingUsers,
    send,
    loadMore,
    markVisible,
    emitTyping,
  };
}
