import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm text-zinc-100 shadow-sm transition-colors",
        "placeholder:text-zinc-500",
        "focus-visible:border-violet-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
