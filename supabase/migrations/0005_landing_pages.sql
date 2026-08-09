-- =============================================================================
-- 0005_landing_pages.sql — customizable single-product landing pages
--
-- The owner picks a product, builds a page out of ordered blocks, and publishes
-- it at /lp/<slug>. Every block's copy, order, visibility and styling lives in
-- `blocks`, so the client can create, edit and restyle a campaign page from the
-- dashboard at any time without a developer or a redeploy.
--
-- `blocks` is an ORDERED jsonb array. Each entry:
--   { "id": "<uuid>", "type": "<block type>", "visible": true, "data": { ... } }
--
-- Block types and their `data` shape (all copy fields are FR/AR pairs):
--   hero        { eyebrow_fr/ar, title_fr/ar, subtitle_fr/ar, image_url,
--                 cta_label_fr/ar, cta_target }
--   bullets     { title_fr/ar, items: [{ text_fr, text_ar }] }
--   features    { title_fr/ar, items: [{ icon, title_fr, title_ar,
--                 text_fr, text_ar }] }
--   gallery     { title_fr/ar, images: [{ url, alt }] }
--   video       { title_fr/ar, url, poster_url }
--   text        { title_fr/ar, body_fr/ar, align }
--   offer       { title_fr/ar, note_fr/ar, show_compare_at, cta_label_fr/ar,
--                 cta_target }
--   reviews     { title_fr/ar, source ("store"|"custom"),
--                 items: [{ name, stars, text_fr, text_ar, image_url }] }
--   faq         { title_fr/ar, items: [{ q_fr, q_ar, a_fr, a_ar }] }
--   countdown   { title_fr/ar, ends_at, note_fr/ar }
--   trust       { items: [{ icon, label_fr, label_ar }] }
--   order_form  { title_fr/ar, note_fr/ar, ask_address, ask_notes }
--   cta         { title_fr/ar, subtitle_fr/ar, label_fr/ar, target }
--   spacer      { size ("sm"|"md"|"lg") }
--
-- The renderer ignores unknown block types and unknown fields, so adding a new
-- block type is a frontend-only change — no migration.
-- =============================================================================

create table if not exists public.landing_pages (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  product_id  uuid references public.products(id) on delete set null,
  status      text not null default 'draft' check (status in ('draft','published')),
  title_fr    text not null default '',
  title_ar    text not null default '',

  -- Per-page look, overriding the site theme for this page only.
  -- { accent: "#RRGGBB"|null, background: "dark"|"light", width:
  --   "narrow"|"normal"|"wide", radius: "sharp"|"soft" }
  theme       jsonb not null default
    '{"accent":null,"background":"dark","width":"normal","radius":"soft"}',

  blocks      jsonb not null default '[]',

  -- { title_fr, title_ar, description_fr, description_ar, og_image }
  seo         jsonb not null default '{}',

  -- Lets one campaign page force a pixel that no scope rule would have matched.
  pixel_ids   uuid[] not null default '{}',

  show_header boolean not null default false,
  show_footer boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists landing_pages_status_idx on public.landing_pages (status);

drop trigger if exists landing_pages_set_updated_at on public.landing_pages;
create trigger landing_pages_set_updated_at
  before update on public.landing_pages
  for each row execute function public.update_updated_at();

alter table public.landing_pages enable row level security;

-- Drafts are invisible to the public: an unfinished campaign page must not be
-- reachable or enumerable before the client publishes it.
drop policy if exists "public read published landing pages" on public.landing_pages;
create policy "public read published landing pages" on public.landing_pages
  for select to anon using (status = 'published');

drop policy if exists "admin manage landing pages" on public.landing_pages;
create policy "admin manage landing pages" on public.landing_pages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- A published landing page shows a product's live price and stock. Its product
-- may legitimately be a `draft` in the catalogue (a campaign-only item that
-- should not appear in /shop), and the anon products policy hides those — so
-- expose exactly that one product through a definer function instead of
-- widening the products policy.
-- =============================================================================
create or replace function public.get_landing_page(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page    public.landing_pages%rowtype;
  v_product jsonb := null;
  v_images  jsonb := '[]'::jsonb;
begin
  if p_slug is null or char_length(btrim(p_slug)) not between 1 and 120 then
    return null;
  end if;

  select * into v_page
  from public.landing_pages
  where slug = btrim(p_slug) and status = 'published';

  if not found then
    return null;
  end if;

  if v_page.product_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('id', pi.id, 'url', pi.url,
                                                 'alt', pi.alt,
                                                 'sort_order', pi.sort_order)
                              order by pi.sort_order), '[]'::jsonb)
    into v_images
    from public.product_images pi
    where pi.product_id = v_page.product_id;

    select jsonb_build_object(
             'id', p.id,
             'slug', p.slug,
             'name_fr', p.name_fr,
             'name_ar', p.name_ar,
             'description_fr', p.description_fr,
             'description_ar', p.description_ar,
             'details_fr', p.details_fr,
             'details_ar', p.details_ar,
             'price', p.price,
             'compare_at_price', p.compare_at_price,
             'stock', p.stock,
             'colors', p.colors,
             'sizes', p.sizes,
             'variants', p.variants,
             'quantity_offers', p.quantity_offers,
             'video_url', p.video_url,
             'status', p.status,
             'product_images', v_images
           )
    into v_product
    from public.products p
    where p.id = v_page.product_id;
  end if;

  return jsonb_build_object(
    'id', v_page.id,
    'slug', v_page.slug,
    'product_id', v_page.product_id,
    'title_fr', v_page.title_fr,
    'title_ar', v_page.title_ar,
    'theme', v_page.theme,
    'blocks', v_page.blocks,
    'seo', v_page.seo,
    'pixel_ids', v_page.pixel_ids,
    'show_header', v_page.show_header,
    'show_footer', v_page.show_footer,
    'product', v_product
  );
end;
$$;

revoke execute on function public.get_landing_page(text) from public;
grant execute on function public.get_landing_page(text) to anon, authenticated;

-- =============================================================================
-- Widen the orderable-product predicate that place_order() already calls (0003).
--
-- place_order() otherwise only sells `status = 'active'` products. A landing
-- page can legitimately point at a campaign-only product deliberately kept out
-- of /shop, and those orders must still go through — so allow a draft product
-- to be ordered when, and only when, it is the target of a PUBLISHED landing
-- page. place_order() itself is untouched.
-- =============================================================================
create or replace function public.product_is_orderable(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.products p
    where p.id = p_product_id
      and (
        p.status = 'active'
        or exists (
          select 1 from public.landing_pages lp
          where lp.product_id = p.id and lp.status = 'published'
        )
      )
  );
$$;

revoke execute on function public.product_is_orderable(uuid) from public;
grant execute on function public.product_is_orderable(uuid) to anon, authenticated;
