import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader2, Mail, Trash2, UserPlus } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useAppData } from "@/context/AppContext";
import {
  ApiError,
  workspaceApi,
  type Invitation,
  type Role,
  type WorkspaceDetail,
} from "@/lib/api";
import { formatDate, initials } from "@/lib/utils";

const ASSIGNABLE: Role[] = ["EDITOR", "REVIEWER", "VIEWER"];

export function Members() {
  const { user, currentWorkspace, refreshWorkspaces } = useAppData();
  const navigate = useNavigate();
  const isOwner = currentWorkspace?.role === "OWNER";

  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("EDITOR");
  const [inviting, setInviting] = useState(false);
  const [lastInvite, setLastInvite] = useState<Invitation | null>(null);

  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const wsId = currentWorkspace?.id;

  const load = useCallback(async () => {
    if (!wsId) return;
    setLoading(true);
    setError(null);
    try {
      const { workspace } = await workspaceApi.get(wsId);
      setDetail(workspace);
      if (isOwner) {
        const { invitations } = await workspaceApi.listInvitations(wsId);
        setInvites(invitations);
      } else {
        setInvites([]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load members.");
    } finally {
      setLoading(false);
    }
  }, [wsId, isOwner]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!wsId) return;
    setInviting(true);
    setError(null);
    setLastInvite(null);
    try {
      const { invitation } = await workspaceApi.invite(wsId, inviteEmail.trim(), inviteRole);
      setLastInvite(invitation);
      setInviteEmail("");
      const { invitations } = await workspaceApi.listInvitations(wsId);
      setInvites(invitations);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send invite.");
    } finally {
      setInviting(false);
    }
  }

  async function onRevoke(invitationId: string) {
    if (!wsId) return;
    setError(null);
    try {
      await workspaceApi.revokeInvitation(wsId, invitationId);
      setInvites((prev) => prev.filter((i) => i.id !== invitationId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't revoke invite.");
    }
  }

  async function onChangeRole(userId: string, role: Role) {
    if (!wsId) return;
    setBusyUserId(userId);
    setError(null);
    try {
      await workspaceApi.changeRole(wsId, userId, role);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't change role.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function onRemove(userId: string) {
    if (!wsId) return;
    const isSelf = userId === user?.id;
    setBusyUserId(userId);
    setError(null);
    try {
      await workspaceApi.removeMember(wsId, userId);
      if (isSelf) {
        await refreshWorkspaces();
        navigate("/dashboard");
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove member.");
      setBusyUserId(null);
    }
  }

  if (!currentWorkspace) return null;

  const inviteLink = lastInvite ? `${window.location.origin}/invite/${lastInvite.token}` : null;
  const members = detail?.members ?? [];

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Team members</h1>
        <p className="mt-1.5 text-zinc-400">
          {detail ? `${members.length} member${members.length === 1 ? "" : "s"} in ` : "Managing "}
          <span className="text-zinc-200">{currentWorkspace.name}</span>
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Invite (owner only) */}
      {isOwner && (
        <section className="animate-fade-up rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-violet-300" />
            <h2 className="font-medium text-zinc-100">Invite a teammate</h2>
          </div>
          <form onSubmit={onInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-500" />
                <Input
                  id="invite-email"
                  type="email"
                  className="pl-11"
                  placeholder="teammate@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                id="invite-role"
                className="h-11 w-full sm:w-36"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
              >
                {ASSIGNABLE.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" loading={inviting} disabled={!inviteEmail.trim()}>
              {!inviting && "Send invite"}
              {inviting && "Sending..."}
            </Button>
          </form>

          {inviteLink && (
            <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/10 p-4">
              <p className="text-sm text-zinc-200">
                Invitation created. Share this link (email delivery arrives in a later phase):
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-300">
                  {inviteLink}
                </code>
                <CopyButton value={inviteLink} />
              </div>
            </div>
          )}
        </section>
      )}

      {/* Pending invitations (owner only) */}
      {isOwner && invites.length > 0 && (
        <section className="animate-fade-up">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">
            Pending invitations
          </h2>
          <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-100">{inv.email}</p>
                  <p className="text-xs text-zinc-500">Expires {formatDate(inv.expiresAt)}</p>
                </div>
                <RoleBadge role={inv.role} />
                <button
                  onClick={() => onRevoke(inv.id)}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-red-300"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Members list */}
      <section className="animate-fade-up">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">Members</h2>
        {loading && !detail ? (
          <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] py-12 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            {members.map((m) => {
              const isSelf = m.userId === user?.id;
              const canManage = isOwner && m.role !== "OWNER";
              const canLeave = isSelf && m.role !== "OWNER";
              const busy = busyUserId === m.userId;
              return (
                <div key={m.userId} className="flex items-center gap-3 px-5 py-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-semibold text-white">
                    {initials(m.user.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-zinc-100">
                      {m.user.name}
                      {isSelf && (
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                          You
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{m.user.email}</p>
                  </div>

                  {canManage ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={m.role}
                        disabled={busy}
                        onChange={(e) => onChangeRole(m.userId, e.target.value as Role)}
                      >
                        {ASSIGNABLE.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                      <button
                        onClick={() => onRemove(m.userId)}
                        disabled={busy}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                        aria-label="Remove member"
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <RoleBadge role={m.role} />
                      {canLeave && (
                        <Button variant="outline" size="sm" loading={busy} onClick={() => onRemove(m.userId)}>
                          {!busy && "Leave"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
