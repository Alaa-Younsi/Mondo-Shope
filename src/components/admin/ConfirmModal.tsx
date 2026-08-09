import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Feedback";
import { useLanguage } from "@/i18n/LanguageProvider";

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  text,
  confirmLabel,
  busy,
  extraAction,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  text?: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  extraAction?: ReactNode;
}) {
  const { t } = useLanguage();

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title={title}
      footer={
        <div className="flex flex-col gap-2">
          {extraAction}
          <Button variant="danger" onClick={onConfirm} disabled={busy} fullWidth>
            {busy && <Spinner />}
            {confirmLabel ?? t("delete")}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy} fullWidth>
            {t("cancel")}
          </Button>
        </div>
      }
    >
      <div className="flex gap-4">
        <TriangleAlert size={26} className="mt-0.5 shrink-0 text-danger" />
        <div className="min-w-0 space-y-2 text-sm text-muted">
          {text ?? t("adminConfirmDeleteText")}
        </div>
      </div>
    </Modal>
  );
}
