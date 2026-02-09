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
} from "lucide-react";
import {
  fetchPhisByDistrict,
  fetchTasks,
  Task,
  TaskStatus,
} from "@/services/tasks.service";
import usersService from "@/services/users.service";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface PhiWithStats {
  id: string;
  name: string;
  email: string;
  tasksAssigned: number;
  tasksCompleted: number;
  tasksPending: number;
}

export default function PhisPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [phis, setPhis] = useState<PhiWithStats[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const supervisorDistrict = user?.district || "Colombo";

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
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create PHI user");
    } finally {
      setSubmitting(false);
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
                    <Badge
                      variant={
                        phi.tasksPending > 5 ? "destructive" : "secondary"
                      }
                    >
                      {phi.tasksPending > 5
                        ? "High Load"
                        : phi.tasksPending > 0
                          ? "Active"
                          : "Available"}
                    </Badge>
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
    </div>
  );
}
