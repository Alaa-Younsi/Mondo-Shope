-- =============================================================================
-- 0007_hero_slides.sql — storefront hero slider
--
-- The hero carries an image slider the client fills from the admin Settings
-- page. It is a jsonb column on store_settings rather than its own table so it
-- inherits that table's existing policies unchanged — "public read store
-- settings" already exposes it to anon, and "admin manage store settings"
-- already gates writes behind is_admin(). A separate table would have needed
-- both policies restated, and a new admin section + permission with them.
--
-- Shape (array, order is display order):
--   [{ "id": "uuid",
--      "image_url": "https://…",
--      "title_fr": "…",  "title_ar": "…",
--      "subtitle_fr": "…", "subtitle_ar": "…",
--      "link_url": "/produit/foo" }]
--
-- NOT NULL DEFAULT '[]' so the storefront never has to handle a null here; the
-- fetch layer still guards with Array.isArray for databases mid-migration.
-- =============================================================================

alter table public.store_settings
  add column if not exists hero_slides jsonb not null default '[]'::jsonb;

-- Reject a scalar or object written by hand in the SQL editor: every consumer
-- maps over this, and a non-array would crash the home page for every visitor.
alter table public.store_settings
  drop constraint if exists store_settings_hero_slides_is_array;

alter table public.store_settings
  add constraint store_settings_hero_slides_is_array
  check (jsonb_typeof(hero_slides) = 'array');
