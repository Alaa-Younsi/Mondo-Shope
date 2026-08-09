import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { AdminPage, Panel } from "@/components/admin/AdminPage";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, LoadingBlock } from "@/components/ui/Feedback";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminLandingPages, useDeleteLandingPage } from "@/hooks/useLandingPages";
import { supabase } from "@/lib/supabase";
import { invalidateLandingPages } from "@/lib/queryCache";
import { formatDate } from "@/lib/format";
import type { LandingPage } from "@/types/landing";

export default function AdminLandingPages() {
  const { t, lang } = useLanguage();
  const toast = useAdminToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useAdminLandingPages();
  const deletePage = useDeleteLandingPage();

  const [pendingDelete, setPendingDelete] = useState<LandingPage | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  const duplicate = async (page: LandingPage) => {
    setDuplicating(true);
    const { error } = await supabase.from("landing_pages").insert({
      slug: `${page.slug}-copie-${Date.now().toString(36).slice(-4)}`,
      product_id: page.product_id,
      // A copy always starts as a draft: publishing is an explicit decision.
      status: "draft",
      title_fr: `${page.title_fr} (copie)`,
      title_ar: page.title_ar,
      theme: page.theme,
      blocks: page.blocks,
      seo: page.seo,
      pixel_ids: page.pixel_ids,
      show_header: page.show_header,
      show_footer: page.show_footer,
    });
    setDuplicating(false);

    if (error) {
      toast.error(t("adminSaveError"));
      return;
    }
    toast.success(t("adminSaved"));
    invalidateLandingPages(queryClient);
  };

  if (isLoading) return <LoadingBlock label={t("loading")} />;

  return (
    <AdminPage
      title={t("lpTitle")}
      subtitle={t("lpSubtitle")}
      action={
        <ButtonLink to="/admin/pages/new" size="sm">
          <Plus size={15} />
          {t("lpNew")}
        </ButtonLink>
      }
    >
      {(data ?? []).length === 0 ? (
        <EmptyState title={t("lpNone")} />
      ) : (
        <div className="space-y-3">
          {(data ?? []).map((page) => (
            <Panel key={page.id}>
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/admin/pages/${page.id}`}
                      className="font-medium text-ink hover:text-brand"
                    >
                      {(lang === "ar" && page.title_ar) || page.title_fr || page.slug}
                    </Link>
                    <Badge tone={page.status === "published" ? "success" : "neutral"}>
                      {page.status === "published" ? t("published") : t("draft")}
                    </Badge>
                    <Badge tone="neutral">
                      {page.blocks.length} {t("lpBlocks").toLowerCase()}
                    </Badge>
                  </div>
                  <p dir="ltr" className="mt-1 font-mono text-xs text-muted">
                    /lp/{page.slug}
                  </p>
                  <p className="mt-1 text-xs text-muted">{formatDate(page.updated_at, lang)}</p>
                </div>

                <div className="flex shrink-0 gap-1">
                  {page.status === "published" && (
                    <a
                      href={`/lp/${page.slug}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={t("lpOpenPage")}
                      className="rounded-lg p-2 text-muted transition-colors hover:text-brand"
                    >
                      <ExternalLink size={15} />
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={duplicating}
                    onClick={() => void duplicate(page)}
                    aria-label={t("lpDuplicate")}
                    className="rounded-lg p-2 text-muted transition-colors hover:text-brand disabled:opacity-50"
                  >
                    <Copy size={15} />
                  </button>
                  <Link
                    to={`/admin/pages/${page.id}`}
                    aria-label={t("edit")}
                    className="rounded-lg p-2 text-muted transition-colors hover:text-brand"
                  >
                    <Pencil size={15} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(page)}
                    aria-label={t("delete")}
                    className="rounded-lg p-2 text-muted transition-colors hover:text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!pendingDelete}
        busy={deletePage.isPending}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await deletePage.mutateAsync(pendingDelete.id);
            setPendingDelete(null);
            toast.success(t("adminDeleted"));
          } catch {
            toast.error(t("adminDeleteError"));
          }
        }}
        title={t("adminConfirmDelete")}
        text={pendingDelete?.title_fr || pendingDelete?.slug}
      />
    </AdminPage>
  );
}
