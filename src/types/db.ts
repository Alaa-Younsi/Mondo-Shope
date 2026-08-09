/**
 * Hand-written row types mirroring supabase/migrations.
 * Keep in sync with the SQL — these are the contract every hook types against.
 */

export type Lang = "fr" | "ar";

export type ProductStatus = "active" | "draft";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";
export type DeliveryType = "home" | "office";

/** A colour swatch. `image_url` is optional: when present, picking the swatch
 *  jumps the product gallery to that photo. */
export interface ProductColor {
  label_fr: string;
  label_ar: string;
  label_en?: string;
  hex: string;
  image_url?: string | null;
}

/** A custom variant axis beyond the built-in colour/size pickers. */
export interface ProductVariantGroup {
  name_fr: string;
  name_ar: string;
  values: string[];
}

/** The shopper's pick from a custom variant group, snapshotted onto the order. */
export interface VariantSelection {
  name_fr: string;
  name_ar: string;
  value: string;
}

export type QuantityOffer =
  | { type: "free"; buy: number; get: number }
  | { type: "price"; qty: number; price: number };

export interface Category {
  id: string;
  slug: string;
  name_fr: string;
  name_ar: string;
  description_fr: string | null;
  description_ar: string | null;
  image_url: string | null;
  sort_order: number;
  created_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt: string | null;
  sort_order: number;
}

export interface Product {
  id: string;
  slug: string;
  name_fr: string;
  name_ar: string;
  description_fr: string | null;
  description_ar: string | null;
  details_fr: string[];
  details_ar: string[];
  price: number;
  compare_at_price: number | null;
  category_id: string | null;
  stock: number;
  style_code: string | null;
  colors: ProductColor[];
  sizes: string[];
  variants: ProductVariantGroup[];
  quantity_offers: QuantityOffer[];
  video_url: string | null;
  featured: boolean;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
  /** Present only when the query embeds them. */
  product_images?: ProductImage[];
  category?: Category | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name_fr: string;
  name_ar: string;
  price: number;
  quantity: number;
  color: string | null;
  size: string | null;
  variants: VariantSelection[];
  image_url: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  wilaya: string;
  city: string;
  address: string | null;
  notes: string | null;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  status: OrderStatus;
  language: Lang;
  delivery_type: DeliveryType;
  source: string | null;
  created_at: string;
  order_items?: OrderItem[];
}

/** Shape returned by the get_order_by_number RPC (guest confirmation page).
 *  Deliberately omits phone/address/notes. */
export interface GuestOrder {
  order_number: string;
  customer_name: string;
  wilaya: string;
  city: string;
  delivery_type: DeliveryType;
  status: OrderStatus;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  created_at: string;
  items: Array<{
    name_fr: string;
    name_ar: string;
    price: number;
    quantity: number;
    color: string | null;
    size: string | null;
    variants: VariantSelection[];
    image_url: string | null;
  }>;
}

/** One slide of the storefront hero slider, managed from admin Settings. */
export interface HeroSlide {
  id: string;
  image_url: string;
  title_fr: string | null;
  title_ar: string | null;
  subtitle_fr: string | null;
  subtitle_ar: string | null;
  /** Optional destination — internal path or absolute URL. */
  link_url: string | null;
}

export interface StoreSettings {
  id: number;
  shipping_fee: number;
  /** NULL = no free-shipping offer. */
  free_ship_threshold: number | null;
  store_phone: string | null;
  store_email: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  announcement_fr: string | null;
  announcement_ar: string | null;
  announcement_active: boolean;
  hero_slides: HeroSlide[];
  /** NULL falls back to the built-in FR/AR marquee strings. */
  marquee_main_fr: string | null;
  marquee_main_ar: string | null;
  marquee_sub_fr: string | null;
  marquee_sub_ar: string | null;
  updated_at: string;
}

export interface DeliveryPrice {
  id: string;
  wilaya: string;
  home_price: number;
  office_price: number;
  active: boolean;
  updated_at: string;
}

export interface ClientReview {
  id: string;
  client_name: string;
  stars: number;
  review_text: string;
  image_url: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export type PixelScope = "all" | "paths" | "products" | "landing";

export type PixelEventKey =
  | "page_view"
  | "view_content"
  | "add_to_cart"
  | "initiate_checkout"
  | "purchase"
  | "lead"
  | "search";

export interface MetaPixel {
  id: string;
  label: string;
  pixel_id: string;
  active: boolean;
  scope: PixelScope;
  /** Empty on a scoped pixel means "every page of that kind", not "no pages". */
  match_values: string[];
  events: Record<PixelEventKey, boolean>;
  test_event_code: string | null;
  currency: string;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  user_id: string;
  email: string | null;
  active: boolean;
  created_at: string;
}
