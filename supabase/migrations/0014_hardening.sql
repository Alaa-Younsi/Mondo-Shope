-- =============================================================================
-- 0014_hardening.sql — server-side enforcement for rules the UI already shows.
--
-- Three independent fixes, each safe to re-run:
--
--   1. The 3-pieces-per-item limit. MAX_QTY_PER_LINE (src/lib/limits.ts) caps
--      the storefront stepper at 3, but place_order() still accepted up to 20
--      per line — anyone posting straight at the RPC bypassed the limit.
--
--   2. A cancelled order is final. Cancelling restocks every unit (the
--      orders_restock_on_cancel trigger). Moving the order back to pending
--      never took those units off the shelf again, and cancelling it a second
--      time restocked them twice — inventory silently inflated.
--
--   3. meta_pixels was world-readable in full, including the owner's private
--      `notes` and campaign `label`. The storefront only needs the runtime
--      columns, so anon gets exactly those.
--
-- Nothing here re-declares place_order(): the limit is a trigger on the rows it
-- inserts, so it holds for every write path and the RPC stays untouched.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. At most 3 pieces of one product/option combination per order.
--
-- Checked per ORDER, not per line: two identical lines of 3 would otherwise
-- be a 6-piece order through a hand-crafted request. Identity matches the
-- cart's own line identity — product, colour, size and custom picks.
--
-- Raising here aborts place_order() mid-transaction, so the order header, every
-- line and every stock decrement roll back together. The client maps
-- ERR_QTY_LIMIT to its own message (src/lib/orderErrors.ts).
-- ---------------------------------------------------------------------------
create or replace function public.enforce_order_item_qty_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  c_max_per_item constant integer := 3;  -- keep equal to MAX_QTY_PER_LINE
  v_already      integer;
begin
  select coalesce(sum(quantity), 0) into v_already
  from public.order_items
  where order_id = new.order_id
    and product_id is not distinct from new.product_id
    and color      is not distinct from new.color
    and size       is not distinct from new.size
    and coalesce(variants, '[]'::jsonb) = coalesce(new.variants, '[]'::jsonb);

  if new.quantity < 1 or v_already + new.quantity > c_max_per_item then
    raise exception 'ERR_QTY_LIMIT: at most % per item', c_max_per_item;
  end if;

  return new;
end;
$$;

drop trigger if exists order_items_qty_limit on public.order_items;
create trigger order_items_qty_limit
  before insert on public.order_items
  for each row execute function public.enforce_order_item_qty_limit();


-- ---------------------------------------------------------------------------
-- 2. Cancelled is a terminal status.
--
-- BEFORE the restock trigger (which is AFTER UPDATE), so a refused transition
-- never touches stock. Deleting a cancelled order is still allowed.
-- ---------------------------------------------------------------------------
create or replace function public.forbid_uncancel_order()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'cancelled' and new.status is distinct from 'cancelled' then
    raise exception 'ERR_ORDER_CANCELLED: a cancelled order cannot be reopened';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_forbid_uncancel on public.orders;
create trigger orders_forbid_uncancel
  before update of status on public.orders
  for each row execute function public.forbid_uncancel_order();


-- ---------------------------------------------------------------------------
-- 3. Column-level read access for the public pixel list.
--
-- RLS still limits anon to active rows; this additionally limits it to the
-- columns the pixel runtime needs (src/hooks/useMetaPixels.ts,
-- PUBLIC_PIXEL_COLUMNS). The authenticated role is untouched, so the admin
-- screen keeps reading every column.
-- ---------------------------------------------------------------------------
revoke select on public.meta_pixels from anon;
grant select (
  id, pixel_id, active, scope, match_values, events,
  test_event_code, currency, sort_order
) on public.meta_pixels to anon;
