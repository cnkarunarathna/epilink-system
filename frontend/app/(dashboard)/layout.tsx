"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { SocketProvider } from "@/contexts/SocketContext";
import { UnreadProvider } from "@/contexts/UnreadContext";
import { ThemeToggle } from "@/components/theme-toggle";
import { ConnectionStatus } from "@/components/ui/connection-status";
import {
  Activity,
  LayoutDashboard,
  Users,
  ClipboardCheck,
  ClipboardList,
  BarChart3,
  Settings,
  Bell,
  Menu,
  LogOut,
  MapPin,
  FileText,
  Mail,
  User,
  ChevronLeft,
  ChevronRight,
  ChevronRight as BreadcrumbChevron,
  Shield,
  MessageSquare,
} from "lucide-react";
import { useUnread } from "@/contexts/UnreadContext";
import { useRouter as useAppRouter } from "next/navigation";
import { useSocketEvent } from "@/hooks/useSocket";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SIDEBAR_STORAGE_KEY = "epilink-sidebar-collapsed";
const EXPANDED_WIDTH = 256;
const COLLAPSED_WIDTH = 68;

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  supervisor: "Supervisor",
  phi: "PHI Officer",
  viewer: "Viewer",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function buildBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];
  let accumulated = "";
  for (const seg of segments) {
    accumulated += `/${seg}`;
    crumbs.push({
      label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "),
      href: accumulated,
    });
  }
  return crumbs;
}

// ─── Nav config ───────────────────────────────────────────────────────────────

function getNavItems(role: string): NavItem[] {
  const baseItems: NavItem[] = [
    { label: "Dashboard", href: `/${role}`, icon: LayoutDashboard },
    { label: "Analytics", href: `/${role}/analytics`, icon: BarChart3 },
  ];

  switch (role) {
    case "admin":
      return [
        ...baseItems,
        {
          label: "Task Analytics",
          href: "/admin/tasks/analytics",
          icon: ClipboardList,
        },
        { label: "Users", href: "/admin/users", icon: Users },
        { label: "Districts", href: "/admin/districts", icon: MapPin },
        { label: "Reports", href: "/admin/reports", icon: FileText },
        { label: "Email", href: "/admin/email", icon: Mail },
        { label: "Settings", href: "/admin/settings", icon: Settings },
      ];
    case "supervisor":
      return [
        ...baseItems,
        { label: "Tasks", href: "/supervisor/tasks", icon: ClipboardCheck },
        { label: "Chats", href: "/supervisor/chats", icon: MessageSquare },
        { label: "PHIs", href: "/supervisor/phis", icon: Users },
        { label: "Reports", href: "/supervisor/reports", icon: FileText },
      ];
    case "phi":
      return [
        { label: "Dashboard", href: "/phi", icon: LayoutDashboard },
        { label: "My Tasks", href: "/phi/tasks", icon: ClipboardCheck },
        { label: "Chats", href: "/phi/chats", icon: MessageSquare },
        { label: "Map View", href: "/phi/map", icon: MapPin },
        { label: "History", href: "/phi/history", icon: FileText },
      ];
    case "viewer":
      return [
        { label: "Overview", href: "/viewer", icon: LayoutDashboard },
        { label: "Analytics", href: "/viewer/analytics", icon: BarChart3 },
        { label: "Reports", href: "/viewer/reports", icon: FileText },
      ];
    default:
      return baseItems;
  }
}

// ─── Sidebar nav item ─────────────────────────────────────────────────────────

