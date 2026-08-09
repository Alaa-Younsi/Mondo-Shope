import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useLanguage } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Physical side. Callers pass `dir === "rtl" ? "left" : "right"`. */
  side?: "left" | "right";
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Drawer({
  open,
  onClose,
  title,
  side = "right",
  children,
  footer,
  className,
}: DrawerProps) {
  const { t } = useLanguage();
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Hardcoded framer-motion offsets are PHYSICAL and do not auto-flip with dir.
  const hiddenX = side === "left" ? "-100%" : "100%";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: hiddenX }}
            animate={{ x: 0 }}
            exit={{ x: hiddenX }}
            transition={{ type: "tween", duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "absolute inset-y-0 flex w-[min(26rem,100vw)] flex-col overflow-hidden border-line bg-panel",
              side === "left" ? "left-0 border-e" : "right-0 border-s",
              className,
            )}
          >
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-5 py-4">
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close")}
                className="-m-2 rounded-lg p-2 text-muted transition-colors hover:text-ink"
              >
                <X size={18} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

            {footer && (
              <footer className="shrink-0 border-t border-line px-5 py-4">{footer}</footer>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
