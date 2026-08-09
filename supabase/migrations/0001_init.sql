-- =============================================================================
-- 0001_init.sql — Mondo Shope core schema
-- Run migrations in filename order. Never edit a migration that has already
-- been run against a live database; add a new one instead.
-- =============================================================================

create extension if not exists "pgcrypto";

-- Shared updated_at trigger function -----------------------------------------
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Categories ------------------------------------------------------------------
create table if not exists public.categories (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  name_fr        text not null,
  name_ar        text not null default '',
  description_fr text,
  description_ar text,
  image_url      text,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);

-- Products --------------------------------------------------------------------
create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  name_fr           text not null,
  name_ar           text not null default '',
  description_fr    text,
  description_ar    text,
  details_fr        text[] not null default '{}',
  details_ar        text[] not null default '{}',
  price             numeric(10,2) not null default 0,
  compare_at_price  numeric(10,2),
  category_id       uuid references public.categories(id) on delete set null,
  stock             integer not null default 0,
  style_code        text,
  -- [{ label_fr, label_ar, label_en?, hex, image_url? }]
  -- image_url is OPTIONAL per swatch: when present, picking that swatch on the
  -- product page jumps the gallery to that photo.
  colors            jsonb not null default '[]',
  -- ["S","M","L"] — plain strings
  sizes             jsonb not null default '[]',
  -- Custom variant axes beyond color/size:
  -- [{ name_fr, name_ar, values: string[] }]
  variants          jsonb not null default '[]',
  -- [{ type:'free', buy, get } | { type:'price', qty, price }]
  -- Priced SERVER-SIDE in place_order. src/lib/offers.ts mirrors the math for
  -- optimistic client totals only.
  quantity_offers   jsonb not null default '[]',
  video_url         text,
  featured          boolean not null default false,
  status            text not null default 'draft' check (status in ('active','draft')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists products_status_idx   on public.products (status);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_featured_idx on public.products (featured) where featured;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.update_updated_at();

-- Product images ---------------------------------------------------------------
create table if not exists public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url        text not null,
  alt        text,
  sort_order integer not null default 0
);

create index if not exists product_images_product_idx
  on public.product_images (product_id, sort_order);

-- Orders -----------------------------------------------------------------------
-- address / notes are NULLABLE on purpose: the checkout field set is a
-- form-only decision for this business model (the dispatcher phones the
-- customer anyway). Dropping a checkout field must never require a migration.
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  order_number   text unique not null,
  customer_name  text not null,
  customer_phone text not null,
  wilaya         text not null,
  city           text not null,
  address        text,
  notes          text,
  subtotal       numeric(12,2) not null default 0,
  shipping       numeric(12,2) not null default 0,
  discount       numeric(12,2) not null default 0,
  total          numeric(12,2) not null default 0,
  status         text not null default 'pending'
                 check (status in ('pending','confirmed','shipped','delivered','cancelled')),
  language       text not null default 'fr' check (language in ('fr','ar')),
  delivery_type  text not null default 'home' check (delivery_type in ('home','office')),
  -- Which landing page produced this order, if any (attribution).
  source         text,
  created_at     timestamptz not null default now()
);

-- Backs the per-phone rate limit in place_order().
create index if not exists orders_phone_created_idx
  on public.orders (customer_phone, created_at desc);
create index if not exists orders_created_idx  on public.orders (created_at desc);
create index if not exists orders_status_idx   on public.orders (status);

-- Order items ------------------------------------------------------------------
-- Names and prices are SNAPSHOTTED at purchase time and never re-joined live.
create table if not exists public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name_fr    text not null,
  name_ar    text not null default '',
  price      numeric(10,2) not null,
  quantity   integer not null,
  color      text,
  size       text,
  -- [{ name_fr, name_ar, value }] — the shopper's custom-variant picks,
  -- snapshotted so an order stays readable after the product is edited.
  variants   jsonb not null default '[]',
  image_url  text
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- Store settings (singleton) ----------------------------------------------------
create table if not exists public.store_settings (
  id                  smallint primary key default 1 check (id = 1),
  shipping_fee        numeric(10,2) not null default 500,
  -- NULL = no free-shipping offer. Free shipping is something the client opts
  -- into, never a scaffold default: a non-null default silently ships most COD
  -- baskets free.
  free_ship_threshold numeric(10,2) default null,
  store_phone         text,
  store_email         text,
  facebook_url        text,
  instagram_url       text,
  tiktok_url          text,
  announcement_fr     text,
  announcement_ar     text,
  announcement_active boolean not null default false,
  updated_at          timestamptz not null default now()
);

