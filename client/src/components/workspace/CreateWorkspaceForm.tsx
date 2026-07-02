import { useState, type FormEvent } from "react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppData } from "@/context/AppContext";
import { ApiError } from "@/lib/api";

export function CreateWorkspaceForm({
  onCreated,
  submitLabel = "Create workspace",
  autoFocus = true,
}: {
  onCreated?: (workspaceId: string) => void;
  submitLabel?: string;
  autoFocus?: boolean;
}) {
  const { createWorkspace } = useAppData();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const ws = await createWorkspace(name.trim());
      if (ws) onCreated?.(ws.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create workspace. Try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="ws-name">Workspace name</Label>
        <Input
          id="ws-name"
          autoFocus={autoFocus}
          placeholder="Acme Media"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
        />
      </div>
      <Button type="submit" className="w-full" loading={loading} disabled={!name.trim()}>
        {!loading && (
          <>
            {submitLabel} <ArrowRight className="h-4 w-4" />
          </>
        )}
        {loading && "Creating..."}
      </Button>
    </form>
  );
}
