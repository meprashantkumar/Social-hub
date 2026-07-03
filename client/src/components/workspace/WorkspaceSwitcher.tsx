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
        className="flex items-center gap-2 rounded-xl border border-line bg-surface py-1.5 pl-1.5 pr-2.5 text-sm transition-colors hover:bg-surface-hover"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 text-[10px] font-semibold text-white">
          {initials(currentWorkspace?.name ?? "?")}
        </span>
        <span className="max-w-[10rem] truncate font-medium text-ink">
          {currentWorkspace?.name ?? "Select workspace"}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-faint" />
      </button>

      {open && (
        <div className="animate-fade-in absolute left-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-panel/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <p className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-faint">
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
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface",
                  w.id === currentWorkspace?.id && "bg-surface"
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-hover text-[10px] font-semibold text-ink">
                  {initials(w.name)}
                </span>
                <span className="flex-1 truncate text-ink">{w.name}</span>
                <RoleBadge role={w.role} />
                {w.id === currentWorkspace?.id && <Check className="h-3.5 w-3.5 text-violet-400" />}
              </button>
            ))}
          </div>
          <div className="my-1 h-px bg-surface-hover" />
          <button
            onClick={() => {
              setCreateOpen(true);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-muted transition-colors hover:bg-surface"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-line">
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
