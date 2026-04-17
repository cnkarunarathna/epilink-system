"use client";

import { useState, useEffect, useCallback } from "react";
import { useSocketEvent } from "@/hooks/useSocket";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StatCard } from "@/components/dashboard/shared/StatCard";
import {
  UserPlus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  Users,
  UserCheck,
  Shield,
  MapPin,
  X,
} from "lucide-react";
import { toast } from "sonner";
import usersService, {
  User,
  CreateUserData,
  UpdateUserData,
  UserStats,
} from "@/services/users.service";
import { fetchLatestPerDistrict } from "@/services/analytics.service";

// ─── Role config ──────────────────────────────────────────────────────────────

type Role = "admin" | "supervisor" | "phi" | "viewer";

const ROLE_CONFIG: Record<
  Role,
  { label: string; color: string; avatarBg: string; avatarText: string }
> = {
  admin: {
    label: "Admin",
    color: "bg-destructive/10 text-destructive border-destructive/20",
    avatarBg: "bg-destructive/15",
    avatarText: "text-destructive",
  },
  supervisor: {
    label: "Supervisor",
    color: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400",
    avatarBg: "bg-sky-500/15",
    avatarText: "text-sky-600",
  },
  phi: {
    label: "PHI",
    color:
      "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
    avatarBg: "bg-emerald-500/15",
    avatarText: "text-emerald-600",
  },
  viewer: {
    label: "Viewer",
    color: "bg-muted text-muted-foreground border-border",
    avatarBg: "bg-muted",
    avatarText: "text-muted-foreground",
  },
};

