import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, Trash2 } from "lucide-react";
import { AdminPage, TableScroll } from "@/components/admin/AdminPage";
import { DeleteAllOrdersModal } from "@/components/admin/DeleteAllOrdersModal";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingBlock } from "@/components/ui/Feedback";
import { Price } from "@/components/ui/Price";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useOrders } from "@/hooks/useOrders";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ORDER_STATUSES, STATUS_TONE, statusLabelKey } from "./orderStatus";
import type { OrderStatus } from "@/types/db";

export default function AdminOrders() {
  const { t, lang } = useLanguage();
  const toast = useAdminToast();
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: orders, isLoading } = useOrders(filter);
  const list = orders ?? [];

  // `xlsx` is ~230 kB — load it only when an export is actually requested,
  // rather than shipping it to every admin who opens the orders list.
  const runExport = async () => {
    setExporting(true);
    try {
      const { exportOrdersToExcel } = await import("@/lib/exportOrders");
      // Exports the CURRENTLY FILTERED list — this file is what the client
      // runs their dispatch off.
      exportOrdersToExcel(list);
    } catch {
      toast.error(t("adminExportError"));
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) return <LoadingBlock label={t("loading")} />;

  return (
    <AdminPage
      title={t("ordTitle")}
      subtitle={t("ordRestockNote")}
      action={
        <>
          <Button
            size="sm"
            variant="secondary"
            disabled={list.length === 0 || exporting}
            onClick={() => void runExport()}
          >
            <Download size={15} />
            {exporting ? t("ordExporting") : t("ordExport")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-danger"
            onClick={() => setDeleteAllOpen(true)}
          >
            <Trash2 size={15} />
            {t("ordDeleteAll")}
          </Button>
        </>
      }
    >
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
        {(["all", ...ORDER_STATUSES] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors",
              filter === status
                ? "border-brand bg-brand/10 text-brand"
                : "border-line text-muted hover:border-muted hover:text-ink",
            )}
          >
            {status === "all" ? t("ordFilterAll") : t(statusLabelKey(status))}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState title={t("ordNone")} />
      ) : (
        <TableScroll minWidth="xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-muted">
                <th className="whitespace-nowrap px-4 py-3 text-start">{t("orderNumber")}</th>
                <th className="whitespace-nowrap px-4 py-3 text-start">{t("ordCustomer")}</th>
                <th className="whitespace-nowrap px-4 py-3 text-start">{t("ordPhone")}</th>
                <th className="whitespace-nowrap px-4 py-3 text-start">{t("ordWilaya")}</th>
                <th className="whitespace-nowrap px-4 py-3 text-start">{t("status")}</th>
                <th className="whitespace-nowrap px-4 py-3 text-end">{t("total")}</th>
                <th className="whitespace-nowrap px-4 py-3 text-start">{t("date")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((order) => (
                <tr key={order.id} className="border-b border-line/60 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      to={`/admin/commandes/${order.id}`}
                      dir="ltr"
                      className="font-mono text-xs text-brand hover:underline"
                    >
                      {order.order_number}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{order.customer_name}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <a
                      href={`tel:${order.customer_phone}`}
                      dir="ltr"
                      className="font-mono text-xs text-muted hover:text-brand"
                    >
                      {order.customer_phone}
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {order.wilaya}
                    <span className="block text-[11px]">{order.city}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone={STATUS_TONE[order.status]}>
                      {t(statusLabelKey(order.status))}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-end">
                    <Price value={order.total} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                    {formatDateTime(order.created_at, lang)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}

      <DeleteAllOrdersModal
        open={deleteAllOpen}
        onClose={() => setDeleteAllOpen(false)}
        orders={list}
      />
    </AdminPage>
  );
}
