-- =============================================================================
-- 0004_meta_pixels.sql — admin-managed, DB-driven Meta pixels
--
-- The owner runs several campaigns at once with different objectives, so the
-- shop runs several pixels and which one is live depends on the page. Both the
-- IDs and their targeting are edited in /admin/pixels — no redeploy, and no
-- pixel snippet hardcoded in index.html.
-- =============================================================================

create table if not exists public.meta_pixels (
  id              uuid primary key default gen_random_uuid(),
  label           text not null,                       -- "Retargeting — hiver"
  pixel_id        text not null,                       -- the 15–16 digit Meta id
  active          boolean not null default true,
  scope           text not null default 'all'
                  check (scope in ('all','paths','products','landing')),
  -- An EMPTY match_values on a scoped pixel means "every page of that kind"
  -- (e.g. one pixel for all product pages) — not "no pages".
  match_values    text[] not null default '{}',
  events          jsonb not null default
    '{"page_view":true,"view_content":true,"add_to_cart":true,"initiate_checkout":true,"purchase":true,"lead":true,"search":true}',
  test_event_code text,
  currency        text not null default 'DZD',
  sort_order      integer not null default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists meta_pixels_set_updated_at on public.meta_pixels;
create trigger meta_pixels_set_updated_at
  before update on public.meta_pixels
  for each row execute function public.update_updated_at();

alter table public.meta_pixels enable row level security;

-- The storefront has to read this to know what to load, so anon SELECT is
-- filtered to active rows only: a paused campaign's pixel ID must not be
-- readable from the public REST API.
drop policy if exists "public read active pixels" on public.meta_pixels;
create policy "public read active pixels" on public.meta_pixels
  for select to anon using (active);

drop policy if exists "admin manage pixels" on public.meta_pixels;
create policy "admin manage pixels" on public.meta_pixels
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
