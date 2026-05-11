"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  RefreshCw,
  Loader2,
  Mail,
  ClipboardList,
  CheckCircle2,
  Clock,
  UserPlus,
  Edit,
  Trash2,
  Ban,
  CheckCircle,
  MoreVertical,
  BarChart3,
} from "lucide-react";
import {
  fetchPhisByDistrict,
  fetchTasks,
  Task,
  TaskStatus,
} from "@/services/tasks.service";
import usersService from "@/services/users.service";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { toast } from "sonner";
import { DISTRICTS } from "@/lib/constants/districts";
import PhiSummaryBar from "@/components/dashboard/phi/PhiSummaryBar";
import PhiWorkloadChart from "@/components/dashboard/phi/PhiWorkloadChart";
import PhiSparkline from "@/components/dashboard/phi/PhiSparkline";

interface PhiWithStats {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  tasksAssigned: number;
  tasksCompleted: number;
  tasksPending: number;
}

export default function PhisPage() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [phis, setPhis] = useState<PhiWithStats[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPhi, setSelectedPhi] = useState<PhiWithStats | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const supervisorDistrict = user?.district || "Colombo";
  const districtId =
    DISTRICTS.find((d) => d.name.toLowerCase() === supervisorDistrict.toLowerCase())?.id ?? 1;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [phisData, tasksData] = await Promise.all([
        fetchPhisByDistrict(supervisorDistrict),
        fetchTasks(),
      ]);

      // Calculate stats for each PHI
      const phisWithStats = phisData.map((phi) => {
        const phiTasks = tasksData.filter((t) => t.assignedPhiId === phi.id);
        return {
          ...phi,
          tasksAssigned: phiTasks.length,
          tasksCompleted: phiTasks.filter(
            (t) => t.status === TaskStatus.COMPLETED,
          ).length,
          tasksPending: phiTasks.filter(
            (t) =>
              ![TaskStatus.COMPLETED, TaskStatus.REJECTED].includes(t.status),
          ).length,
        };
      });

      setPhis(phisWithStats);
    } catch (error) {
      console.error("Failed to load PHIs:", error);
      toast.error("Failed to load PHI data");
    } finally {
      setLoading(false);
    }
  }, [supervisorDistrict]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // WebSocket event listeners for real-time updates
  useEffect(() => {
    if (!socket) return;

    // Listen for user created events
    socket.on("user:created", (newUser: any) => {
      if (newUser.role === "phi" && newUser.district === supervisorDistrict) {
        // Add new PHI to list with default stats
        setPhis((prev) => [
          {
            ...newUser,
            tasksAssigned: 0,
            tasksCompleted: 0,
            tasksPending: 0,
          },
          ...prev,
        ]);
      }
    });

    // Listen for user updated events
    socket.on("user:updated", (updatedUser: any) => {
      setPhis((prev) =>
        prev.map((phi) =>
          phi.id === updatedUser.id ? { ...phi, ...updatedUser } : phi,
        ),
      );
    });

    // Listen for user status changed events
    socket.on(
      "user:status-changed",
      (data: { id: string; isActive: boolean }) => {
        setPhis((prev) =>
          prev.map((phi) =>
            phi.id === data.id ? { ...phi, isActive: data.isActive } : phi,
          ),
        );
      },
    );

    // Listen for user deleted events
    socket.on("user:deleted", (userId: string) => {
      setPhis((prev) => prev.filter((phi) => phi.id !== userId));
    });

    return () => {
      socket.off("user:created");
      socket.off("user:updated");
      socket.off("user:status-changed");
      socket.off("user:deleted");
    };
  }, [socket, supervisorDistrict]);

  const handleCreatePhi = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast.error("Please fill in all fields");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setSubmitting(true);
      await usersService.createPhi(formData);
      toast.success("PHI user created successfully");
      setOpenDialog(false);
      setFormData({ name: "", email: "", password: "" });
      // No need to reload - WebSocket will update automatically
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create PHI user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (phi: PhiWithStats) => {
    setSelectedPhi(phi);
    setEditFormData({
      name: phi.name,
      email: phi.email,
      password: "",
    });
    setOpenEditDialog(true);
  };

  const handleEditPhi = async () => {
    if (!selectedPhi) return;

    if (!editFormData.name || !editFormData.email) {
      toast.error("Name and email are required");
      return;
    }

    if (editFormData.password && editFormData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setSubmitting(true);
      const updateData: any = {
        name: editFormData.name,
        email: editFormData.email,
      };
      if (editFormData.password) {
        updateData.password = editFormData.password;
      }
      await usersService.updatePhi(selectedPhi.id, updateData);
      toast.success("PHI updated successfully");
      setOpenEditDialog(false);
      setSelectedPhi(null);
      // No need to reload - WebSocket will update automatically
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update PHI");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (phi: PhiWithStats) => {
    setSelectedPhi(phi);
    setOpenDeleteDialog(true);
  };

  const handleDeletePhi = async () => {
    if (!selectedPhi) return;

    try {
      setSubmitting(true);
      await usersService.deletePhi(selectedPhi.id);
      toast.success("PHI deleted successfully");
      setOpenDeleteDialog(false);
      setSelectedPhi(null);
      // No need to reload - WebSocket will update automatically
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete PHI");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (phi: PhiWithStats) => {
    try {
      await usersService.togglePhiStatus(phi.id);
      toast.success(
        `PHI ${phi.isActive ? "suspended" : "activated"} successfully`,
      );
      // No need to reload - WebSocket will update automatically
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to update PHI status",
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">PHI Management</h2>
          <p className="text-muted-foreground">
            Public Health Inspectors in {supervisorDistrict} District
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setOpenDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add PHI
          </Button>
          <Button variant="outline" onClick={loadData} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* PHI Summary Bar */}
      {!loading && <PhiSummaryBar phis={phis} />}

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total PHIs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                phis.length
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Assigned Tasks
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                phis.reduce((sum, p) => sum + p.tasksAssigned, 0)
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completion Rate
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                (() => {
                  const total = phis.reduce(
                    (sum, p) => sum + p.tasksAssigned,
                    0,
                  );
                  const completed = phis.reduce(
                    (sum, p) => sum + p.tasksCompleted,
                    0,
                  );
                  return total > 0
                    ? `${Math.round((completed / total) * 100)}%`
                    : "N/A";
                })()
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PHI Workload Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-orange-500" />
            PHI Workload Comparison
          </CardTitle>
          <CardDescription>
            Completed vs remaining tasks per PHI in {supervisorDistrict}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PhiWorkloadChart districtId={districtId} />
        </CardContent>
      </Card>

      {/* PHI List */}
      <Card>
        <CardHeader>
          <CardTitle>PHI List</CardTitle>
          <CardDescription>All PHIs and their current workload</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : phis.length > 0 ? (
            <div className="space-y-4">
              {phis.map((phi) => (
                <div
                  key={phi.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{phi.name}</p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {phi.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-lg font-semibold">
                        {phi.tasksAssigned}
                      </p>
                      <p className="text-xs text-muted-foreground">Assigned</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-yellow-600">
                        {phi.tasksPending}
                      </p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-green-600">
                        {phi.tasksCompleted}
                      </p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                    <div className="hidden md:flex flex-col items-center gap-0.5">
                      <PhiSparkline phiId={phi.id} />
                      <p className="text-xs text-muted-foreground">Trend</p>
                    </div>
                    <Badge
                      variant={
                        !phi.isActive
                          ? "destructive"
                          : phi.tasksPending > 5
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {!phi.isActive
                        ? "Suspended"
                        : phi.tasksPending > 5
                          ? "High Load"
                          : phi.tasksPending > 0
                            ? "Active"
                            : "Available"}
                    </Badge>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditClick(phi)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleStatus(phi)}
                      >
                        {phi.isActive ? (
                          <Ban className="h-4 w-4" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteClick(phi)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No PHIs found in {supervisorDistrict}</p>
              <p className="text-sm mt-1">
                Contact admin to add PHIs to your district
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create PHI Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New PHI</DialogTitle>
            <DialogDescription>
              Create a new Public Health Inspector account for{" "}
              {supervisorDistrict} district
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                placeholder="Enter full name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="phi@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 6 characters"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="district">District</Label>
              <Input
                id="district"
                value={supervisorDistrict}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                PHI will be automatically assigned to your district
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenDialog(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleCreatePhi} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create PHI"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit PHI Dialog */}
      <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit PHI</DialogTitle>
            <DialogDescription>Update PHI user details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                placeholder="Enter full name"
                value={editFormData.name}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="phi@example.com"
                value={editFormData.email}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Password</Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="Leave empty to keep current password"
                value={editFormData.password}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, password: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Only fill this if you want to change the password
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenEditDialog(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleEditPhi} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update PHI"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete PHI</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedPhi?.name}? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenDeleteDialog(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePhi}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete PHI"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
