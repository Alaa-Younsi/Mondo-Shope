import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
import { AdminPage, TableScroll } from "@/components/admin/AdminPage";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Form";
import { EmptyState, LoadingBlock } from "@/components/ui/Feedback";
import { Num, Price } from "@/components/ui/Price";
import { useLanguage } from "@/i18n/LanguageProvider";
import { supabase } from "@/lib/supabase";
import { invalidateProducts } from "@/lib/queryCache";
import type { Product } from "@/types/db";

export default function AdminProducts() {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async (): Promise<Product[]> => {
      const { data: rows, error } = await supabase
        .from("products")
        .select("*, category:categories(name_fr), product_images(url, sort_order)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (rows ?? []) as Product[];
    },
  });

  const products = (data ?? []).filter((product) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      product.name_fr.toLowerCase().includes(term) ||
      product.name_ar.toLowerCase().includes(term) ||
      product.slug.toLowerCase().includes(term)
    );
  });

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("products").delete().eq("id", pendingDelete.id);
    setDeleting(false);

    if (error) {
      toast.error(t("adminDeleteError"));
      return;
    }
    setPendingDelete(null);
    toast.success(t("adminDeleted"));
    invalidateProducts(queryClient);
  };

  if (isLoading) return <LoadingBlock label={t("loading")} />;
  if (isError) {
    return (
      <AdminPage title={t("prodTitle")}>
        <EmptyState title={t("adminLoadError")} />
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title={t("prodTitle")}
      action={
        <ButtonLink to="/admin/produits/new" size="sm">
          <Plus size={15} />
          {t("prodNew")}
        </ButtonLink>
      }
    >
      <div className="relative mb-4">
        <Search
          size={16}
          className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("prodSearchPlaceholder")}
          className="ps-9"
        />
      </div>

      {products.length === 0 ? (
        <EmptyState title={t("prodNone")} />
      ) : (
        <TableScroll minWidth="46rem">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-muted">
                <th className="whitespace-nowrap px-4 py-3 text-start">{t("prodNameFr")}</th>
                <th className="whitespace-nowrap px-4 py-3 text-start">{t("prodCategory")}</th>
                <th className="whitespace-nowrap px-4 py-3 text-end">{t("prodPrice")}</th>
                <th className="whitespace-nowrap px-4 py-3 text-end">{t("prodStock")}</th>
                <th className="whitespace-nowrap px-4 py-3 text-start">{t("status")}</th>
                <th className="whitespace-nowrap px-4 py-3 text-end">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-line bg-panel-2">
                        {product.product_images?.[0]?.url && (
                          <img
                            src={product.product_images[0].url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <Link
                        to={`/admin/produits/${product.id}`}
                        className="whitespace-nowrap font-medium text-ink hover:text-brand"
                      >
                        {product.name_fr}
                      </Link>
                      {product.featured && <Badge tone="brand">★</Badge>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {product.category?.name_fr ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-end">
                    <Price value={product.price} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-end">
                    <span
                      className={
                        product.stock <= 0
                          ? "text-danger"
                          : product.stock <= 5
                            ? "text-warning"
                            : "text-muted"
                      }
                    >
                      <Num value={product.stock} />
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone={product.status === "active" ? "success" : "neutral"}>
                      {product.status === "active" ? t("active") : t("draft")}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-end">
                    <button
                      type="button"
                      onClick={() => setPendingDelete(product)}
                      aria-label={t("delete")}
                      className="rounded-lg p-2 text-muted transition-colors hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}

      <ConfirmModal
        open={!!pendingDelete}
        busy={deleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        title={t("adminConfirmDelete")}
        text={pendingDelete?.name_fr}
      />
    </AdminPage>
  );
}
