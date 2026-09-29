import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AdminPage, Panel } from "@/components/admin/AdminPage";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { EmptyState, LoadingBlock, Spinner } from "@/components/ui/Feedback";
import { Modal } from "@/components/ui/Modal";
import { useLanguage } from "@/i18n/LanguageProvider";
import { supabase } from "@/lib/supabase";
import { invalidateCategories } from "@/lib/queryCache";
import { slugify } from "@/lib/utils";
import type { Category } from "@/types/db";

type Draft = {
  id: string | null;
  /** Kept as-is on edit: the slug is the public /shop?categorie= URL. */
  slug: string | null;
  name_fr: string;
  name_ar: string;
  description_fr: string;
  description_ar: string;
  image_url: string | null;
  sort_order: number;
};

const EMPTY: Draft = {
  id: null,
  slug: null,
  name_fr: "",
  name_ar: "",
  description_fr: "",
  description_ar: "",
  image_url: null,
  sort_order: 0,
};

/**
 * A free slug for a NEW category. `slug` is unique, so two categories with the
 * same name (or an Arabic-only name, which slugifies to "") must not collide.
 */
async function uniqueCategorySlug(name: string): Promise<string> {
  const root = slugify(name) || `categorie-${Date.now().toString(36)}`;
  let candidate = root;
  for (let suffix = 2; suffix < 50; suffix++) {
    const { data, error } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", candidate)
      .limit(1);
    if (error || !data || data.length === 0) return candidate;
    candidate = `${root}-${suffix}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export default function AdminCategories() {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async (): Promise<Array<Category & { products: { count: number }[] }>> => {
      const { data: rows, error } = await supabase
        .from("categories")
        .select("*, products(count)")
        .order("sort_order")
        .order("name_fr");
      if (error) throw error;
      return (rows ?? []) as Array<Category & { products: { count: number }[] }>;
    },
  });

  const onSave = async () => {
    if (!draft) return;
    if (!draft.name_fr.trim() && !draft.name_ar.trim()) return;

    setSaving(true);
    const values = {
      name_fr: draft.name_fr.trim(),
      name_ar: draft.name_ar.trim(),
      description_fr: draft.description_fr.trim() || null,
      description_ar: draft.description_ar.trim() || null,
      image_url: draft.image_url,
      sort_order: Number(draft.sort_order) || 0,
      // Renaming a category must not move its URL: every shared or indexed
      // /shop?categorie=<slug> link would silently stop filtering.
      slug: draft.slug ?? (await uniqueCategorySlug(draft.name_fr || draft.name_ar)),
    };

    const { error } = draft.id
      ? await supabase.from("categories").update(values).eq("id", draft.id)
      : await supabase.from("categories").insert(values);

    setSaving(false);

    if (error) {
      toast.error(t("adminSaveError"));
      return; // stay on the form — do NOT close as if it saved
    }

    setDraft(null);
    toast.success(t("adminSaved"));
    invalidateCategories(queryClient);
  };

  const onDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("categories").delete().eq("id", pendingDelete.id);
    setDeleting(false);

    if (error) {
      toast.error(t("adminDeleteError"));
      return;
    }
    setPendingDelete(null);
    toast.success(t("adminDeleted"));
    invalidateCategories(queryClient);
  };

  if (isLoading) return <LoadingBlock label={t("loading")} />;

  return (
    <AdminPage
      title={t("catTitle")}
      action={
        <Button size="sm" onClick={() => setDraft(EMPTY)}>
          <Plus size={15} />
          {t("catNew")}
        </Button>
      }
    >
      {(data ?? []).length === 0 ? (
        <EmptyState title={t("catNone")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((category) => (
            <Panel key={category.id}>
              <div className="flex gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-panel-2">
                  {category.image_url && (
                    <img src={category.image_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{category.name_fr}</p>
                  <p dir="rtl" className="truncate text-sm text-muted">
                    {category.name_ar}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-muted">
                    <span dir="ltr">{category.products?.[0]?.count ?? 0}</span>{" "}
                    {t("catProductsCount")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        id: category.id,
                        slug: category.slug,
                        name_fr: category.name_fr,
                        name_ar: category.name_ar,
                        description_fr: category.description_fr ?? "",
                        description_ar: category.description_ar ?? "",
                        image_url: category.image_url,
                        sort_order: category.sort_order,
                      })
                    }
                    aria-label={t("edit")}
                    className="rounded-lg p-2 text-muted transition-colors hover:text-brand"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(category)}
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

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? t("edit") : t("catNew")}
        footer={
          <div className="flex gap-2">
            <Button onClick={() => void onSave()} disabled={saving} fullWidth>
              {saving && <Spinner />}
              {saving ? t("saving") : t("save")}
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)} fullWidth>
              {t("cancel")}
            </Button>
          </div>
        }
      >
        {draft && (
          <div className="space-y-4">
            <Field label={t("catNameFr")} required>
              <Input
                value={draft.name_fr}
                onChange={(event) => setDraft({ ...draft, name_fr: event.target.value })}
              />
            </Field>
            <Field label={t("catNameAr")}>
              <Input
                dir="rtl"
                value={draft.name_ar}
                onChange={(event) => setDraft({ ...draft, name_ar: event.target.value })}
              />
            </Field>
            <Field label={t("catDescFr")}>
              <Textarea
                rows={2}
                value={draft.description_fr}
                onChange={(event) => setDraft({ ...draft, description_fr: event.target.value })}
              />
            </Field>
            <Field label={t("catDescAr")}>
              <Textarea
                rows={2}
                dir="rtl"
                value={draft.description_ar}
                onChange={(event) => setDraft({ ...draft, description_ar: event.target.value })}
              />
            </Field>
            <Field label={t("catSortOrder")}>
              <Input
                type="number"
                value={draft.sort_order}
                onChange={(event) =>
                  setDraft({ ...draft, sort_order: Number(event.target.value) })
                }
              />
            </Field>
            <ImageUploader
              label={t("catImage")}
              prefix="categories/"
              value={draft.image_url}
              onChange={(image_url) => setDraft({ ...draft, image_url })}
            />
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!pendingDelete}
        busy={deleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void onDelete()}
        title={t("adminConfirmDelete")}
        text={pendingDelete?.name_fr}
      />
    </AdminPage>
  );
}
