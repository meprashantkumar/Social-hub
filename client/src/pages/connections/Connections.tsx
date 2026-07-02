import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Instagram,
  Linkedin,
  Loader2,
  Plug,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/context/AppContext";
import { ApiError, connectionsApi, type Connection, type Platform } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface PlatformMeta {
  key: Platform;
  name: string;
  icon: LucideIcon;
  color: string;
  enabled: boolean;
  blurb: string;
}

const PLATFORMS: PlatformMeta[] = [
  { key: "YOUTUBE", name: "YouTube", icon: Youtube, color: "text-red-400", enabled: true, blurb: "Upload & publish videos." },
  { key: "INSTAGRAM", name: "Instagram", icon: Instagram, color: "text-pink-400", enabled: false, blurb: "Publish photos to your feed." },
  { key: "LINKEDIN", name: "LinkedIn", icon: Linkedin, color: "text-sky-400", enabled: true, blurb: "Share image posts to your profile." },
  { key: "X", name: "X", icon: Twitter, color: "text-zinc-300", enabled: true, blurb: "Post tweets (text + image)." },
];

const META = Object.fromEntries(PLATFORMS.map((p) => [p.key, p])) as Record<Platform, PlatformMeta>;

function errorMessage(reason: string | null): string {
  switch (reason) {
    case "access_denied":
      return "You cancelled the connection.";
    case "invalid_state":
      return "That connect link expired. Please try again.";
    case "missing_code":
      return "The connection was interrupted. Please try again.";
    case "NO_CHANNEL":
      return "That Google account has no YouTube channel yet. Create one at youtube.com, then reconnect.";
    case "NO_IG_ACCOUNT":
      return "Couldn't read that Instagram account. Make sure it's a Business/Creator account and you accepted the tester invite.";
    case "NO_LI_ACCOUNT":
      return "Couldn't read your LinkedIn profile. Please try connecting again.";
    case "NO_X_ACCOUNT":
      return "Couldn't read your X account. Please try connecting again.";
    default:
      return "Something went wrong connecting the account.";
  }
}

export function Connections() {
  const { currentWorkspace } = useAppData();
  const [params, setParams] = useSearchParams();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const wsId = currentWorkspace?.id;
  const canManage = currentWorkspace?.role === "OWNER" || currentWorkspace?.role === "EDITOR";

  const load = useCallback(async () => {
    if (!wsId) return;
    setLoading(true);
    try {
      const { connections: rows } = await connectionsApi.list(wsId);
      setConnections(rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load connections.");
    } finally {
      setLoading(false);
    }
  }, [wsId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Handle the OAuth redirect result (?status=connected|error) then clean the URL.
  useEffect(() => {
    const status = params.get("status");
    if (!status) return;
    if (status === "connected") {
      const p = params.get("platform")?.toUpperCase() as Platform | undefined;
      setSuccess(`${p && META[p] ? META[p].name : "Account"} connected successfully.`);
    } else if (status === "error") {
      setError(errorMessage(params.get("reason")));
    }
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect(platform: Platform) {
    if (!wsId) return;
    setConnecting(platform);
    setError(null);
    setSuccess(null);
    try {
      const { url } = await connectionsApi.startOAuth(platform.toLowerCase(), wsId);
      window.location.href = url; // hand off to the provider's consent screen
    } catch (err) {
      if (err instanceof ApiError && err.code === "OAUTH_NOT_CONFIGURED") {
        setError(`${META[platform]?.name ?? "That platform"} isn't configured on the server yet. Add its OAuth credentials to .env.`);
      } else {
        setError(err instanceof ApiError ? err.message : "Couldn't start the connection.");
      }
      setConnecting(null);
    }
  }

  async function disconnect(id: string) {
    setDisconnectingId(id);
    setError(null);
    try {
      await connectionsApi.disconnect(id);
      setConnections((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't disconnect.");
    } finally {
      setDisconnectingId(null);
    }
  }

  if (!currentWorkspace) return null;

  const connectedPlatforms = new Set(connections.map((c) => c.platform));

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Connections</h1>
        <p className="mt-1.5 text-zinc-400">
          Link social accounts to <span className="text-zinc-200">{currentWorkspace.name}</span> to publish across platforms.
        </p>
      </div>

      {success && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Connected accounts */}
      <section className="animate-fade-up">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">
          Connected accounts
        </h2>
        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] py-12 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-12 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-500">
              <Plug className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm text-zinc-400">No accounts connected yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {connections.map((c) => {
              const meta = META[c.platform];
              const Icon = meta?.icon ?? Plug;
              return (
                <div key={c.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  {c.avatarUrl ? (
                    <img src={c.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5">
                      <Icon className={`h-5 w-5 ${meta?.color ?? "text-zinc-300"}`} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-100">{c.accountName}</p>
                    <p className="text-xs text-zinc-500">
                      {meta?.name ?? c.platform} • connected {formatDate(c.connectedAt)}
                    </p>
                  </div>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={disconnectingId === c.id}
                      onClick={() => disconnect(c.id)}
                    >
                      {disconnectingId !== c.id && "Disconnect"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Available platforms */}
      <section className="animate-fade-up">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">
          Add a platform
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORMS.map((p) => {
            const Icon = p.icon;
            const already = connectedPlatforms.has(p.key);
            return (
              <div key={p.key} className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  <Icon className={`h-5 w-5 ${p.color}`} />
                </div>
                <p className="mt-4 font-medium text-zinc-100">{p.name}</p>
                <p className="mt-1 flex-1 text-sm text-zinc-500">{p.blurb}</p>
                <div className="mt-4">
                  {!p.enabled ? (
                    <span className="inline-block rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
                      Soon
                    </span>
                  ) : !canManage ? (
                    <span className="text-xs text-zinc-500">Owners & editors can connect</span>
                  ) : (
                    <Button
                      size="sm"
                      variant={already ? "outline" : "primary"}
                      className="w-full"
                      loading={connecting === p.key}
                      onClick={() => connect(p.key)}
                    >
                      {connecting !== p.key && (already ? "Reconnect" : "Connect")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
