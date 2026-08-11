-- =============================================================================
-- 0011_variant_stock.sql — per-option stock for colours, sizes and custom
-- variant values.
--
-- BEFORE: products.stock was a single integer. Selling a size M decremented the
-- same pool as a size L, no option could ever be individually out of stock, and
-- place_order() accepted ANY colour/size string the client sent — including one
-- the product does not offer.
--
-- AFTER: each option may carry its own `stock`.
--     colors   [{ hex, label_fr, label_ar, image_url, stock }]
--     sizes    [{ value, stock }]                  (was ["S","M","L"])
--     variants [{ name_fr, name_ar, values: [{ value, image_url, stock }] }]
--                                                  (values was string[])
--
--   stock = null (or absent) means UNTRACKED: that option sells against the
--   product's own stock. Every row written before this migration therefore
--   keeps behaving exactly as it did — nothing is rewritten in place, the
--   readers below accept both shapes.
--
-- MODEL: pools are INDEPENDENT PER AXIS, not a combination matrix. Buying one
-- "Red / M" decrements Red by one AND M by one; there is no Red-M cell. With
-- two tracked axes this can oversell one exact pairing (10 Red + 8 M in stock,
-- but only 3 actual Red-M). That is the deliberate, documented trade for an
-- admin form with one box per option instead of a grid that grows
-- multiplicatively.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Readers that tolerate BOTH shapes: a bare string (legacy) and an object.
-- ---------------------------------------------------------------------------

-- The selectable label of an option entry, whichever shape it is in.
create or replace function public.option_value(p_entry jsonb)
returns text
language sql
immutable
as $$
  select case
           when jsonb_typeof(p_entry) = 'string' then p_entry #>> '{}'
           when jsonb_typeof(p_entry) = 'object' then p_entry ->> 'value'
           else null
         end;
$$;

-- The option's own pool, or NULL when untracked.
create or replace function public.option_stock(p_entry jsonb)
returns integer
language sql
immutable
as $$
  select case
           when jsonb_typeof(p_entry) <> 'object' then null
           when p_entry -> 'stock' is null then null
           when jsonb_typeof(p_entry -> 'stock') <> 'number' then null
           else greatest(0, floor((p_entry ->> 'stock')::numeric)::integer)
         end;
$$;

/*
 * Find one option inside a jsonb array by its label and return its index and
 * remaining stock. `p_match_labels` lets a colour be found by label_fr OR
 * label_ar — order_items stores whichever language the customer was browsing
 * in, so the restock path has to accept both.
 */
create or replace function public.find_option(
  p_options jsonb,
  p_label text,
  p_match_labels boolean default false
)
returns table (idx integer, stock integer)
language sql
stable
as $$
  select (ordinal - 1)::integer,
         public.option_stock(entry)
  from jsonb_array_elements(coalesce(p_options, '[]'::jsonb))
       with ordinality as t(entry, ordinal)
  where p_label is not null
    and (
      public.option_value(entry) = p_label
      or (p_match_labels and (entry ->> 'label_fr' = p_label
                              or entry ->> 'label_ar' = p_label))
    )
  limit 1;
$$;

/*
 * Add `p_delta` to one option's stock, addressed by index. Untracked options
 * are left untouched — writing a number onto them would silently convert an
 * untracked option into a tracked one at zero and take it off sale.
 */
create or replace function public.bump_option_stock(
  p_options jsonb,
  p_index integer,
  p_delta integer
)
returns jsonb
language sql
immutable
as $$
  select case
           when p_index is null
             or p_index < 0
             or p_index >= jsonb_array_length(coalesce(p_options, '[]'::jsonb))
             or public.option_stock(p_options -> p_index) is null
           then p_options
           else jsonb_set(
                  p_options,
                  array[p_index::text, 'stock'],
                  to_jsonb(greatest(0, public.option_stock(p_options -> p_index) + p_delta))
                )
         end;
$$;

