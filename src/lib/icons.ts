import {
  Award,
  BadgeCheck,
  Clock,
  CreditCard,
  Heart,
  Package,
  Phone,
  RefreshCw,
  ShieldCheck,
  Star,
  Truck,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * The icons a landing-page block may reference by name. Kept as an explicit
 * registry rather than a dynamic import so an unknown name from hand-edited
 * jsonb falls back instead of crashing the renderer.
 */
export const ICON_REGISTRY: Record<string, LucideIcon> = {
  ShieldCheck,
  Truck,
  BadgeCheck,
  Star,
  Heart,
  Zap,
  Package,
  Clock,
  Phone,
  CreditCard,
  RefreshCw,
  Award,
};

export function resolveIcon(name: string | undefined | null): LucideIcon {
  return (name && ICON_REGISTRY[name]) || BadgeCheck;
}