insert into public.store_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists store_settings_set_updated_at on public.store_settings;
create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.update_updated_at();

-- Delivery prices per wilaya -----------------------------------------------------
create table if not exists public.delivery_prices (
  id           uuid primary key default gen_random_uuid(),
  wilaya       text unique not null,
  home_price   numeric(10,2) not null default 0,
  office_price numeric(10,2) not null default 0,
  active       boolean not null default true,
  updated_at   timestamptz not null default now()
);

drop trigger if exists delivery_prices_set_updated_at on public.delivery_prices;
create trigger delivery_prices_set_updated_at
  before update on public.delivery_prices
  for each row execute function public.update_updated_at();

-- Client reviews -------------------------------------------------------------------
create table if not exists public.client_reviews (
  id          uuid primary key default gen_random_uuid(),
  client_name text not null,
  stars       integer not null default 5 check (stars between 1 and 5),
  review_text text not null default '',
  image_url   text,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Seed the 58 Algerian wilayas ------------------------------------------------------
-- Prices start at 0 so nothing ships accidentally cheap; the client sets real
-- prices in /admin/livraison before go-live.
insert into public.delivery_prices (wilaya, home_price, office_price, active) values
  ('Adrar', 0, 0, true),
  ('Chlef', 0, 0, true),
  ('Laghouat', 0, 0, true),
  ('Oum El Bouaghi', 0, 0, true),
  ('Batna', 0, 0, true),
  ('Béjaïa', 0, 0, true),
  ('Biskra', 0, 0, true),
  ('Béchar', 0, 0, true),
  ('Blida', 0, 0, true),
  ('Bouira', 0, 0, true),
  ('Tamanrasset', 0, 0, true),
  ('Tébessa', 0, 0, true),
  ('Tlemcen', 0, 0, true),
  ('Tiaret', 0, 0, true),
  ('Tizi Ouzou', 0, 0, true),
  ('Alger', 0, 0, true),
  ('Djelfa', 0, 0, true),
  ('Jijel', 0, 0, true),
  ('Sétif', 0, 0, true),
  ('Saïda', 0, 0, true),
  ('Skikda', 0, 0, true),
  ('Sidi Bel Abbès', 0, 0, true),
  ('Annaba', 0, 0, true),
  ('Guelma', 0, 0, true),
  ('Constantine', 0, 0, true),
  ('Médéa', 0, 0, true),
  ('Mostaganem', 0, 0, true),
  ('M''Sila', 0, 0, true),
  ('Mascara', 0, 0, true),
  ('Ouargla', 0, 0, true),
  ('Oran', 0, 0, true),
  ('El Bayadh', 0, 0, true),
  ('Illizi', 0, 0, true),
  ('Bordj Bou Arréridj', 0, 0, true),
  ('Boumerdès', 0, 0, true),
  ('El Tarf', 0, 0, true),
  ('Tindouf', 0, 0, true),
  ('Tissemsilt', 0, 0, true),
  ('El Oued', 0, 0, true),
  ('Khenchela', 0, 0, true),
  ('Souk Ahras', 0, 0, true),
  ('Tipaza', 0, 0, true),
  ('Mila', 0, 0, true),
  ('Aïn Defla', 0, 0, true),
  ('Naâma', 0, 0, true),
  ('Aïn Témouchent', 0, 0, true),
  ('Ghardaïa', 0, 0, true),
  ('Relizane', 0, 0, true),
  ('Timimoun', 0, 0, true),
  ('Bordj Badji Mokhtar', 0, 0, true),
  ('Ouled Djellal', 0, 0, true),
  ('Béni Abbès', 0, 0, true),
  ('In Salah', 0, 0, true),
  ('In Guezzam', 0, 0, true),
  ('Touggourt', 0, 0, true),
  ('Djanet', 0, 0, true),
  ('El M''Ghair', 0, 0, true),
  ('El Meniaa', 0, 0, true)
on conflict (wilaya) do nothing;
