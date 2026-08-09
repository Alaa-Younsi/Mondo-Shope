import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * The wordmark carries the whole brand, so no companion text is needed.
 *
 * width/height match public/logo.png's 1048x428 aspect ratio (~2.45:1) so the
 * header reserves the right box and nothing shifts as the image decodes. If
 * the logo is ever re-cropped by scripts/prepare-logo.py, update these.
 */
const RATIO = 1048 / 428;

export function Wordmark({
  className,
  to = "/",
  size = "md",
}: {
  className?: string;
  to?: string;
  size?: "sm" | "md";
}) {
  const height = size === "sm" ? 32 : 40;

  return (
    <Link
      to={to}
      className={cn("inline-flex shrink-0 items-center", className)}
      aria-label="Mondo Shope"
    >
      <img
        src="/logo.png"
        alt="Mondo Shope"
        width={Math.round(height * RATIO)}
        height={height}
        className={cn("w-auto object-contain", size === "sm" ? "h-8" : "h-10")}
      />
    </Link>
  );
}
