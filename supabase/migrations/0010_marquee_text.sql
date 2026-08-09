-- =============================================================================
-- 0010_marquee_text.sql — editable scrolling bands on the home page
--
-- The two marquee strips under the featured row were hard-coded translation
-- strings, so changing them meant a redeploy. They are marketing copy the
-- client should own, so they move onto store_settings — which already carries
-- "public read" / "admin manage" policies, so nothing new is needed for RLS.
--
-- NULL means "fall back to the built-in FR/AR string". That keeps the bands
-- populated on a store that has never opened the setting, and lets the client
-- clear a field to get the default back rather than being stuck with an empty
-- scrolling strip.
-- =============================================================================

alter table public.store_settings
  add column if not exists marquee_main_fr text,
  add column if not exists marquee_main_ar text,
  add column if not exists marquee_sub_fr  text,
  add column if not exists marquee_sub_ar  text;
