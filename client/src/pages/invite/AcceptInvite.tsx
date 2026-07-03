import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowRight, Loader2, MailWarning } from "lucide-react";
import { GridBackground } from "@/components/shared/GridBackground";
import { Logo } from "@/components/shared/Logo";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/context/AppContext";
import { ApiError, invitationApi, type InvitationPreview } from "@/lib/api";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-6">
      <GridBackground />
      <div className="animate-fade-up w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-2xl shadow-black/30">
          {children}
        </div>
      </div>
    </div>
  );
}

export function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { status, refreshWorkspaces, selectWorkspace } = useAppData();
  const navigate = useNavigate();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    invitationApi
      .preview(token)
      .then((r) => !cancelled && setPreview(r.invitation))
      .catch((e) => !cancelled && setLoadError(e instanceof ApiError ? e.message : "Invitation not found"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function accept() {
    if (!token) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      const { workspace } = await invitationApi.accept(token);
      await refreshWorkspaces();
      selectWorkspace(workspace.id);
      navigate("/dashboard");
    } catch (e) {
      setAcceptError(e instanceof ApiError ? e.message : "Couldn't accept the invitation.");
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-8 text-faint">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </Shell>
    );
  }

  if (loadError || !preview) {
    return (
      <Shell>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-300">
          <MailWarning className="h-5 w-5" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold text-ink">Invitation not found</h1>
        <p className="mt-2 text-sm text-muted">{loadError ?? "This invitation link is invalid."}</p>
        <Link to="/dashboard" className="mt-6 inline-block">
          <Button variant="outline">Go to dashboard</Button>
        </Link>
      </Shell>
    );
  }

  if (preview.status !== "PENDING") {
    const reason =
      preview.status === "ACCEPTED"
        ? "This invitation has already been accepted."
        : preview.status === "EXPIRED"
          ? "This invitation has expired."
          : "This invitation is no longer valid.";
    return (
      <Shell>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-muted">
          <MailWarning className="h-5 w-5" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold text-ink">Can't accept this invite</h1>
        <p className="mt-2 text-sm text-muted">{reason}</p>
        <Link to="/dashboard" className="mt-6 inline-block">
          <Button variant="outline">Go to dashboard</Button>
        </Link>
      </Shell>
    );
  }

  const nextUrl = `/invite/${token}`;

  return (
    <Shell>
      <p className="text-sm text-muted">You've been invited to join</p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
        {preview.workspace.name}
      </h1>
      <div className="mt-3 inline-flex items-center gap-2 text-sm text-muted">
        as <RoleBadge role={preview.role} />
      </div>

      {acceptError && (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{acceptError}</span>
        </div>
      )}

      <div className="mt-6">
        {status === "loading" ? (
          <div className="flex items-center justify-center py-2 text-faint">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : status === "authenticated" ? (
          <Button className="w-full" size="lg" loading={accepting} onClick={accept}>
            {!accepting && (
              <>
                Accept invitation <ArrowRight className="h-4 w-4" />
              </>
            )}
            {accepting && "Accepting..."}
          </Button>
        ) : (
          <div className="space-y-3">
            <Link to={`/login?next=${encodeURIComponent(nextUrl)}`} className="block">
              <Button className="w-full" size="lg">
                Sign in to accept <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="text-center text-sm text-muted">
              New here?{" "}
              <Link
                to={`/register?next=${encodeURIComponent(nextUrl)}`}
                className="font-medium text-violet-400 hover:text-violet-300"
              >
                Create an account
              </Link>
            </p>
          </div>
        )}
      </div>
    </Shell>
  );
}
