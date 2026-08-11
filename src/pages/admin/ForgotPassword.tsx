import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, MailCheck, Send } from "lucide-react";
import { Wordmark } from "@/components/layout/Wordmark";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Feedback";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useSeo } from "@/hooks/useSeo";
import { sendPasswordResetEmail } from "@/lib/passwordReset";

/**
 * The signed-OUT half of the forgot-password flow: reached from the login
 * screen when the client cannot get in at all. The signed-IN half lives on
 * /admin/compte, which can skip the e-mail entry.
 */
export default function AdminForgotPassword() {
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useSeo({ title: `${t("fpTitle")} | ${t("brandName")}`, noIndex: true });

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(false);
    setSubmitting(true);
    const { error: sendError } = await sendPasswordResetEmail(email.trim());
    setSubmitting(false);
    // Never branch the success message on whether the account exists — that
    // turns this form into an admin-address oracle.
    if (sendError) setError(true);
    else setSent(true);
  };

  return (
    <div className="admin-shell fx-grid grid min-h-dvh place-items-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Wordmark />
        </div>

        <div className="space-y-4 rounded-2xl border border-line bg-panel p-6">
          <h1 className="font-display text-xl font-bold uppercase tracking-tight text-ink">
            {t("fpTitle")}
          </h1>

          {sent ? (
            <>
              <p
                role="status"
                className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success"
              >
                <MailCheck size={15} className="mt-0.5 shrink-0" />
                {t("fpSent")}
              </p>
              <p className="text-sm leading-relaxed text-muted">{t("rpSameDevice")}</p>
            </>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <p className="text-sm leading-relaxed text-muted">{t("fpText")}</p>

              <Field label={t("adminEmail")} htmlFor="fp-email">
                <Input
                  id="fp-email"
                  type="email"
                  dir="ltr"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>

              {error && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
                >
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  {t("fpError")}
                </p>
              )}

              <Button type="submit" fullWidth size="lg" disabled={submitting}>
                {submitting ? <Spinner /> : <Send size={15} />}
                {submitting ? t("fpSending") : t("fpSend")}
              </Button>
            </form>
          )}

          <Link
            to="/admin/login"
            className="flex items-center justify-center gap-2 text-sm text-muted transition-colors hover:text-brand"
          >
            <ArrowLeft size={14} className="rtl:rotate-180" />
            {t("fpBackToLogin")}
          </Link>
        </div>
      </div>
    </div>
  );
}
