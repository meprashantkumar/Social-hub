import { Sparkles } from "lucide-react";
import { GridBackground } from "@/components/shared/GridBackground";
import { Logo } from "@/components/shared/Logo";
import { CreateWorkspaceForm } from "@/components/workspace/CreateWorkspaceForm";

export function Onboarding() {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-6">
      <GridBackground />
      <div className="animate-fade-up w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl shadow-black/30">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-violet-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
            Create your first workspace
          </h1>
          <p className="mb-6 mt-2 text-sm text-zinc-400">
            A workspace is where your team's connected accounts, posts, and analytics live.
            You can invite teammates once it's set up.
          </p>
          <CreateWorkspaceForm submitLabel="Create workspace" />
        </div>
      </div>
    </div>
  );
}