revoke execute on function public.option_value(jsonb) from public;
revoke execute on function public.option_stock(jsonb) from public;
revoke execute on function public.find_option(jsonb, text, boolean) from public;
revoke execute on function public.bump_option_stock(jsonb, integer, integer) from public;

-- =============================================================================
-- place_order — re-declared to validate and decrement per-option stock.
--
-- Everything the previous version hardened is preserved verbatim: server-side
-- customer validation, phone rate limiting, cart shape caps, FOR UPDATE row
-- locking, server-side offer pricing, reject-never-clamp on stock, unknown or
-- disabled wilaya rejection, and field-by-field rebuilding of the variants
-- jsonb. The additions are marked NEW.
-- =============================================================================
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

  -- NEW: per-option bookkeeping.
  v_colors        jsonb;
  v_sizes         jsonb;
  v_variant_defs  jsonb;
  v_group         jsonb;
  v_group_idx     integer;
  v_sel_color     text;
  v_sel_size      text;
  v_sel_value     text;
  v_opt_idx       integer;
  v_opt_stock     integer;
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
  -- 2. Validate the cart shape, then price PASS 1.
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

    if v_qty <= 0 or v_qty > 20 then
      raise exception 'ERR_PRODUCT_UNAVAILABLE: quantity out of range';
    end if;

    if jsonb_typeof(coalesce(v_item->'variants', '[]'::jsonb)) = 'array'
       and jsonb_array_length(coalesce(v_item->'variants', '[]'::jsonb)) > 10 then
      raise exception 'ERR_INVALID_INPUT: too many variants';
    end if;

    -- FOR UPDATE serializes concurrent checkouts of the same product.
    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and public.product_is_orderable(id)
    for update;

    if not found then
      raise exception 'ERR_PRODUCT_UNAVAILABLE: %', v_item->>'product_id';
    end if;

    if v_product.stock < v_qty then
      raise exception 'ERR_STOCK: %', v_product.name_fr;
    end if;

    -------------------------------------------------------------------------
    -- NEW 2b. Every axis the product offers must be answered with an option
    -- the product actually has, and that option must have the stock.
    --
    -- Previously the client's colour/size strings were stored unvalidated, so
    -- a direct call could order a size that does not exist and the client
    -- would ship a guess. Selection is now mandatory whenever the axis has at
    -- least one option left, which matches what the storefront enforces.
    -------------------------------------------------------------------------
    v_colors       := coalesce(v_product.colors, '[]'::jsonb);
    v_sizes        := coalesce(v_product.sizes, '[]'::jsonb);
    v_variant_defs := coalesce(v_product.variants, '[]'::jsonb);

    v_sel_color := nullif(btrim(coalesce(v_item->>'color', '')), '');
    v_sel_size  := nullif(btrim(coalesce(v_item->>'size', '')), '');

    if jsonb_array_length(v_colors) > 0 then
      if v_sel_color is null then
        raise exception 'ERR_OPTION_REQUIRED: color';
      end if;
      select idx, stock into v_opt_idx, v_opt_stock
      from public.find_option(v_colors, v_sel_color, true);
      if v_opt_idx is null then
        raise exception 'ERR_OPTION_UNAVAILABLE: color';
      end if;
      if v_opt_stock is not null and v_opt_stock < v_qty then
        raise exception 'ERR_OPTION_STOCK: %', v_sel_color;
      end if;
    end if;

    if jsonb_array_length(v_sizes) > 0 then
      if v_sel_size is null then
        raise exception 'ERR_OPTION_REQUIRED: size';
      end if;
      select idx, stock into v_opt_idx, v_opt_stock
      from public.find_option(v_sizes, v_sel_size);
      if v_opt_idx is null then
        raise exception 'ERR_OPTION_UNAVAILABLE: size';
      end if;
      if v_opt_stock is not null and v_opt_stock < v_qty then
        raise exception 'ERR_OPTION_STOCK: %', v_sel_size;
      end if;
    end if;

    for v_group in select value from jsonb_array_elements(v_variant_defs) loop
      if jsonb_array_length(coalesce(v_group->'values', '[]'::jsonb)) = 0 then
        continue;
      end if;

      select v->>'value' into v_sel_value
      from jsonb_array_elements(coalesce(v_item->'variants', '[]'::jsonb)) as t(v)
      where v->>'name_fr' = v_group->>'name_fr'
      limit 1;

      v_sel_value := nullif(btrim(coalesce(v_sel_value, '')), '');
      if v_sel_value is null then
        raise exception 'ERR_OPTION_REQUIRED: %', v_group->>'name_fr';
      end if;

      select idx, stock into v_opt_idx, v_opt_stock
      from public.find_option(v_group->'values', v_sel_value);
      if v_opt_idx is null then
        raise exception 'ERR_OPTION_UNAVAILABLE: %', v_group->>'name_fr';
      end if;
      if v_opt_stock is not null and v_opt_stock < v_qty then
        raise exception 'ERR_OPTION_STOCK: %', v_sel_value;
      end if;
    end loop;

    v_line_base := v_product.price * v_qty;
    v_line_best := v_line_base;

    -- Quantity offers, priced server-side. src/lib/offers.ts mirrors this math.
    if jsonb_typeof(coalesce(v_product.quantity_offers, '[]'::jsonb)) = 'array' then
      for v_offer in select value from jsonb_array_elements(v_product.quantity_offers) loop
        if v_offer->>'type' = 'free' then
          v_buy := coalesce(nullif(v_offer->>'buy', '')::integer, 0);
          v_get := coalesce(nullif(v_offer->>'get', '')::integer, 0);
          if v_buy > 0 and v_get > 0 then
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
  -- 3. Shipping.
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
  -- 5. PASS 2: insert the lines, then decrement the product pool AND every
  --    selected option's pool.
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

    -- The client's jsonb is never stored as-is: it is attacker-writable and
    -- lands in an admin screen.
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

    -- NEW: decrement the option pools alongside the product total.
    v_colors       := coalesce(v_product.colors, '[]'::jsonb);
    v_sizes        := coalesce(v_product.sizes, '[]'::jsonb);
    v_variant_defs := coalesce(v_product.variants, '[]'::jsonb);

    /*
     * Re-check here, not only in pass 1.
     *
     * Pass 1 validates each line against the product as it stands at that
     * moment, so TWO lines of the same product — which is now the normal way to
     * buy a size S and a size M together — each saw the full stock and both
     * passed. This pass re-reads the row, so it sees the previous line's
     * decrement and is the only place that can catch the cumulative overdraw.
     * Raising rolls the whole order back.
     */
    v_sel_color := nullif(btrim(coalesce(v_item->>'color', '')), '');
    if v_sel_color is not null then
      select idx into v_opt_idx from public.find_option(v_colors, v_sel_color, true);
      v_opt_stock := public.option_stock(v_colors -> v_opt_idx);
      if v_opt_stock is not null and v_opt_stock < v_qty then
        raise exception 'ERR_OPTION_STOCK: %', v_sel_color;
      end if;
      v_colors := public.bump_option_stock(v_colors, v_opt_idx, -v_qty);
    end if;

    v_sel_size := nullif(btrim(coalesce(v_item->>'size', '')), '');
    if v_sel_size is not null then
      select idx into v_opt_idx from public.find_option(v_sizes, v_sel_size);
      v_opt_stock := public.option_stock(v_sizes -> v_opt_idx);
      if v_opt_stock is not null and v_opt_stock < v_qty then
        raise exception 'ERR_OPTION_STOCK: %', v_sel_size;
      end if;
      v_sizes := public.bump_option_stock(v_sizes, v_opt_idx, -v_qty);
    end if;

    v_group_idx := 0;
    for v_group in select value from jsonb_array_elements(v_variant_defs) loop
      select v->>'value' into v_sel_value
      from jsonb_array_elements(v_variants) as t(v)
      where v->>'name_fr' = v_group->>'name_fr'
      limit 1;

      if v_sel_value is not null then
        select idx into v_opt_idx from public.find_option(v_group->'values', v_sel_value);
        if v_opt_idx is not null then
          v_opt_stock := public.option_stock(v_group->'values'->v_opt_idx);
          if v_opt_stock is not null and v_opt_stock < v_qty then
            raise exception 'ERR_OPTION_STOCK: %', v_sel_value;
          end if;
          v_variant_defs := jsonb_set(
            v_variant_defs,
            array[v_group_idx::text, 'values'],
            public.bump_option_stock(v_group->'values', v_opt_idx, -v_qty)
          );
        end if;
      end if;
      v_group_idx := v_group_idx + 1;
    end loop;

    -- `and stock >= v_qty` is the guard that makes the product total safe under
    -- the same multi-line case. Without it the UPDATE happily drives stock
    -- negative and the store keeps selling what it does not have.
    update public.products
    set stock    = stock - v_qty,
        colors   = v_colors,
        sizes    = v_sizes,
        variants = v_variant_defs
    where id = v_product.id
      and stock >= v_qty;

    if not found then
      raise exception 'ERR_STOCK: %', v_product.name_fr;
    end if;
  end loop;

  return v_order_number;
