import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { BarChart3, FileText, LayoutDashboard, LogOut, Plug, Users2, type LucideIcon } from "lucide-react";
import { GridBackground } from "@/components/shared/GridBackground";
import { Logo } from "@/components/shared/Logo";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/context/AppContext";
import { cn, initials } from "@/lib/utils";

function NavItem({ to, icon: Icon, children }: { to: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
          isActive ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
        )
      }
    >
      <Icon className="h-4 w-4" />
      {children}
    </NavLink>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAppData();
  const [loggingOut, setLoggingOut] = useState(false);

  async function onLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <GridBackground />

      <header className="sticky top-0 z-20 border-b border-white/5 bg-zinc-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <Logo showText={false} />
            <span className="text-zinc-700">/</span>
            <WorkspaceSwitcher />
          </div>

          <div className="flex items-center gap-2">
            <nav className="mr-1 hidden items-center gap-1 sm:flex">
              <NavItem to="/dashboard" icon={LayoutDashboard}>
                Overview
              </NavItem>
              <NavItem to="/posts" icon={FileText}>
                Posts
              </NavItem>
              <NavItem to="/analytics" icon={BarChart3}>
                Analytics
              </NavItem>
              <NavItem to="/connections" icon={Plug}>
                Connections
              </NavItem>
              <NavItem to="/members" icon={Users2}>
                Members
              </NavItem>
            </nav>
            {user && (
              <div
                className="hidden h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[11px] font-semibold text-white sm:flex"
                title={user.name}
              >
                {initials(user.name)}
              </div>
            )}
            <Button variant="outline" size="sm" loading={loggingOut} onClick={onLogout}>
              {!loggingOut && <LogOut className="h-4 w-4" />}
              <span className="hidden sm:inline">{loggingOut ? "Signing out..." : "Sign out"}</span>
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-white/5 px-5 py-2 sm:hidden">
          <NavItem to="/dashboard" icon={LayoutDashboard}>
            Overview
          </NavItem>
          <NavItem to="/posts" icon={FileText}>
            Posts
          </NavItem>
          <NavItem to="/analytics" icon={BarChart3}>
            Analytics
          </NavItem>
          <NavItem to="/members" icon={Users2}>
            Members
          </NavItem>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">{children}</main>
    </div>
  );
}
