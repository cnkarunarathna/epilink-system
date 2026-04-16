"use client";

import React from "react";

interface TypingIndicatorProps {
  typingUsers: Array<{ userId: string; userName: string }>;
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  const label =
    typingUsers.length === 1
      ? `${typingUsers[0].userName} is typing`
      : typingUsers.length === 2
        ? `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing`
        : "Several people are typing";

  return (
    <div className="mx-3 mb-1 flex items-center gap-2 rounded-full border border-border/70 bg-muted/35 px-3 py-1 text-xs text-muted-foreground">
      <span className="flex gap-1">
        <span className="typing-dot" />
        <span className="typing-dot animation-delay-150" />
        <span className="typing-dot animation-delay-300" />
      </span>
      <span>{label}...</span>

      <style>{`
        .typing-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: currentColor;
          animation: typingBounce 1.2s ease-in-out infinite;
        }
        .animation-delay-150 { animation-delay: 0.15s; }
        .animation-delay-300 { animation-delay: 0.30s; }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%            { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
