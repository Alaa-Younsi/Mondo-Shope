import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Package, ShoppingBag, Wallet } from "lucide-react";
import { AdminPage, Panel, TableScroll } from "@/components/admin/AdminPage";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, LoadingBlock } from "@/components/ui/Feedback";
import { Price, Num } from "@/components/ui/Price";
import { useLanguage } from "@/i18n/LanguageProvider";
import { supabase } from "@/lib/supabase";
import { formatDate, toLocalDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STATUS_TONE, statusLabelKey } from "./orderStatus";
import type { Order, Product } from "@/types/db";

type RangeKey = "day" | "week" | "month" | "all";

const RANGE_DAYS: Record<RangeKey, number | null> = {
  day: 1,
  week: 7,
  month: 30,
  all: null,
};

export default function Dashboard() {
  const { t, lang } = useLanguage();
  const [range, setRange] = useState<RangeKey>("week");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [orders, products] = await Promise.all([
        supabase
          .from("orders")
          .select("id, order_number, customer_name, wilaya, total, status, created_at")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("products").select("id, name_fr, slug, stock, status"),
      ]);

      if (orders.error) throw orders.error;
      if (products.error) throw products.error;

      return {
        orders: (orders.data ?? []) as Array<Pick<
          Order,
          "id" | "order_number" | "customer_name" | "wilaya" | "total" | "status" | "created_at"
        >>,
        products: (products.data ?? []) as Array<
          Pick<Product, "id" | "name_fr" | "slug" | "stock" | "status">
        >,
      };
    },
  });

  const stats = useMemo(() => {
    const orders = data?.orders ?? [];
    const products = data?.products ?? [];

    const days = RANGE_DAYS[range];
    // Trailing window ending today — "this week" means the last 7 days
    // including today, which is what the owner means comparing periods.
    const from = days
      ? (() => {
          const date = new Date();
          date.setDate(date.getDate() - (days - 1));
          return toLocalDay(date);
        })()
      : null;

    const inRange = orders.filter(
      (order) => !from || toLocalDay(order.created_at) >= from,
    );

    // Revenue counts BOOKED orders — everything not cancelled. On cash on
    // delivery that is not the same as cash collected; the delivered subset is
    // shown beside it so the two are never confused.
    const booked = inRange.filter((order) => order.status !== "cancelled");
    const delivered = inRange.filter((order) => order.status === "delivered");

    return {
      count: inRange.length,
      pending: inRange.filter((order) => order.status === "pending").length,
      revenue: booked.reduce((sum, order) => sum + Number(order.total), 0),
      deliveredRevenue: delivered.reduce((sum, order) => sum + Number(order.total), 0),
      activeProducts: products.filter((product) => product.status === "active").length,
      lowStock: products.filter(
        (product) => product.status === "active" && product.stock <= 5,
      ),
      recent: orders.slice(0, 8),
    };
  }, [data, range]);

  if (isLoading) return <LoadingBlock label={t("loading")} />;

  const TILES = [
    { icon: ShoppingBag, label: t("dashOrdersTotal"), value: <Num value={stats.count} /> },
    { icon: Clock, label: t("dashOrdersPending"), value: <Num value={stats.pending} /> },
    {
      icon: Wallet,
      label: t("dashRevenue"),
      value: <Price value={stats.revenue} />,
      hint: t("dashRevenueHint"),
    },
    { icon: Package, label: t("dashProducts"), value: <Num value={stats.activeProducts} /> },
  ];

  return (
    <AdminPage
      title={t("dashTitle")}
      subtitle={t("dashSubtitle")}
      action={
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-lg border border-line bg-panel p-1">
          {(["day", "week", "month", "all"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors",
                range === key ? "bg-brand text-brand-ink" : "text-muted hover:text-ink",
              )}
            >
              {t(
                key === "day"
                  ? "dashToday"
                  : key === "week"
                    ? "dashWeek"
                    : key === "month"
                      ? "dashMonth"
                      : "dashAll",
              )}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-line bg-panel p-5">
            <div className="flex items-center gap-2 text-muted">
              <tile.icon size={15} />
              <span className="text-xs uppercase tracking-wide">{tile.label}</span>
            </div>
            <p className="mt-2 font-display text-2xl font-bold tabular-nums text-ink">
              {tile.value}
            </p>
            {tile.hint && <p className="mt-1 text-xs text-muted">{tile.hint}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title={t("dashRecentOrders")}>
            {stats.recent.length === 0 ? (
              <EmptyState title={t("dashNoOrders")} className="border-none bg-transparent py-8" />
            ) : (
              <TableScroll minWidth="34rem">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-start font-mono text-[11px] uppercase tracking-wider text-muted">
                      <th className="whitespace-nowrap px-4 py-2.5 text-start">
                        {t("orderNumber")}
                      </th>
                      <th className="whitespace-nowrap px-4 py-2.5 text-start">
                        {t("ordCustomer")}
                      </th>
                      <th className="whitespace-nowrap px-4 py-2.5 text-start">
                        {t("status")}
                      </th>
                      <th className="whitespace-nowrap px-4 py-2.5 text-end">{t("total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent.map((order) => (
                      <tr key={order.id} className="border-b border-line/60 last:border-0">
                        <td className="whitespace-nowrap px-4 py-3">
                          <Link
                            to={`/admin/commandes/${order.id}`}
                            dir="ltr"
                            className="font-mono text-xs text-brand hover:underline"
                          >
                            {order.order_number}
                          </Link>
                          <span className="block text-[11px] text-muted">
                            {formatDate(order.created_at, lang)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {order.customer_name}
                          <span className="block text-[11px] text-muted">{order.wilaya}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge tone={STATUS_TONE[order.status]}>
                            {t(statusLabelKey(order.status))}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-end">
                          <Price value={order.total} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Panel>
        </div>

        <Panel title={t("dashLowStock")}>
          {stats.lowStock.length === 0 ? (
            <p className="py-4 text-sm text-muted">—</p>
          ) : (
            <ul className="space-y-2">
              {stats.lowStock.slice(0, 10).map((product) => (
                <li key={product.id} className="flex items-center justify-between gap-3">
                  <Link
                    to={`/admin/produits/${product.id}`}
                    className="min-w-0 flex-1 truncate text-sm text-ink hover:text-brand"
                  >
                    {product.name_fr}
                  </Link>
                  <Badge tone={product.stock <= 0 ? "danger" : "warning"}>
                    <AlertTriangle size={11} />
                    <Num value={product.stock} />
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AdminPage>
  );
}
