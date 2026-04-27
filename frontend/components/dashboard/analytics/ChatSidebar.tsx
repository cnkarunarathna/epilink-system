"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatSessionItem } from "./ChatSessionItem";
import type { ChatSessionMeta } from "@/services/analytics.service";

function groupSessions(sessions: ChatSessionMeta[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const groups: { label: string; items: ChatSessionMeta[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This Week", items: [] },
    { label: "Older", items: [] },
  ];

  for (const s of sessions) {
    const d = new Date(s.updatedAt);
    if (d >= todayStart) groups[0].items.push(s);
    else if (d >= yesterdayStart) groups[1].items.push(s);
    else if (d >= weekStart) groups[2].items.push(s);
    else groups[3].items.push(s);
  }

  return groups.filter((g) => g.items.length > 0);
}

interface ChatSidebarProps {
  sessions: ChatSessionMeta[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (session: ChatSessionMeta) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
}: ChatSidebarProps) {
  const groups = groupSessions(sessions);

  return (
    <div className="flex flex-col h-full border-r border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/50">
      <div className="p-2 shrink-0">
        <Button
          onClick={onNewChat}
          variant="outline"
          className="w-full h-8 text-[12px] border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-2 min-h-0">
        {groups.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-6 px-2">
            No conversations yet
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((session) => (
                  <ChatSessionItem
                    key={session.id}
                    session={session}
                    isActive={session.sessionId === activeSessionId}
                    onSelect={() => onSelectSession(session)}
                    onRename={(title) => onRenameSession(session.sessionId, title)}
                    onDelete={() => onDeleteSession(session.sessionId)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
