import { useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { BarChart3, CreditCard, Crown, FileText, LayoutDashboard, LogOut, Plug, UserRound, Users2, type LucideIcon } from "lucide-react";
import { GridBackground } from "@/components/shared/GridBackground";
import { Logo } from "@/components/shared/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Footer } from "@/components/layout/Footer";
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
          isActive ? "bg-surface-hover text-ink" : "text-muted hover:bg-surface hover:text-ink"
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
    <div className="relative flex min-h-screen flex-col">
      <GridBackground />

      <header className="sticky top-0 z-20 border-b border-line bg-canvas/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <Logo showText={false} />
            <span className="text-faint">/</span>
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
              <NavItem to="/billing" icon={CreditCard}>
                Billing
              </NavItem>
            </nav>
            {user?.plan === "pro" && (
              <span className="hidden items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300 sm:inline-flex">
                <Crown className="h-3 w-3" /> Pro
              </span>
            )}
            <ThemeToggle />
            {user && (
              <Link
                to="/account"
                title="Account settings"
                className="hidden rounded-full ring-offset-2 ring-offset-canvas transition-shadow hover:ring-2 hover:ring-violet-500/50 sm:block"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="h-8 w-8 rounded-full border border-line object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[11px] font-semibold text-white">
                    {initials(user.name)}
                  </span>
                )}
              </Link>
            )}
            <Button variant="outline" size="sm" loading={loggingOut} onClick={onLogout}>
              {!loggingOut && <LogOut className="h-4 w-4" />}
              <span className="hidden sm:inline">{loggingOut ? "Signing out..." : "Sign out"}</span>
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-line px-5 py-2 sm:hidden">
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
          <NavItem to="/billing" icon={CreditCard}>
            Billing
          </NavItem>
          <NavItem to="/account" icon={UserRound}>
            Account
          </NavItem>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8">{children}</main>

      <Footer />
    </div>
  );
}
