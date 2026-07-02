import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  PlugZap,
  ShieldCheck,
  UserPlus,
  Users2,
} from "lucide-react";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/context/AppContext";
import { workspaceApi, type WorkspaceDetail } from "@/lib/api";
import { formatDate, initials } from "@/lib/utils";

const UPCOMING = [
  { icon: PlugZap, title: "Connect platforms", desc: "Link YouTube, Instagram, LinkedIn & X." },
  { icon: CalendarClock, title: "Schedule posts", desc: "Compose once, publish on a timeline." },
  { icon: BarChart3, title: "Track analytics", desc: "Views, likes & comments in one view." },
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
  const members = detail?.members ?? [];

  return (
    <div className="space-y-10">
      <div className="animate-fade-up">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          Signed in &amp; session secured
        </div>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-white">
          Welcome back, {firstName}.
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-400">
          <span>
            Workspace <span className="font-medium text-zinc-200">{currentWorkspace.name}</span>
          </span>
          <span className="text-zinc-700">•</span>
          <span className="inline-flex items-center gap-1.5">
            your role <RoleBadge role={currentWorkspace.role} />
          </span>
        </div>
      </div>

      {/* Workspace summary */}
      <section className="animate-fade-up grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 text-zinc-500">
            <Users2 className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Members</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">
            {detail ? members.length : "—"}
          </p>
          <div className="mt-3 flex -space-x-2">
            {members.slice(0, 6).map((m) => (
              <div
                key={m.userId}
                title={m.user.name}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-900 bg-gradient-to-br from-violet-500 to-indigo-600 text-[10px] font-semibold text-white"
              >
                {initials(m.user.name)}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 text-zinc-500">
            <CalendarDays className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Created</span>
          </div>
          <p className="mt-2 text-[15px] text-zinc-100">{formatDate(currentWorkspace.createdAt)}</p>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div>
            <div className="flex items-center gap-2 text-zinc-500">
              <UserPlus className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Team</span>
            </div>
            <p className="mt-2 text-sm text-zinc-400">
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

      {/* What's next */}
      <section className="animate-fade-up">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">Coming next</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {UPCOMING.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-violet-300">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-4 font-medium text-zinc-100">{title}</p>
              <p className="mt-1 text-sm text-zinc-500">{desc}</p>
              <span className="mt-4 inline-block rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
                Soon
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
