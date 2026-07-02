import { Instagram, Linkedin, Plug, Twitter, Youtube, type LucideIcon } from "lucide-react";
import type { Platform } from "@/lib/api";
import { cn } from "@/lib/utils";

const META: Record<Platform, { icon: LucideIcon; color: string; label: string }> = {
  YOUTUBE: { icon: Youtube, color: "text-red-400", label: "YouTube" },
  INSTAGRAM: { icon: Instagram, color: "text-pink-400", label: "Instagram" },
  LINKEDIN: { icon: Linkedin, color: "text-sky-400", label: "LinkedIn" },
  X: { icon: Twitter, color: "text-zinc-300", label: "X" },
};

export const platformLabel = (p: Platform) => META[p]?.label ?? p;

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const meta = META[platform];
  const Icon = meta?.icon ?? Plug;
  return <Icon className={cn("h-4 w-4", meta?.color, className)} />;
}
