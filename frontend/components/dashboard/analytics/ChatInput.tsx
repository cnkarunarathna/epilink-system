"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2 } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  loading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export function ChatInput({ value, onChange, onSend, loading, inputRef }: ChatInputProps) {
  return (
    <div className="flex gap-2 p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 shrink-0">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask about dengue analytics..."
        className="flex-1 bg-white dark:bg-slate-800 border-purple-200/60 dark:border-purple-800/60 focus-visible:ring-purple-500 text-sm h-9"
        disabled={loading}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
      />
      <Button
        onClick={onSend}
        disabled={loading || !value.trim()}
        size="sm"
        className="bg-linear-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow h-9 px-3"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
