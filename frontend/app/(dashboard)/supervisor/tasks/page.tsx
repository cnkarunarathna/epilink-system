"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  RefreshCw,
  Loader2,
  Filter,
  ChevronRight,
  List,
  MapIcon,
  Route,
  X,
  CheckSquare,
  Users,
} from "lucide-react";
import {
  fetchTasks,
  fetchPhisByDistrict,
  getOptimizedRoute,
  assignTask,
  Task,
  TaskStatus,
  TaskType,
  RouteResult,
  getStatusColor,
  getPriorityColor,
} from "@/services/tasks.service";
import { toast } from "sonner";
import TasksMap from "@/components/tasks/TasksMap";
import { RouteMap } from "@/components/tasks/RouteMap";
import { useSocketEvent } from "@/hooks/useSocket";
import { useAuth } from "@/contexts/AuthContext";

type PhiOption = { id: string; name: string; email: string; isActive: boolean };

export default function TasksListPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<TaskType | "all">("all");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  // Bulk select state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [phiOptions, setPhiOptions] = useState<PhiOption[]>([]);
  const [phiOptionsLoading, setPhiOptionsLoading] = useState(false);
  const [selectedPhiId, setSelectedPhiId] = useState<string>("");

  // Route preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewRoute, setPreviewRoute] = useState<RouteResult | null>(null);
  const [assigning, setAssigning] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchTasks({
        status: statusFilter !== "all" ? statusFilter : undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
      });
      setTasks(data);
    } catch (error) {
      console.error("Failed to load tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Load PHI options when bulk mode is activated
  useEffect(() => {
    if (!bulkMode || !user?.district) return;
    setPhiOptionsLoading(true);
    fetchPhisByDistrict(user.district)
      .then((phis) => setPhiOptions(phis.filter((p) => p.isActive)))
      .catch(() => toast.error("Failed to load PHI list"))
      .finally(() => setPhiOptionsLoading(false));
  }, [bulkMode, user?.district]);

  // ==================== WebSocket ====================

  const handleTaskCreated = useCallback((newTask: Task) => {
    setTasks((prev) => [newTask, ...prev]);
    toast.success(`New task created: ${newTask.title}`);
  }, []);

  const handleTaskUpdated = useCallback((updatedTask: Task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
    );
  }, []);

  const handleTaskStatusChanged = useCallback(
    (data: { task: Task; oldStatus: string; newStatus: string }) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === data.task.id ? data.task : t)),
      );
      toast.info(
        `Task "${data.task.title}" status: ${data.newStatus.replace("_", " ")}`,
      );
    },
    [],
  );

  const handleTaskAssigned = useCallback((data: { task: Task }) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === data.task.id ? data.task : t)),
    );
  }, []);

  const handleTaskDeleted = useCallback((data: { taskId: string }) => {
    setTasks((prev) => prev.filter((t) => t.id !== data.taskId));
    toast.info("A task was deleted");
  }, []);

  useSocketEvent("task:created", handleTaskCreated, [handleTaskCreated]);
  useSocketEvent("task:updated", handleTaskUpdated, [handleTaskUpdated]);
  useSocketEvent("task:status-changed", handleTaskStatusChanged, [
    handleTaskStatusChanged,
  ]);
  useSocketEvent("task:assigned", handleTaskAssigned, [handleTaskAssigned]);
  useSocketEvent("task:deleted", handleTaskDeleted, [handleTaskDeleted]);

  // ==================== Filtering ====================

  const filteredTasks = tasks.filter(
    (task) =>
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.assignedPhi?.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Tasks eligible for bulk route preview (must have lat/lng)
  const selectedTasksWithLocation = useMemo(
    () =>
      tasks.filter(
        (t) =>
          selectedIds.has(t.id) &&
          t.latitude !== null &&
          t.longitude !== null,
      ),
    [tasks, selectedIds],
  );

  const canPreviewRoute =
    selectedIds.size >= 1 &&
    selectedPhiId !== "" &&
    selectedTasksWithLocation.length >= 2;

  // ==================== Bulk select helpers ====================

  const toggleBulkMode = useCallback(() => {
    setBulkMode((prev) => !prev);
    setSelectedIds(new Set());
    setSelectedPhiId("");
    setPreviewRoute(null);
  }, []);

  const toggleTask = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === filteredTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTasks.map((t) => t.id)));
    }
  }, [selectedIds.size, filteredTasks]);

  // ==================== Route preview ====================

  const handlePreviewRoute = useCallback(async () => {
    const taskIds = Array.from(selectedIds);
    setPreviewLoading(true);
    try {
      const result = await getOptimizedRoute(taskIds);
      setPreviewRoute(result);
      setPreviewOpen(true);
      if (result.routingUnavailable) {
        toast.warning("Road routing unavailable — showing estimated order.");
      }
    } catch {
      toast.error("Failed to compute route. Please try again.");
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedIds]);

  // ==================== Assign & confirm ====================

  const handleConfirmAssign = useCallback(async () => {
    if (!selectedPhiId) return;
    const taskIds = Array.from(selectedIds);
    setAssigning(true);
    try {
      await Promise.all(taskIds.map((id) => assignTask(id, selectedPhiId)));
      const phi = phiOptions.find((p) => p.id === selectedPhiId);
      toast.success(
        `${taskIds.length} task${taskIds.length !== 1 ? "s" : ""} assigned to ${phi?.name ?? "PHI"}`,
      );
      setPreviewOpen(false);
      setPreviewRoute(null);
      setBulkMode(false);
      setSelectedIds(new Set());
      setSelectedPhiId("");
      await loadTasks();
    } catch {
      toast.error("Failed to assign some tasks. Please try again.");
    } finally {
      setAssigning(false);
    }
  }, [selectedPhiId, selectedIds, phiOptions, loadTasks]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const selectedPhi = phiOptions.find((p) => p.id === selectedPhiId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Tasks</h2>
          <p className="text-muted-foreground">
            Manage and track all tasks in your district
          </p>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === "list" && (
            <Button
              variant={bulkMode ? "secondary" : "outline"}
              size="sm"
              onClick={toggleBulkMode}
            >
              {bulkMode ? (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Exit Bulk Select
                </>
              ) : (
                <>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Bulk Assign
                </>
              )}
            </Button>
          )}
          <Link href="/supervisor/tasks/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Task
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or PHI name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as TaskStatus | "all")}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value={TaskStatus.PENDING}>Pending</SelectItem>
                <SelectItem value={TaskStatus.ASSIGNED}>Assigned</SelectItem>
                <SelectItem value={TaskStatus.IN_PROGRESS}>
                  In Progress
                </SelectItem>
                <SelectItem value={TaskStatus.SUBMITTED}>Submitted</SelectItem>
                <SelectItem value={TaskStatus.VERIFIED}>Verified</SelectItem>
                <SelectItem value={TaskStatus.COMPLETED}>Completed</SelectItem>
                <SelectItem value={TaskStatus.REJECTED}>Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as TaskType | "all")}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value={TaskType.CLEANUP}>Cleanup</SelectItem>
                <SelectItem value={TaskType.FOGGING}>Fogging</SelectItem>
                <SelectItem value={TaskType.INSPECTION}>Inspection</SelectItem>
                <SelectItem value={TaskType.INVESTIGATION}>
                  Investigation
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={loadTasks}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                className="rounded-r-none"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "map" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("map")}
                className="rounded-l-none"
              >
                <MapIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk assign action bar */}
      {bulkMode && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-primary" />
                <span>
                  {selectedIds.size === 0
                    ? "Select tasks to assign"
                    : `${selectedIds.size} task${selectedIds.size !== 1 ? "s" : ""} selected`}
                </span>
              </div>

              <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:ml-auto">
                <Select
                  value={selectedPhiId}
                  onValueChange={setSelectedPhiId}
                  disabled={phiOptionsLoading}
                >
                  <SelectTrigger className="w-full sm:w-[220px] bg-background">
                    {phiOptionsLoading ? (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading PHIs…
                      </span>
                    ) : (
                      <SelectValue placeholder="Select a PHI…" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {phiOptions.map((phi) => (
                      <SelectItem key={phi.id} value={phi.id}>
                        {phi.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  onClick={handlePreviewRoute}
                  disabled={!canPreviewRoute || previewLoading}
                  title={
                    selectedIds.size < 1
                      ? "Select at least 1 task"
                      : !selectedPhiId
                        ? "Choose a PHI first"
                        : selectedTasksWithLocation.length < 2
                          ? "Need ≥2 tasks with location to preview route"
                          : undefined
                  }
                >
                  {previewLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Route className="h-4 w-4" />
                  )}
                  <span className="ml-1.5">Preview Route</span>
                </Button>

                {selectedIds.size > 0 && selectedPhiId && selectedTasksWithLocation.length < 2 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleConfirmAssign}
                    disabled={assigning || selectedIds.size === 0 || !selectedPhiId}
                  >
                    {assigning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    <span className="ml-1">Assign</span>
                  </Button>
                )}
              </div>
            </div>
            {selectedIds.size > 0 && selectedTasksWithLocation.length < 2 && selectedTasksWithLocation.length < selectedIds.size && (
              <p className="text-xs text-muted-foreground mt-2">
                {selectedIds.size - selectedTasksWithLocation.length} selected task
                {selectedIds.size - selectedTasksWithLocation.length !== 1 ? "s" : ""} missing
                location — route preview requires ≥2 tasks with coordinates.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tasks View */}
      {viewMode === "map" ? (
        <Card>
          <CardHeader>
            <CardTitle>Tasks Map</CardTitle>
            <CardDescription>
              {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}{" "}
              shown on map
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <TasksMap tasks={filteredTasks} height={500} />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Tasks</CardTitle>
            <CardDescription>
              {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}{" "}
              found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTasks.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    {bulkMode && (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            filteredTasks.length > 0 &&
                            selectedIds.size === filteredTasks.length
                          }
                          onCheckedChange={toggleAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                    )}
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    {!bulkMode && <TableHead className="w-[50px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <TableRow
                      key={task.id}
                      className={
                        bulkMode
                          ? selectedIds.has(task.id)
                            ? "bg-primary/5 cursor-pointer"
                            : "cursor-pointer hover:bg-muted/50"
                          : "cursor-pointer hover:bg-muted/50"
                      }
                      onClick={
                        bulkMode ? () => toggleTask(task.id) : undefined
                      }
                    >
                      {bulkMode && (
                        <TableCell
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={selectedIds.has(task.id)}
                            onCheckedChange={() => toggleTask(task.id)}
                            aria-label={`Select ${task.title}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        {task.title}
                      </TableCell>
                      <TableCell className="capitalize">{task.type}</TableCell>
                      <TableCell>
                        {task.assignedPhi?.name || "Unassigned"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`capitalize font-medium ${getPriorityColor(task.priority)}`}
                        >
                          {task.priority}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(task.status)}>
                          {task.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(task.dueDate)}</TableCell>
                      {!bulkMode && (
                        <TableCell>
                          <Link href={`/supervisor/tasks/${task.id}`}>
                            <Button variant="ghost" size="icon">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No tasks found</p>
                <p className="text-sm mt-1">
                  Try adjusting your filters or create a new task
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Route Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl w-full">
          <DialogHeader>
            <DialogTitle>Route Preview</DialogTitle>
            <DialogDescription>
              Optimized visit order for{" "}
              <span className="font-medium">{selectedPhi?.name}</span> —{" "}
              {selectedIds.size} task{selectedIds.size !== 1 ? "s" : ""}{" "}
              selected
            </DialogDescription>
          </DialogHeader>

          {previewRoute && (
            <RouteMap
              tasks={tasks.filter((t) => selectedIds.has(t.id))}
              routeResult={previewRoute}
              height={420}
              basePath="/supervisor/tasks"
            />
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
              disabled={assigning}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmAssign} disabled={assigning}>
              {assigning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Assign {selectedIds.size} task
              {selectedIds.size !== 1 ? "s" : ""} to {selectedPhi?.name}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