const ROLE_FILTERS = ["all", "admin", "supervisor", "phi", "viewer"] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function TableSkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-10 rounded-full" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="h-7 w-7 ml-auto rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [districts, setDistricts] = useState<string[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateUserData>({
    name: "",
    email: "",
    password: "",
    role: "viewer",
    district: "",
  });
  const [editFormData, setEditFormData] = useState<UpdateUserData>({
    name: "",
    email: "",
    role: "viewer",
    district: "",
  });

  useEffect(() => {
    loadData();
    loadDistricts();
  }, []);

  const loadDistricts = async () => {
    try {
      const data = await fetchLatestPerDistrict();
      setDistricts(data.map((d) => d.district));
    } catch {}
  };

  // ── WebSocket handlers ────────────────────────────────────────────────────

  const handleUserCreated = useCallback((newUser: User) => {
    setUsers((prev) => [newUser, ...prev]);
    setStats((prev) =>
      prev
        ? {
            ...prev,
            totalUsers: prev.totalUsers + 1,
            activeUsers: newUser.isActive
              ? prev.activeUsers + 1
              : prev.activeUsers,
            usersByRole: {
              ...prev.usersByRole,
              [newUser.role]:
                (prev.usersByRole[
                  newUser.role as keyof typeof prev.usersByRole
                ] || 0) + 1,
            },
          }
        : null,
    );
    toast.success("New user added", {
      description: `${newUser.name} has been created`,
    });
  }, []);

  const handleUserUpdated = useCallback((updatedUser: User) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
    );
  }, []);

  const handleUserDeleted = useCallback(({ id }: { id: string }) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    usersService.getStats().then(setStats).catch(console.error);
  }, []);

  const handleUserStatusChanged = useCallback(
    ({ id, isActive }: { id: string; isActive: boolean }) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, isActive } : u)),
      );
      setStats((prev) =>
        prev
          ? {
              ...prev,
              activeUsers: isActive
                ? prev.activeUsers + 1
                : prev.activeUsers - 1,
              inactiveUsers: isActive
                ? prev.inactiveUsers - 1
                : prev.inactiveUsers + 1,
            }
          : null,
      );
    },
    [],
  );

  useSocketEvent("user:created", handleUserCreated, [handleUserCreated]);
  useSocketEvent("user:updated", handleUserUpdated, [handleUserUpdated]);
  useSocketEvent("user:deleted", handleUserDeleted, [handleUserDeleted]);
  useSocketEvent("user:status-changed", handleUserStatusChanged, [
    handleUserStatusChanged,
  ]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, statsData] = await Promise.all([
        usersService.getAll(),
        usersService.getStats(),
      ]);
      setUsers(usersData);
      setStats(statsData);
    } catch (error: any) {
      toast.error("Failed to load users", {
        description: error.response?.data?.message || error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (
      (formData.role === "supervisor" || formData.role === "phi") &&
      !formData.district
    ) {
      toast.error(
        `District is required for ${formData.role.toUpperCase()} accounts`,
      );
      return;
    }
    try {
      setSubmitting(true);
      await usersService.create(formData);
      toast.success("User created successfully");
      setOpenCreateDialog(false);
      setFormData({
        name: "",
        email: "",
        password: "",
        role: "viewer",
        district: "",
      });
      loadData();
    } catch (error: any) {
      toast.error("Failed to create user", {
        description: error.response?.data?.message || error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    try {
      setSubmitting(true);
      await usersService.update(selectedUser.id, editFormData);
      toast.success("User updated successfully");
      setOpenEditDialog(false);
      setSelectedUser(null);
      loadData();
    } catch (error: any) {
      toast.error("Failed to update user", {
        description: error.response?.data?.message || error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      setSubmitting(true);
      await usersService.delete(selectedUser.id);
      toast.success("User deleted successfully");
      setOpenDeleteDialog(false);
      setSelectedUser(null);
      loadData();
    } catch (error: any) {
      toast.error("Failed to delete user", {
        description: error.response?.data?.message || error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: User, nextIsActive?: boolean) => {
    const previousIsActive = user.isActive;
    const optimisticIsActive =
      typeof nextIsActive === "boolean" ? nextIsActive : !previousIsActive;

    setTogglingId(user.id);
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, isActive: optimisticIsActive } : u,
      ),
    );

    try {
      const updatedUser = await usersService.toggleStatus(user.id);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, ...updatedUser } : u)),
      );
      toast.success(
        `User ${updatedUser.isActive ? "activated" : "deactivated"} successfully`,
      );
    } catch (error: any) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, isActive: previousIsActive } : u,
        ),
      );
      toast.error("Failed to update user status", {
        description: error.response?.data?.message || error.message,
      });
    } finally {
      setTogglingId(null);
      usersService.getStats().then(setStats).catch(console.error);
    }
  };

  const openEditUserDialog = (user: User) => {
    setSelectedUser(user);
    setEditFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      district: user.district || "",
    });
    setOpenEditDialog(true);
  };

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filteredUsers = users.filter((user) => {
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      user.name.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      user.role.toLowerCase().includes(q);
    return matchesRole && matchesSearch;
  });

  const activeRate =
    stats && stats.totalUsers > 0
      ? ((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)
      : "0";

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              User Management
            </h2>
            <p className="text-sm text-muted-foreground">
              Create and manage system users with role-based access
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>

            {/* Create user dialog */}
            <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Create User
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>
                    Add a new user with role-based permissions
                  </DialogDescription>
                </DialogHeader>
                <UserForm
                  data={formData}
                  onChange={(patch) => setFormData((p) => ({ ...p, ...patch }))}
                  districts={districts}
                  showPassword
                />
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setOpenCreateDialog(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateUser} disabled={submitting}>
                    {submitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create User
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Users"
            value={stats?.totalUsers ?? 0}
            description={`${stats?.activeUsers ?? 0} active`}
            icon={Users}
            iconColor="text-primary bg-primary/10"
            accent="primary"
            loading={loading}
          />
          <StatCard
            title="Active Rate"
            value={loading ? "—" : `${activeRate}%`}
            description="Users currently active"
            icon={UserCheck}
            iconColor="text-green-600 bg-green-500/10"
            accent="success"
            loading={loading}
          />
          <StatCard
            title="Supervisors"
            value={stats?.usersByRole?.supervisor ?? 0}
            description="Regional managers"
            icon={Shield}
            iconColor="text-sky-600 bg-sky-500/10"
            accent="info"
            loading={loading}
          />
          <StatCard
            title="PHI Officers"
            value={stats?.usersByRole?.phi ?? 0}
            description="Field officers"
            icon={MapPin}
            iconColor="text-emerald-600 bg-emerald-500/10"
            accent="success"
            loading={loading}
          />
        </div>

        {/* ── User table ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base">All Users</CardTitle>
                <CardDescription>
                  {loading
                    ? "Loading…"
                    : `${filteredUsers.length} of ${users.length} user${users.length !== 1 ? "s" : ""}`}
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search by name, email, role…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-8 h-9 text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Role filter chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ROLE_FILTERS.map((r) => {
                const isActive = roleFilter === r;
                const count =
                  r === "all"
                    ? users.length
                    : users.filter((u) => u.role === r).length;
                return (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {r === "all" ? "All roles" : ROLE_CONFIG[r as Role].label}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        isActive ? "bg-primary-foreground/20" : "bg-muted"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>District</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableSkeletonRows />
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="flex flex-col items-center justify-center py-14 text-center gap-2">
                        <span className="flex items-center justify-center h-12 w-12 rounded-full bg-muted mb-1">
                          <Users className="h-5 w-5 text-muted-foreground" />
                        </span>
                        <p className="text-sm font-medium text-muted-foreground">
                          {searchQuery || roleFilter !== "all"
                            ? "No users match your filters"
                            : "No users yet"}
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          {searchQuery || roleFilter !== "all"
                            ? "Try clearing the search or changing the role filter"
                            : "Create the first user to get started"}
                        </p>
                        {(searchQuery || roleFilter !== "all") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 text-xs"
                            onClick={() => {
                              setSearchQuery("");
                              setRoleFilter("all");
                            }}
                          >
                            Clear filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const roleCfg =
                      ROLE_CONFIG[user.role as Role] ?? ROLE_CONFIG.viewer;
                    const isToggling = togglingId === user.id;
                    return (
                      <TableRow key={user.id} className="group">
                        {/* User */}
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 shrink-0">
                              <AvatarFallback
                                className={`text-xs font-semibold ${roleCfg.avatarBg} ${roleCfg.avatarText}`}
                              >
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-none truncate">
                                {user.name}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        {/* Role */}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs font-medium ${roleCfg.color}`}
                          >
                            {roleCfg.label}
                          </Badge>
                        </TableCell>

                        {/* District */}
                        <TableCell>
                          {user.district ? (
                            <span className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                              {user.district}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>

                        {/* Active toggle */}
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center">
                                <Switch
                                  checked={user.isActive}
                                  onCheckedChange={(checked) =>
                                    handleToggleStatus(user, checked)
                                  }
                                  disabled={isToggling}
                                  aria-label={
                                    user.isActive
                                      ? "Deactivate user"
                                      : "Activate user"
                                  }
                                  className="scale-90"
                                />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {user.isActive
                                ? "Click to deactivate"
                                : "Click to activate"}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right pr-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="User actions"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                                {user.name}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openEditUserDialog(user)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(user)}
                                disabled={isToggling}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                {user.isActive ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setOpenDeleteDialog(true);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ── Edit dialog ── */}
        <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update information and permissions
              </DialogDescription>
            </DialogHeader>
            <UserForm
              data={editFormData}
              onChange={(patch) => setEditFormData((p) => ({ ...p, ...patch }))}
              districts={districts}
              showPassword
              passwordOptional
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpenEditDialog(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleEditUser} disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete dialog ── */}
        <AlertDialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete user?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove{" "}
                <span className="font-semibold text-foreground">
                  {selectedUser?.name}
                </span>{" "}
                and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteUser}
                disabled={submitting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}

// ─── Shared form ──────────────────────────────────────────────────────────────

interface UserFormProps {
  data: Partial<CreateUserData & UpdateUserData>;
  onChange: (patch: Partial<CreateUserData & UpdateUserData>) => void;
  districts: string[];
  showPassword?: boolean;
  passwordOptional?: boolean;
}

function UserForm({
  data,
  onChange,
  districts,
  showPassword,
  passwordOptional,
}: UserFormProps) {
  const needsDistrict = data.role === "supervisor" || data.role === "phi";

  return (
    <div className="grid gap-4 py-2">
      <div className="grid gap-1.5">
        <Label htmlFor="uf-name">
          Full Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="uf-name"
          placeholder="John Doe"
          value={data.name ?? ""}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="uf-email">
          Email <span className="text-destructive">*</span>
        </Label>
        <Input
          id="uf-email"
          type="email"
          placeholder="john@health.lk"
          value={data.email ?? ""}
          onChange={(e) => onChange({ email: e.target.value })}
        />
      </div>

      {showPassword && (
        <div className="grid gap-1.5">
          <Label htmlFor="uf-password">
            Password{" "}
            {passwordOptional ? (
              <span className="text-muted-foreground font-normal">
                (leave blank to keep current)
              </span>
            ) : (
              <span className="text-destructive">*</span>
            )}
          </Label>
          <Input
            id="uf-password"
            type="password"
            placeholder={
              passwordOptional
                ? "Leave blank to keep current"
                : "Min. 6 characters"
            }
            value={(data as any).password ?? ""}
            onChange={(e) => onChange({ password: e.target.value } as any)}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="uf-role">
            Role <span className="text-destructive">*</span>
          </Label>
          <Select
            value={data.role ?? "viewer"}
            onValueChange={(v) => onChange({ role: v as any })}
          >
            <SelectTrigger id="uf-role">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="supervisor">Supervisor</SelectItem>
              <SelectItem value="phi">PHI</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="uf-district">
            District{" "}
            {needsDistrict ? (
              <span className="text-destructive">*</span>
            ) : (
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            )}
          </Label>
          <Select
            value={data.district || "none"}
            onValueChange={(v) => onChange({ district: v === "none" ? "" : v })}
          >
            <SelectTrigger id="uf-district">
              <SelectValue placeholder="Select district" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {districts.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
