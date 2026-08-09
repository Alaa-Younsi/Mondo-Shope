import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

/**
 * Filled accent / accent outline / neutral outline, all square — the reference
 * site's button system. `primary` darkens to brand-dim on hover rather than
 * glowing, so a row of buttons never lights up the whole section.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "border border-brand bg-brand text-brand-ink hover:border-brand-dim hover:bg-brand-dim",
  secondary:
    "border border-brand bg-transparent text-brand hover:bg-brand hover:text-brand-ink",
  ghost: "border border-transparent bg-transparent text-muted hover:text-ink",
  danger: "border border-danger bg-danger text-white hover:brightness-110",
  outline: "border border-line bg-transparent text-ink hover:border-brand hover:text-brand",
};

const SIZES: Record<Size, string> = {
  // ≥44px tall on md/lg: these are tapped on phones.
  sm: "h-9 px-3 text-xs gap-1.5",
  md: "h-11 px-6 text-sm gap-2",
  lg: "h-13 px-8 text-base gap-2.5",
};

const BASE =
  "fx-sweep inline-flex items-center justify-center font-display font-bold uppercase tracking-widest transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
}

export type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", fullWidth, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className)}
      {...rest}
    >
      {children}
    </button>
  );
});

interface ButtonLinkProps extends CommonProps {
  to: string;
  /** External links render an <a> with the same styling. */
  external?: boolean;
  target?: string;
  rel?: string;
  onClick?: () => void;
}

export function ButtonLink({
  to,
  external,
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  const classes = cn(
    BASE,
    VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
    className,
  );

  if (external) {
    return (
      <a href={to} className={classes} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <Link to={to} className={classes} {...rest}>
      {children}
    </Link>
  );
}
