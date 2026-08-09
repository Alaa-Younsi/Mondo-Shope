import type { Product } from "./db";

/**
 * Landing page block model.
 *
 * `blocks` on landing_pages is an ordered jsonb array of these. The renderer
 * ignores unknown types and unknown fields, so adding a block type is a
 * frontend-only change — no migration.
 */

export type LandingBlockType =
  | "hero"
  | "bullets"
  | "features"
  | "gallery"
  | "video"
  | "text"
  | "offer"
  | "reviews"
  | "faq"
  | "countdown"
  | "trust"
  | "order_form"
  | "cta"
  | "spacer";

/** Where a CTA button scrolls to. Landing pages are single-page by design. */
export type CtaTarget = "order_form" | "offer" | "gallery" | "top";

export interface HeroData {
  eyebrow_fr: string;
  eyebrow_ar: string;
  title_fr: string;
  title_ar: string;
  subtitle_fr: string;
  subtitle_ar: string;
  image_url: string | null;
  cta_label_fr: string;
  cta_label_ar: string;
  cta_target: CtaTarget;
}

export interface BulletsData {
  title_fr: string;
  title_ar: string;
  items: Array<{ text_fr: string; text_ar: string }>;
}

export interface FeaturesData {
  title_fr: string;
  title_ar: string;
  items: Array<{
    icon: string;
    title_fr: string;
    title_ar: string;
    text_fr: string;
    text_ar: string;
  }>;
}

export interface GalleryData {
  title_fr: string;
  title_ar: string;
  images: Array<{ url: string; alt: string }>;
}

export interface VideoData {
  title_fr: string;
  title_ar: string;
  url: string;
  poster_url: string | null;
}

export interface TextData {
  title_fr: string;
  title_ar: string;
  body_fr: string;
  body_ar: string;
  align: "start" | "center";
}

export interface OfferData {
  title_fr: string;
  title_ar: string;
  note_fr: string;
  note_ar: string;
  show_compare_at: boolean;
  cta_label_fr: string;
  cta_label_ar: string;
  cta_target: CtaTarget;
}

export interface ReviewsData {
  title_fr: string;
  title_ar: string;
  /** "store" pulls the active client_reviews rows; "custom" uses `items`. */
  source: "store" | "custom";
  items: Array<{
    name: string;
    stars: number;
    text_fr: string;
    text_ar: string;
    image_url: string | null;
  }>;
}

export interface FaqData {
  title_fr: string;
  title_ar: string;
  items: Array<{ q_fr: string; q_ar: string; a_fr: string; a_ar: string }>;
}

export interface CountdownData {
  title_fr: string;
  title_ar: string;
  /** ISO timestamp. Past values simply render the block as expired. */
  ends_at: string | null;
  note_fr: string;
  note_ar: string;
}

export interface TrustData {
  items: Array<{ icon: string; label_fr: string; label_ar: string }>;
}

export interface OrderFormData {
  title_fr: string;
  title_ar: string;
  note_fr: string;
  note_ar: string;
  ask_address: boolean;
  ask_notes: boolean;
}

export interface CtaData {
  title_fr: string;
  title_ar: string;
  subtitle_fr: string;
  subtitle_ar: string;
  label_fr: string;
  label_ar: string;
  target: CtaTarget;
}

export interface SpacerData {
  size: "sm" | "md" | "lg";
}

export type LandingBlockData =
  | { type: "hero"; data: HeroData }
  | { type: "bullets"; data: BulletsData }
  | { type: "features"; data: FeaturesData }
  | { type: "gallery"; data: GalleryData }
  | { type: "video"; data: VideoData }
  | { type: "text"; data: TextData }
  | { type: "offer"; data: OfferData }
  | { type: "reviews"; data: ReviewsData }
  | { type: "faq"; data: FaqData }
  | { type: "countdown"; data: CountdownData }
  | { type: "trust"; data: TrustData }
  | { type: "order_form"; data: OrderFormData }
  | { type: "cta"; data: CtaData }
  | { type: "spacer"; data: SpacerData };

export type LandingBlock = LandingBlockData & {
  id: string;
  visible: boolean;
};

export interface LandingTheme {
  /** Overrides the site accent for this page only. `null` keeps the brand. */
  accent: string | null;
  background: "dark" | "light";
  width: "narrow" | "normal" | "wide";
  radius: "sharp" | "soft";
}

export interface LandingSeo {
  title_fr?: string;
  title_ar?: string;
  description_fr?: string;
  description_ar?: string;
  og_image?: string | null;
}

export interface LandingPage {
  id: string;
  slug: string;
  product_id: string | null;
  status: "draft" | "published";
  title_fr: string;
  title_ar: string;
  theme: LandingTheme;
  blocks: LandingBlock[];
  seo: LandingSeo;
  pixel_ids: string[];
  show_header: boolean;
  show_footer: boolean;
  created_at: string;
  updated_at: string;
}

/** Shape returned by the get_landing_page RPC — the page plus its product. */
export interface LandingPagePayload
  extends Omit<LandingPage, "status" | "created_at" | "updated_at"> {
  product: Product | null;
}
