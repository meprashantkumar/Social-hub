import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BarChart3,
  ExternalLink,
  Eye,
  Loader2,
  MessageCircle,
  RefreshCw,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/context/AppContext";
import { ApiError, analyticsApi, type WorkspaceAnalytics } from "@/lib/api";
import { formatCount, formatDate } from "@/lib/utils";

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2 text-muted">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 font-display text-3xl font-semibold text-ink" title={value.toLocaleString()}>
        {formatCount(value)}
      </p>
    </div>
  );
}

export function Analytics() {
  const { currentWorkspace } = useAppData();
  const [data, setData] = useState<WorkspaceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsId = currentWorkspace?.id;

  const load = useCallback(
    async (isRefresh = false) => {
      if (!wsId) return;
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        setData(await analyticsApi.get(wsId));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't load analytics.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [wsId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (!currentWorkspace) return null;

  return (
    <div className="space-y-8">
      <div className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Analytics</h1>
          <p className="mt-1.5 text-muted">
            Live performance of published posts in <span className="text-ink">{currentWorkspace.name}</span>.
          </p>
        </div>
        <Button variant="outline" size="sm" loading={refreshing} onClick={() => load(true)}>
          {!refreshing && <RefreshCw className="h-4 w-4" />} Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-line bg-surface py-16 text-faint">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !data || data.totals.posts === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface py-16 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-faint">
            <BarChart3 className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm text-muted">No published posts yet.</p>
          <Link to="/posts" className="mt-4">
            <Button variant="outline" size="sm">Go to posts</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Totals */}
          <div className="grid animate-fade-up gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={BarChart3} label="Published" value={data.totals.posts} />
            <StatCard icon={Eye} label="Views" value={data.totals.views} />
            <StatCard icon={ThumbsUp} label="Likes" value={data.totals.likes} />
            <StatCard icon={MessageCircle} label="Comments" value={data.totals.comments} />
          </div>

          {/* Per-post breakdown */}
          <section className="animate-fade-up space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wider text-faint">Published posts</h2>
            <div className="space-y-3">
              {data.posts.map((p) => (
                <div key={p.postId} className="rounded-2xl border border-line bg-surface p-5">
                  <div className="flex items-center justify-between gap-3">
                    <Link to={`/posts/${p.postId}`} className="truncate text-sm font-medium text-ink hover:text-ink">
                      {p.title || "Untitled post"}
                    </Link>
                    {p.publishedAt && (
                      <span className="shrink-0 text-xs text-faint">{formatDate(p.publishedAt)}</span>
                    )}
                  </div>
                  <div className="mt-4 space-y-2">
                    {p.targets.map((t) => (
                      <div
                        key={t.connectionId}
                        className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <PlatformIcon platform={t.platform} />
                          <span className="truncate text-ink">{t.accountName}</span>
                        </div>
                        {t.error ? (
                          <span className="flex items-center gap-1.5 text-xs text-amber-300">
                            <AlertCircle className="h-3.5 w-3.5" /> {t.error}
                          </span>
                        ) : (
                          <div className="flex items-center gap-5 text-muted">
                            <span className="flex items-center gap-1.5" title="Views">
                              <Eye className="h-4 w-4 text-faint" /> {formatCount(t.views)}
                            </span>
                            <span className="flex items-center gap-1.5" title="Likes">
                              <ThumbsUp className="h-4 w-4 text-faint" /> {formatCount(t.likes)}
                            </span>
                            <span className="flex items-center gap-1.5" title="Comments">
                              <MessageCircle className="h-4 w-4 text-faint" /> {formatCount(t.comments)}
                            </span>
                          </div>
                        )}
                        {t.url && (
                          <a
                            href={t.url}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-auto inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200"
                          >
                            Watch <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
