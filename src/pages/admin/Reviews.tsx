import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { AdminPage, Panel } from "@/components/admin/AdminPage";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { EmptyState, LoadingBlock, Spinner } from "@/components/ui/Feedback";
import { Modal } from "@/components/ui/Modal";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useReviews } from "@/hooks/useReviews";
import { supabase } from "@/lib/supabase";
import type { ClientReview } from "@/types/db";

interface Draft {
  id: string | null;
  client_name: string;
  stars: number;
  review_text: string;
  image_url: string | null;
  active: boolean;
  sort_order: number;
}

const EMPTY: Draft = {
  id: null,
  client_name: "",
  stars: 5,
  review_text: "",
  image_url: null,
  active: true,
  sort_order: 0,
};

export default function AdminReviews() {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useReviews(false);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ClientReview | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["reviews"] });

  const onSave = async () => {
    if (!draft || !draft.client_name.trim()) return;
    setSaving(true);

    const values = {
      client_name: draft.client_name,
      stars: Math.min(5, Math.max(1, Number(draft.stars) || 5)),
      review_text: draft.review_text,
      image_url: draft.image_url,
      active: draft.active,
      sort_order: Number(draft.sort_order) || 0,
    };

    const { error } = draft.id
      ? await supabase.from("client_reviews").update(values).eq("id", draft.id)
      : await supabase.from("client_reviews").insert(values);

    setSaving(false);

    if (error) {
      toast.error(t("adminSaveError"));
      return;
    }
    setDraft(null);
    toast.success(t("adminSaved"));
    invalidate();
  };

  const onDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error } = await supabase
      .from("client_reviews")
      .delete()
      .eq("id", pendingDelete.id);
    setDeleting(false);

    if (error) {
      toast.error(t("adminDeleteError"));
      return;
    }
    setPendingDelete(null);
    toast.success(t("adminDeleted"));
    invalidate();
  };

  if (isLoading) return <LoadingBlock label={t("loading")} />;

  return (
    <AdminPage
      title={t("revTitle")}
      action={
        <Button size="sm" onClick={() => setDraft(EMPTY)}>
          <Plus size={15} />
          {t("revNew")}
        </Button>
      }
    >
      {(data ?? []).length === 0 ? (
        <EmptyState title={t("revNone")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((review) => (
            <Panel key={review.id} className={review.active ? "" : "opacity-50"}>
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-line bg-panel-2">
                  {review.image_url && (
                    <img src={review.image_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{review.client_name}</p>
                  <div className="mt-0.5 flex gap-0.5 text-brand" dir="ltr">
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        size={12}
                        fill={index < review.stars ? "currentColor" : "none"}
                        className={index < review.stars ? "" : "text-line"}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        id: review.id,
                        client_name: review.client_name,
                        stars: review.stars,
                        review_text: review.review_text,
                        image_url: review.image_url,
                        active: review.active,
                        sort_order: review.sort_order,
                      })
                    }
                    aria-label={t("edit")}
                    className="rounded-lg p-2 text-muted transition-colors hover:text-brand"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(review)}
                    aria-label={t("delete")}
                    className="rounded-lg p-2 text-muted transition-colors hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-muted">
                {review.review_text}
              </p>
            </Panel>
          ))}
        </div>
      )}

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? t("edit") : t("revNew")}
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
            <Field label={t("revClientName")} required>
              <Input
                value={draft.client_name}
                onChange={(event) => setDraft({ ...draft, client_name: event.target.value })}
              />
            </Field>
            <Field label={t("revStars")}>
              <Select
                value={draft.stars}
                onChange={(event) => setDraft({ ...draft, stars: Number(event.target.value) })}
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("revText")}>
              <Textarea
                rows={4}
                value={draft.review_text}
                onChange={(event) => setDraft({ ...draft, review_text: event.target.value })}
              />
            </Field>
            <ImageUploader
              label={t("revImage")}
              prefix="reviews/"
              value={draft.image_url}
              onChange={(image_url) => setDraft({ ...draft, image_url })}
            />
            <Checkbox
              id="rev-active"
              label={t("revActive")}
              checked={draft.active}
              onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
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
        text={pendingDelete?.client_name}
      />
    </AdminPage>
  );
}
