"use client";

import React, { useRef, useState } from "react";
import { Paperclip, X, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadChatAttachment } from "@/services/chat.service";

interface AttachmentPickerProps {
  onAttached: (result: { url: string; type: "image" | "document" }) => void;
  disabled?: boolean;
}

export function AttachmentPicker({ onAttached, disabled }: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<{ src: string; name: string } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    e.target.value = "";

    const isImage = file.type.startsWith("image/");
    const type: "image" | "document" = isImage ? "image" : "document";

    if (isImage) {
      const reader = new FileReader();
      reader.onload = () =>
        setPreview({ src: reader.result as string, name: file.name });
      reader.readAsDataURL(file);
    } else {
      setPreview({ src: "", name: file.name });
    }

    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadChatAttachment(file, setProgress);
      onAttached({ url: result.url, type });
    } catch {
      setPreview(null);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const clearPreview = () => setPreview(null);

  return (
    <div className="flex flex-col gap-1">
      {/* Preview */}
      {preview && (
        <div className="relative inline-flex items-center gap-2 rounded-md border bg-muted px-2 py-1 text-xs">
          {preview.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.src} alt="preview" className="h-8 w-8 rounded object-cover" />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="max-w-[120px] truncate text-muted-foreground">{preview.name}</span>
          {uploading && (
            <span className="ml-1 text-muted-foreground">
              {progress}%
            </span>
          )}
          <button
            type="button"
            onClick={clearPreview}
            className="ml-auto text-muted-foreground hover:text-foreground"
            disabled={uploading}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Upload progress bar */}
      {uploading && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Trigger button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
      </Button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
