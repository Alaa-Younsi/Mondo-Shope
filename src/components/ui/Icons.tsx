/**
 * Hand-drawn header icons.
 *
 * The header controls previously used stock icons at 18-22px, which rendered as
 * thin grey scratches against the dark ground. These are drawn on a 24-unit
 * grid with a heavier 1.7 stroke, round caps and joins, and geometry that stays
 * legible when the accent glow sits behind them.
 *
 * `vector-effect: non-scaling-stroke` keeps the weight identical at every size,
 * so bumping one of these to 26px does not thin the line.
 */

interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  vectorEffect: "non-scaling-stroke" as const,
  "aria-hidden": true,
  focusable: false as const,
});

/** Globe with meridian + equator — reads as "language" at a glance. */
export function GlobeIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.2 9.4h17.6M3.2 14.6h17.6" />
      <path d="M12 3c2.6 2.5 4 5.6 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.6-4-9s1.4-6.5 4-9Z" />
    </svg>
  );
}

/** Sun with eight rays: longer cardinals, shorter diagonals. */
export function SunIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="4.1" />
      <path d="M12 1.9v2.4M12 19.7v2.4M22.1 12h-2.4M4.3 12H1.9" />
      <path d="M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7M19.1 19.1l-1.7-1.7M6.6 6.6L4.9 4.9" />
    </svg>
  );
}

/** Crescent moon with two stars — distinct from the sun at small sizes. */
export function MoonIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M20.8 15.1A9.2 9.2 0 0 1 8.9 3.2a9.3 9.3 0 1 0 11.9 11.9Z" />
      <path d="M17.4 3.2v2.6M18.7 4.5h-2.6" />
    </svg>
  );
}

/** Shopping cart with a squared basket — heavier than the stock outline. */
export function CartIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M2.4 3.1h2.1a1 1 0 0 1 1 .82l.35 1.98" />
      <path d="M5.85 5.9h15.2l-1.6 7.62a1.9 1.9 0 0 1-1.86 1.5H9.1a1.9 1.9 0 0 1-1.87-1.56L5.85 5.9Z" />
      <circle cx="9.6" cy="19.8" r="1.6" />
      <circle cx="17.4" cy="19.8" r="1.6" />
    </svg>
  );
}

/** Hamburger with a shortened middle rule. */
export function MenuIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3.2 6.4h17.6M3.2 12h12.4M3.2 17.6h17.6" />
    </svg>
  );
}

export function CloseIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M5.4 5.4l13.2 13.2M18.6 5.4L5.4 18.6" />
    </svg>
  );
}
