"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { SocketProvider } from "@/contexts/SocketContext";
import { ThemeToggle } from "@/components/theme-toggle";
import { ConnectionStatus } from "@/components/ui/connection-status";
import {
  Activity,
  LayoutDashboard,
  Users,
  ClipboardCheck,
  BarChart3,
  Settings,
  Bell,
  Menu,
  LogOut,
  MapPin,
  FileText,
  User,
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Determine user role from pathname
  const role = pathname.split("/")[1] || "admin";

  // Navigation items based on role
  const getNavItems = () => {
    const baseItems = [
      { label: "Dashboard", href: `/${role}`, icon: LayoutDashboard },
      { label: "Analytics", href: `/${role}/analytics`, icon: BarChart3 },
    ];

    switch (role) {
      case "admin":
        return [
          ...baseItems,
          { label: "Users", href: "/admin/users", icon: Users },
          { label: "Districts", href: "/admin/districts", icon: MapPin },
          { label: "Reports", href: "/admin/reports", icon: FileText },
          { label: "Settings", href: "/admin/settings", icon: Settings },
        ];
      case "supervisor":
        return [
          ...baseItems,
          { label: "Tasks", href: "/supervisor/tasks", icon: ClipboardCheck },
          { label: "PHIs", href: "/supervisor/phis", icon: Users },
          { label: "Reports", href: "/supervisor/reports", icon: FileText },
        ];
      case "phi":
        return [
          { label: "Dashboard", href: "/phi", icon: LayoutDashboard },
          { label: "My Tasks", href: "/phi/tasks", icon: ClipboardCheck },
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
  };

  const navItems = getNavItems();

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex flex-col h-full ${mobile ? "" : "border-r"}`}>
      {/* Logo */}
      <div className="p-6 border-b">
        <Link href="/" className="flex items-center space-x-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-linear-to-br from-primary to-primary/80 shadow-lg">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <span className="font-bold text-xl">
              Epi<span className="text-primary">Link</span>
            </span>
            <p className="text-xs text-muted-foreground capitalize">
              {user?.name || role}
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => mobile && setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "hover:bg-muted"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t space-y-2">
        <Link
          href="/profile"
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
        >
          <User className="h-5 w-5" />
          <span className="font-medium">Profile</span>
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={logout}
        >
          <LogOut className="h-5 w-5 mr-3" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <ProtectedRoute>
      <SocketProvider>
        <div className="min-h-screen bg-background">
          {/* Desktop Sidebar */}
          <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
            <Sidebar />
          </aside>

          {/* Main Content */}
          <div className="md:pl-64">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
              <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
                {/* Mobile Menu */}
                <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                  <SheetTrigger asChild className="md:hidden">
                    <Button variant="ghost" size="icon">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 w-64">
                    <Sidebar mobile />
                  </SheetContent>
                </Sheet>

                {/* Breadcrumb/Title */}
                <div className="flex-1">
                  <h1 className="text-xl font-semibold capitalize">
                    {pathname.split("/").pop() || role}
                  </h1>
                </div>

                {/* Connection Status */}
                <ConnectionStatus />

                {/* Theme Toggle */}
                <ThemeToggle />

                {/* Notifications */}
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
                </Button>
              </div>
            </header>

            {/* Page Content */}
            <main className="p-4 sm:p-6">{children}</main>
          </div>
        </div>
      </SocketProvider>
    </ProtectedRoute>
  );
}
