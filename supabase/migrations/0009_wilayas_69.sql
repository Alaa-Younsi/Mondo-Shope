-- =============================================================================
-- 0009_wilayas_69.sql — Algeria's 11 new wilayas (58 → 69)
--
-- On 16 November 2025 Algeria promoted 11 administrative districts in the
-- Hautes Plaines and the south to full wilayas, taking the country from 58 to
-- 69. 0001_init.sql seeded the 58 that existed when it was written; this adds
-- the rest. That older file is left alone on purpose — a migration that has
-- already run everywhere is history, not a place to edit.
--
-- Codes 59-69 are recorded in the comments for reference only: delivery_prices
-- is keyed on the wilaya NAME, so nothing here depends on the numbering.
--
-- Prices start at 0, exactly like the original seed: nothing must ship
-- accidentally cheap. Set the real prices in /admin/livraison — until you do,
-- these 11 behave like any other unpriced wilaya.
-- =============================================================================

insert into public.delivery_prices (wilaya, home_price, office_price, active) values
  ('Aflou', 0, 0, true),                 -- 59
  ('Barika', 0, 0, true),                -- 60
  ('El Kantara', 0, 0, true),            -- 61
  ('Bir El Ater', 0, 0, true),           -- 62
  ('El Aricha', 0, 0, true),             -- 63
  ('Ksar Chellala', 0, 0, true),         -- 64
  ('Aïn Oussera', 0, 0, true),           -- 65
  ('Messaad', 0, 0, true),               -- 66
  ('Ksar El Boukhari', 0, 0, true),      -- 67
  ('Bou Saâda', 0, 0, true),             -- 68
  ('El Abiodh Sidi Cheikh', 0, 0, true)  -- 69
on conflict (wilaya) do nothing;

-- Sanity check: catches a half-applied migration now rather than at checkout,
-- where a missing wilaya means a customer cannot complete an order.
do $$
declare
  total integer;
begin
  select count(*) into total from public.delivery_prices;
  if total < 69 then
    raise warning 'delivery_prices holds % rows, expected at least 69. Some wilayas may be missing.', total;
  end if;
end $$;
