import { Suspense, useEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ExternalLink,
  Languages,
  LogOut,
  Menu,
  Moon,
  ShieldAlert,
  Sun,
  X,
} from "lucide-react";
import { Wordmark } from "@/components/layout/Wordmark";
import { AdminToastProvider } from "@/components/admin/AdminToastProvider";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/Feedback";
import { useAuth } from "@/hooks/useAuth";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { ADMIN_SECTIONS } from "@/lib/adminSections";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/i18n/translations";

interface SidebarProps {
  t: (key: TranslationKey) => string;
  theme: "dark" | "light";
  toggleTheme: () => void;
  lang: "fr" | "ar";
  setLang: (lang: "fr" | "ar") => void;
  onSignOut: () => void;
  onNavigate?: () => void;
}

/**
 * MODULE scope, deliberately.
 *
 * Declared inside AdminLayout's render body this gets a new function identity
 * every render, so React unmounts and remounts the whole drawer subtree instead
 * of updating it. A touch tap only fires `click` when pointerdown and pointerup
 * land on the SAME element — with 100ms+ between them, any incidental re-render
 * (an auth refresh, a React Query refetch) swaps the button out mid-tap and the
 * drawer becomes impossible to close.
 */
function SidebarContent({
  t,
  theme,
  toggleTheme,
  lang,
  setLang,
  onSignOut,
  onNavigate,
}: SidebarProps) {
  return (
    <>
      {/* Only the links list scrolls. With overflow on the <aside> instead, the
          wordmark and the sign-out button scroll away with it. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <nav className="flex flex-col gap-1">
          {ADMIN_SECTIONS.map((section) => (
            <NavLink
              key={section.key}
              to={section.route}
              end={section.exact}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-brand/10 text-brand"
                    : "text-muted hover:bg-panel-2 hover:text-ink",
                )
              }
            >
              <section.icon size={17} className="shrink-0" />
              <span className="truncate">{t(section.labelKey)}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-4 shrink-0 space-y-1 border-t border-line pt-4">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-panel-2 hover:text-ink"
        >
          <ExternalLink size={16} className="shrink-0" />
          {t("adminBackToSite")}
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-panel-2 hover:text-ink"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          {t("toggleTheme")}
        </button>

        <button
          type="button"
          onClick={() => setLang(lang === "fr" ? "ar" : "fr")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-panel-2 hover:text-ink"
        >
          <Languages size={16} />
          {lang === "fr" ? "العربية" : "Français"}
        </button>

        <button
          type="button"
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-danger transition-colors hover:bg-danger/10"
        >
          <LogOut size={16} />
          {t("adminSignOut")}
        </button>
      </div>
    </>
  );
}

export function AdminLayout() {
  const { t, lang, setLang, dir } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { session, user, isLoading: authLoading, signOut } = useAuth();
  const { isAdmin, isLoading: profileLoading } = useAdminProfile(user?.id);
  const { pathname } = useLocation();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useScrollLock(drawerOpen);

  // Belt and braces: a redirect or the back button changes the route with no
  // click on the drawer at all.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // The drawer is lg:hidden — a resize past the breakpoint would otherwise
  // strand it open with the scroll lock applied to an invisible element.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (query.matches) setDrawerOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // The scrolling element is <main>, not the window, so a global ScrollToTop
  // cannot reach it — every route change would otherwise land mid-page.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  // 1. Hold the loading screen while the profile is still resolving, or the
  //    first render bounces a legitimate admin.
  if (authLoading || (session && profileLoading)) {
    return (
      <div className="admin-shell grid min-h-dvh place-items-center bg-bg">
        <LoadingBlock label={t("loading")} />
      </div>
    );
  }

  // 2. No session at all.
  if (!session) return <Navigate to="/admin/login" replace state={{ from: pathname }} />;

  // 3. Signed in but not on the allow-list: a real screen with a way out, not
  //    an empty dashboard and not a redirect loop.
  if (!isAdmin) {
    return (
      <div className="admin-shell grid min-h-dvh place-items-center bg-bg px-6">
        <div className="max-w-md text-center">
          <ShieldAlert size={44} className="mx-auto text-danger" />
          <h1 className="mt-5 font-display text-2xl font-bold uppercase tracking-tight text-ink">
            {t("adminNoAccessTitle")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">{t("adminNoAccessText")}</p>
          <Button variant="outline" className="mt-7" onClick={() => void signOut()}>
            <LogOut size={15} />
            {t("adminSignOut")}
          </Button>
        </div>
      </div>
    );
  }

  const sidebarProps: SidebarProps = {
    t,
    theme,
    toggleTheme,
    lang,
    setLang,
    onSignOut: () => void signOut(),
  };

  return (
    <AdminToastProvider>
      {/* h-dvh + overflow-hidden, NOT min-h-screen: pinned, a 300-row orders
          table cannot drag the sidebar up out of view. */}
      <div className="admin-shell flex h-dvh overflow-hidden bg-bg">
        <aside className="hidden h-full w-64 shrink-0 flex-col overflow-hidden border-e border-line bg-panel p-5 lg:flex">
          <div className="mb-8 shrink-0">
            <Wordmark to="/admin" size="sm" />
          </div>
          <SidebarContent {...sidebarProps} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-4 lg:hidden">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label={t("openMenu")}
              className="-m-2 rounded-lg p-2 text-ink"
            >
              <Menu size={20} />
            </button>
            <Wordmark to="/admin" size="sm" />
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={t("toggleTheme")}
              className="-m-2 ms-auto rounded-lg p-2 text-muted"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </header>

          <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto">
            {/* Suspense is scoped to the routed Outlet ONLY. Around AdminLayout
                instead, a lazy chunk suspending would tear down the layout (and
                the drawer) mid-close, leaving AnimatePresence's exit unfinished
                and the drawer stuck open and inert. */}
            <Suspense fallback={<LoadingBlock label={t("loading")} />}>
              <Outlet />
            </Suspense>
          </main>
        </div>

        <AnimatePresence>
          {drawerOpen && (
            <div className="fixed inset-0 z-[100] lg:hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setDrawerOpen(false)}
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              />
              <motion.aside
                // Physical offset — does NOT auto-flip with dir.
                initial={{ x: dir === "rtl" ? "100%" : "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: dir === "rtl" ? "100%" : "-100%" }}
                transition={{ type: "tween", duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "absolute inset-y-0 flex h-full w-[min(17rem,85vw)] flex-col overflow-hidden border-line bg-panel p-5",
                  dir === "rtl" ? "right-0 border-s" : "left-0 border-e",
                )}
              >
                <div className="mb-8 flex shrink-0 items-center justify-between">
                  <Wordmark to="/admin" size="sm" />
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    aria-label={t("closeMenu")}
                    // ≥44px tap target around an 18px glyph.
                    className="-m-2 rounded-lg p-2 text-muted transition-colors hover:text-ink"
                  >
                    <X size={18} />
                  </button>
                </div>
                <SidebarContent {...sidebarProps} onNavigate={() => setDrawerOpen(false)} />
              </motion.aside>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AdminToastProvider>
  );
}
