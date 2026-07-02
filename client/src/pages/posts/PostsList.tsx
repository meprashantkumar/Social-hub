import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, FileText, Loader2, Plus } from "lucide-react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { PostStatusBadge } from "@/components/shared/PostStatusBadge";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/context/AppContext";
import { ApiError, postsApi, type PostSummary } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "DRAFT", label: "Drafts" },
  { key: "PENDING_REVIEW", label: "In review" },
  { key: "APPROVED", label: "Approved" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "PUBLISHED", label: "Published" },
];

export function PostsList() {
  const { currentWorkspace } = useAppData();
  const [filter, setFilter] = useState("");
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const wsId = currentWorkspace?.id;
  const canCreate = currentWorkspace?.role === "OWNER" || currentWorkspace?.role === "EDITOR";

  const load = useCallback(async () => {
    if (!wsId) return;
    setLoading(true);
    setError(null);
    try {
      const { posts: rows } = await postsApi.list(wsId, filter || undefined);
      setPosts(rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load posts.");
    } finally {
      setLoading(false);
    }
  }, [wsId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!currentWorkspace) return null;

  return (
    <div className="space-y-6">
      <div className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Posts</h1>
          <p className="mt-1.5 text-zinc-400">
            Compose once, target multiple platforms in <span className="text-zinc-200">{currentWorkspace.name}</span>.
          </p>
        </div>
        {canCreate && (
          <Link to="/posts/new">
            <Button>
              <Plus className="h-4 w-4" /> New post
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key || "all"}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              filter === f.key
                ? "border-violet-500/40 bg-violet-500/15 text-violet-200"
                : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07]"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-16 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-500">
            <FileText className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm text-zinc-400">
            {filter ? "No posts with this status." : "No posts yet."}
          </p>
          {canCreate && !filter && (
            <Link to="/posts/new" className="mt-4">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4" /> Create your first post
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="animate-fade-up divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {posts.map((p) => (
            <Link
              key={p.id}
              to={`/posts/${p.id}`}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.03]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">{p.title || "Untitled post"}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {p.targetCount} target{p.targetCount === 1 ? "" : "s"} • updated {formatDate(p.updatedAt)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {p.platforms.map((pl) => (
                  <PlatformIcon key={pl} platform={pl} />
                ))}
              </div>
              <PostStatusBadge status={p.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
