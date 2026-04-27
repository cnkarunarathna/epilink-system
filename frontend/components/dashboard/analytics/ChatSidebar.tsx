"use client";

import { useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  onExportSession: (sessionId: string, format: "json" | "markdown") => void;
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  onExportSession,
}: ChatSidebarProps) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? sessions.filter((s) =>
        s.title.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : sessions;

  const groups = groupSessions(filtered);

  return (
    <div className="flex flex-col h-full border-r border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/50">
      <div className="p-2 shrink-0 space-y-1.5">
        <Button
          onClick={onNewChat}
          variant="outline"
          className="w-full h-8 text-[12px] border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          New Chat
        </Button>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            className="h-7 pl-6 pr-6 text-[11px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-purple-400"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-2 min-h-0">
        {groups.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-6 px-2">
            {query ? "No matching chats" : "No conversations yet"}
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
                    onExport={(fmt) => onExportSession(session.sessionId, fmt)}
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
