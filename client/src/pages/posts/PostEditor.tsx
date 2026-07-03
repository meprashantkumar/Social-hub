import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plug,
  Send,
  Trash2,
} from "lucide-react";
import { MediaUploader } from "@/components/posts/MediaUploader";
import { PlatformIcon, platformLabel } from "@/components/shared/PlatformIcon";
import { PostStatusBadge } from "@/components/shared/PostStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppData } from "@/context/AppContext";
import {
  ApiError,
  connectionsApi,
  postsApi,
  type Connection,
  type Platform,
  type PostDetail,
  type Visibility,
} from "@/lib/api";
import { cn } from "@/lib/utils";

/** Format a Date for a <input type="datetime-local"> value (local time, no tz). */
function toLocalInputValue(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PostEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const { currentWorkspace } = useAppData();
  const navigate = useNavigate();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [post, setPost] = useState<PostDetail | null>(null);
  const [title, setTitle] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [scheduledFor, setScheduledFor] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsId = currentWorkspace?.id;
  const canEdit = currentWorkspace?.role === "OWNER" || currentWorkspace?.role === "EDITOR";
  const canReview = currentWorkspace?.role === "OWNER" || currentWorkspace?.role === "REVIEWER";
  const editable = (isNew || post?.status === "DRAFT") && canEdit;

  const applyPost = useCallback((p: PostDetail) => {
    setPost(p);
    setTitle(p.title ?? "");
    setMediaUrl(p.mediaUrl ?? "");
    setVisibility(p.visibility);
    setScheduledFor(p.scheduledFor ? toLocalInputValue(new Date(p.scheduledFor)) : "");
    const sel: Record<string, boolean> = {};
    const caps: Record<string, string> = {};
    for (const t of p.targets) {
      sel[t.connectionId] = true;
      caps[t.connectionId] = t.caption ?? "";
    }
    setSelected(sel);
    setCaptions(caps);
  }, []);

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [conns, postRes] = await Promise.all([
          connectionsApi.list(wsId),
          isNew ? Promise.resolve(null) : postsApi.get(id!),
        ]);
        if (cancelled) return;
        setConnections(conns.connections);
        if (postRes) applyPost(postRes.post);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Couldn't load the post.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wsId, id, isNew, applyPost]);

  function buildTargets() {
    return connections
      .filter((c) => selected[c.id])
      .map((c) => ({ connectionId: c.id, caption: captions[c.id]?.trim() || undefined }));
  }

  async function save() {
    if (!wsId) return;
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const { post: created } = await postsApi.create({
          workspaceId: wsId,
          title: title.trim() || undefined,
          mediaUrl: mediaUrl.trim() || undefined,
          targets: buildTargets(),
        });
        navigate(`/posts/${created.id}`, { replace: true });
      } else {
        const { post: updated } = await postsApi.update(id!, {
          title: title.trim() || null,
          mediaUrl: mediaUrl.trim() || null,
          targets: buildTargets(),
        });
        applyPost(updated);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the post.");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(name: string, fn: () => Promise<{ post: PostDetail }>) {
    setAction(name);
    setError(null);
    try {
      const { post: p } = await fn();
      applyPost(p);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setAction(null);
    }
  }

  async function del() {
    setAction("delete");
    setError(null);
    try {
      await postsApi.remove(id!);
      navigate("/posts");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete the post.");
      setAction(null);
    }
  }

  if (!currentWorkspace) return null;

  if (isNew && !canEdit) {
    return (
      <div className="animate-fade-up rounded-2xl border border-line bg-surface p-8 text-center text-muted">
        You don't have permission to create posts in this workspace.
      </div>
    );
  }

  const selectedCount = connections.filter((c) => selected[c.id]).length;

  // The publish panel adapts to the post's target platforms. "Visibility"
  // (private/unlisted/public) is a YouTube concept, so we only show it when a
  // YouTube account is targeted; otherwise we publish at a sensible default.
  const targetPlatforms = post
    ? ([...new Set(post.targets.map((t) => t.connection?.platform).filter(Boolean))] as Platform[])
    : [];
  const hasYoutube = targetPlatforms.includes("YOUTUBE");
  const targetPlatformNames = targetPlatforms.map((p) => platformLabel(p)).join(", ");
  const effectiveVisibility: Visibility = hasYoutube ? visibility : "public";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/posts" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All posts
      </Link>

      <div className="animate-fade-up flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          {isNew ? "New post" : post?.title || "Untitled post"}
        </h1>
        {post && <PostStatusBadge status={post.status} />}
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
      ) : (
        <>
          <div className="animate-fade-up space-y-5 rounded-2xl border border-line bg-surface p-6">
            <div className="space-y-2">
              <Label htmlFor="post-title">Title</Label>
              <Input
                id="post-title"
                placeholder="Internal name for this post"
                value={title}
                disabled={!editable}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Media</Label>
              <MediaUploader
                workspaceId={currentWorkspace.id}
                value={mediaUrl || null}
                onChange={(url) => setMediaUrl(url ?? "")}
                disabled={!editable}
              />
            </div>
          </div>

          {/* Target accounts */}
          <div className="animate-fade-up space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-faint">
                Target accounts {selectedCount > 0 && `(${selectedCount})`}
              </h2>
            </div>

            {connections.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface py-10 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-faint">
                  <Plug className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm text-muted">No connected accounts yet.</p>
                <Link to="/connections" className="mt-3">
                  <Button variant="outline" size="sm">Connect an account</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {connections.map((c) => {
                  const on = !!selected[c.id];
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        "rounded-xl border p-4 transition-colors",
                        on ? "border-violet-500/30 bg-violet-500/[0.06]" : "border-line bg-surface"
                      )}
                    >
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={!editable}
                          onChange={(e) => setSelected((p) => ({ ...p, [c.id]: e.target.checked }))}
                          className="h-4 w-4 accent-violet-500 disabled:opacity-50"
                        />
                        <PlatformIcon platform={c.platform} />
                        <span className="text-sm font-medium text-ink">{c.accountName}</span>
                        <span className="text-xs text-faint">{platformLabel(c.platform)}</span>
                      </label>
                      {on && (
                        <textarea
                          value={captions[c.id] ?? ""}
                          disabled={!editable}
                          onChange={(e) => setCaptions((p) => ({ ...p, [c.id]: e.target.value }))}
                          placeholder={`Caption for ${platformLabel(c.platform)}…`}
                          rows={2}
                          className="mt-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:border-violet-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/20 disabled:opacity-60"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="animate-fade-up flex flex-wrap items-center gap-3 border-t border-line pt-5">
            {editable && (
              <>
                <Button loading={saving} onClick={save}>
                  {isNew ? "Save draft" : "Save changes"}
                </Button>
                {!isNew && post?.status === "DRAFT" && (
                  <Button
                    variant="outline"
                    loading={action === "submit"}
                    onClick={() => runAction("submit", () => postsApi.submit(id!))}
                  >
                    <Send className="h-4 w-4" /> Submit for review
                  </Button>
                )}
                {!isNew && (
                  <Button
                    variant="ghost"
                    loading={action === "delete"}
                    onClick={del}
                    className="ml-auto text-red-300 hover:bg-red-500/10 hover:text-red-200"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                )}
              </>
            )}

            {!editable && post?.status === "PENDING_REVIEW" && (
              canReview ? (
                <>
                  <Button
                    loading={action === "approve"}
                    onClick={() => runAction("approve", () => postsApi.approve(id!))}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    loading={action === "request"}
                    onClick={() => runAction("request", () => postsApi.requestChanges(id!))}
                  >
                    Request changes
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted">This post is awaiting review.</p>
              )
            )}

          </div>

          {/* Publish & schedule */}
          {post && ["APPROVED", "SCHEDULED", "PUBLISHING", "PUBLISHED", "FAILED"].includes(post.status) && (
            <div className="animate-fade-up space-y-4 border-t border-line pt-5">
              {(post.status === "APPROVED" || post.status === "FAILED") &&
                (canEdit ? (
                  <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-ink">
                      <Send className="h-4 w-4 text-violet-300" />
                      {post.status === "FAILED"
                        ? "Retry publishing"
                        : `Publish${targetPlatformNames ? ` to ${targetPlatformNames}` : ""}`}
                    </div>
                    {hasYoutube && (
                      <div className="space-y-2">
                        <Label>YouTube visibility</Label>
                        <div className="flex flex-wrap gap-2">
                          {(["private", "unlisted", "public"] as Visibility[]).map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setVisibility(v)}
                              className={cn(
                                "rounded-lg border px-3 py-1.5 text-sm capitalize transition-colors",
                                visibility === v
                                  ? "border-violet-500/40 bg-violet-500/15 text-violet-200"
                                  : "border-line bg-surface text-muted hover:bg-surface-hover"
                              )}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-faint">
                          {visibility === "private"
                            ? "Only you can see it on YouTube."
                            : visibility === "unlisted"
                              ? "Anyone with the link can watch — it won't show up in search."
                              : "Visible to everyone on YouTube."}
                        </p>
                      </div>
                    )}
                    <Button
                      loading={action === "publish"}
                      onClick={() => runAction("publish", () => postsApi.publish(id!, effectiveVisibility))}
                    >
                      <Send className="h-4 w-4" />
                      {post.status === "FAILED" ? "Retry publish now" : "Publish now"}
                    </Button>

                    {/* Or schedule for later */}
                    <div className="space-y-2 border-t border-line pt-4">
                      <Label htmlFor="sched" className="flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" /> Or schedule for later
                      </Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          id="sched"
                          type="datetime-local"
                          min={toLocalInputValue(new Date())}
                          value={scheduledFor}
                          onChange={(e) => setScheduledFor(e.target.value)}
                          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink [color-scheme:dark] focus-visible:border-violet-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/20"
                        />
                        <Button
                          variant="outline"
                          loading={action === "schedule"}
                          disabled={!scheduledFor}
                          onClick={() =>
                            runAction("schedule", () =>
                              postsApi.schedule(id!, new Date(scheduledFor).toISOString(), effectiveVisibility)
                            )
                          }
                        >
                          <CalendarClock className="h-4 w-4" /> Schedule
                        </Button>
                      </div>
                      <p className="text-xs text-faint">We'll auto-publish it at the time you pick.</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-emerald-300">Approved & ready — an owner or editor can publish it.</p>
                ))}

              {post.status === "SCHEDULED" && (
                <div className="space-y-3 rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-5">
                  <div className="flex items-center gap-2 text-sm text-sky-200">
                    <CalendarClock className="h-4 w-4" />
                    Scheduled for{" "}
                    <span className="font-medium text-sky-100">
                      {post.scheduledFor ? new Date(post.scheduledFor).toLocaleString() : "—"}
                    </span>
                    <span className="text-sky-300/70">· {post.visibility}</span>
                  </div>
                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        loading={action === "publish"}
                        onClick={() => runAction("publish", () => postsApi.publish(id!, post.visibility))}
                      >
                        <Send className="h-4 w-4" /> Publish now
                      </Button>
                      <Button
                        variant="outline"
                        loading={action === "unschedule"}
                        onClick={() => runAction("unschedule", () => postsApi.unschedule(id!))}
                      >
                        Cancel schedule
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {post.status === "PUBLISHING" && (
                <div className="flex items-center gap-2 text-sm text-sky-300">
                  <Loader2 className="h-4 w-4 animate-spin" /> Publishing… this can take a moment.
                </div>
              )}

              {/* Per-target publish results */}
              <div className="space-y-2">
                {post.targets.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                  >
                    {t.connection && <PlatformIcon platform={t.connection.platform} />}
                    <span className="truncate text-muted">{t.connection?.accountName ?? "Account"}</span>
                    <div className="ml-auto shrink-0">
                      {t.publishStatus === "PUBLISHED" && t.publishedUrl ? (
                        <a
                          href={t.publishedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200"
                        >
                          <CheckCircle2 className="h-4 w-4" /> View <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : t.publishStatus === "FAILED" ? (
                        <span className="text-red-300">Failed</span>
                      ) : t.publishStatus === "PUBLISHING" ? (
                        <span className="inline-flex items-center gap-1 text-sky-300">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading
                        </span>
                      ) : (
                        <span className="text-faint">Pending</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Failure details */}
              {post.targets
                .filter((t) => t.publishStatus === "FAILED" && t.errorMessage)
                .map((t) => (
                  <p key={t.id} className="text-xs text-red-300/90">
                    <span className="text-red-200">{t.connection?.accountName}:</span> {t.errorMessage}
                  </p>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
