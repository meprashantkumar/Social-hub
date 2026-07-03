import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Crown,
  PenLine,
  Plug,
  Share2,
  ShieldCheck,
  UserPlus,
  Users2,
  type LucideIcon,
} from "lucide-react";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/context/AppContext";
import { workspaceApi, type WorkspaceDetail } from "@/lib/api";
import { formatDate, initials } from "@/lib/utils";

interface QuickAction {
  icon: LucideIcon;
  title: string;
  desc: string;
  to: string;
}
const QUICK_ACTIONS: QuickAction[] = [
  { icon: PenLine, title: "Compose a post", desc: "Write once, publish everywhere.", to: "/posts/new" },
  { icon: Plug, title: "Connect a platform", desc: "Link your social accounts.", to: "/connections" },
  { icon: UserPlus, title: "Invite your team", desc: "Collaborate in a workspace.", to: "/members" },
  { icon: BarChart3, title: "View analytics", desc: "See how your posts perform.", to: "/analytics" },
];

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
}
const FEATURES: Feature[] = [
  {
    icon: Share2,
    title: "Multi-platform publishing",
    desc: "Push a single post to YouTube, LinkedIn & X from one composer — with Instagram coming soon.",
  },
  {
    icon: CalendarClock,
    title: "Schedule ahead",
    desc: "Queue posts for later and let SocialHub publish them automatically at the right time.",
  },
  {
    icon: Users2,
    title: "Team workspaces",
    desc: "Invite teammates with roles and collaborate on content in a shared workspace.",
  },
  {
    icon: CheckCircle2,
    title: "Review & approve",
    desc: "Move posts through draft → review → approved so nothing goes live by accident.",
  },
  {
    icon: BarChart3,
    title: "Unified analytics",
    desc: "Track views, likes and comments across every connected platform in one place.",
  },
  {
    icon: Crown,
    title: "Pro when you grow",
    desc: "Start free, then upgrade for unlimited workspaces, members and posts.",
  },
];

export function Dashboard() {
  const { user, currentWorkspace } = useAppData();
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);

  useEffect(() => {
    const id = currentWorkspace?.id;
    if (!id) return;
    let cancelled = false;
    setDetail(null);
    workspaceApi
      .get(id)
      .then((r) => !cancelled && setDetail(r.workspace))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentWorkspace?.id]);

  if (!user || !currentWorkspace) return null;

  const firstName = user.name.split(/\s+/)[0];
  const isOwner = currentWorkspace.role === "OWNER";
  const isPro = user.plan === "pro";
  const members = detail?.members ?? [];

  return (
    <div className="space-y-10">
      <div className="animate-fade-up">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          Signed in &amp; session secured
        </div>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-ink">
          Welcome back, {firstName}.
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
          <span>
            Workspace <span className="font-medium text-ink">{currentWorkspace.name}</span>
          </span>
          <span className="text-faint">•</span>
          <span className="inline-flex items-center gap-1.5">
            your role <RoleBadge role={currentWorkspace.role} />
          </span>
        </div>
      </div>

      {/* Quick actions */}
      <section className="animate-fade-up">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-faint">Quick actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map(({ icon: Icon, title, desc, to }) => (
            <Link
              key={to}
              to={to}
              className="group flex flex-col rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-surface-hover"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-violet-300">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-4 flex items-center gap-1 font-medium text-ink">
                {title}
                <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </p>
              <p className="mt-1 text-sm text-faint">{desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Workspace summary */}
      <section className="animate-fade-up grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2 text-faint">
            <Users2 className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Members</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {detail ? members.length : "—"}
          </p>
          <div className="mt-3 flex -space-x-2">
            {members.slice(0, 6).map((m) => (
              <div
                key={m.userId}
                title={m.user.name}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-canvas bg-gradient-to-br from-violet-500 to-indigo-600 text-[10px] font-semibold text-white"
              >
                {initials(m.user.name)}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2 text-faint">
            <CalendarDays className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Created</span>
          </div>
          <p className="mt-2 text-[15px] text-ink">{formatDate(currentWorkspace.createdAt)}</p>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-5">
          <div>
            <div className="flex items-center gap-2 text-faint">
              <UserPlus className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Team</span>
            </div>
            <p className="mt-2 text-sm text-muted">
              {isOwner ? "Invite teammates to collaborate." : "View who's in this workspace."}
            </p>
          </div>
          <Link to="/members" className="mt-3">
            <Button variant="outline" size="sm" className="w-full">
              {isOwner ? "Invite & manage" : "View members"}
            </Button>
          </Link>
        </div>
      </section>

      {/* What you can do */}
      <section className="animate-fade-up">
        <h2 className="mb-1 font-display text-2xl font-semibold tracking-tight text-ink">
          Everything you can do with SocialHub
        </h2>
        <p className="mb-5 max-w-2xl text-sm text-muted">
          SocialHub brings your whole social workflow — composing, scheduling, approvals,
          publishing and analytics — into one place, so your team can ship content without
          juggling a dozen tabs.
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-line bg-surface p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-violet-300">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-4 font-medium text-ink">{title}</p>
              <p className="mt-1 text-sm text-faint">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Upgrade CTA (free users only) */}
      {!isPro && (
        <section className="animate-fade-up overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-indigo-500/[0.06] p-6 sm:p-8">
          <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
            <div className="max-w-xl">
              <p className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight text-ink">
                <Crown className="h-5 w-5 text-violet-300" /> Unlock more with Pro
              </p>
              <p className="mt-1.5 text-sm text-muted">
                You're on the Free plan — 1 workspace, up to 2 members and 3 posts. Upgrade to
                Pro for unlimited workspaces, members and posts.
              </p>
            </div>
            <Link to="/billing" className="shrink-0">
              <Button>
                View plans <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