function NavLink({
  item,
  isActive,
  collapsed,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const content = (
    <Link
      href={item.href}
      onClick={onClick}
      className={`
        relative flex items-center gap-3 rounded-lg transition-all duration-200 select-none
        ${collapsed ? "justify-center px-0 py-2.5 mx-1" : "px-3 py-2.5 mx-2"}
        ${
          isActive
            ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
        }
      `}
    >
      {/* Active left-border accent (only when expanded) */}
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary-foreground/40" />
      )}

      {/* Icon with dot overlay when collapsed and badge > 0 */}
      <span className="relative shrink-0">
        <item.icon className="h-5 w-5" />
        {collapsed && item.badge && item.badge > 0 && (
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive ring-1 ring-background" />
        )}
      </span>

      {!collapsed && (
        <>
          <span className="font-medium text-sm truncate flex-1">
            {item.label}
          </span>
          {item.badge && item.badge > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

// ─── Desktop sidebar ──────────────────────────────────────────────────────────

function DesktopSidebar({
  collapsed,
  onToggle,
  navItems,
  pathname,
  user,
  role,
  onLogout,
}: {
  collapsed: boolean;
  onToggle: () => void;
  navItems: NavItem[];
  pathname: string;
  user: { name?: string; email?: string } | null;
  role: string;
  onLogout: () => void;
}) {
  const { totalUnread } = useUnread();
  const badgedItems = navItems.map((item) =>
    item.href.endsWith("/chats") ? { ...item, badge: totalUnread } : item,
  );

  return (
    <TooltipProvider delayDuration={300}>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="fixed inset-y-0 left-0 z-30 flex flex-col border-r bg-sidebar overflow-hidden"
      >
        {/* Logo + toggle */}
        <div
          className={`flex items-center border-b h-16 shrink-0 ${
            collapsed ? "justify-center px-3" : "px-4 gap-3"
          }`}
        >
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-linear-to-br from-primary to-primary/70 shadow-lg shrink-0">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="min-w-0"
              >
                <p className="font-bold text-lg leading-none">
                  Epi<span className="text-primary">Link</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {ROLE_LABELS[role] ?? role}
                </p>
              </motion.div>
            )}
          </Link>

          {!collapsed && (
            <button
              onClick={onToggle}
              className="ml-auto p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <div className="flex justify-center py-2 border-b">
            <button
              onClick={onToggle}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {!collapsed && (
            <p className="px-5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Navigation
            </p>
          )}
          {badgedItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={pathname === item.href}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Divider */}
        <div className="border-t" />

        {/* User section */}
        <div className="py-3 space-y-0.5">
          {collapsed ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/profile"
                    className="flex justify-center mx-1 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                  >
                    <User className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Profile
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onLogout}
                    className="flex justify-center w-full mx-1 py-2.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Sign Out
                </TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              {/* User card */}
              <div className="mx-2 mb-1 px-3 py-2.5 rounded-lg bg-muted/50 flex items-center gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate leading-none">
                    {user?.name ?? "User"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {user?.email ?? ROLE_LABELS[role] ?? role}
                  </p>
                </div>
              </div>

              <Link
                href="/profile"
                className="flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors text-sm"
              >
                <User className="h-4 w-4 shrink-0" />
                <span>Profile</span>
              </Link>

              <button
                onClick={onLogout}
                className="flex items-center gap-3 w-full mx-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-sm"
                style={{ width: "calc(100% - 1rem)" }}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Sign Out</span>
              </button>
            </>
          )}
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}

// ─── Mobile sidebar (Sheet) ───────────────────────────────────────────────────

function MobileSidebar({
  open,
  onOpenChange,
  navItems,
  pathname,
  user,
  role,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  navItems: NavItem[];
  pathname: string;
  user: { name?: string; email?: string } | null;
  role: string;
  onLogout: () => void;
}) {
  const { totalUnread } = useUnread();
  const badgedItems = navItems.map((item) =>
    item.href.endsWith("/chats") ? { ...item, badge: totalUnread } : item,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild className="md:hidden">
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-64 bg-sidebar">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-4 h-16 border-b shrink-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-linear-to-br from-primary to-primary/70 shadow-lg">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold text-lg leading-none">
                Epi<span className="text-primary">Link</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {ROLE_LABELS[role] ?? role}
              </p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
            <p className="px-5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Navigation
            </p>
            {badgedItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={pathname === item.href}
                collapsed={false}
                onClick={() => onOpenChange(false)}
              />
            ))}
          </nav>

          <div className="border-t" />

          {/* User section */}
          <div className="py-3 space-y-0.5">
            <div className="mx-2 mb-1 px-3 py-2.5 rounded-lg bg-muted/50 flex items-center gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                  {getInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate leading-none">
                  {user?.name ?? "User"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {ROLE_LABELS[role] ?? role}
                </p>
              </div>
            </div>

            <Link
              href="/profile"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors text-sm"
            >
              <User className="h-4 w-4 shrink-0" />
              <span>Profile</span>
            </Link>

            <button
              onClick={() => {
                onOpenChange(false);
                onLogout();
              }}
              className="flex items-center gap-3 w-full mx-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-sm"
              style={{ width: "calc(100% - 1rem)" }}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

function Breadcrumbs({ pathname }: { pathname: string }) {
  const crumbs = buildBreadcrumbs(pathname);
  return (
    <nav
      className="flex items-center gap-1 text-sm min-w-0"
      aria-label="Breadcrumb"
    >
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1 min-w-0">
          {i > 0 && (
            <BreadcrumbChevron className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          {i === crumbs.length - 1 ? (
            <span className="font-semibold text-foreground truncate">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="text-muted-foreground hover:text-foreground transition-colors truncate"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

// ─── Notification Bell ────────────────────────────────────────────────────────

function NotificationBell({ role }: { role: string }) {
  const { totalUnread, counts } = useUnread();
  const router = useAppRouter();

  const handleClick = () => {
    const chatsPath = `/${role}/chats`;
    if (totalUnread > 0) {
      const topTaskId = Object.entries(counts).sort(
        ([, a], [, b]) => b - a,
      )[0]?.[0];
      if (topTaskId) {
        router.push(`${chatsPath}?task=${topTaskId}`);
        return;
      }
    }
    router.push(chatsPath);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={
        totalUnread > 0 ? `${totalUnread} unread messages` : "Notifications"
      }
      onClick={handleClick}
    >
      <Bell className="h-5 w-5" />
      {totalUnread > 0 ? (
        <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background">
          {totalUnread > 99 ? "99+" : totalUnread}
        </span>
      ) : (
        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
      )}
    </Button>
  );
}

// ─── Broadcast listener (6.5) ─────────────────────────────────────────────────

interface BroadcastEvent {
  senderName: string;
  districtName: string;
  content: string;
  sentAt: string;
}

function BroadcastListener() {
  useSocketEvent<BroadcastEvent>(
    "chat:broadcast",
    (data) => {
      toast.info(`📢 ${data.senderName}: ${data.content}`, {
        duration: 8000,
        description: `District broadcast — ${data.districtName}`,
      });
    },
    [],
  );
  return null;
}

// ─── Root layout ──────────────────────────────────────────────────────────────

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const pathname = usePathname();
  const { user, logout } = useAuth();

  const role = pathname.split("/")[1] || "admin";
  const isChatsRoute = pathname.includes("/chats");
  const navItems = getNavItems(role);

  // Restore collapsed state from localStorage after mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored !== null) setCollapsed(stored === "true");
    } catch {}
    setMounted(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  // Keyboard shortcut: ⌘B / Ctrl+B
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleCollapsed]);

  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <ProtectedRoute>
      <SocketProvider>
        <UnreadProvider>
          <BroadcastListener />
          <div className="min-h-screen bg-background">
            {/* Desktop sidebar */}
            <div className="hidden md:block">
              {mounted && (
                <DesktopSidebar
                  collapsed={collapsed}
                  onToggle={toggleCollapsed}
                  navItems={navItems}
                  pathname={pathname}
                  user={user}
                  role={role}
                  onLogout={logout}
                />
              )}
            </div>

            {/* Main content — shifts with sidebar */}
            <motion.div
              initial={false}
              animate={{ paddingLeft: mounted ? sidebarWidth : EXPANDED_WIDTH }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className={cn(
                "hidden md:flex md:flex-col",
                isChatsRoute ? "h-screen overflow-hidden" : "min-h-screen",
              )}
            >
              {/* Header */}
              <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 h-16 shrink-0">
                <div className="flex h-full items-center gap-4 px-5">
                  {/* Role badge */}
                  <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
                    <Shield className="h-3 w-3" />
                    {ROLE_LABELS[role] ?? role}
                  </span>

                  {/* Breadcrumbs */}
                  <div className="flex-1 min-w-0">
                    <Breadcrumbs pathname={pathname} />
                  </div>

                  <ConnectionStatus />
                  <ThemeToggle />

                  {/* Notifications */}
                  <NotificationBell role={role} />

                  {/* User avatar */}
                  <Avatar className="h-8 w-8 cursor-pointer">
                    <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                      {getInitials(user?.name)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </header>

              {/* Page content */}
              <main
                className={cn(
                  "flex-1 min-h-0 flex flex-col p-4 sm:p-6",
                  isChatsRoute ? "overflow-hidden" : "overflow-auto",
                )}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={pathname}
                    className={cn(
                      isChatsRoute
                        ? "flex-1 min-h-0 flex flex-col overflow-hidden"
                        : "h-full",
                    )}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                  >
                    {children}
                  </motion.div>
                </AnimatePresence>
              </main>
            </motion.div>

            {/* Mobile layout */}
            <div className={cn("md:hidden flex flex-col", isChatsRoute ? "h-screen overflow-hidden" : "min-h-screen")}>
              <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 h-16">
                <div className="flex h-full items-center gap-3 px-4">
                  <MobileSidebar
                    open={sidebarOpen}
                    onOpenChange={setSidebarOpen}
                    navItems={navItems}
                    pathname={pathname}
                    user={user}
                    role={role}
                    onLogout={logout}
                  />

                  <div className="flex-1 min-w-0">
                    <Breadcrumbs pathname={pathname} />
                  </div>

                  <ConnectionStatus />
                  <ThemeToggle />

                  <NotificationBell role={role} />
                </div>
              </header>

              <main
                className={cn(
                  "flex-1 min-h-0 flex flex-col p-4",
                  isChatsRoute ? "overflow-hidden" : "overflow-auto",
                )}
              >
                {children}
              </main>
            </div>
          </div>
        </UnreadProvider>
      </SocketProvider>
    </ProtectedRoute>
  );
}
