import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageProvider";
import { usePrefersReducedMotion } from "@/hooks/useMediaFlags";
import { cn, highPriorityImageProps } from "@/lib/utils";

export interface GalleryImage {
  key: string;
  url: string;
  alt?: string | null;
}

interface GalleryProps {
  images: GalleryImage[];
  activeIndex: number;
  onActiveChange: (index: number) => void;
  className?: string;
}

const SWIPE_THRESHOLD = 60;

/**
 * Domain-agnostic gallery. It owns NO state: a colour swatch, a thumbnail click
 * and a swipe all drive the same index held by the parent page — which is what
 * lets picking "red" jump the gallery to the red photo.
 */
export function Gallery({ images, activeIndex, onActiveChange, className }: GalleryProps) {
  const { t, dir } = useLanguage();
  const reducedMotion = usePrefersReducedMotion();

  if (images.length === 0) {
    return (
      <div className={cn("aspect-square w-full rounded-xl border border-line bg-panel-2", className)}>
        <div className="fx-grid h-full w-full rounded-xl opacity-40" />
      </div>
    );
  }

  const safeIndex = Math.min(Math.max(activeIndex, 0), images.length - 1);
  const image = images[safeIndex];

  const step = (delta: number) =>
    onActiveChange((safeIndex + delta + images.length) % images.length);

  const onDragEnd = (_event: unknown, info: PanInfo) => {
    // Flip the sign in RTL so a physical left-swipe still means "next".
    const offset = dir === "rtl" ? -info.offset.x : info.offset.x;
    if (offset <= -SWIPE_THRESHOLD) step(1);
    else if (offset >= SWIPE_THRESHOLD) step(-1);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <motion.div
        drag={images.length > 1 ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.25}
        onDragEnd={onDragEnd}
        // Lets vertical page-scroll still work over the gallery.
        style={{ touchAction: "pan-y" }}
        className="relative aspect-square w-full overflow-hidden rounded-xl border border-line bg-panel-2"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.img
            key={image.key}
            src={image.url}
            alt={image.alt ?? ""}
            width={1000}
            height={1000}
            // The LCP element on a product page.
            loading="eager"
            decoding="async"
            {...highPriorityImageProps}
            draggable={false}
            initial={reducedMotion ? false : { opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="h-full w-full select-none object-cover"
          />
        </AnimatePresence>

        {images.length > 1 && (
          <div className="pointer-events-none absolute bottom-3 end-3 rounded-full bg-black/60 px-2.5 py-1 font-mono text-[11px] text-white">
            <span dir="ltr">
              {safeIndex + 1}/{images.length}
            </span>
          </div>
        )}
      </motion.div>

      {images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {images.map((entry, index) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => onActiveChange(index)}
              aria-label={`${t("preview")} ${index + 1}`}
              className={cn(
                "h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                index === safeIndex ? "border-brand" : "border-line hover:border-muted",
              )}
            >
              <img
                src={entry.url}
                alt=""
                width={64}
                height={64}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
