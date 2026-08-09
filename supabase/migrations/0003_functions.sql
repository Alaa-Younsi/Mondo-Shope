-- =============================================================================
-- 0003_functions.sql — server-side order placement and guest order lookup
--
-- place_order() is the single most important object in this schema. The anon
-- key ships in the public JS bundle, so this RPC is a real, internet-facing
-- request boundary: every price, every discount and every shipping fee is
-- computed HERE from server-owned columns. Nothing the browser sends about
-- money is trusted, and the zod schema / honeypot in the checkout forms are
-- convenience only — a bot posting straight at this endpoint skips both.
-- =============================================================================

-- Which products place_order() is allowed to sell. Kept as its own predicate so
-- later migrations can widen it without re-declaring place_order() — that
-- function has been hardened carefully (row locking, offer pricing, variant
-- truncation) and re-typing it to change one WHERE clause risks regressing all
-- of it. 0005 replaces this body to also allow a campaign-only product that a
-- published landing page points at.
create or replace function public.product_is_orderable(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.products p
    where p.id = p_product_id and p.status = 'active'
  );
$$;

revoke execute on function public.product_is_orderable(uuid) from public;
grant execute on function public.product_is_orderable(uuid) to anon, authenticated;


create or replace function public.place_order(items jsonb, customer jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name          text;
  v_phone         text;
  v_wilaya        text;
  v_city          text;
  v_address       text;
  v_notes         text;
  v_source        text;
  v_delivery_type text;
  v_language      text;

  v_item          jsonb;
  v_offer         jsonb;
  v_variant       jsonb;
  v_variants      jsonb;
  v_product       public.products%rowtype;
  v_delivery      public.delivery_prices%rowtype;
  v_settings      public.store_settings%rowtype;

  v_qty           integer;
  v_line_base     numeric;
  v_line_best     numeric;
  v_candidate     numeric;
  v_buy           integer;
  v_get           integer;
  v_bundle_qty    integer;
  v_bundle_price  numeric;

  v_subtotal      numeric := 0;
  v_discount      numeric := 0;
  v_shipping      numeric := 0;
  v_total         numeric := 0;
  v_goods         numeric := 0;

  v_recent_10m    integer;
  v_recent_24h    integer;

  v_order_id      uuid;
  v_order_number  text;
  v_attempts      integer := 0;
  v_image         text;
begin
  ---------------------------------------------------------------------------
  -- 0. Validate the customer server-side.
  ---------------------------------------------------------------------------
  if customer is null or jsonb_typeof(customer) <> 'object' then
    raise exception 'ERR_INVALID_INPUT: customer';
  end if;

  v_name  := btrim(coalesce(customer->>'name', ''));
  v_phone := btrim(coalesce(customer->>'phone', ''));
  v_phone := regexp_replace(v_phone, '[\s.-]', '', 'g');
  v_wilaya := btrim(coalesce(customer->>'wilaya', ''));
  v_city  := btrim(coalesce(customer->>'city', ''));
  v_address := nullif(btrim(coalesce(customer->>'address', '')), '');
  v_notes := nullif(btrim(coalesce(customer->>'notes', '')), '');
  v_source := nullif(left(btrim(coalesce(customer->>'source', '')), 60), '');
  v_delivery_type := coalesce(customer->>'delivery_type', 'home');
  v_language := coalesce(customer->>'language', 'fr');

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'ERR_INVALID_INPUT: name';
  end if;

  -- Algerian mobile: 05/06/07 + 8 digits.
  if v_phone !~ '^0[5-7][0-9]{8}$' then
    raise exception 'ERR_INVALID_INPUT: phone';
  end if;

  if char_length(v_city) < 1 or char_length(v_city) > 80 then
    raise exception 'ERR_INVALID_INPUT: city';
  end if;

  if char_length(v_wilaya) < 1 or char_length(v_wilaya) > 80 then
    raise exception 'ERR_INVALID_INPUT: wilaya';
  end if;

  if v_delivery_type not in ('home', 'office') then
    raise exception 'ERR_INVALID_INPUT: delivery_type';
  end if;

  -- Whitelisted, never passed through raw.
  if v_language not in ('fr', 'ar') then
    v_language := 'fr';
  end if;

  v_address := left(v_address, 240);
  v_notes   := left(v_notes, 500);

  ---------------------------------------------------------------------------
  -- 1. Rate-limit by phone number.
  -- COD's identity is a reachable phone, so that is what we throttle. This is
  -- the real defense against a fake-order flood zeroing stock; client-side
  -- guards do nothing against a direct call to this endpoint. Cancelled orders
  -- still count, or the limit resets itself trivially.
  ---------------------------------------------------------------------------
  select count(*) into v_recent_10m
  from public.orders
  where customer_phone = v_phone and created_at > now() - interval '10 minutes';

  if v_recent_10m >= 3 then
    raise exception 'ERR_RATE_LIMIT: too many orders';
  end if;

  select count(*) into v_recent_24h
  from public.orders
  where customer_phone = v_phone and created_at > now() - interval '24 hours';

  if v_recent_24h >= 10 then
    raise exception 'ERR_RATE_LIMIT: daily cap';
  end if;

  ---------------------------------------------------------------------------
  -- 2. Validate the cart shape, then price PASS 1: look every product up by
  --    id using the server's own price column, locking the row.
  ---------------------------------------------------------------------------
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'ERR_CART_EMPTY: no items';
  end if;

  if jsonb_array_length(items) > 20 then
    raise exception 'ERR_INVALID_INPUT: too many lines';
  end if;

  for v_item in select value from jsonb_array_elements(items) loop
    if coalesce(v_item->>'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'ERR_PRODUCT_UNAVAILABLE: bad id';
    end if;

    if coalesce(v_item->>'quantity', '') !~ '^[0-9]{1,4}$' then
      raise exception 'ERR_PRODUCT_UNAVAILABLE: bad quantity';
    end if;

    v_qty := (v_item->>'quantity')::integer;

    -- Upper bound matters: without it a single call with quantity 10000
    -- reserves the whole catalogue's stock with no payment at risk.
    if v_qty <= 0 or v_qty > 20 then
      raise exception 'ERR_PRODUCT_UNAVAILABLE: quantity out of range';
    end if;

    if jsonb_typeof(coalesce(v_item->'variants', '[]'::jsonb)) = 'array'
       and jsonb_array_length(coalesce(v_item->'variants', '[]'::jsonb)) > 10 then
      raise exception 'ERR_INVALID_INPUT: too many variants';
    end if;

    -- FOR UPDATE serializes concurrent checkouts of the same product, so two
    -- customers cannot both pass the stock check for the last unit.
    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and public.product_is_orderable(id)
    for update;

    if not found then
      raise exception 'ERR_PRODUCT_UNAVAILABLE: %', v_item->>'product_id';
    end if;

    -- Reject, never clamp. GREATEST(0, stock - qty) accepts orders that cannot
    -- be fulfilled: under concurrent ad traffic, N customers all "successfully"
    -- buy the last unit.
    if v_product.stock < v_qty then
      raise exception 'ERR_STOCK: %', v_product.name_fr;
    end if;

    v_line_base := v_product.price * v_qty;
    v_line_best := v_line_base;

    -- Quantity offers, priced server-side. Keep the cheapest applicable offer.
    -- src/lib/offers.ts mirrors this exact math for optimistic UI totals — if
    -- one changes, change both.
    if jsonb_typeof(coalesce(v_product.quantity_offers, '[]'::jsonb)) = 'array' then
      for v_offer in select value from jsonb_array_elements(v_product.quantity_offers) loop
        if v_offer->>'type' = 'free' then
          v_buy := coalesce(nullif(v_offer->>'buy', '')::integer, 0);
          v_get := coalesce(nullif(v_offer->>'get', '')::integer, 0);
          if v_buy > 0 and v_get > 0 then
            -- Every full group of (buy + get) units contains `get` free units.
            v_candidate := (v_qty - floor(v_qty::numeric / (v_buy + v_get)) * v_get) * v_product.price;
            if v_candidate < v_line_best then
              v_line_best := v_candidate;
            end if;
          end if;
        elsif v_offer->>'type' = 'price' then
          v_bundle_qty   := coalesce(nullif(v_offer->>'qty', '')::integer, 0);
          v_bundle_price := coalesce(nullif(v_offer->>'price', '')::numeric, 0);
          if v_bundle_qty > 0 and v_bundle_price > 0 then
            v_candidate := floor(v_qty::numeric / v_bundle_qty) * v_bundle_price
                           + (v_qty % v_bundle_qty) * v_product.price;
            if v_candidate < v_line_best then
              v_line_best := v_candidate;
            end if;
          end if;
        end if;
      end loop;
    end if;

    v_subtotal := v_subtotal + v_line_base;
    v_discount := v_discount + (v_line_base - v_line_best);
  end loop;

  ---------------------------------------------------------------------------
  -- 3. Shipping. An unknown wilaya is REJECTED, never silently priced at the
  --    default fee — otherwise a direct call can invent any destination string
  --    and still get a real, undeliverable order through.
  ---------------------------------------------------------------------------
  select * into v_delivery from public.delivery_prices where wilaya = v_wilaya;

  if not found then
    raise exception 'ERR_INVALID_INPUT: wilaya';
  end if;

  if not v_delivery.active then
    raise exception 'ERR_WILAYA_DISABLED: %', v_wilaya;
  end if;

  v_shipping := case when v_delivery_type = 'office'
                     then v_delivery.office_price
                     else v_delivery.home_price end;

  select * into v_settings from public.store_settings where id = 1;

  -- The threshold compares against what the customer actually pays for goods.
  v_goods := v_subtotal - v_discount;
  if v_settings.free_ship_threshold is not null and v_goods >= v_settings.free_ship_threshold then
    v_shipping := 0;
  end if;

  v_total := v_goods + v_shipping;

  ---------------------------------------------------------------------------
  -- 4. Generate a unique order number and insert the header.
  ---------------------------------------------------------------------------
  loop
    v_attempts := v_attempts + 1;
    v_order_number := 'MS-' || to_char(now(), 'YYYYMMDD') || '-' ||
                      upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    exit when not exists (select 1 from public.orders where order_number = v_order_number);
    if v_attempts > 12 then
      raise exception 'ERR_INVALID_INPUT: order number';
    end if;
  end loop;

  insert into public.orders (
    order_number, customer_name, customer_phone, wilaya, city, address, notes,
    subtotal, shipping, discount, total, status, language, delivery_type, source
  ) values (
    v_order_number, v_name, v_phone, v_wilaya, v_city, v_address, v_notes,
    v_subtotal, v_shipping, v_discount, v_total, 'pending', v_language,
    v_delivery_type, v_source
  )
  returning id into v_order_id;

  ---------------------------------------------------------------------------
  -- 5. PASS 2: insert the lines with server-fetched snapshots, then decrement
  --    stock. Every line already passed the stock check above.
  ---------------------------------------------------------------------------
  for v_item in select value from jsonb_array_elements(items) loop
    v_qty := (v_item->>'quantity')::integer;

    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and public.product_is_orderable(id);

    if not found then
      raise exception 'ERR_PRODUCT_UNAVAILABLE: %', v_item->>'product_id';
    end if;

    select url into v_image
    from public.product_images
    where product_id = v_product.id
    order by sort_order asc
    limit 1;

    -- Rebuild the variants array field by field. The client's jsonb is never
    -- stored as-is: it is attacker-writable and lands in an admin screen.
    v_variants := '[]'::jsonb;
    if jsonb_typeof(coalesce(v_item->'variants', '[]'::jsonb)) = 'array' then
      for v_variant in select value from jsonb_array_elements(v_item->'variants') loop
        v_variants := v_variants || jsonb_build_object(
          'name_fr', left(coalesce(v_variant->>'name_fr', ''), 40),
          'name_ar', left(coalesce(v_variant->>'name_ar', ''), 40),
          'value',   left(coalesce(v_variant->>'value', ''), 40)
        );
      end loop;
    end if;

    insert into public.order_items (
      order_id, product_id, name_fr, name_ar, price, quantity, color, size,
      variants, image_url
    ) values (
      v_order_id, v_product.id, v_product.name_fr, v_product.name_ar,
      v_product.price, v_qty,
      nullif(left(coalesce(v_item->>'color', ''), 40), ''),
      nullif(left(coalesce(v_item->>'size', ''), 40), ''),
      v_variants,
      v_image
    );

    update public.products
    set stock = stock - v_qty
    where id = v_product.id;
  end loop;

  return v_order_number;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC on every new function; be explicit.
revoke execute on function public.place_order(jsonb, jsonb) from public;
grant execute on function public.place_order(jsonb, jsonb) to anon, authenticated;


-- =============================================================================
-- get_order_by_number — the guest confirmation page's only way in.
--
-- `orders` has no anon SELECT policy (it holds every customer's phone number),
-- so OrderConfirmation.tsx CANNOT do .from("orders").select(...) — that 406s
-- for every real customer while looking fine in dev if you happen to be logged
-- in as an admin. This returns only the fields the confirmation page needs and
-- deliberately omits phone/address/notes even though it bypasses RLS.
-- There is no "list all orders" equivalent for anon, so this adds no
-- enumeration risk beyond guessing a 5-character suffix.
-- =============================================================================
create or replace function public.get_order_by_number(p_order_number text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order  public.orders%rowtype;
  v_items  jsonb;
begin
  if p_order_number is null or char_length(btrim(p_order_number)) not between 5 and 40 then
    return null;
  end if;

  select * into v_order from public.orders where order_number = btrim(p_order_number);

  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name_fr', oi.name_fr,
           'name_ar', oi.name_ar,
           'price', oi.price,
           'quantity', oi.quantity,
           'color', oi.color,
           'size', oi.size,
           'variants', oi.variants,
           'image_url', oi.image_url
         )), '[]'::jsonb)
  into v_items
  from public.order_items oi
  where oi.order_id = v_order.id;

  return jsonb_build_object(
    'order_number', v_order.order_number,
    'customer_name', v_order.customer_name,
    'wilaya', v_order.wilaya,
    'city', v_order.city,
    'delivery_type', v_order.delivery_type,
    'status', v_order.status,
    'subtotal', v_order.subtotal,
    'shipping', v_order.shipping,
    'discount', v_order.discount,
    'total', v_order.total,
    'created_at', v_order.created_at,
    'items', v_items
  );
end;
$$;

revoke execute on function public.get_order_by_number(text) from public;
grant execute on function public.get_order_by_number(text) to anon, authenticated;


-- =============================================================================
-- Restock on cancellation.
--
-- place_order decrements stock at placement (correct — it is reserved for that
-- customer), but COD refusal rates are high. Without this, every refused
-- delivery permanently eats inventory until in-stock items read "out of stock".
-- Fires only on the TRANSITION into 'cancelled', so re-saving an already
-- cancelled order cannot double-credit.
--
-- Note for the client: DELETING an order does not restock. Cancel first.
-- =============================================================================
create or replace function public.restock_cancelled_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.products p
    set stock = p.stock + oi.quantity
    from public.order_items oi
    where oi.order_id = new.id and oi.product_id = p.id;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_restock_on_cancel on public.orders;
create trigger orders_restock_on_cancel
  after update of status on public.orders
  for each row execute function public.restock_cancelled_order();
