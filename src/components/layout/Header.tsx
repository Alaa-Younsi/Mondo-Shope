import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Moon, ShoppingCart, Sun, X } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { CartDrawer } from "./CartDrawer";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { useScrollLock } from "@/hooks/useScrollLock";
import { cartCount, useCart } from "@/store/cart";
import { cn, pick } from "@/lib/utils";
import { Num } from "@/components/ui/Price";

const NAV = [
  { to: "/", labelKey: "navHome" },
  { to: "/shop", labelKey: "navShop" },
] as const;

export function Header() {
  const { t, lang, setLang, dir } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const items = useCart((state) => state.items);
  const { data: settings } = useStoreSettings();

  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useScrollLock(menuOpen);

  // A redirect or the back button changes the route with no click.
  useEffect(() => {
    setMenuOpen(false);
    setCartOpen(false);
  }, [pathname]);

  // The mobile menu is md:hidden — a resize past the breakpoint would otherwise
  // strand it open with the scroll lock applied to an invisible panel.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (query.matches) setMenuOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // The bar lifts off the page once you leave the hero, exactly like the
  // reference site: an accent shadow rather than a heavier background.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const count = cartCount(items);
  const announcement = settings?.announcement_active
    ? pick(lang, settings, "announcement")
    : "";

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "relative py-2 font-display text-sm uppercase tracking-[0.1em] transition-colors",
      isActive ? "text-brand" : "text-muted hover:text-ink",
    );

  return (
    <>
      {announcement && (
        <div className="bg-brand px-4 py-2 text-center font-mono text-[11px] uppercase tracking-wider text-brand-ink">
          {announcement}
        </div>
      )}

      <header
        className={cn(
          "sticky top-0 z-50 border-b border-line bg-bg/90 backdrop-blur-md transition-shadow duration-300",
          scrolled && "shadow-[0_2px_20px_rgb(var(--c-brand)/0.15)]",
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t("openMenu")}
            className="-m-2 p-2 text-ink transition-colors hover:text-brand md:hidden"
          >
            <Menu size={22} />
          </button>

          <Wordmark />

          <nav className="ms-8 hidden items-center gap-8 md:flex">
            {NAV.map((entry) => (
              <NavLink
                key={entry.to}
                to={entry.to}
                end={entry.to === "/"}
                className={navLinkClass}
              >
                {({ isActive }) => (
                  <>
                    {t(entry.labelKey)}
                    {isActive && (
                      <motion.span
                        layoutId="activeNavLink"
                        className="absolute inset-x-0 bottom-0 h-[2px] bg-brand"
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setLang(lang === "fr" ? "ar" : "fr")}
              aria-label={t("toggleLanguage")}
              className="px-1 font-mono text-xs uppercase tracking-widest text-muted transition-colors hover:text-brand"
            >
              {lang === "fr" ? "ع" : "FR"}
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={t("toggleTheme")}
              className="text-muted transition-colors hover:text-brand"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label={t("cart")}
              className="relative text-ink transition-colors hover:text-brand"
            >
              <ShoppingCart size={22} />
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  className="absolute -end-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand px-1 font-mono text-[10px] font-bold leading-none text-brand-ink"
                >
                  <Num value={count} />
                </motion.span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-[100] md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 bg-black/80"
            />
            <motion.nav
              // Physical offset: must branch on dir, it does not auto-flip.
              initial={{ x: dir === "rtl" ? "100%" : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: dir === "rtl" ? "100%" : "-100%" }}
              transition={{ type: "tween", duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "absolute inset-y-0 flex w-[min(20rem,85vw)] flex-col border-line bg-bg",
                dir === "rtl" ? "right-0 border-s" : "left-0 border-e",
              )}
            >
              <div className="flex items-center justify-between border-b border-line p-6">
                <Wordmark size="sm" />
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label={t("closeMenu")}
                  className="-m-2 p-2 text-muted transition-colors hover:text-ink"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-1 flex-col p-6">
                {NAV.map((entry) => (
                  <Link
                    key={entry.to}
                    to={entry.to}
                    className="border-b border-panel-2 py-3 font-display text-sm uppercase tracking-widest text-muted transition-colors hover:text-ink"
                  >
                    {t(entry.labelKey)}
                  </Link>
                ))}
              </div>
            </motion.nav>
          </div>
        )}
      </AnimatePresence>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
