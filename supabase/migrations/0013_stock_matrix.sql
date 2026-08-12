-- =============================================================================
-- 0013_stock_matrix.sql — connect colour and size into ONE stock grid.
--
-- BEFORE (0011): colour and size were INDEPENDENT pools. Buying a "Red / M"
-- decremented Red by one AND M by one, with no Red-M cell anywhere. 0011
-- documented the consequence honestly: 10 Red + 8 M in stock can oversell the
-- exact Red-M pairing, because nothing in the schema knew how many Red-M there
-- actually were.
--
-- AFTER: a product may carry a grid.
--
--     stock_matrix  [{ "color": "<hex>", "size": "<value>", "stock": <int> }]
--
--   One entry per offered combination. A combination with NO entry is not
--   offered at all — that is how the admin grid's untick works, and it is why
--   an absent cell must never be read as "zero of something we sell".
--
-- WHAT STAYS INDEPENDENT: custom variant groups (material, finish, …) keep the
-- per-axis pools 0011 gave them. Folding them into the grid too would make the
-- admin form grow multiplicatively — 3 colours x 3 sizes x 2 materials is 18
-- boxes for one shirt — and the grid already removes the oversell that
-- actually bites, which is the colour/size one.
--
-- BACKWARD COMPATIBILITY: `stock_matrix = []` means NO GRID, and every product
-- written before this migration has exactly that. Those rows keep 0011's
-- independent-pool behaviour byte for byte; nothing is rewritten in place. The
-- grid only takes over when it is non-empty AND the product actually has both
-- colours and sizes to build it from — see `matrix_active` below.
--
-- products.stock BECOMES DERIVED once a grid exists: the trigger at the bottom
-- overwrites it with the sum of the cells on every write, so the admin's own
-- stock box is display-only for gridded products and the two can never drift.
-- =============================================================================

alter table public.products
  add column if not exists stock_matrix jsonb not null default '[]'::jsonb;

comment on column public.products.stock_matrix is
  'Colour x size grid: [{color:<hex>, size:<value>, stock:<int>}]. Empty = no '
  'grid, fall back to the independent per-axis pools from 0011. A missing cell '
  'means that combination is not offered.';


-- ---------------------------------------------------------------------------
-- Grid readers.
-- ---------------------------------------------------------------------------

/*
 * Is the grid the authority for this product?
 *
 * Non-empty is not enough. A grid keyed on colour and size is meaningless once
 * either axis is gone, and a product whose colours were all deleted would
 * otherwise be left unbuyable behind cells that can never be matched. Both
 * axes must be present, or we fall through to 0011.
 */
create or replace function public.matrix_active(
  p_matrix jsonb,
  p_colors jsonb,
  p_sizes  jsonb
)
returns boolean
language sql
immutable
as $$
  select jsonb_array_length(coalesce(p_matrix, '[]'::jsonb)) > 0
     and jsonb_array_length(coalesce(p_colors, '[]'::jsonb)) > 0
     and jsonb_array_length(coalesce(p_sizes,  '[]'::jsonb)) > 0;
$$;

/*
 * Locate one cell by colour hex + size label.
 *
 * Returns no row when the combination is not offered, which the callers below
 * treat as "unavailable" rather than "zero" — the two are different answers and
 * only one of them is a mistake to sell against.
 */
create or replace function public.matrix_find(
  p_matrix jsonb,
  p_color  text,
  p_size   text
)
returns table (idx integer, stock integer)
language sql
stable
as $$
  select (ordinal - 1)::integer,
         greatest(0, floor(coalesce((cell ->> 'stock')::numeric, 0))::integer)
  from jsonb_array_elements(coalesce(p_matrix, '[]'::jsonb))
       with ordinality as t(cell, ordinal)
  where p_color is not null
    and p_size  is not null
    and cell ->> 'color' = p_color
    and cell ->> 'size'  = p_size
  limit 1;
$$;

