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
  Navigation,
} from "lucide-react";
import {
  fetchTask,
  fetchTaskEvidence,
  updateTaskStatus,
  verifyEvidence,
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
import { useUnread } from "@/contexts/UnreadContext";
import { ChatPopup } from "@/components/chat/ChatPopup";

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<Task | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const { counts, refreshCounts } = useUnread();
  const unreadCount = counts[taskId] ?? 0;

  const loadTaskData = useCallback(async () => {
    try {
      setLoading(true);
      const [taskData, evidenceData] = await Promise.all([
        fetchTask(taskId),
        fetchTaskEvidence(taskId).catch(() => []),
      ]);
      setTask(taskData);
      setEvidence(evidenceData);
      refreshCounts([taskId]);
    } catch (error) {
      console.error("Failed to load task:", error);
      toast.error("Failed to load task details");
      router.push("/supervisor/tasks");
    } finally {
      setLoading(false);
    }
  }, [taskId, router, refreshCounts]);

  useEffect(() => {
    loadTaskData();
  }, [loadTaskData]);

  // WebSocket: listen for real-time updates to this task
  const handleTaskUpdated = useCallback(
    (updatedTask: Task) => {
      if (updatedTask.id === taskId) {
        setTask(updatedTask);
        toast.info("Task updated in real-time");
      }
    },
    [taskId],
  );

  const handleTaskStatusChanged = useCallback(
    (data: { task: Task; oldStatus: string; newStatus: string }) => {
      if (data.task.id === taskId) {
        setTask(data.task);
        toast.info(
          `Task status changed: ${data.oldStatus.replace("_", " ")} → ${data.newStatus.replace("_", " ")}`,
        );
      }
    },
    [taskId],
  );

  const handleTaskAssigned = useCallback(
    (data: { task: Task }) => {
      if (data.task.id === taskId) {
        setTask(data.task);
        toast.info(`Task assigned to ${data.task.assignedPhi?.name || "PHI"}`);
      }
    },
    [taskId],
  );

  useSocketEvent("task:updated", handleTaskUpdated, [handleTaskUpdated]);
  useSocketEvent("task:status-changed", handleTaskStatusChanged, [
    handleTaskStatusChanged,
  ]);
  useSocketEvent("task:assigned", handleTaskAssigned, [handleTaskAssigned]);

  const handleStatusUpdate = async (
    newStatus: TaskStatus,
    rejectionReason?: string,
    force?: boolean,
  ) => {
    if (!task) return;
    setActionLoading(true);
    try {
      await updateTaskStatus(task.id, newStatus, rejectionReason, force);
      toast.success(
        newStatus === TaskStatus.COMPLETED
          ? force
            ? "Task forcefully marked as complete"
            : "Task approved and marked as complete"
          : newStatus === TaskStatus.REJECTED
            ? "Task rejected"
            : `Task ${newStatus.replace("_", " ")}`,
      );
      loadTaskData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyEvidence = async (
    evidenceId: string,
    approved: boolean,
  ) => {
    setActionLoading(true);
    try {
      await verifyEvidence(evidenceId, approved);
      toast.success(`Evidence ${approved ? "approved" : "rejected"}`);
      loadTaskData();
    } catch (error: any) {
      toast.error("Failed to verify evidence");
    } finally {
      setActionLoading(false);
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

  if (!task) {
    return null;
  }

  // Determine available actions based on current status
  const canVerify = task.status === TaskStatus.SUBMITTED;
  const canComplete = task.status === TaskStatus.VERIFIED;
  const isTerminal =
    task.status === TaskStatus.COMPLETED ||
    task.status === TaskStatus.REJECTED;
  const canForceComplete = !isTerminal && !canVerify && !canComplete;
  const pendingEvidenceCount = evidence.filter(
    (e) => e.status === EvidenceStatus.PENDING,
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/supervisor/tasks">
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
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            {canVerify && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleStatusUpdate(TaskStatus.REJECTED)}
                  disabled={actionLoading}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  onClick={() => handleStatusUpdate(TaskStatus.COMPLETED)}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Approve &amp; Complete
                </Button>
              </>
            )}
            {canComplete && (
              <Button
                onClick={() => handleStatusUpdate(TaskStatus.COMPLETED)}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Mark Complete
              </Button>
            )}
            {canForceComplete && (
              <Button
                variant="outline"
                onClick={() =>
                  handleStatusUpdate(TaskStatus.COMPLETED, undefined, true)
                }
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Force Complete
              </Button>
            )}
          </div>
          {canVerify && pendingEvidenceCount > 0 && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {pendingEvidenceCount} evidence item
              {pendingEvidenceCount > 1 ? "s" : ""} still pending review
            </p>
          )}
        </div>
      </div>

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
                <p className="text-muted-foreground text-sm mb-1">Notes</p>
                <p className="text-sm">{task.notes}</p>
              </div>
            )}

            {task.rejectionReason && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-red-600 mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Rejection Reason</span>
                </div>
                <p className="text-sm text-red-600">{task.rejectionReason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assignment Info */}
        <Card>
          <CardHeader>
            <CardTitle>Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {task.assignedPhi?.name || "Unassigned"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {task.assignedPhi?.email || "No PHI assigned yet"}
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Assigned: {formatDate(task.assignedAt)}</span>
              </div>
              {task.submittedAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
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

            <div className="pt-2">
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
              <CardTitle>Location</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps?q=${task.latitude},${task.longitude}`,
                    "_blank",
                  )
                }
              >
                <Navigation className="mr-2 h-3 w-3" />
                Open in Google Maps
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

      {/* Floating chat popup */}
      <ChatPopup
        taskId={taskId}
        taskTitle={task.title}
        hasAssignedPhi={!!task.assignedPhiId}
        readOnly={isTerminal}
        unreadCount={unreadCount}
      />

      {/* Evidence Section */}
      <Card>
        <CardHeader>
          <CardTitle>Evidence ({evidence.length})</CardTitle>
          <CardDescription>
            Photos and notes submitted by the PHI
          </CardDescription>
        </CardHeader>
        <CardContent>
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

                    {e.status === EvidenceStatus.PENDING && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleVerifyEvidence(e.id, false)}
                          disabled={actionLoading}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => handleVerifyEvidence(e.id, true)}
                          disabled={actionLoading}
                        >
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No evidence submitted yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
