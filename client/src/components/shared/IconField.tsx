import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface IconFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Optional element rendered on the right (e.g. a password visibility toggle). */
  trailing?: React.ReactNode;
}

export const IconField = React.forwardRef<HTMLInputElement, IconFieldProps>(
  ({ id, label, icon: Icon, trailing, className, ...props }, ref) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-faint" />
        <Input
          id={id}
          ref={ref}
          className={cn("pl-11", trailing ? "pr-11" : "", className)}
          {...props}
        />
        {trailing && (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</div>
        )}
      </div>
    </div>
  )
);
IconField.displayName = "IconField";
