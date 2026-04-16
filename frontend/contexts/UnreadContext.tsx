"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { useSocketEvent } from "@/hooks/useSocket";
import { fetchUnreadBatch, MessageResponseDto } from "@/services/chat.service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatReadEvent {
  taskId: string;
  userId: string;
  messageIds: string[];
}

interface UnreadContextType {
  /** Map of taskId → unread message count for the current user */
  counts: Record<string, number>;
  /** Fetch unread counts for the given task IDs and merge into state */
  refreshCounts: (taskIds: string[]) => Promise<void>;
  /** Immediately zero out the count for a task (called when user opens chat) */
  clearCount: (taskId: string) => void;
  /** Total unread messages across all tracked tasks */
  totalUnread: number;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const UnreadContext = createContext<UnreadContextType>({
  counts: {},
  refreshCounts: async () => {},
  clearCount: () => {},
  totalUnread: 0,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const { user } = useAuth();

  // Keep a ref of known task IDs so socket handlers can refresh them
  const trackedTaskIds = useRef<Set<string>>(new Set());

  // ─── Fetch & merge ──────────────────────────────────────────────────────

  const refreshCounts = useCallback(
    async (taskIds: string[]): Promise<void> => {
      if (!user || taskIds.length === 0) return;
      try {
        taskIds.forEach((id) => trackedTaskIds.current.add(id));
        const batch = await fetchUnreadBatch(taskIds);
        setCounts((prev) => ({ ...prev, ...batch }));
      } catch (err) {
        console.error("[UnreadContext] refreshCounts error:", err);
      }
    },
    [user],
  );

  const clearCount = useCallback((taskId: string): void => {
    setCounts((prev) => (prev[taskId] ? { ...prev, [taskId]: 0 } : prev));
  }, []);

  // ─── Socket: new message ─────────────────────────────────────────────────

  useSocketEvent<MessageResponseDto>(
    "chat:message",
    (msg) => {
      if (!user) return;
      // Only increment if this message is not from the current user
      if (msg.sender.id === user.id) return;
      setCounts((prev) => ({
        ...prev,
        [msg.taskId]: (prev[msg.taskId] ?? 0) + 1,
      }));
    },
    [user],
  );

  // ─── Socket: read receipt ────────────────────────────────────────────────

  useSocketEvent<ChatReadEvent>(
    "chat:read",
    (data) => {
      if (!user || data.userId !== user.id) return;
      // When the current user reads messages, refresh the accurate count from backend
      if (trackedTaskIds.current.has(data.taskId)) {
        refreshCounts([data.taskId]);
      }
    },
    [user, refreshCounts],
  );

  // ─── Derived ─────────────────────────────────────────────────────────────

  const totalUnread = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <UnreadContext.Provider
      value={{ counts, refreshCounts, clearCount, totalUnread }}
    >
      {children}
    </UnreadContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUnread() {
  const context = useContext(UnreadContext);
  if (!context) {
    throw new Error("useUnread must be used within an UnreadProvider");
  }
  return context;
}
