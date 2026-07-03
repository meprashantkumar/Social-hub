import { useRef, useState, type FormEvent } from "react";
import { AlertCircle, Camera, Check, Loader2, Lock, Trash2, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppData } from "@/context/AppContext";
import { ApiError, authApi } from "@/lib/api";
import { MAX_AVATAR_BYTES, uploadAvatar } from "@/lib/upload";
import { formatBytes, initials } from "@/lib/utils";

export function Account() {
  const { user, refreshUser } = useAppData();

  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [profileOk, setProfileOk] = useState(false);

  // Change-password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);

  if (!user) return null;

  const dirty = name.trim() !== user.name || avatarUrl !== (user.avatarUrl ?? null);

  async function handleFile(file: File) {
    setProfileErr(null);
    setProfileOk(false);
    if (!file.type.startsWith("image/")) {
      setProfileErr("Please choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setProfileErr(`That image is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_AVATAR_BYTES)}.`);
      return;
    }
    setUploading(true);
    try {
      const result = await uploadAvatar(file);
      setAvatarUrl(result.url);
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileErr(null);
    setProfileOk(false);
    if (!name.trim()) {
      setProfileErr("Name can't be empty.");
      return;
    }
    setSavingProfile(true);
    try {
      await authApi.updateProfile({ name: name.trim(), avatarUrl });
      await refreshUser();
      setProfileOk(true);
    } catch (err) {
      setProfileErr(err instanceof ApiError ? err.message : "Couldn't save your profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setPwErr(null);
    setPwOk(false);
    if (newPassword.length < 8) {
      setPwErr("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwErr("New password and confirmation don't match.");
      return;
    }
    setSavingPw(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setPwOk(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwErr(err instanceof ApiError ? err.message : "Couldn't change your password.");
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="animate-fade-up">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Account</h1>
        <p className="mt-1.5 text-muted">Manage your profile and password.</p>
      </div>

      {/* Profile */}
      <form onSubmit={saveProfile} className="animate-fade-up space-y-6 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-faint">Profile</h2>

        {profileErr && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{profileErr}</span>
          </div>
        )}
        {profileOk && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Profile updated.</span>
          </div>
        )}

        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div className="relative h-20 w-20 shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Your avatar"
                className="h-20 w-20 rounded-full border border-line object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xl font-semibold text-white">
                {initials(user.name)}
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                <Camera className="h-4 w-4" /> {avatarUrl ? "Change photo" : "Upload photo"}
              </Button>
              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={uploading}
                  onClick={() => setAvatarUrl(null)}
                  className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-faint">JPG, PNG or GIF · up to {formatBytes(MAX_AVATAR_BYTES)}</p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
        </div>

        {/* Name + email */}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <div className="relative">
            <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-faint" />
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className="pl-10"
              placeholder="Your name"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user.email} disabled className="opacity-70" />
          <p className="text-xs text-faint">Your email can't be changed.</p>
        </div>

        <div className="flex justify-end">
          <Button type="submit" loading={savingProfile} disabled={uploading || !dirty}>
            {!savingProfile && "Save changes"}
          </Button>
        </div>
      </form>

      {/* Change password */}
      <form onSubmit={savePassword} className="animate-fade-up space-y-5 rounded-2xl border border-line bg-surface p-6">
        <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-faint">
          <Lock className="h-4 w-4" /> Change password
        </h2>

        {pwErr && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{pwErr}</span>
          </div>
        )}
        {pwOk && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Password changed.</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="current">Current password</Label>
          <Input
            id="current"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new">New password</Label>
            <Input
              id="new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            loading={savingPw}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          >
            {!savingPw && "Update password"}
          </Button>
        </div>
      </form>
    </div>
  );
}
