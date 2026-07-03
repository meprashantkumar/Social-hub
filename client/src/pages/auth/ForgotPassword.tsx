import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, ArrowRight, MailCheck, Mail } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { IconField } from "@/components/shared/IconField";
import { Button } from "@/components/ui/button";
import { ApiError, authApi } from "@/lib/api";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="animate-fade-up">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
            <MailCheck className="h-6 w-6" />
          </div>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">Check your email</h2>
          <p className="mt-2 text-sm text-muted">
            If an account exists for <span className="font-medium text-ink">{email}</span>, we've
            sent a link to reset your password. The link expires in 30 minutes.
          </p>
          <p className="mt-6 text-sm text-muted">
            Didn't get it? Check your spam folder, or{" "}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="font-medium text-violet-400 transition-colors hover:text-violet-300"
            >
              try again
            </button>
            .
          </p>
          <Link
            to="/login"
            className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-8">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">Forgot password?</h2>
        <p className="mt-2 text-sm text-muted">
          Enter your email and we'll send you a link to reset it.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <IconField
          id="email"
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Button type="submit" size="lg" loading={loading} className="w-full">
          {!loading && (
            <>
              Send reset link <ArrowRight className="h-4 w-4" />
            </>
          )}
          {loading && "Sending..."}
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
