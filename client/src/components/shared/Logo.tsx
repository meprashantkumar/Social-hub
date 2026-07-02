import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/40">
        <Share2 className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
      </div>
      {showText && (
        <span className="font-display text-lg font-semibold tracking-tight text-white">
          Social<span className="text-violet-400">Hub</span>
        </span>
      )}
    </div>
  );
}
