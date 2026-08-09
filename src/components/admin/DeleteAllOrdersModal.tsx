import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Feedback";
import { useAdminToast } from "./AdminToastProvider";
import { useLanguage } from "@/i18n/LanguageProvider";
import { supabase } from "@/lib/supabase";
import { invalidateOrders } from "@/lib/queryCache";
import type { Order } from "@/types/db";

/**
 * Deleting every order is irreversible, so the escape hatch (export first)
 * lives INSIDE the modal rather than being something the admin is expected to
 * have remembered.
 */
export function DeleteAllOrdersModal({
  open,
  onClose,
  orders,
}: {
  open: boolean;
  onClose: () => void;
  orders: Order[];
}) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // `xlsx` is loaded on demand — see the note in Orders.tsx.
  const runExport = async () => {
    setExporting(true);
    try {
      const { exportOrdersToExcel } = await import("@/lib/exportOrders");
      exportOrdersToExcel(orders);
    } catch {
      toast.error(t("adminExportError"));
    } finally {
      setExporting(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    // Supabase refuses an unfiltered .delete(); order_items go with it via the
    // FK cascade.
    const { error } = await supabase.from("orders").delete().not("id", "is", null);
    setDeleting(false);

    if (error) {
      toast.error(t("adminDeleteError"));
      return;
    }
    onClose();
    toast.success(t("adminDeleted"));
    invalidateOrders(queryClient);
  };

  return (
    <Modal
      open={open}
      busy={deleting}
      // Backdrop dismiss is disabled while the delete is in flight.
      onClose={onClose}
      title={t("ordDeleteAllTitle")}
      footer={
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            disabled={deleting || exporting || orders.length === 0}
            onClick={() => void runExport()}
            fullWidth
          >
            <Download size={15} />
            {exporting ? t("ordExporting") : t("ordDeleteAllExportFirst")}
          </Button>
          <Button variant="danger" onClick={() => void onDelete()} disabled={deleting} fullWidth>
            {deleting && <Spinner />}
            {deleting ? t("ordDeleting") : t("ordDeleteAllConfirm")}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={deleting} fullWidth>
            {t("cancel")}
          </Button>
        </div>
      }
    >
      <div className="flex gap-4">
        <TriangleAlert size={26} className="mt-0.5 shrink-0 text-danger" />
        <div className="min-w-0 space-y-3 text-sm text-muted">
          <p>{t("ordDeleteAllText", { count: orders.length })}</p>
          <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed text-warning">
            {t("ordDeleteAllNote")}
          </p>
        </div>
      </div>
    </Modal>
  );
}