/* Add p_delta to one cell, addressed by index. Clamped at zero. */
create or replace function public.matrix_bump(
  p_matrix jsonb,
  p_index  integer,
  p_delta  integer
)
returns jsonb
language sql
immutable
as $$
  select case
           when p_index is null
             or p_index < 0
             or p_index >= jsonb_array_length(coalesce(p_matrix, '[]'::jsonb))
           then p_matrix
           else jsonb_set(
                  p_matrix,
                  array[p_index::text, 'stock'],
                  to_jsonb(greatest(
                    0,
                    floor(coalesce((p_matrix -> p_index ->> 'stock')::numeric, 0))::integer + p_delta
                  ))
                )
         end;
$$;

/* Sum of every cell — what products.stock is kept equal to. */
create or replace function public.matrix_total(p_matrix jsonb)
returns integer
language sql
immutable
as $$
  select coalesce(
           sum(greatest(0, floor(coalesce((cell ->> 'stock')::numeric, 0))::integer)),
           0
         )::integer
  from jsonb_array_elements(coalesce(p_matrix, '[]'::jsonb)) as t(cell);
$$;

/*
 * Drop cells whose colour or size no longer exists on the product.
 *
 * Deleting a colour in the admin form leaves its whole row of cells orphaned.
 * Left alone they would keep counting toward the total, so the shop would
 * advertise stock for a colour it no longer lists. Pruning on write is what
 * keeps `stock` honest without asking the admin UI to be careful.
 */
create or replace function public.matrix_prune(
  p_matrix jsonb,
  p_colors jsonb,
  p_sizes  jsonb
)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_agg(cell), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_matrix, '[]'::jsonb)) as t(cell)
  where exists (
          select 1
          from jsonb_array_elements(coalesce(p_colors, '[]'::jsonb)) as c(col)
          where col ->> 'hex' = cell ->> 'color'
        )
    and exists (
          select 1
          from jsonb_array_elements(coalesce(p_sizes, '[]'::jsonb)) as s(sz)
          where public.option_value(sz) = cell ->> 'size'
        );
$$;

revoke execute on function public.matrix_active(jsonb, jsonb, jsonb) from public;
revoke execute on function public.matrix_find(jsonb, text, text) from public;
revoke execute on function public.matrix_bump(jsonb, integer, integer) from public;
revoke execute on function public.matrix_total(jsonb) from public;
revoke execute on function public.matrix_prune(jsonb, jsonb, jsonb) from public;


-- =============================================================================
-- Keep products.stock equal to the grid, whoever writes the row.
--
-- SECURITY DEFINER because the helpers above are revoked from public and this
-- fires under the admin's `authenticated` role on every product save.
-- =============================================================================
create or replace function public.sync_matrix_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.stock_matrix := public.matrix_prune(
    coalesce(new.stock_matrix, '[]'::jsonb),
    coalesce(new.colors, '[]'::jsonb),
    coalesce(new.sizes,  '[]'::jsonb)
  );

  if public.matrix_active(new.stock_matrix, new.colors, new.sizes) then
    new.stock := public.matrix_total(new.stock_matrix);
  end if;

  return new;
end;
$$;

drop trigger if exists products_sync_matrix_stock on public.products;
create trigger products_sync_matrix_stock
  before insert or update on public.products
  for each row execute function public.sync_matrix_stock();


