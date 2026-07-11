import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-[border-color,box-shadow]",
        "placeholder:text-faint",
        "focus-visible:border-violet-500/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet-500/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
