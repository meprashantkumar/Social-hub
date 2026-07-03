import { Github, Heart } from "lucide-react";
import { Logo } from "@/components/shared/Logo";

const YEAR = new Date().getFullYear();
const GITHUB_URL = "https://github.com/meprashantkumar";

/** App footer — credits the author and links out to GitHub. */
export function Footer() {
  return (
    <footer className="relative mt-16 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
        <div className="flex items-center gap-2.5">
          <Logo showText />
          <span className="text-sm text-faint">© {YEAR}</span>
        </div>

        <p className="flex items-center gap-1.5 text-sm text-muted">
          Built with <Heart className="h-3.5 w-3.5 fill-violet-500 text-violet-500" /> by
          <span className="font-medium text-ink">Prashant Kumar Chaturvedi</span>
        </p>

        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-ink"
        >
          <Github className="h-4 w-4" /> GitHub
        </a>
      </div>
    </footer>
  );
}
