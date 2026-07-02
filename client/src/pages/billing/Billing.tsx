import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, Crown, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/context/AppContext";
import {
  ApiError,
  billingApi,
  type BillingPlanId,
  type BillingStatus,
} from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (resp: { error?: { description?: string } }) => void) => void;
}
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const FREE_FEATURES = ["1 workspace", "Up to 2 members per workspace", "Up to 3 posts per workspace"];
const PRO_FEATURES = ["Unlimited workspaces", "Unlimited members", "Unlimited posts", "All platforms & scheduling"];

export function Billing() {
  const { user, refreshUser } = useAppData();
  const [data, setData] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<BillingPlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await billingApi.status());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load billing info.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function upgrade(plan: BillingPlanId) {
    setError(null);
    setSuccess(null);
    setUpgrading(plan);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Couldn't load the payment window. Check your connection and retry.");

      const order = await billingApi.createOrder(plan);
      const rzp = new window.Razorpay!({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "SocialHub",
        description: `${data?.plans.find((p) => p.id === plan)?.label ?? "Pro"} plan`,
        order_id: order.orderId,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: "#7c3aed" },
        handler: async (resp: RazorpayResponse) => {
          try {
            const status = await billingApi.verify(resp);
            setData(status);
            await refreshUser();
            setSuccess("Payment successful — you're on Pro! 🎉");
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Payment verification failed.");
          } finally {
            setUpgrading(null);
          }
        },
        modal: { ondismiss: () => setUpgrading(null) },
      });
      rzp.on("payment.failed", (r) => {
        setError(r.error?.description ?? "Payment failed. Please try again.");
        setUpgrading(null);
      });
      rzp.open();
    } catch (err) {
      if (err instanceof ApiError && err.code === "PAYMENTS_NOT_CONFIGURED") {
        setError("Payments aren't configured on the server yet.");
      } else {
        setError(err instanceof Error ? err.message : "Couldn't start the upgrade.");
      }
      setUpgrading(null);
    }
  }

  const isPro = data?.plan === "pro";

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Billing</h1>
        <p className="mt-1.5 text-zinc-400">Upgrade to Pro to lift the Free-plan limits.</p>
      </div>

      {success && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading || !data ? (
        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          {/* Current plan */}
          <section className="animate-fade-up rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                  isPro ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : "border-white/10 bg-white/5 text-zinc-400"
                }`}
              >
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-100">
                  You're on the <span className={isPro ? "text-amber-300" : "text-zinc-200"}>{isPro ? "Pro" : "Free"}</span> plan
                </p>
                <p className="text-xs text-zinc-500">
                  {isPro && data.proExpiresAt
                    ? `Pro access until ${formatDate(data.proExpiresAt)}`
                    : `Free plan: ${data.limits.workspaces} workspace, ${data.limits.members} members, ${data.limits.posts} posts per workspace`}
                </p>
              </div>
            </div>
          </section>

          {/* Plans */}
          <section className="animate-fade-up">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">
              {isPro ? "Extend Pro" : "Upgrade to Pro"}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {data.plans.map((p) => {
                const highlight = p.id === "yearly";
                return (
                  <div
                    key={p.id}
                    className={`flex flex-col rounded-2xl border p-6 ${
                      highlight ? "border-violet-500/40 bg-violet-500/[0.06]" : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    {highlight && (
                      <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-medium text-violet-200">
                        <Sparkles className="h-3 w-3" /> Best value
                      </span>
                    )}
                    <p className="font-display text-lg font-semibold text-white">{p.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-100">
                      ₹{(p.amount / 100).toLocaleString("en-IN")}
                    </p>
                    <p className="text-xs text-zinc-500">{p.priceLabel}</p>
                    <Button
                      className="mt-5 w-full"
                      variant={highlight ? "primary" : "outline"}
                      loading={upgrading === p.id}
                      onClick={() => upgrade(p.id)}
                    >
                      {upgrading !== p.id && (isPro ? "Extend" : "Upgrade")}
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* What you get */}
          <section className="animate-fade-up grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-sm font-medium text-zinc-300">Free</p>
              <ul className="mt-3 space-y-2">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-400">
                    <Check className="h-4 w-4 shrink-0 text-zinc-500" /> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.05] p-6">
              <p className="flex items-center gap-1.5 text-sm font-medium text-violet-200">
                <Crown className="h-4 w-4" /> Pro
              </p>
              <ul className="mt-3 space-y-2">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                    <Check className="h-4 w-4 shrink-0 text-violet-400" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <p className="text-center text-xs text-zinc-600">
            Test mode — use Razorpay's test cards (e.g. 4111 1111 1111 1111, any future expiry &amp; CVV).
          </p>
        </>
      )}
    </div>
  );
}