-- =============================================================================
-- place_order — re-declared to price and decrement against the grid.
--
-- Everything 0011 and its predecessors hardened is preserved verbatim:
-- server-side customer validation, phone rate limiting, cart shape caps, FOR
-- UPDATE row locking, server-side offer pricing, reject-never-clamp on stock,
-- unknown/disabled wilaya rejection, mandatory option selection, and
-- field-by-field rebuilding of the variants jsonb. Grid changes are marked GRID.
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

  -- GRID bookkeeping.
  v_matrix        jsonb;
  v_use_matrix    boolean;
  v_color_hex     text;
  v_cell_idx      integer;
  v_cell_stock    integer;
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
    -- 2b. Every axis the product offers must be answered with an option the
    -- product actually has, and that option must have the stock.
    -------------------------------------------------------------------------
    v_colors       := coalesce(v_product.colors, '[]'::jsonb);
    v_sizes        := coalesce(v_product.sizes, '[]'::jsonb);
    v_variant_defs := coalesce(v_product.variants, '[]'::jsonb);
    v_matrix       := coalesce(v_product.stock_matrix, '[]'::jsonb);
    v_use_matrix   := public.matrix_active(v_matrix, v_colors, v_sizes);

    v_sel_color := nullif(btrim(coalesce(v_item->>'color', '')), '');
    v_sel_size  := nullif(btrim(coalesce(v_item->>'size', '')), '');
    v_color_hex := null;

    if jsonb_array_length(v_colors) > 0 then
      if v_sel_color is null then
        raise exception 'ERR_OPTION_REQUIRED: color';
      end if;
      select idx, stock into v_opt_idx, v_opt_stock
      from public.find_option(v_colors, v_sel_color, true);
      if v_opt_idx is null then
        raise exception 'ERR_OPTION_UNAVAILABLE: color';
      end if;
      -- GRID: the cell is the authority, so the colour's own pool is not
      -- consulted. The lookup above still runs — it is what rejects a colour
      -- the product does not offer, and it resolves the hex the grid is keyed
      -- on. order_items stores the LABEL the shopper saw, in whichever
      -- language they were browsing; the grid is keyed on hex, and this is the
      -- only place that translation happens.
      v_color_hex := v_colors -> v_opt_idx ->> 'hex';
      if not v_use_matrix and v_opt_stock is not null and v_opt_stock < v_qty then
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
      if not v_use_matrix and v_opt_stock is not null and v_opt_stock < v_qty then
        raise exception 'ERR_OPTION_STOCK: %', v_sel_size;
      end if;
    end if;

    -- GRID: the pairing itself, which is the whole point of this migration.
    if v_use_matrix then
      select idx, stock into v_cell_idx, v_cell_stock
      from public.matrix_find(v_matrix, v_color_hex, v_sel_size);
      if v_cell_idx is null then
        raise exception 'ERR_COMBO_UNAVAILABLE: % / %', v_sel_color, v_sel_size;
      end if;
      if v_cell_stock < v_qty then
        raise exception 'ERR_OPTION_STOCK: % / %', v_sel_color, v_sel_size;
      end if;
    end if;

    -- Custom variant groups stay independent of the grid.
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
  -- 5. PASS 2: insert the lines, then decrement every pool that was drawn on.
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

    v_colors       := coalesce(v_product.colors, '[]'::jsonb);
    v_sizes        := coalesce(v_product.sizes, '[]'::jsonb);
    v_variant_defs := coalesce(v_product.variants, '[]'::jsonb);
    v_matrix       := coalesce(v_product.stock_matrix, '[]'::jsonb);
    v_use_matrix   := public.matrix_active(v_matrix, v_colors, v_sizes);

    /*
     * Re-check here, not only in pass 1.
     *
     * Pass 1 validates each line against the product as it stands at that
     * moment, so TWO lines of the same product — which is the normal way to buy
     * a size S and a size M together — each saw the full stock and both passed.
     * This pass re-reads the row, so it sees the previous line's decrement and
     * is the only place that can catch the cumulative overdraw. Raising rolls
     * the whole order back.
     */
    v_sel_color := nullif(btrim(coalesce(v_item->>'color', '')), '');
    v_sel_size  := nullif(btrim(coalesce(v_item->>'size', '')), '');
    v_color_hex := null;

    if v_sel_color is not null then
      select idx into v_opt_idx from public.find_option(v_colors, v_sel_color, true);
      v_color_hex := v_colors -> v_opt_idx ->> 'hex';

      -- GRID: skip the per-axis colour pool entirely. Decrementing both it and
      -- the cell would take two units off the shelf for one shirt sold.
      if not v_use_matrix then
        v_opt_stock := public.option_stock(v_colors -> v_opt_idx);
        if v_opt_stock is not null and v_opt_stock < v_qty then
          raise exception 'ERR_OPTION_STOCK: %', v_sel_color;
        end if;
        v_colors := public.bump_option_stock(v_colors, v_opt_idx, -v_qty);
      end if;
    end if;

    if v_sel_size is not null and not v_use_matrix then
      select idx into v_opt_idx from public.find_option(v_sizes, v_sel_size);
      v_opt_stock := public.option_stock(v_sizes -> v_opt_idx);
      if v_opt_stock is not null and v_opt_stock < v_qty then
        raise exception 'ERR_OPTION_STOCK: %', v_sel_size;
      end if;
      v_sizes := public.bump_option_stock(v_sizes, v_opt_idx, -v_qty);
    end if;

    if v_use_matrix then
      select idx, stock into v_cell_idx, v_cell_stock
      from public.matrix_find(v_matrix, v_color_hex, v_sel_size);
      if v_cell_idx is null then
        raise exception 'ERR_COMBO_UNAVAILABLE: % / %', v_sel_color, v_sel_size;
      end if;
      if v_cell_stock < v_qty then
        raise exception 'ERR_OPTION_STOCK: % / %', v_sel_color, v_sel_size;
      end if;
      v_matrix := public.matrix_bump(v_matrix, v_cell_idx, -v_qty);
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
    --
    -- GRID: `stock` is assigned here anyway, then overwritten by the
    -- products_sync_matrix_stock BEFORE trigger with the sum of the cells. Both
    -- arrive at the same number; the trigger is what guarantees it.
    update public.products
    set stock        = stock - v_qty,
        colors       = v_colors,
        sizes        = v_sizes,
        variants     = v_variant_defs,
        stock_matrix = v_matrix
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
-- restock_cancelled_order — re-declared to put the grid cell back too.
--
-- Without this, cancelling a COD refusal returned the unit to the product total
-- but left the exact colour/size combination permanently down one, so a
-- high-refusal product would drift into "every combination sold out" while the
-- total still said 40.
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
  v_matrix       jsonb;
  v_use_matrix   boolean;
  v_color_hex    text;
  v_cell_idx     integer;
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
      select colors, sizes, variants, stock_matrix
      into v_colors, v_sizes, v_variant_defs, v_matrix
      from public.products
      where id = v_line.product_id
      for update;

      if not found then
        continue;
      end if;

      v_colors       := coalesce(v_colors, '[]'::jsonb);
      v_sizes        := coalesce(v_sizes, '[]'::jsonb);
      v_variant_defs := coalesce(v_variant_defs, '[]'::jsonb);
      v_matrix       := coalesce(v_matrix, '[]'::jsonb);
      v_use_matrix   := public.matrix_active(v_matrix, v_colors, v_sizes);
      v_color_hex    := null;

      if v_line.color is not null then
        select idx into v_opt_idx from public.find_option(v_colors, v_line.color, true);
        v_color_hex := v_colors -> v_opt_idx ->> 'hex';
        if not v_use_matrix then
          v_colors := public.bump_option_stock(v_colors, v_opt_idx, v_line.quantity);
        end if;
      end if;

      if v_line.size is not null and not v_use_matrix then
        select idx into v_opt_idx from public.find_option(v_sizes, v_line.size);
        v_sizes := public.bump_option_stock(v_sizes, v_opt_idx, v_line.quantity);
      end if;

      /*
       * A cell that no longer exists is skipped rather than recreated. The
       * combination was retired from the grid by the admin at some point after
       * the order was placed; putting it back would silently return it to sale.
       */
      if v_use_matrix then
        select idx into v_cell_idx
        from public.matrix_find(v_matrix, v_color_hex, v_line.size);
        if v_cell_idx is not null then
          v_matrix := public.matrix_bump(v_matrix, v_cell_idx, v_line.quantity);
        end if;
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

      -- As in place_order, the BEFORE trigger recomputes `stock` from the cells
      -- when a grid is active, so the arithmetic here is the non-grid path.
      update public.products
      set stock        = stock + v_line.quantity,
          colors       = v_colors,
          sizes        = v_sizes,
          variants     = v_variant_defs,
          stock_matrix = v_matrix
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
