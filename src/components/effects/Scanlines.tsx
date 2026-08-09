/**
 * Fixed scanline veil — the reference site's texture, done with one CSS
 * gradient instead of anything animated. pointer-events:none, and it disappears
 * entirely under prefers-reduced-motion (see index.css).
 */
export function Scanlines() {
  return <div className="fx-scanlines" aria-hidden />;
}
