import type { ReactNode } from "react";
import { CalendarClock, Share2, Users2 } from "lucide-react";
import { GridBackground } from "@/components/shared/GridBackground";
import { Logo } from "@/components/shared/Logo";

const FEATURES = [
  { icon: Share2, title: "Publish once, everywhere", desc: "YouTube, Instagram, LinkedIn & X from a single composer." },
  { icon: CalendarClock, title: "Schedule with confidence", desc: "Plan a week of content and let it ship on time." },
  { icon: Users2, title: "Built for teams", desc: "Draft, review and approve together in one workspace." },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <GridBackground />
      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-2">
        {/* Brand showcase (desktop) */}
        <div className="relative hidden flex-col justify-between p-12 xl:p-16 lg:flex">
          <Logo />

          <div className="animate-fade-up space-y-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                Social media, minus the chaos
              </div>
              <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-white">
                Publish everywhere.
                <br />
                <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-fuchsia-400 bg-clip-text text-transparent">
                  Manage in one place.
                </span>
              </h1>
              <p className="max-w-md text-[15px] leading-relaxed text-zinc-400">
                Connect every channel, schedule content once, and collaborate with your
                team — without juggling a dozen tabs.
              </p>
            </div>

            <ul className="space-y-4">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex items-start gap-3.5">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-violet-300">
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{title}</p>
                    <p className="text-sm text-zinc-500">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-zinc-600">© 2026 SocialHub. All rights reserved.</p>
        </div>

        {/* Form panel */}
        <div className="flex items-center justify-center p-6 sm:p-10">
          <div className="animate-fade-up w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <Logo />
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
