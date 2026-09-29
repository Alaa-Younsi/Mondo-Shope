import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { usePrefersReducedMotion } from "@/hooks/useMediaFlags";
import { cn, highPriorityImageProps, pick } from "@/lib/utils";
import type { HeroSlide } from "@/types/db";

const INTERVAL = 5000;

/**
 * The hero centrepiece — an image slider sitting where the reference site puts
 * its 3D canvas, and framed to match it: a hard-edged panel with corner ticks,
 * an accent halo, a mono counter and a segmented progress rail.
 *
 * Slides cross-fade rather than translate. A translating track has to branch on
 * `dir` to move the right way in Arabic; a cross-fade is direction-agnostic and
 * cannot end up half-scrolled after a resize.
 *
 * Autoplay stops whenever it would be wasted or unwanted: pointer over the
 * frame, focus inside it, tab hidden, slider scrolled off screen, or
 * prefers-reduced-motion set.
 */
export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const { t, lang, dir } = useLanguage();
  const reducedMotion = usePrefersReducedMotion();

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const frameRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<number | null>(null);

  const count = slides.length;

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  // A slide being deleted in the admin can leave the index past the end.
  useEffect(() => {
    setIndex((current) => (count === 0 ? 0 : Math.min(current, count - 1)));
  }, [count]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (reducedMotion || paused || !visible || count < 2) return;
    const timer = window.setInterval(() => go(index + 1), INTERVAL);
    return () => window.clearInterval(timer);
  }, [reducedMotion, paused, visible, count, index, go]);

  if (count === 0) return null;

  // The arrows sit at the physical edges, so the glyph must follow `dir` —
  // "previous" points at the start edge, which is the right one in Arabic.
  const PrevIcon = dir === "rtl" ? ChevronRight : ChevronLeft;
  const NextIcon = dir === "rtl" ? ChevronLeft : ChevronRight;

  const onPointerDown = (event: PointerEvent) => {
    pointerStart.current = event.clientX;
  };

  const onPointerUp = (event: PointerEvent) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (start === null) return;
    const delta = event.clientX - start;
    if (Math.abs(delta) < 40) return;
    // A drag toward the start edge advances, mirrored under RTL.
    const forward = dir === "rtl" ? delta > 0 : delta < 0;
    go(index + (forward ? 1 : -1));
  };

  return (
    <div
      ref={frameRef}
      className="group/slider relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Halo behind the frame — the glow the 3D canvas used to throw. */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 bg-[radial-gradient(circle,rgb(var(--c-brand)/0.18),transparent_70%)] blur-2xl"
      />

      <div
        className="fx-ticks neon-frame relative h-[clamp(340px,55vh,560px)] overflow-hidden border border-line bg-panel"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pointerStart.current = null;
        }}
      >
        {slides.map((slide, slideIndex) => {
          const active = slideIndex === index;
          const title = pick(lang, slide, "title");
          const subtitle = pick(lang, slide, "subtitle");
          const body = (
            <>
              <img
                src={slide.image_url}
                alt={title || ""}
                loading={slideIndex === 0 ? "eager" : "lazy"}
                decoding="async"
                // The first slide is the homepage's LCP element.
                {...(slideIndex === 0 ? highPriorityImageProps : {})}
                className={cn(
                  "h-full w-full object-cover transition-transform duration-[6000ms] ease-out",
                  active && !reducedMotion ? "scale-105" : "scale-100",
                )}
              />
              {/* Anchors the caption and keeps the ochre reading through. */}
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-bg via-bg/25 to-transparent"
              />
              {(title || subtitle) && (
                <div className="absolute inset-x-0 bottom-0 p-6 pb-16">
                  {title && (
                    <p className="font-display text-2xl font-bold uppercase leading-tight tracking-wide text-ink">
                      {title}
                    </p>
                  )}
                  {subtitle && (
                    <p className="mt-1 font-mono text-xs leading-relaxed text-muted">
                      {subtitle}
                    </p>
                  )}
                </div>
              )}
            </>
          );

          return (
            <div
              key={slide.id}
              aria-hidden={!active}
              className={cn(
                // `visibility` is transitioned alongside opacity so it flips
                // only once the fade-out finishes — and it is what actually
                // pulls a hidden slide's link out of the tab order. Opacity
                // alone leaves focus able to land on an invisible slide.
                "absolute inset-0 transition-[opacity,visibility] duration-700",
                active
                  ? "visible opacity-100"
                  : "invisible opacity-0 pointer-events-none",
              )}
            >
              {slide.link_url ? (
                slide.link_url.startsWith("http") ? (
                  <a
                    href={slide.link_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block h-full w-full"
                  >
                    {body}
                  </a>
                ) : (
                  <Link to={slide.link_url} className="block h-full w-full">
                    {body}
                  </Link>
                )
              ) : (
                <div className="h-full w-full">{body}</div>
              )}
            </div>
          );
        })}

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label={t("galleryPrevious")}
              className="absolute start-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-line bg-bg/70 text-ink opacity-0 backdrop-blur-sm transition-all hover:border-brand hover:text-brand focus-visible:opacity-100 group-hover/slider:opacity-100"
            >
              <PrevIcon size={18} />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label={t("galleryNext")}
              className="absolute end-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-line bg-bg/70 text-ink opacity-0 backdrop-blur-sm transition-all hover:border-brand hover:text-brand focus-visible:opacity-100 group-hover/slider:opacity-100"
            >
              <NextIcon size={18} />
            </button>

            <div className="absolute inset-x-0 bottom-0 flex items-center gap-4 border-t border-line bg-bg/80 px-4 py-3 backdrop-blur-sm">
              <span dir="ltr" className="font-mono text-[11px] tracking-widest text-brand">
                {String(index + 1).padStart(2, "0")}
                <span className="text-muted"> / {String(count).padStart(2, "0")}</span>
              </span>

              <div className="flex flex-1 gap-1.5">
                {slides.map((slide, slideIndex) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => go(slideIndex)}
                    aria-label={`${slideIndex + 1}`}
                    aria-current={slideIndex === index}
                    className="group/dot flex-1 py-2"
                  >
                    <span
                      className={cn(
                        "block h-[2px] w-full transition-colors",
                        slideIndex === index
                          ? "bg-brand"
                          : "bg-line group-hover/dot:bg-brand-dim",
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
