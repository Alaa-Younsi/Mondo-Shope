import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, KeyRound } from "lucide-react";
import { Wordmark } from "@/components/layout/Wordmark";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { LoadingBlock, Spinner } from "@/components/ui/Feedback";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useSeo } from "@/hooks/useSeo";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/i18n/translations";

const MIN_PASSWORD_LENGTH = 8;

type LinkState =
  | { phase: "checking" }
  | { phase: "ready" }
  | { phase: "invalid"; key: TranslationKey };

/**
 * Landing page for the recovery e-mail link.
 *
 * The Supabase client runs with detectSessionInUrl:false (see lib/supabase.ts),
 * so nothing consumes the token for us — this screen has to do it by hand. Two
 * shapes arrive depending on the project's auth flow:
 *
 *   PKCE (the client default)  →  ?code=...
 *   implicit                   →  #access_token=...&refresh_token=...
 *
 * Both are handled. The PKCE exchange needs the verifier this browser stored
 * when the link was REQUESTED, which is why a link opened on a different
 * device fails — rpSameDevice explains that rather than showing "expired".
 */
export default function AdminResetPassword() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [link, setLink] = useState<LinkState>({ phase: "checking" });
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<{ tone: "ok" | "error"; key: TranslationKey } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout>>();

  useSeo({ title: `${t("rpTitle")} | ${t("brandName")}`, noIndex: true });

  useEffect(() => () => clearTimeout(redirectTimer.current), []);

  useEffect(() => {
    let cancelled = false;

    const consumeLink = async () => {
      const query = new URLSearchParams(window.location.search);
      // The fragment carries a query string of its own after the '#'.
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

      // Supabase reports an expired or already-used link this way, on either
      // side of the URL.
      if (query.get("error") || hash.get("error")) {
        if (!cancelled) setLink({ phase: "invalid", key: "rpInvalidLink" });
        return;
      }

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const code = query.get("code");

      let failure: TranslationKey | null = null;

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) failure = "rpInvalidLink";
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        // No stored verifier means the link was opened in another browser.
        if (error) failure = "rpSameDevice";
      } else {
        failure = "rpInvalidLink";
      }

      // Strip the token from the address bar either way: it must not survive
      // in history, in a bookmark, or in a shared screenshot.
      window.history.replaceState({}, "", window.location.pathname);

      if (cancelled) return;
      setLink(failure ? { phase: "invalid", key: failure } : { phase: "ready" });
    };

    void consumeLink();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);

    if (next.length < MIN_PASSWORD_LENGTH) {
      setStatus({ tone: "error", key: "accPasswordTooShort" });
      return;
    }
    if (next !== confirm) {
      setStatus({ tone: "error", key: "accPasswordMismatch" });
      return;
    }

    setSaving(true);
    try {
      // No current-password check here, unlike /admin/compte: possession of the
      // e-mail link IS the proof, and requiring the old password would defeat
      // the whole point of the flow.
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        setStatus({ tone: "error", key: "adminSaveError" });
        return;
      }

      setStatus({ tone: "ok", key: "rpDone" });
      setNext("");
      setConfirm("");
      // Drop the recovery session so the new password is actually used, then
      // hand them the normal login screen.
      await supabase.auth.signOut();
      redirectTimer.current = setTimeout(
        () => navigate("/admin/login", { replace: true }),
        1600,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-shell fx-grid grid min-h-dvh place-items-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Wordmark />
        </div>

        <div className="space-y-4 rounded-2xl border border-line bg-panel p-6">
          <h1 className="font-display text-xl font-bold uppercase tracking-tight text-ink">
            {t("rpTitle")}
          </h1>

          {link.phase === "checking" && <LoadingBlock label={t("rpChecking")} />}

          {link.phase === "invalid" && (
            <>
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                {t(link.key)}
              </p>
              <Link
                to="/admin/mot-de-passe-oublie"
                className="block text-center text-sm text-brand hover:underline"
              >
                {t("fpTitle")}
              </Link>
            </>
          )}

          {link.phase === "ready" && (
            <form onSubmit={onSubmit} className="space-y-4">
              <p className="text-sm leading-relaxed text-muted">{t("rpText")}</p>

              <Field label={t("accNewPassword")} htmlFor="rp-new">
                <Input
                  id="rp-new"
                  type="password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  value={next}
                  onChange={(event) => setNext(event.target.value)}
                />
              </Field>

              <Field label={t("accConfirmPassword")} htmlFor="rp-confirm">
                <Input
                  id="rp-confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </Field>

              {status && (
                <p
                  role="status"
                  className={cn(
                    "rounded-lg border p-3 text-sm",
                    status.tone === "ok"
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-danger/40 bg-danger/10 text-danger",
                  )}
                >
                  {t(status.key)}
                </p>
              )}

              <Button type="submit" fullWidth size="lg" disabled={saving}>
                {saving ? <Spinner /> : <KeyRound size={15} />}
                {saving ? t("saving") : t("rpSubmit")}
              </Button>
            </form>
          )}

          <Link
            to="/admin/login"
            className="block text-center text-sm text-muted transition-colors hover:text-brand"
          >
            {t("rpGoToLogin")}
          </Link>
        </div>
      </div>
    </div>
  );
}
