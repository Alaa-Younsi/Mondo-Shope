import { useMediaFlags } from "@/hooks/useMediaFlags";

/**
 * The hero backdrop: an accent-tinted grid with three blurred ochre orbs
 * drifting over it and two accent bars that sweep the section on a long loop.
 * All of it is CSS (see .hero-orb / .hero-glitch-bar in index.css) so it costs
 * nothing to animate and dies cleanly under prefers-reduced-motion.
 *
 * The orbs are gated off phones and data-saver: three 55px-blur layers are the
 * one genuinely expensive thing on this page, and the grid alone still carries
 * the section.
 */
export function HeroArt() {
  const { heavyOk } = useMediaFlags();

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="accent-grid-bg absolute inset-0 opacity-60" />

      {heavyOk && (
        <>
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-orb hero-orb-3" />
          <div className="hero-glitch-bar hero-glitch-bar-1" />
          <div className="hero-glitch-bar hero-glitch-bar-2" />
        </>
      )}
    </div>
  );
}
