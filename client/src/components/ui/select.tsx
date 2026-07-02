import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-9 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-sm text-zinc-100 transition-colors",
      "focus-visible:border-violet-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/20",
      "disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-zinc-900",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
