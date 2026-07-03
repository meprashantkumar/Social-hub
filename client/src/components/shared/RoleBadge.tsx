import type { Role } from "@/lib/api";
import { cn } from "@/lib/utils";

const STYLES: Record<Role, string> = {
  OWNER: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  EDITOR: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  REVIEWER: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  VIEWER: "border-line bg-surface text-muted",
};

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide",
        STYLES[role],
        className
      )}
    >
      {role}
    </span>
  );
}