end;
$$;

revoke execute on function public.place_order(jsonb, jsonb) from public;
grant execute on function public.place_order(jsonb, jsonb) to anon, authenticated;


-- =============================================================================
-- restock_cancelled_order — re-declared to put the option pools back too.
--
-- Without this, cancelling a COD refusal returned the unit to the product total
-- but left the size it was bought in permanently down one, so a high-refusal
-- product would drift into "every size sold out" while the total said 40.
-- =============================================================================
create or replace function public.restock_cancelled_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line         record;
  v_colors       jsonb;
  v_sizes        jsonb;
  v_variant_defs jsonb;
  v_group        jsonb;
  v_group_idx    integer;
  v_sel_value    text;
  v_opt_idx      integer;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    for v_line in
      select oi.product_id, oi.quantity, oi.color, oi.size, oi.variants
      from public.order_items oi
      where oi.order_id = new.id and oi.product_id is not null
    loop
      select colors, sizes, variants
      into v_colors, v_sizes, v_variant_defs
      from public.products
      where id = v_line.product_id
      for update;

      if not found then
        continue;
      end if;

      v_colors       := coalesce(v_colors, '[]'::jsonb);
      v_sizes        := coalesce(v_sizes, '[]'::jsonb);
      v_variant_defs := coalesce(v_variant_defs, '[]'::jsonb);

      if v_line.color is not null then
        select idx into v_opt_idx from public.find_option(v_colors, v_line.color, true);
        v_colors := public.bump_option_stock(v_colors, v_opt_idx, v_line.quantity);
      end if;

      if v_line.size is not null then
        select idx into v_opt_idx from public.find_option(v_sizes, v_line.size);
        v_sizes := public.bump_option_stock(v_sizes, v_opt_idx, v_line.quantity);
      end if;

      v_group_idx := 0;
      for v_group in select value from jsonb_array_elements(v_variant_defs) loop
        select v->>'value' into v_sel_value
        from jsonb_array_elements(coalesce(v_line.variants, '[]'::jsonb)) as t(v)
        where v->>'name_fr' = v_group->>'name_fr'
        limit 1;

        if v_sel_value is not null then
          select idx into v_opt_idx from public.find_option(v_group->'values', v_sel_value);
          if v_opt_idx is not null then
            v_variant_defs := jsonb_set(
              v_variant_defs,
              array[v_group_idx::text, 'values'],
              public.bump_option_stock(v_group->'values', v_opt_idx, v_line.quantity)
            );
          end if;
        end if;
        v_group_idx := v_group_idx + 1;
      end loop;

      update public.products
      set stock    = stock + v_line.quantity,
          colors   = v_colors,
          sizes    = v_sizes,
          variants = v_variant_defs
      where id = v_line.product_id;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_restock_on_cancel on public.orders;
create trigger orders_restock_on_cancel
  after update of status on public.orders
  for each row execute function public.restock_cancelled_order();
