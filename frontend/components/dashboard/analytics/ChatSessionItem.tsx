"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Pencil,
  Trash2,
  Check,
  X,
  Download,
} from "lucide-react";
import type { ChatSessionMeta } from "@/services/analytics.service";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface ChatSessionItemProps {
  session: ChatSessionMeta;
  isActive: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onExport: (format: "json" | "markdown") => void;
}

export function ChatSessionItem({
  session,
  isActive,
  onSelect,
  onRename,
  onDelete,
  onExport,
}: ChatSessionItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(session.title);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(session.title);
  }, [session.title]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportMenu]);

  const commitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== session.title) onRename(trimmed);
    setIsEditing(false);
  };

  const cancelRename = () => {
    setEditValue(session.title);
    setIsEditing(false);
  };

  return (
    <div
      className={`group relative flex flex-col px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
          : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
      }`}
      onClick={() => !isEditing && onSelect()}
    >
      <div className="flex items-center gap-2">
        <MessageSquare
          className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-purple-500" : "text-slate-400"}`}
        />

        {isEditing ? (
          <div className="flex flex-1 items-center gap-1 min-w-0">
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") cancelRename();
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 text-[12px] bg-white dark:bg-slate-700 border border-purple-300 dark:border-purple-600 rounded px-1.5 py-0.5 outline-none min-w-0"
            />
            <button
              onClick={(e) => { e.stopPropagation(); commitRename(); }}
              className="text-green-600 hover:text-green-700 shrink-0"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); cancelRename(); }}
              className="text-red-500 hover:text-red-600 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <span className="flex-1 text-[12px] truncate leading-snug">
              {session.title}
            </span>
            <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                className="p-0.5 rounded hover:bg-purple-200 dark:hover:bg-purple-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                title="Rename"
              >
                <Pencil className="h-3 w-3" />
              </button>

              {/* Export button + dropdown */}
              <div ref={exportRef} className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowExportMenu((v) => !v);
                  }}
                  className="p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-slate-400 hover:text-blue-500 transition-colors"
                  title="Export"
                >
                  <Download className="h-3 w-3" />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[110px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExport("json");
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-1 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                    >
                      Export as JSON
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExport("markdown");
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-1 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                    >
                      Export as Markdown
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Relative time indicator */}
      {!isEditing && (
        <p className="ml-5 text-[10px] text-muted-foreground leading-none mt-0.5 truncate">
          {relativeTime(session.updatedAt)}
          {session.turnCount > 0 && (
            <span className="ml-1 opacity-60">· {session.turnCount} turn{session.turnCount !== 1 ? "s" : ""}</span>
          )}
        </p>
      )}
    </div>
  );
}
