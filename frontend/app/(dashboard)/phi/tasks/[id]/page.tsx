"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ImageIcon,
  Play,
  Upload,
  Send,
  Navigation,
  Camera,
  Plus,
} from "lucide-react";
import {
  fetchTask,
  fetchTaskEvidence,
  updateTaskStatus,
  addEvidence,
  uploadEvidenceFile,
  Task,
  Evidence,
  TaskStatus,
  EvidenceStatus,
  getStatusColor,
  getPriorityColor,
} from "@/services/tasks.service";
import { toast } from "sonner";
import {
  Map,
  MapMarker,
  MarkerContent,
  MapControls,
} from "@/components/ui/map";
import { useSocketEvent } from "@/hooks/useSocket";
import { useAuth } from "@/contexts/AuthContext";

export default function PHITaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const taskId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<Task | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Evidence form state
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [evidenceSubmitting, setEvidenceSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const loadTaskData = useCallback(async () => {
    try {
      setLoading(true);
      const [taskData, evidenceData] = await Promise.all([
        fetchTask(taskId),
        fetchTaskEvidence(taskId).catch(() => []),
      ]);
      setTask(taskData);
      setEvidence(evidenceData);
    } catch (error) {
      console.error("Failed to load task:", error);
      toast.error("Failed to load task details");
      router.push("/phi/tasks");
    } finally {
      setLoading(false);
    }
  }, [taskId, router]);

  useEffect(() => {
    loadTaskData();
  }, [loadTaskData]);

  // WebSocket: listen for real-time updates to this task
  const handleTaskUpdated = useCallback(
    (updatedTask: Task) => {
      if (updatedTask.id === taskId) {
        setTask(updatedTask);
      }
    },
    [taskId],
  );

  const handleTaskStatusChanged = useCallback(
    (data: { task: Task; oldStatus: string; newStatus: string }) => {
      if (data.task.id === taskId) {
        setTask(data.task);
        if (data.newStatus === TaskStatus.REJECTED) {
          toast.warning("Task was rejected by supervisor");
        } else if (data.newStatus === TaskStatus.VERIFIED) {
          toast.success("Task was verified by supervisor");
        } else if (data.newStatus === TaskStatus.COMPLETED) {
          toast.success("Task marked as complete");
        }
      }
    },
    [taskId],
  );

  useSocketEvent("task:updated", handleTaskUpdated, [handleTaskUpdated]);
  useSocketEvent("task:status-changed", handleTaskStatusChanged, [
    handleTaskStatusChanged,
  ]);

  const handleStatusUpdate = async (newStatus: TaskStatus) => {
    if (!task) return;
    setActionLoading(true);
    try {
      await updateTaskStatus(task.id, newStatus);
      toast.success(
        newStatus === TaskStatus.IN_PROGRESS
          ? "Task started"
          : newStatus === TaskStatus.SUBMITTED
            ? "Task submitted for review"
            : `Task ${newStatus.replace("_", " ")}`,
      );
      loadTaskData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setEvidenceFile(file);
    if (evidencePreview) {
      URL.revokeObjectURL(evidencePreview);
    }
    setEvidencePreview(file ? URL.createObjectURL(file) : null);
    setUploadProgress(0);
  };

  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceFile) {
      toast.error("Please select an image file");
      return;
    }

    setEvidenceSubmitting(true);
    try {
      // Upload file to S3 — returns signed URL for preview and key to store
      const { key: imageUrl } = await uploadEvidenceFile(evidenceFile, setUploadProgress);

      // Try to get current GPS location
      let latitude: number | undefined;
      let longitude: number | undefined;

      try {
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
            });
          },
        );
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch {
        // GPS not available, submit without coordinates
      }

      await addEvidence(taskId, {
        imageUrl, // stores S3 key; server signs it on every read
        notes: evidenceNotes.trim() || undefined,
        latitude,
        longitude,
      });

      toast.success("Evidence submitted successfully");
      setEvidenceFile(null);
      setEvidencePreview(null);
      setEvidenceNotes("");
      setUploadProgress(0);
      setShowEvidenceForm(false);
      loadTaskData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to submit evidence");
    } finally {
      setEvidenceSubmitting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!task) return null;

  // Determine available PHI actions based on current status
  const canStart = task.status === TaskStatus.ASSIGNED;
  const canSubmit = task.status === TaskStatus.IN_PROGRESS;
  const canResubmit = task.status === TaskStatus.REJECTED;
  const canAddEvidence =
    task.status === TaskStatus.IN_PROGRESS ||
    task.status === TaskStatus.REJECTED;
  const isFinished =
    task.status === TaskStatus.COMPLETED || task.status === TaskStatus.VERIFIED;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/phi/tasks">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{task.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={getStatusColor(task.status)}>
                {task.status.replace("_", " ")}
              </Badge>
              <span
                className={`text-sm font-medium capitalize ${getPriorityColor(task.priority)}`}
              >
                {task.priority} Priority
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {canStart && (
            <Button
              onClick={() => handleStatusUpdate(TaskStatus.IN_PROGRESS)}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Start Task
            </Button>
          )}
          {canSubmit && (
            <Button
              onClick={() => handleStatusUpdate(TaskStatus.SUBMITTED)}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Submit for Review
            </Button>
          )}
          {canResubmit && (
            <Button
              onClick={() => handleStatusUpdate(TaskStatus.IN_PROGRESS)}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Resubmit Task
            </Button>
          )}
        </div>
      </div>

      {/* Rejection Warning */}
      {task.status === TaskStatus.REJECTED && task.rejectionReason && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">Task Rejected</span>
          </div>
          <p className="text-sm text-red-600">{task.rejectionReason}</p>
          <p className="text-xs text-red-500 mt-1">
            Please address the issues and resubmit with updated evidence.
          </p>
        </div>
      )}

      {/* Completion Banner */}
      {isFinished && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">
              Task{" "}
              {task.status === TaskStatus.VERIFIED ? "Verified" : "Completed"}
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Task Details */}
        <Card>
          <CardHeader>
            <CardTitle>Task Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Type</p>
                <p className="font-medium capitalize">{task.type}</p>
              </div>
              <div>
                <p className="text-muted-foreground">District</p>
                <p className="font-medium">{task.district?.name || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">{formatDate(task.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Due Date</p>
                <p className="font-medium">{formatDate(task.dueDate)}</p>
              </div>
            </div>

            <Separator />

            {task.description && (
              <div>
                <p className="text-muted-foreground text-sm mb-1">
                  Description
                </p>
                <p className="text-sm">{task.description}</p>
              </div>
            )}

            {task.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <p className="text-sm">{task.address}</p>
              </div>
            )}

            {task.notes && (
              <div>
                <p className="text-muted-foreground text-sm mb-1">
                  Supervisor Notes
                </p>
                <p className="text-sm">{task.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline / Status Info */}
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Created: {formatDate(task.createdAt)}</span>
              </div>
              {task.assignedAt && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-500" />
                  <span>Assigned: {formatDate(task.assignedAt)}</span>
                </div>
              )}
              {task.submittedAt && (
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-purple-500" />
                  <span>Submitted: {formatDate(task.submittedAt)}</span>
                </div>
              )}
              {task.completedAt && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Completed: {formatDate(task.completedAt)}</span>
                </div>
              )}
            </div>

            <Separator />

            <div>
              <p className="text-muted-foreground text-sm mb-1">Created By</p>
              <p className="text-sm">{task.createdBy?.name || "-"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Location Map */}
      {task.latitude && task.longitude && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Task Location</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${task.latitude},${task.longitude}`,
                    "_blank",
                  )
                }
              >
                <Navigation className="mr-2 h-3 w-3" />
                Get Directions
              </Button>
            </div>
            {task.address && (
              <CardDescription className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {task.address}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div
              className="rounded-lg overflow-hidden border"
              style={{ height: 300 }}
            >
              <Map
                center={[Number(task.longitude), Number(task.latitude)]}
                zoom={15}
                minZoom={6}
                maxZoom={18}
              >
                <MapMarker
                  longitude={Number(task.longitude)}
                  latitude={Number(task.latitude)}
                  anchor="bottom"
                >
                  <MarkerContent>
                    <MapPin className="h-8 w-8 text-primary fill-primary/20" />
                  </MarkerContent>
                </MapMarker>
                <MapControls position="bottom-right" showZoom />
              </Map>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evidence Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Evidence ({evidence.length})</CardTitle>
              <CardDescription>
                Photos and notes submitted for this task
              </CardDescription>
            </div>
            {canAddEvidence && (
              <Button
                size="sm"
                onClick={() => setShowEvidenceForm(!showEvidenceForm)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Evidence
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Evidence Submission Form */}
          {showEvidenceForm && (
            <form
              onSubmit={handleSubmitEvidence}
              className="p-4 border rounded-lg bg-muted/50 space-y-3"
            >
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Photo
                </label>
                <label
                  className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer bg-background hover:bg-muted/40 transition-colors"
                >
                  {evidencePreview ? (
                    <img
                      src={evidencePreview}
                      alt="Preview"
                      className="h-full w-full object-contain rounded-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <Camera className="h-8 w-8" />
                      <span className="text-sm">Click to select a photo</span>
                      <span className="text-xs">JPEG, PNG, WebP · max 10 MB</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={evidenceSubmitting}
                  />
                </label>
                {evidenceFile && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {evidenceFile.name} ({(evidenceFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              {/* Upload progress bar */}
              {evidenceSubmitting && uploadProgress > 0 && (
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-1 block">
                  Notes (optional)
                </label>
                <Textarea
                  placeholder="Describe what was done, observations, etc."
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={evidenceSubmitting || !evidenceFile} size="sm">
                  {evidenceSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="mr-2 h-4 w-4" />
                  )}
                  {evidenceSubmitting
                    ? uploadProgress < 100
                      ? `Uploading ${uploadProgress}%`
                      : "Saving..."
                    : "Submit Evidence"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowEvidenceForm(false);
                    setEvidenceFile(null);
                    setEvidencePreview(null);
                    setUploadProgress(0);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Evidence List */}
          {evidence.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {evidence.map((e) => (
                <div key={e.id} className="border rounded-lg overflow-hidden">
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    {e.imageUrl ? (
                      <img
                        src={e.imageUrl}
                        alt="Evidence"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge
                        className={
                          e.status === EvidenceStatus.APPROVED
                            ? "bg-green-100 text-green-800"
                            : e.status === EvidenceStatus.REJECTED
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                        }
                      >
                        {e.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(e.submittedAt)}
                      </span>
                    </div>
                    {e.notes && (
                      <p className="text-sm text-muted-foreground">{e.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No evidence submitted yet</p>
              {canAddEvidence && (
                <p className="text-xs mt-1">
                  Click &quot;Add Evidence&quot; to upload photos and notes
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
