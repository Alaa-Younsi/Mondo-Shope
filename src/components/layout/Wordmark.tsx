import { Link } from "react-router-dom";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/lib/utils";

/**
 * The wordmark carries the whole brand, so no companion text is needed.
 *
 * width/height match public/logo.png's 1048x428 aspect ratio (~2.45:1) so the
 * header reserves the right box and nothing shifts as the image decodes. If
 * the logo is ever re-cropped by scripts/prepare-logo.py, update these.
 */
const RATIO = 1048 / 428;

/**
 * TWO FILES, one per theme — not a style choice, a contrast one.
 *
 * The original logo is two light marks (#FFAB40 "MONDO", #EBEFF2 "SHOPE") drawn
 * for the near-black dark theme. On the light theme the pale half vanishes, and
 * there is no background that fixes it: anything dark enough to show #EBEFF2 at
 * 3:1 drops dark body text below 4.5:1, so the two requirements never overlap.
 * logo-light.png re-inks both halves for parchment (scripts/make-light-logo.py)
 * and is regenerated from logo.png whenever that changes.
 */
const LOGO_SRC: Record<"dark" | "light", string> = {
  dark: "/logo.png",
  light: "/logo-light.png",
};

export function Wordmark({
  className,
  to = "/",
  size = "md",
}: {
  className?: string;
  to?: string;
  size?: "sm" | "md";
}) {
  const { theme } = useTheme();
  const height = size === "sm" ? 32 : 40;

  return (
    <Link
      to={to}
      className={cn("inline-flex shrink-0 items-center", className)}
      aria-label="Mondo Shope"
    >
      <img
        src={LOGO_SRC[theme]}
        alt="Mondo Shope"
        width={Math.round(height * RATIO)}
        height={height}
        className={cn("w-auto object-contain", size === "sm" ? "h-8" : "h-10")}
      />
    </Link>
  );
}
