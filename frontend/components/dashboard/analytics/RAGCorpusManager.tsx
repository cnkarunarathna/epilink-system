"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Database,
  RefreshCw,
  Loader2,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  XCircle,
  BookOpen,
  FileText,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchRagStatus,
  ingestRagDocuments,
  RagStatus,
  RagIngestDocument,
} from "@/services/analytics.service";

const EMPTY_DOC: RagIngestDocument = {
  title: "",
  source: "",
  published_date: null,
  content: "",
};

function StatusIndicator({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span className="text-sm">{label}</span>
    </div>
  );
}

export default function RAGCorpusManager() {
  const [status, setStatus] = useState<RagStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [docs, setDocs] = useState<RagIngestDocument[]>([{ ...EMPTY_DOC }]);
  const [ingesting, setIngesting] = useState(false);

  const loadStatus = useCallback(async (showToast = false) => {
    try {
      setStatusLoading(true);
      const s = await fetchRagStatus();
      setStatus(s);
      if (showToast) toast.success("Status refreshed");
    } catch (err: any) {
      toast.error("Failed to fetch RAG status", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  function updateDoc(idx: number, field: keyof RagIngestDocument, value: string) {
    setDocs((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value || (field === "published_date" ? null : value) };
      return next;
    });
  }

  function addDoc() {
    setDocs((prev) => [...prev, { ...EMPTY_DOC }]);
  }

  function removeDoc(idx: number) {
    setDocs((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleIngest() {
    const valid = docs.filter((d) => d.title.trim() && d.content.trim());
    if (valid.length === 0) {
      toast.error("No valid documents", {
        description: "Each document needs at least a title and content.",
      });
      return;
    }
    try {
      setIngesting(true);
      const result = await ingestRagDocuments(valid);
      toast.success(`Ingested ${result.ingested} document${result.ingested !== 1 ? "s" : ""}`, {
        description: result.message,
      });
      setDocs([{ ...EMPTY_DOC }]);
      loadStatus();
    } catch (err: any) {
      toast.error("Ingestion failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIngesting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg shadow-md">
            <Database className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold">AI Knowledge Corpus</h3>
            <p className="text-xs text-muted-foreground">
              Manage reference documents for RAG-enhanced AI insights
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadStatus(true)}
          disabled={statusLoading}
          className="gap-2"
        >
          {statusLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            Corpus Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusLoading && !status ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading status...
            </div>
          ) : status ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">RAG Enabled</p>
                  <StatusIndicator ok={status.rag_enabled} label={status.rag_enabled ? "Enabled" : "Disabled"} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Vector DB</p>
                  <StatusIndicator ok={status.pgvector_configured} label={status.pgvector_configured ? "Connected" : "Not configured"} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Documents</p>
                  <p className="text-2xl font-bold tabular-nums">{status.document_count}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Top-K Retrieval</p>
                  <p className="text-2xl font-bold tabular-nums">{status.top_k}</p>
                </div>
              </div>
              {status.embedding_model && (
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="secondary" className="text-xs font-normal">
                    {status.embedding_model}
                  </Badge>
                  <span className="text-xs text-muted-foreground">embedding model</span>
                </div>
              )}
              {!status.rag_enabled && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    RAG is disabled. Set <code className="text-xs bg-amber-100 dark:bg-amber-900/50 px-1 rounded">EXPLAIN_RAG_ENABLED=true</code> and configure <code className="text-xs bg-amber-100 dark:bg-amber-900/50 px-1 rounded">EXPLAIN_PGVECTOR_URL</code> in the explain-analytics service to enable it.
                  </span>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Ingest Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Ingest Reference Documents
          </CardTitle>
          <CardDescription className="text-xs">
            Add MoH guidelines, WHO bulletins, or other epidemiological references to enhance AI insights.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {docs.map((doc, idx) => (
            <div key={idx} className="space-y-3 p-4 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Document {idx + 1}
                </span>
                {docs.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDoc(idx)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`title-${idx}`} className="text-xs">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`title-${idx}`}
                    placeholder="e.g. WHO Dengue Prevention Guidelines 2024"
                    value={doc.title}
                    onChange={(e) => updateDoc(idx, "title", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`source-${idx}`} className="text-xs">
                    Source / URL
                  </Label>
                  <Input
                    id={`source-${idx}`}
                    placeholder="e.g. who.int or MoH Circular 2024/03"
                    value={doc.source}
                    onChange={(e) => updateDoc(idx, "source", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`date-${idx}`} className="text-xs">
                  Published Date
                </Label>
                <Input
                  id={`date-${idx}`}
                  type="date"
                  value={doc.published_date ?? ""}
                  onChange={(e) => updateDoc(idx, "published_date", e.target.value)}
                  className="h-8 text-sm w-48"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`content-${idx}`} className="text-xs">
                  Content <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id={`content-${idx}`}
                  placeholder="Paste the full document text or relevant excerpts here..."
                  value={doc.content}
                  onChange={(e) => updateDoc(idx, "content", e.target.value)}
                  rows={6}
                  className="text-sm resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {doc.content.length} characters
                </p>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={addDoc}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Another Document
            </Button>

            <Button
              onClick={handleIngest}
              disabled={ingesting || !status?.rag_enabled}
              className="gap-2"
            >
              {ingesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {ingesting ? "Ingesting..." : `Ingest ${docs.filter((d) => d.title.trim() && d.content.trim()).length || ""} Document${docs.filter((d) => d.title.trim() && d.content.trim()).length !== 1 ? "s" : ""}`}
            </Button>
          </div>

          {!status?.rag_enabled && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              Ingestion is disabled — RAG must be enabled in the service configuration.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
