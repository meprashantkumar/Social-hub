import type { BillingPlan } from "../../db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PlanDef {
  id: BillingPlan;
  label: string;
  priceLabel: string;
  amount: number; // in paise
  days: number;
}

// One-time-per-period Pro plans. `amount` is in paise (₹1 = 100 paise).
export const PLANS: Record<BillingPlan, PlanDef> = {
  monthly: { id: "monthly", label: "Monthly", priceLabel: "₹1,299 / month", amount: 129900, days: 30 },
  half_yearly: { id: "half_yearly", label: "6 Months", priceLabel: "₹5,999 / 6 months", amount: 599900, days: 182 },
  yearly: { id: "yearly", label: "Yearly", priceLabel: "₹8,999 / year", amount: 899900, days: 365 },
};

export const PLAN_LIST: PlanDef[] = [PLANS.monthly, PLANS.half_yearly, PLANS.yearly];

// Free-tier caps. Lifted entirely while the workspace owner has an active Pro plan.
export const FREE_LIMITS = {
  workspaces: 1, // per account (owned)
  members: 2, // per workspace (owner + 1)
  posts: 3, // per workspace (any status)
};

export const daysToMs = (days: number): number => days * DAY_MS;
