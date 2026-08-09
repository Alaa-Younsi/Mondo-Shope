import { useRef } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useAdminUpload } from "@/hooks/useAdminUpload";
import { useAdminToast } from "./AdminToastProvider";
import { useLanguage } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

interface SingleProps {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  prefix?: string;
  className?: string;
  /** Compact square control, used inside the colour rows. */
  compact?: boolean;
}

export function ImageUploader({
  value,
  onChange,
  label,
  prefix = "",
  className,
  compact,
}: SingleProps) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { upload, uploading } = useAdminUpload();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const url = await upload(file, "product-images", prefix);
    if (!url) {
      toast.error(t("adminUploadError"));
      return;
    }
    onChange(url);
  };

  const size = compact ? "h-11 w-11" : "h-28 w-28";

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "relative shrink-0 overflow-hidden rounded-lg border border-dashed border-line bg-panel-2 transition-colors hover:border-brand disabled:opacity-60",
            size,
          )}
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-muted">
              {uploading ? (
                <Loader2 size={compact ? 15 : 20} className="animate-spin" />
              ) : (
                <ImagePlus size={compact ? 15 : 20} />
              )}
            </span>
          )}
        </button>

        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={t("delete")}
            className="rounded-lg border border-line p-2 text-muted transition-colors hover:border-danger hover:text-danger"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}

interface MultiProps {
  urls: string[];
  onChange: (urls: string[]) => void;
  prefix?: string;
}

export function MultiImageUploader({ urls, onChange, prefix = "" }: MultiProps) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { upload, uploading } = useAdminUpload();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const uploaded: string[] = [];
    let failed = false;

    for (const file of Array.from(files)) {
      const url = await upload(file, "product-images", prefix);
      if (url) uploaded.push(url);
      else failed = true;
    }

    if (uploaded.length > 0) onChange([...urls, ...uploaded]);
    if (failed) toast.error(t("adminUploadError"));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= urls.length) return;
    const next = [...urls];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {urls.map((url, index) => (
          <div
            key={url}
            className="group relative h-24 w-24 overflow-hidden rounded-lg border border-line bg-panel-2"
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
            {index === 0 && (
              <span className="absolute inset-x-0 bottom-0 bg-brand/90 py-0.5 text-center font-mono text-[9px] uppercase text-brand-ink">
                1
              </span>
            )}
            <button
              type="button"
              onClick={() => onChange(urls.filter((entry) => entry !== url))}
              aria-label={t("delete")}
              className="absolute end-1 top-1 rounded bg-black/70 p-1 text-white transition-colors hover:bg-danger"
            >
              <X size={12} />
            </button>
            <div className="absolute start-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => move(index, index - 1)}
                className="rounded bg-black/70 px-1.5 py-1 text-[10px] text-white"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => move(index, index + 1)}
                className="rounded bg-black/70 px-1.5 py-1 text-[10px] text-white"
              >
                ›
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-panel-2 text-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
        >
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
          <span className="px-1 text-center text-[10px] leading-tight">
            {uploading ? t("prodUploading") : t("prodDropImages")}
          </span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
