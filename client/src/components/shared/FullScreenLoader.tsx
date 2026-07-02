import { Loader2 } from "lucide-react";
import { GridBackground } from "./GridBackground";
import { Logo } from "./Logo";

export function FullScreenLoader() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6">
      <GridBackground />
      <Logo showText={false} className="scale-125" />
      <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
    </div>
  );
}
