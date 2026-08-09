import { useState } from "react";
import { Navigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { Wordmark } from "@/components/layout/Wordmark";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { LoadingBlock, Spinner } from "@/components/ui/Feedback";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useSeo } from "@/hooks/useSeo";

export default function AdminLogin() {
  const { t } = useLanguage();
  const { session, isLoading, signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useSeo({ title: `${t("adminLogin")} | ${t("brandName")}`, noIndex: true });

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <LoadingBlock />
      </div>
    );
  }

  if (session) return <Navigate to="/admin" replace />;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(false);
    setSubmitting(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (signInError) setError(true);
    // On success the auth listener flips `session` and the Navigate above runs.
  };

  return (
    <div className="fx-grid grid min-h-dvh place-items-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Wordmark />
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-line bg-panel p-6"
        >
          <h1 className="font-display text-xl font-bold uppercase tracking-tight text-ink">
            {t("adminLogin")}
          </h1>

          <Field label={t("adminEmail")} htmlFor="admin-email">
            <Input
              id="admin-email"
              type="email"
              dir="ltr"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field label={t("adminPassword")} htmlFor="admin-password">
            <Input
              id="admin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          {error && (
            <p
              className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
              role="alert"
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {t("adminLoginError")}
            </p>
          )}

          <Button type="submit" fullWidth size="lg" disabled={submitting}>
            {submitting && <Spinner />}
            {submitting ? t("adminSigningIn") : t("adminSignIn")}
          </Button>
        </form>
      </div>
    </div>
  );
}
