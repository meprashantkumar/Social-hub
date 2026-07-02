import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { useAppData } from "@/context/AppContext";
import { cn, initials } from "@/lib/utils";
import { CreateWorkspaceModal } from "./CreateWorkspaceModal";

export function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, selectWorkspace } = useAppData();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-1.5 pl-1.5 pr-2.5 text-sm transition-colors hover:bg-white/[0.07]"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 text-[10px] font-semibold text-white">
          {initials(currentWorkspace?.name ?? "?")}
        </span>
        <span className="max-w-[10rem] truncate font-medium text-zinc-100">
          {currentWorkspace?.name ?? "Select workspace"}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-zinc-500" />
      </button>

      {open && (
        <div className="animate-fade-in absolute left-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-zinc-900/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <p className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Workspaces
          </p>
          <div className="max-h-64 overflow-y-auto">
            {workspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  selectWorkspace(w.id);
                  setOpen(false);
                  navigate("/dashboard");
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-white/5",
                  w.id === currentWorkspace?.id && "bg-white/5"
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-[10px] font-semibold text-zinc-200">
                  {initials(w.name)}
                </span>
                <span className="flex-1 truncate text-zinc-100">{w.name}</span>
                <RoleBadge role={w.role} />
                {w.id === currentWorkspace?.id && <Check className="h-3.5 w-3.5 text-violet-400" />}
              </button>
            ))}
          </div>
          <div className="my-1 h-px bg-white/10" />
          <button
            onClick={() => {
              setCreateOpen(true);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-white/5"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10">
              <Plus className="h-3.5 w-3.5" />
            </span>
            New workspace
          </button>
        </div>
      )}

      <CreateWorkspaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
