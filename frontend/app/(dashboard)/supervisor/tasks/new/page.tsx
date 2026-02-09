"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import {
  createTask,
  TaskType,
  TaskPriority,
  fetchPhisByDistrict,
} from "@/services/tasks.service";
import { fetchLatestPerDistrict } from "@/services/analytics.service";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function CreateTaskPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [phis, setPhis] = useState<
    { id: string; name: string; email: string }[]
  >([]);
  const [districts, setDistricts] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [loadingPhis, setLoadingPhis] = useState(true);

  const supervisorDistrict = user?.district || "Colombo";

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    type: TaskType.INSPECTION,
    priority: TaskPriority.MEDIUM,
    description: "",
    address: "",
    districtId: 0,
    assignedPhiId: "",
    dueDate: "",
    notes: "",
  });

  useEffect(() => {
    async function loadData() {
      setLoadingPhis(true);
      try {
        // Fetch PHIs for supervisor's district
        const phisData = await fetchPhisByDistrict(supervisorDistrict);
        setPhis(phisData);

        // Fetch districts for district selector
        const districtsData = await fetchLatestPerDistrict();
        const districtList = districtsData.map((d, idx) => ({
          id: idx + 1, // Assuming sequential IDs
          name: d.district,
        }));
        setDistricts(districtList);

        // Set default district
        const myDistrict = districtList.find(
          (d) => d.name.toLowerCase() === supervisorDistrict.toLowerCase(),
        );
        if (myDistrict) {
          setFormData((prev) => ({ ...prev, districtId: myDistrict.id }));
        }
      } catch (error) {
        console.error("Failed to load data:", error);
        toast.error("Failed to load PHIs");
      } finally {
        setLoadingPhis(false);
      }
    }
    loadData();
  }, [supervisorDistrict]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!formData.districtId) {
      toast.error("District is required");
      return;
    }

    setLoading(true);
    try {
      await createTask({
        title: formData.title,
        type: formData.type,
        priority: formData.priority,
        description: formData.description || undefined,
        address: formData.address || undefined,
        districtId: formData.districtId,
        assignedPhiId: formData.assignedPhiId || undefined,
        dueDate: formData.dueDate || undefined,
        notes: formData.notes || undefined,
      });
      toast.success("Task created successfully");
      router.push("/supervisor/tasks");
    } catch (error: any) {
      console.error("Failed to create task:", error);
      toast.error(error.response?.data?.message || "Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/supervisor/tasks">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Create Task</h2>
          <p className="text-muted-foreground">Assign a new task to a PHI</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Task title, type, and priority</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Cleanup at Main Street"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Task Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) =>
                    setFormData({ ...formData, type: v as TaskType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TaskType.CLEANUP}>Cleanup</SelectItem>
                    <SelectItem value={TaskType.FOGGING}>Fogging</SelectItem>
                    <SelectItem value={TaskType.INSPECTION}>
                      Inspection
                    </SelectItem>
                    <SelectItem value={TaskType.INVESTIGATION}>
                      Investigation
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) =>
                    setFormData({ ...formData, priority: v as TaskPriority })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TaskPriority.LOW}>Low</SelectItem>
                    <SelectItem value={TaskPriority.MEDIUM}>Medium</SelectItem>
                    <SelectItem value={TaskPriority.HIGH}>High</SelectItem>
                    <SelectItem value={TaskPriority.URGENT}>Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the task details..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Assignment & Location */}
          <Card>
            <CardHeader>
              <CardTitle>Assignment & Location</CardTitle>
              <CardDescription>Assign PHI and set location</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="district">District *</Label>
                <Select
                  value={formData.districtId.toString()}
                  onValueChange={(v) =>
                    setFormData({ ...formData, districtId: parseInt(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map((d) => (
                      <SelectItem key={d.id} value={d.id.toString()}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phi">Assign to PHI</Label>
                <Select
                  value={formData.assignedPhiId}
                  onValueChange={(v) =>
                    setFormData({ ...formData, assignedPhiId: v })
                  }
                  disabled={loadingPhis}
                >
                  <SelectTrigger>
                    {loadingPhis ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SelectValue placeholder="Select PHI (optional)" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {phis.map((phi) => (
                      <SelectItem key={phi.id} value={phi.id}>
                        {phi.name} ({phi.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {phis.length === 0 && !loadingPhis && (
                  <p className="text-xs text-muted-foreground">
                    No PHIs available in {supervisorDistrict}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="e.g., 123 Main Street, Colombo 01"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) =>
                    setFormData({ ...formData, dueDate: e.target.value })
                  }
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional notes for the PHI..."
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4 mt-6">
          <Link href="/supervisor/tasks">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Create Task
          </Button>
        </div>
      </form>
    </div>
  );
}
