import { useRef, useState } from "react";
import { AlertCircle, Film, ImageIcon, Link2, Loader2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_UPLOAD_BYTES, isImageUrl, isVideoUrl, uploadMedia } from "@/lib/upload";
import { cn, formatBytes } from "@/lib/utils";

interface Props {
  workspaceId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

export function MediaUploader({ workspaceId, value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  async function handleFile(file: File) {
    setError(null);
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setError("Only image and video files are supported.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`);
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadMedia(file, workspaceId, setProgress);
      onChange(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function applyLink() {
    const url = linkValue.trim();
    if (!url) return;
    try {
      // eslint-disable-next-line no-new
      new URL(url);
    } catch {
      setError("That doesn't look like a valid URL.");
      return;
    }
    setError(null);
    onChange(url);
    setLinkValue("");
    setShowLink(false);
  }

  // ---- Preview of an already-set media URL ----
  if (value && !uploading) {
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-line bg-black/40">
          {isVideoUrl(value) ? (
            <video src={value} controls className="max-h-72 w-full bg-black object-contain" />
          ) : isImageUrl(value) ? (
            <img src={value} alt="Post media" className="max-h-72 w-full bg-black object-contain" />
          ) : (
            <div className="flex items-center gap-3 p-4 text-sm text-muted">
              <Link2 className="h-4 w-4 shrink-0 text-faint" />
              <a href={value} target="_blank" rel="noreferrer" className="truncate hover:text-ink">
                {value}
              </a>
            </div>
          )}
        </div>
        {!disabled && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              <UploadCloud className="h-4 w-4" /> Replace
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
            >
              <X className="h-4 w-4" /> Remove
            </Button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        {error && (
          <p className="flex items-center gap-1.5 text-sm text-red-300">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}
      </div>
    );
  }

  // ---- Uploading state ----
  if (uploading) {
    return (
      <div className="rounded-xl border border-violet-500/30 bg-violet-500/[0.06] p-6">
        <div className="flex items-center gap-3 text-sm text-ink">
          <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
          Uploading… {progress}%
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // ---- Empty dropzone ----
  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
          disabled
            ? "cursor-not-allowed border-line bg-surface opacity-60"
            : "cursor-pointer border-line bg-surface hover:border-violet-500/40 hover:bg-violet-500/[0.04]",
          dragging && "border-violet-500/60 bg-violet-500/[0.08]"
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-surface text-muted">
          <UploadCloud className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm font-medium text-ink">
          {dragging ? "Drop to upload" : "Drag & drop, or click to upload"}
        </p>
        <p className="mt-1 flex items-center gap-2 text-xs text-faint">
          <ImageIcon className="h-3.5 w-3.5" /> Images
          <Film className="h-3.5 w-3.5" /> Videos
          <span>· up to {formatBytes(MAX_UPLOAD_BYTES)}</span>
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      {!disabled &&
        (showLink ? (
          <div className="flex items-center gap-2">
            <Input
              type="url"
              autoFocus
              placeholder="https://…"
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyLink())}
            />
            <Button size="sm" onClick={applyLink}>
              Use link
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowLink(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowLink(true)}
            className="inline-flex items-center gap-1.5 text-xs text-faint hover:text-muted"
          >
            <Link2 className="h-3.5 w-3.5" /> or paste a link
          </button>
        ))}

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-red-300">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}
    </div>
  );
}
