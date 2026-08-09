import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingBag,
  Truck,
  Star,
  LayoutTemplate,
  Radio,
  Settings,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import type { TranslationKey } from "@/i18n/translations";

/**
 * Single source of truth for the admin sidebar and the route table.
 * Adding a page means adding one row here plus its <Route> in App.tsx.
 */
export interface AdminSection {
  key: string;
  route: string;
  /** Only the overview matches exactly; everything else matches by prefix. */
  exact?: boolean;
  labelKey: TranslationKey;
  icon: LucideIcon;
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { key: "dashboard", route: "/admin", exact: true, labelKey: "navDashboard", icon: LayoutDashboard },
  { key: "products", route: "/admin/produits", labelKey: "navProducts", icon: Package },
  { key: "categories", route: "/admin/categories", labelKey: "navCategoriesAdmin", icon: FolderTree },
  { key: "orders", route: "/admin/commandes", labelKey: "navOrders", icon: ShoppingBag },
  { key: "landing", route: "/admin/pages", labelKey: "navLandingPages", icon: LayoutTemplate },
  { key: "delivery", route: "/admin/livraison", labelKey: "navDelivery", icon: Truck },
  { key: "reviews", route: "/admin/avis", labelKey: "navReviews", icon: Star },
  { key: "pixels", route: "/admin/pixels", labelKey: "navPixels", icon: Radio },
  { key: "settings", route: "/admin/parametres", labelKey: "navSettings", icon: Settings },
  { key: "account", route: "/admin/compte", labelKey: "navAccount", icon: UserCircle },
];

/**
 * Resolve a pathname to its section. The exact `/admin` overview is checked
 * first, then the LONGEST matching route prefix — otherwise `/admin` shadows
 * everything as a prefix and `/admin/produits/new` fails to resolve.
 */
export function routeToSection(pathname: string): string | null {
  const exact = ADMIN_SECTIONS.find((s) => s.exact && s.route === pathname);
  if (exact) return exact.key;

  const matches = ADMIN_SECTIONS.filter(
    (s) => !s.exact && (pathname === s.route || pathname.startsWith(`${s.route}/`)),
  ).sort((a, b) => b.route.length - a.route.length);

  return matches[0]?.key ?? null;
}
