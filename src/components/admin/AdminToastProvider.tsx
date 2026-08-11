import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, TriangleAlert, X } from "lucide-react";

type Tone = "success" | "error";

interface Toast {
  id: number;
  tone: Tone;
  text: string;
}

interface ToastContextValue {
  success: (text: string) => void;
  error: (text: string) => void;
}

const ToastCtx = createContext<ToastContextValue | null>(null);

/**
 * Mounted in AdminLayout AROUND the <Outlet />, so a toast fired by a page that
 * then navigates away still renders.
 */
export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);

  // Timers live on the provider and are cleared on unmount.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) window.clearTimeout(timer);
    };
  }, []);

  const push = useCallback((tone: Tone, text: string) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, tone, text }]);
    const timer = window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      tone === "error" ? 6000 : 3500,
    );
    timers.current.push(timer);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (text: string) => push("success", text),
      error: (text: string) => push("error", text),
    }),
    [push],
  );

  return (
    <ToastCtx.Provider value={value}>
      {children}

      {/* admin-shell: the toast stack is a sibling of the dashboard tree, so it
          needs the class itself to pick up the admin type scale. */}
      <div className="admin-shell pointer-events-none fixed inset-x-4 bottom-4 z-[200] flex flex-col items-center gap-2 sm:inset-x-auto sm:end-6 sm:items-end">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ y: 12, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              role="status"
              className={
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg " +
                (toast.tone === "error"
                  ? "border-danger/50 bg-danger/10 text-danger"
                  : "border-success/50 bg-success/10 text-success")
              }
            >
              {toast.tone === "error" ? (
                <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              ) : (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              )}
              <span className="min-w-0 flex-1 text-ink">{toast.text}</span>
              <button
                type="button"
                onClick={() =>
                  setToasts((current) => current.filter((entry) => entry.id !== toast.id))
                }
                className="-m-1 shrink-0 rounded p-1 text-muted transition-colors hover:text-ink"
                aria-label="×"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useAdminToast(): ToastContextValue {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useAdminToast must be used inside <AdminToastProvider>");
  return ctx;
}
