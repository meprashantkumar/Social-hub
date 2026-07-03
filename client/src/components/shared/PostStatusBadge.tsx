import type { PostStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

const STYLES: Record<PostStatus, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "border-line bg-surface text-muted" },
  PENDING_REVIEW: { label: "Pending review", cls: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  APPROVED: { label: "Approved", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  SCHEDULED: { label: "Scheduled", cls: "border-sky-500/30 bg-sky-500/10 text-sky-300" },
  PUBLISHING: { label: "Publishing…", cls: "border-sky-500/30 bg-sky-500/10 text-sky-300" },
  PUBLISHED: { label: "Published", cls: "border-violet-500/30 bg-violet-500/10 text-violet-300" },
  FAILED: { label: "Failed", cls: "border-red-500/30 bg-red-500/10 text-red-300" },
};

export function PostStatusBadge({ status, className }: { status: PostStatus; className?: string }) {
  const s = STYLES[status] ?? STYLES.DRAFT;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        s.cls,
        className
      )}
    >
      {s.label}
    </span>
  );
}
