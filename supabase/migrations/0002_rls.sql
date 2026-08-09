-- =============================================================================
-- 0002_rls.sql — Row Level Security
--
-- READ THIS BEFORE RUNNING:
--   After this migration, ONLY users listed in `admin_users` can write anything.
--   Seed your own account at the bottom of this file FIRST (replace the
--   placeholder email), or you will lock yourself out of the dashboard.
--
-- Why an admin_users table instead of the simpler `TO authenticated USING
-- (true)`: the anon key ships inside the public JS bundle, so if the Supabase
-- project ever allows public sign-up, anyone could self-register and land in
-- the `authenticated` role — which under a blanket policy is full store-owner
-- write access, without ever visiting /admin/login. The client-side route
-- guard is UI convenience, not a security boundary. Gating on an explicit
-- allow-list closes that hole even if sign-up is left on.
-- =============================================================================

-- Admin allow-list ------------------------------------------------------------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- SECURITY DEFINER is REQUIRED, not a shortcut: this reads admin_users with the
-- definer's rights, bypassing that table's own RLS. Without it, every policy
-- that calls is_admin() re-enters admin_users' policies and Postgres errors
-- with infinite recursion.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and active
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- An admin may read THEIR OWN row (that is how the dashboard learns it is
-- allowed in). Nobody can write this table from a client session at all —
-- adding or removing an admin is done in the Supabase SQL editor, which runs
-- as the service role and bypasses RLS.
drop policy if exists "admin reads own row" on public.admin_users;
create policy "admin reads own row" on public.admin_users
  for select to authenticated
  using (user_id = auth.uid());

-- Enable RLS everywhere --------------------------------------------------------
alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.product_images  enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.store_settings  enable row level security;
alter table public.delivery_prices enable row level security;
alter table public.client_reviews  enable row level security;

-- Public storefront reads --------------------------------------------------------
drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories
  for select to anon, authenticated using (true);

-- Draft products are invisible to the storefront.
drop policy if exists "public read active products" on public.products;
create policy "public read active products" on public.products
  for select to anon using (status = 'active');

-- Photos follow their product's visibility, so a draft product's gallery is not
-- enumerable through the REST API before launch.
drop policy if exists "public read product images" on public.product_images;
create policy "public read product images" on public.product_images
  for select to anon
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.status = 'active'
    )
  );

drop policy if exists "public read store settings" on public.store_settings;
create policy "public read store settings" on public.store_settings
  for select to anon, authenticated using (true);

drop policy if exists "public read delivery prices" on public.delivery_prices;
create policy "public read delivery prices" on public.delivery_prices
  for select to anon, authenticated using (true);

drop policy if exists "public read active reviews" on public.client_reviews;
create policy "public read active reviews" on public.client_reviews
  for select to anon using (active);

-- NOTE: `orders` and `order_items` deliberately have NO anon policy of any
-- kind — not even SELECT. They hold every customer's phone number, and a
-- blanket read policy would let anyone dump the whole table through the REST
-- API. Order placement goes through place_order() and the guest confirmation
-- page reads through get_order_by_number() — both SECURITY DEFINER (0003).

-- Admin full access ----------------------------------------------------------------
drop policy if exists "admin manage categories" on public.categories;
create policy "admin manage categories" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manage products" on public.products;
create policy "admin manage products" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manage product images" on public.product_images;
create policy "admin manage product images" on public.product_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manage orders" on public.orders;
create policy "admin manage orders" on public.orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manage order items" on public.order_items;
create policy "admin manage order items" on public.order_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manage store settings" on public.store_settings;
create policy "admin manage store settings" on public.store_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manage delivery prices" on public.delivery_prices;
create policy "admin manage delivery prices" on public.delivery_prices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manage reviews" on public.client_reviews;
create policy "admin manage reviews" on public.client_reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- SEED YOUR ADMIN ACCOUNT
--
-- 1. Create the user first: Supabase dashboard → Authentication → Users →
--    "Add user" (email + password, auto-confirm).
-- 2. Replace the email below with that user's email.
-- 3. Run this block. Re-running it is safe.
--
-- Also turn OFF public sign-up: Authentication → Sign In / Providers →
-- "Allow new users to sign up". With this allow-list a self-registered user
-- gets no admin access anyway, but there is no reason to let strangers create
-- auth rows in the project at all.
-- =============================================================================
insert into public.admin_users (user_id, email, active)
select id, email, true
from auth.users
where email = 'owner@mondoshope.com'   -- <<< CHANGE ME
on conflict (user_id) do update set active = true;
