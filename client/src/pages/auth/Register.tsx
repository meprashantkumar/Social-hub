import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { IconField } from "@/components/shared/IconField";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/context/AppContext";
import { ApiError } from "@/lib/api";

export function Register() {
  const { register } = useAppData();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({ name, email, password });
      // On success the route guard redirects to /dashboard.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="mb-8">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-white">
          Create your account
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Start publishing across every platform in minutes.
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
          id="name"
          label="Full name"
          icon={User}
          type="text"
          autoComplete="name"
          placeholder="Ada Lovelace"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

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

        <div className="space-y-1.5">
          <IconField
            id="password"
            label="Password"
            icon={Lock}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-zinc-200"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            }
          />
          <p className="pl-1 text-xs text-zinc-500">Use 8 or more characters.</p>
        </div>

        <Button type="submit" size="lg" loading={loading} className="w-full">
          {!loading && (
            <>
              Create account <ArrowRight className="h-4 w-4" />
            </>
          )}
          {loading && "Creating account..."}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-zinc-400">
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-medium text-violet-400 transition-colors hover:text-violet-300"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
