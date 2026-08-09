import { useState } from "react";
import { KeyRound } from "lucide-react";
import { AdminPage, Panel } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Feedback";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageProvider";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/i18n/translations";

const MIN_PASSWORD_LENGTH = 8;

export default function AdminAccount() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<{ tone: "ok" | "error"; key: TranslationKey } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);

    // All three outcomes get distinct messages — one generic "failed" here
    // reads as a broken form.
    if (next.length < MIN_PASSWORD_LENGTH) {
      setStatus({ tone: "error", key: "accPasswordTooShort" });
      return;
    }
    if (next !== confirm) {
      setStatus({ tone: "error", key: "accPasswordMismatch" });
      return;
    }
    if (!user?.email) return;

    setSaving(true);
    try {
      /*
       * Re-verify the CURRENT password before writing the new one. This is the
       * point of the feature, not ceremony: a Supabase session outlives the
       * browser tab by days, and updateUser({ password }) asks for no proof of
       * the old password — the access token is all it checks. Without this,
       * anyone reaching an unattended dashboard can lock the owner out of it.
       *
       * A failed sign-in returns an error WITHOUT disturbing the session we
       * already hold.
       */
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current,
      });
      if (authError) {
        setStatus({ tone: "error", key: "accWrongPassword" });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        setStatus({ tone: "error", key: "adminSaveError" });
        return;
      }

      setStatus({ tone: "ok", key: "accPasswordUpdated" });
      setCurrent("");
      setNext("");
      setConfirm("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPage title={t("accTitle")}>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("accEmail")}>
          <p dir="ltr" className="font-mono text-sm text-ink">
            {user?.email ?? "—"}
          </p>
        </Panel>

        <Panel title={t("accChangePassword")}>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label={t("accCurrentPassword")} htmlFor="acc-current">
              <Input
                id="acc-current"
                type="password"
                required
                autoComplete="current-password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
              />
            </Field>

            <Field label={t("accNewPassword")} htmlFor="acc-new">
              <Input
                id="acc-new"
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                // new-password so a password manager offers to UPDATE the
                // stored entry rather than autofilling the old one.
                autoComplete="new-password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
              />
            </Field>

            <Field label={t("accConfirmPassword")} htmlFor="acc-confirm">
              <Input
                id="acc-confirm"
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

            <Button type="submit" disabled={saving} fullWidth>
              {saving ? <Spinner /> : <KeyRound size={15} />}
              {saving ? t("saving") : t("accUpdatePassword")}
            </Button>
          </form>
        </Panel>
      </div>
    </AdminPage>
  );
}
