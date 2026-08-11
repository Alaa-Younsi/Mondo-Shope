import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { AdminPage, Panel } from "@/components/admin/AdminPage";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { MultiImageUploader } from "@/components/admin/ImageUploader";
import {
  ColorsEditor,
  CustomVariantsEditor,
  OffersEditor,
  OptionListEditor,
} from "@/components/admin/Editors";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { ErrorState, LoadingBlock, Spinner } from "@/components/ui/Feedback";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useCategories } from "@/hooks/useCatalog";
import { useAdminUpload } from "@/hooks/useAdminUpload";
import { supabase } from "@/lib/supabase";
import { invalidateProducts } from "@/lib/queryCache";
import { sanitizeOffers } from "@/lib/offers";
import { slugify } from "@/lib/utils";
import type { Product } from "@/types/db";

/**
 * The editable columns, and ONLY those.
 *
 * Never build the write payload by spreading a row loaded with select("*") —
 * PostgREST rejects the ENTIRE update when the body names anything that is not
 * a column of the table (embedded relations like `product_images`, or generated
 * columns like `id`/`created_at`), with:
 *
 *   400 PGRST204 Could not find the 'product_images' column of 'products'
 *
 * That makes every EDIT a silent no-op while creating products keeps working —
 * exactly the shape that survives a smoke test and shows up weeks later as
 * "I changed the price and it went back".
 *
 * The Omit<> return type makes TypeScript enforce completeness: adding a column
 * to the form is a compile error until it is mapped here.
 */
type ProductFormState = Omit<
  Product,
  "id" | "created_at" | "updated_at" | "category" | "product_images"
>;

function toFormState(row: Product): ProductFormState {
  return {
    slug: row.slug,
    name_fr: row.name_fr,
    name_ar: row.name_ar,
    description_fr: row.description_fr,
    description_ar: row.description_ar,
    details_fr: Array.isArray(row.details_fr) ? row.details_fr : [],
    details_ar: Array.isArray(row.details_ar) ? row.details_ar : [],
    price: Number(row.price),
    compare_at_price: row.compare_at_price === null ? null : Number(row.compare_at_price),
    category_id: row.category_id,
    stock: row.stock,
    style_code: row.style_code,
    colors: Array.isArray(row.colors) ? row.colors : [],
    sizes: Array.isArray(row.sizes) ? row.sizes : [],
    variants: Array.isArray(row.variants) ? row.variants : [],
    quantity_offers: sanitizeOffers(row.quantity_offers),
    video_url: row.video_url,
    featured: row.featured,
    status: row.status,
  };
}

const EMPTY: ProductFormState = {
  slug: "",
  name_fr: "",
  name_ar: "",
  description_fr: "",
  description_ar: "",
  details_fr: [],
  details_ar: [],
  price: 0,
  compare_at_price: null,
  category_id: null,
  stock: 0,
  style_code: null,
  colors: [],
  sizes: [],
  variants: [],
  quantity_offers: [],
  video_url: null,
  featured: false,
  status: "draft",
};

/**
 * `slug` is unique, so slugify(name) alone fails on a duplicate name — and
 * returns "" for an Arabic-only title. Probe until free.
 */
