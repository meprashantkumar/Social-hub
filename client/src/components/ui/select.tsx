import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink transition-colors",
      "focus-visible:border-violet-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/20",
      "disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-panel",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
