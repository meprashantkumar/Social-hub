import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { IconField } from "@/components/shared/IconField";
import { Button } from "@/components/ui/button";
import { ApiError, authApi } from "@/lib/api";

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout>
        <div className="animate-fade-up">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-300">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">Invalid reset link</h2>
          <p className="mt-2 text-sm text-muted">
            This link is missing its reset token. Request a new one to continue.
          </p>
          <Link to="/forgot-password" className="mt-8 inline-block">
            <Button size="lg">Request a new link</Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout>
        <div className="animate-fade-up">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">Password reset</h2>
          <p className="mt-2 text-sm text-muted">
            Your password has been updated. You can now sign in with your new password.
          </p>
          <Link to="/login" className="mt-8 inline-block">
            <Button size="lg">
              Go to sign in <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-8">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">Set a new password</h2>
        <p className="mt-2 text-sm text-muted">Choose a strong password you don't use elsewhere.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <IconField
          id="password"
          label="New password"
          icon={Lock}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors hover:text-ink"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          }
        />

        <IconField
          id="confirm"
          label="Confirm new password"
          icon={Lock}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Re-enter new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />

        <Button type="submit" size="lg" loading={loading} className="w-full">
          {!loading && (
            <>
              Reset password <ArrowRight className="h-4 w-4" />
            </>
          )}
          {loading && "Resetting..."}
        </Button>
      </form>

      <Link
        to="/login"
        className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
    </AuthLayout>
  );
}