async function uniqueSlug(base: string, currentId?: string): Promise<string> {
  const root = slugify(base) || `produit-${Date.now().toString(36)}`;
  let candidate = root;
  let suffix = 2;

  for (let attempt = 0; attempt < 25; attempt++) {
    let query = supabase.from("products").select("id").eq("slug", candidate).limit(1);
    if (currentId) query = query.neq("id", currentId);
    const { data, error } = await query;
    if (error) return candidate; // let the unique constraint decide
    if (!data || data.length === 0) return candidate;
    candidate = `${root}-${suffix++}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export default function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const { t } = useLanguage();
  const toast = useAdminToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: categories } = useCategories();
  const { upload, uploading: uploadingVideo } = useAdminUpload();

  const [form, setForm] = useState<ProductFormState>(EMPTY);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: loaded, isLoading, isError } = useQuery({
    queryKey: ["admin-product", id],
    enabled: !isNew,
    queryFn: async (): Promise<Product | null> => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_images(*)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Product | null;
    },
  });

  useEffect(() => {
    if (isNew) return;
    if (isError) {
      setLoadFailed(true);
      return;
    }
    if (isLoading) return;

    // A failed load must BLOCK the form. `if (row) setForm(row)` with no else
    // leaves an edit form sitting on blank defaults, and the next Save writes
    // those blanks over a real product.
    if (!loaded) {
      setLoadFailed(true);
      return;
    }
    setForm(toFormState(loaded));
    setImageUrls(
      [...(loaded.product_images ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((image) => image.url),
    );
  }, [isNew, isError, isLoading, loaded]);

  const patch = (values: Partial<ProductFormState>) =>
    setForm((current) => ({ ...current, ...values }));

  const onSave = async () => {
    if (!form.name_fr.trim() && !form.name_ar.trim()) {
      toast.error(t("adminSaveError"));
      return;
    }

    setSaving(true);
    try {
      const slug = form.slug.trim()
        ? await uniqueSlug(form.slug, isNew ? undefined : id)
        : await uniqueSlug(form.name_fr || form.name_ar, isNew ? undefined : id);

      const payload: ProductFormState = {
        ...form,
        slug,
        price: Number(form.price) || 0,
        compare_at_price:
          form.compare_at_price === null || form.compare_at_price === undefined
            ? null
            : Number(form.compare_at_price) || null,
        stock: Math.max(0, Math.floor(Number(form.stock) || 0)),
        quantity_offers: sanitizeOffers(form.quantity_offers),
        // A half-filled group the admin abandoned must not reach the storefront
        // as a nameless or empty picker.
        variants: form.variants
          .map((group) => ({
            ...group,
            values: group.values.filter((entry) => entry.value.trim()),
          }))
          .filter((group) => group.name_fr.trim() && group.values.length > 0),
        colors: form.colors.filter((color) => color.hex),
        // An option with a blank label is unpickable on the storefront and
        // unmatchable by place_order().
        sizes: form.sizes.filter((size) => size.value.trim()),
      };

      let productId = id;

      if (isNew) {
        const { data, error } = await supabase
          .from("products")
          .insert(payload)
          .select("id")
          .single();
        if (error) {
          toast.error(t("adminSaveError"));
          return;
        }
        productId = (data as { id: string }).id;
      } else {
        const { error } = await supabase.from("products").update(payload).eq("id", id!);
        if (error) {
          toast.error(t("adminSaveError"));
          return;
        }
      }

      // Images are a delete-then-insert pair. BOTH legs must be checked: if the
      // insert fails after the delete succeeded, the gallery is now empty in the
      // database — report it and stay on the form rather than navigating away
      // from a half-applied save.
      const { error: deleteError } = await supabase
        .from("product_images")
        .delete()
        .eq("product_id", productId!);
      if (deleteError) {
        toast.error(t("adminSaveError"));
        return;
      }

      if (imageUrls.length > 0) {
        const { error: insertError } = await supabase.from("product_images").insert(
          imageUrls.map((url, index) => ({
            product_id: productId,
            url,
            alt: form.name_fr,
            sort_order: index,
          })),
        );
        if (insertError) {
          toast.error(t("adminSaveError"));
          return;
        }
      }

      toast.success(t("adminSaved"));
      invalidateProducts(queryClient);
      queryClient.invalidateQueries({ queryKey: ["admin-product", productId] });
      navigate("/admin/produits");
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && isLoading) return <LoadingBlock label={t("loading")} />;

  if (loadFailed) {
    return (
      <AdminPage title={t("prodEdit")}>
        <ErrorState title={t("adminLoadError")} text={t("prodLoadFailed")} />
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title={isNew ? t("prodNew") : t("prodEdit")}
      action={
        <>
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/produits")}>
            <ArrowLeft size={15} className="rtl:rotate-180" />
            {t("back")}
          </Button>
          <Button size="sm" onClick={() => void onSave()} disabled={saving}>
            {saving ? <Spinner /> : <Save size={15} />}
            {saving ? t("saving") : t("save")}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <Panel title={t("prodNameFr")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("prodNameFr")} required>
              <Input
                value={form.name_fr}
                onChange={(event) => patch({ name_fr: event.target.value })}
              />
            </Field>
            <Field label={t("prodNameAr")}>
              <Input
                dir="rtl"
                value={form.name_ar}
                onChange={(event) => patch({ name_ar: event.target.value })}
              />
            </Field>
            <Field label={t("prodSlug")} hint={t("prodSlugHint")} className="sm:col-span-2">
              <Input
                dir="ltr"
                value={form.slug}
                onChange={(event) => patch({ slug: event.target.value })}
              />
            </Field>
            <Field label={t("prodDescFr")}>
              <Textarea
                rows={4}
                value={form.description_fr ?? ""}
                onChange={(event) => patch({ description_fr: event.target.value })}
              />
            </Field>
            <Field label={t("prodDescAr")}>
              <Textarea
                rows={4}
                dir="rtl"
                value={form.description_ar ?? ""}
                onChange={(event) => patch({ description_ar: event.target.value })}
              />
            </Field>
            <Field label={t("prodDetailsFr")} hint={t("prodDetailsHint")}>
              <Textarea
                rows={4}
                value={form.details_fr.join("\n")}
                onChange={(event) =>
                  patch({
                    details_fr: event.target.value.split("\n").filter((line) => line.trim()),
                  })
                }
              />
            </Field>
            <Field label={t("prodDetailsAr")} hint={t("prodDetailsHint")}>
              <Textarea
                rows={4}
                dir="rtl"
                value={form.details_ar.join("\n")}
                onChange={(event) =>
                  patch({
                    details_ar: event.target.value.split("\n").filter((line) => line.trim()),
                  })
                }
              />
            </Field>
          </div>
        </Panel>

        <Panel title={t("prodPrice")}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t("prodPrice")} required>
              <Input
                type="number"
                min={0}
                step="1"
                value={form.price}
                onChange={(event) => patch({ price: Number(event.target.value) })}
              />
            </Field>
            <Field label={t("prodCompareAt")} hint={t("prodCompareAtHint")}>
              <Input
                type="number"
                min={0}
                step="1"
                value={form.compare_at_price ?? ""}
                onChange={(event) =>
                  patch({
                    compare_at_price:
                      event.target.value === "" ? null : Number(event.target.value),
                  })
                }
              />
            </Field>
            <Field label={t("prodStock")} hint={t("prodStockHint")}>
              <Input
                type="number"
                min={0}
                value={form.stock}
                onChange={(event) => patch({ stock: Number(event.target.value) })}
              />
            </Field>
            <Field label={t("prodStyleCode")}>
              <Input
                value={form.style_code ?? ""}
                onChange={(event) => patch({ style_code: event.target.value || null })}
              />
            </Field>
            <Field label={t("prodCategory")}>
              <Select
                value={form.category_id ?? ""}
                onChange={(event) => patch({ category_id: event.target.value || null })}
              >
                <option value="">{t("prodNoCategory")}</option>
                {(categories ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name_fr}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("prodStatus")}>
              <Select
                value={form.status}
                onChange={(event) =>
                  patch({ status: event.target.value as ProductFormState["status"] })
                }
              >
                <option value="draft">{t("draft")}</option>
                <option value="active">{t("active")}</option>
              </Select>
            </Field>
            <div className="sm:col-span-2 lg:col-span-2 lg:self-end">
              <Checkbox
                id="prod-featured"
                label={t("prodFeatured")}
                checked={form.featured}
                onChange={(event) => patch({ featured: event.target.checked })}
              />
            </div>
          </div>
        </Panel>

        <Panel title={t("prodImages")}>
          <p className="mb-3 text-xs text-muted">{t("prodImagesHint")}</p>
          <MultiImageUploader urls={imageUrls} onChange={setImageUrls} />
        </Panel>

        <Panel title={t("prodVideo")}>
          <div className="space-y-3">
            <Field label={t("prodVideoUrl")} hint={t("prodVideoUrlHint")}>
              <Input
                dir="ltr"
                value={form.video_url ?? ""}
                onChange={(event) => patch({ video_url: event.target.value || null })}
              />
            </Field>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  const url = await upload(file, "product-videos");
                  if (!url) {
                    toast.error(t("adminUploadError"));
                    return;
                  }
                  patch({ video_url: url });
                }}
              />
              <span className="rounded-lg border border-line px-3 py-2 transition-colors hover:border-brand hover:text-brand">
                {uploadingVideo ? t("prodUploading") : t("add")}
              </span>
            </label>
          </div>
        </Panel>

        <Panel title={t("prodColors")}>
          <ColorsEditor colors={form.colors} onChange={(colors) => patch({ colors })} />
        </Panel>

        <Panel title={t("prodSizes")}>
          <OptionListEditor
            values={form.sizes.map((size) => ({ ...size, image_url: null }))}
            onChange={(values) =>
              patch({ sizes: values.map(({ value, stock }) => ({ value, stock })) })
            }
          />
        </Panel>

        <Panel title={t("prodVariants")}>
          <p className="mb-3 text-xs text-muted">{t("prodVariantsHint")}</p>
          <CustomVariantsEditor
            groups={form.variants}
            onChange={(variants) => patch({ variants })}
          />
        </Panel>

        <Panel title={t("prodOffers")}>
          <OffersEditor
            offers={form.quantity_offers}
            onChange={(quantity_offers) => patch({ quantity_offers })}
          />
        </Panel>
      </div>
    </AdminPage>
  );
}
