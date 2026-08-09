-- =============================================================================
-- seed_demo.sql — DEMO CONTENT FOR PREVIEW ONLY
--
-- This is deliberately NOT in migrations/. Migrations run on every environment
-- forever; demo stock must never do that. Run this by hand in the Supabase SQL
-- editor when you want something to look at, and run the teardown block at the
-- bottom before you go live.
--
-- Re-running is safe: every insert upserts on its natural key, and the images
-- are cleared and rewritten rather than duplicated.
--
-- IMAGES: hot-linked from images.unsplash.com. Every URL below was checked and
-- returns 200, but they are somebody else's CDN and somebody else's photos —
-- fine for a preview, not for a real catalogue. Replace them with your own
-- uploads (admin → Produits → images) before selling anything.
-- =============================================================================

-- Categories -------------------------------------------------------------------
insert into public.categories (slug, name_fr, name_ar, description_fr, description_ar, image_url, sort_order)
values
  ('audio', 'Audio', 'سماعات',
   'Casques et écouteurs sans fil.', 'سماعات رأس وأذن لاسلكية.',
   'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80', 1),
  ('montres', 'Montres', 'ساعات',
   'Montres connectées et classiques.', 'ساعات ذكية وكلاسيكية.',
   'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&q=80', 2),
  ('chaussures', 'Chaussures', 'أحذية',
   'Baskets et sneakers du quotidien.', 'أحذية رياضية للاستعمال اليومي.',
   'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=80', 3),
  ('accessoires', 'Accessoires', 'إكسسوارات',
   'Sacs, lunettes et petits objets.', 'حقائب ونظارات وأغراض صغيرة.',
   'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=900&q=80', 4)
on conflict (slug) do update set
  name_fr = excluded.name_fr,
  name_ar = excluded.name_ar,
  description_fr = excluded.description_fr,
  description_ar = excluded.description_ar,
  image_url = excluded.image_url,
  sort_order = excluded.sort_order;

-- Products ---------------------------------------------------------------------
-- Prices are in DA. compare_at_price is set on a few so the -%% badge and the
-- struck-through price have something to render.
insert into public.products (
  slug, name_fr, name_ar, description_fr, description_ar,
  details_fr, details_ar, price, compare_at_price, category_id,
  stock, colors, sizes, featured, status
)
select v.slug, v.name_fr, v.name_ar, v.description_fr, v.description_ar,
       v.details_fr, v.details_ar, v.price, v.compare_at_price, c.id,
       v.stock, v.colors::jsonb, v.sizes::jsonb, v.featured, 'active'
from (values
  ('casque-bluetooth-pro', 'Casque Bluetooth Pro', 'سماعة بلوتوث برو',
   'Casque circum-auriculaire avec réduction de bruit active et 40 h d''autonomie.',
   'سماعة رأس مع خاصية إلغاء الضجيج وبطارية تدوم 40 ساعة.',
   array['Réduction de bruit active', 'Autonomie 40 heures', 'Bluetooth 5.3', 'Micro intégré'],
   array['إلغاء الضجيج النشط', 'بطارية 40 ساعة', 'بلوتوث 5.3', 'مايكروفون مدمج'],
   12900, 16900, 'audio', 24,
   '[{"label_fr":"Noir","label_ar":"أسود","hex":"#111111"},{"label_fr":"Beige","label_ar":"بيج","hex":"#D8C3A5"}]',
   '[]', true),

  ('ecouteurs-sans-fil-air', 'Écouteurs sans fil Air', 'سماعات لاسلكية إير',
   'Écouteurs compacts avec boîtier de charge et commandes tactiles.',
   'سماعات صغيرة مع علبة شحن وأزرار لمسية.',
   array['Boîtier de charge', 'Commandes tactiles', 'Résistant à la transpiration'],
   array['علبة شحن', 'تحكم باللمس', 'مقاومة للعرق'],
   6900, 8900, 'audio', 40, '[]', '[]', true),

  ('montre-connectee-fit', 'Montre connectée Fit', 'ساعة ذكية فيت',
   'Suivi d''activité, fréquence cardiaque et notifications.',
   'تتبع النشاط ونبض القلب والإشعارات.',
   array['Écran AMOLED', 'Cardio + SpO2', 'Étanche IP68', 'Autonomie 7 jours'],
   array['شاشة AMOLED', 'نبض القلب و SpO2', 'مقاومة للماء IP68', 'بطارية 7 أيام'],
   9500, null, 'montres', 18,
   '[{"label_fr":"Noir","label_ar":"أسود","hex":"#1A1A1A"},{"label_fr":"Or","label_ar":"ذهبي","hex":"#D08921"}]',
   '[]', true),

  ('montre-cuir-classic', 'Montre cuir Classic', 'ساعة جلدية كلاسيك',
   'Montre à quartz, bracelet cuir véritable, boîtier acier.',
   'ساعة كوارتز بسوار جلد طبيعي وهيكل فولاذي.',
   array['Bracelet cuir véritable', 'Boîtier acier inoxydable', 'Étanche 3 ATM'],
   array['سوار جلد طبيعي', 'هيكل فولاذ مقاوم', 'مقاومة للماء 3 ATM'],
   7400, 9200, 'montres', 12, '[]', '[]', false),

  ('baskets-urbaines', 'Baskets urbaines', 'حذاء رياضي حضري',
   'Baskets légères en maille respirante, semelle amortissante.',
   'حذاء خفيف بقماش شبكي ونعل مريح.',
   array['Maille respirante', 'Semelle amortissante', 'Poids léger'],
   array['قماش شبكي', 'نعل ممتص للصدمات', 'وزن خفيف'],
   8900, 11900, 'chaussures', 30, '[]', '["39","40","41","42","43","44"]', true),

  ('sneakers-runner', 'Sneakers Runner', 'حذاء ركض رانر',
   'Chaussures de running pour usage quotidien.',
   'حذاء ركض للاستعمال اليومي.',
   array['Amorti renforcé', 'Semelle antidérapante', 'Tige respirante'],
   array['امتصاص معزز', 'نعل مضاد للانزلاق', 'جزء علوي متنفس'],
   10500, null, 'chaussures', 22, '[]', '["40","41","42","43","44"]', false),

  ('lunettes-soleil-uv', 'Lunettes de soleil UV400', 'نظارات شمسية UV400',
   'Verres polarisés UV400, monture légère.',
   'عدسات مستقطبة UV400 بإطار خفيف.',
   array['Verres polarisés', 'Protection UV400', 'Étui inclus'],
   array['عدسات مستقطبة', 'حماية UV400', 'علبة مرفقة'],
   3900, 5400, 'accessoires', 50, '[]', '[]', false),

  ('sac-a-dos-city', 'Sac à dos City', 'حقيبة ظهر سيتي',
   'Sac à dos 22 L avec compartiment ordinateur 15".',
   'حقيبة ظهر 22 لتر مع جيب للحاسوب 15 بوصة.',
   array['Compartiment PC 15"', 'Tissu déperlant', 'Port USB externe'],
   array['جيب حاسوب 15 بوصة', 'قماش مقاوم للماء', 'منفذ USB خارجي'],
   5900, 7500, 'accessoires', 35, '[]', '[]', true)
) as v(slug, name_fr, name_ar, description_fr, description_ar,
       details_fr, details_ar, price, compare_at_price, cat_slug,
       stock, colors, sizes, featured)
join public.categories c on c.slug = v.cat_slug
on conflict (slug) do update set
  name_fr = excluded.name_fr,
  name_ar = excluded.name_ar,
  description_fr = excluded.description_fr,
  description_ar = excluded.description_ar,
  details_fr = excluded.details_fr,
  details_ar = excluded.details_ar,
  price = excluded.price,
  compare_at_price = excluded.compare_at_price,
  category_id = excluded.category_id,
  stock = excluded.stock,
  colors = excluded.colors,
  sizes = excluded.sizes,
  featured = excluded.featured,
  status = 'active';

-- Product images ---------------------------------------------------------------
-- Cleared first so re-running does not stack duplicates onto the gallery.
delete from public.product_images
where product_id in (
  select id from public.products where slug in (
    'casque-bluetooth-pro','ecouteurs-sans-fil-air','montre-connectee-fit',
    'montre-cuir-classic','baskets-urbaines','sneakers-runner',
    'lunettes-soleil-uv','sac-a-dos-city'
  )
);

insert into public.product_images (product_id, url, alt, sort_order)
select p.id, v.url, p.name_fr, v.ord
from (values
  ('casque-bluetooth-pro',   'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80', 0),
  ('casque-bluetooth-pro',   'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=900&q=80', 1),
  ('ecouteurs-sans-fil-air', 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=900&q=80', 0),
  ('ecouteurs-sans-fil-air', 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=900&q=80', 1),
  ('montre-connectee-fit',   'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=900&q=80', 0),
  ('montre-connectee-fit',   'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&q=80', 1),
  ('montre-cuir-classic',    'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=900&q=80', 0),
  ('montre-cuir-classic',    'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=900&q=80', 1),
  ('baskets-urbaines',       'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=80', 0),
  ('baskets-urbaines',       'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=900&q=80', 1),
  ('sneakers-runner',        'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=900&q=80', 0),
  ('sneakers-runner',        'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=900&q=80', 1),
  ('lunettes-soleil-uv',     'https://images.unsplash.com/photo-1625772452859-1c03d5bf1137?w=900&q=80', 0),
  ('lunettes-soleil-uv',     'https://images.unsplash.com/photo-1517254797898-04edd251bfb3?w=900&q=80', 1),
  ('sac-a-dos-city',         'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=900&q=80', 0),
  ('sac-a-dos-city',         'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=900&q=80', 1)
) as v(slug, url, ord)
join public.products p on p.slug = v.slug;

-- Reviews ----------------------------------------------------------------------
delete from public.client_reviews where review_text like '[demo]%';

insert into public.client_reviews (client_name, stars, review_text, active, sort_order)
values
  ('Amine B.',   5, '[demo] Commande reçue en 48h à Alger. Produit conforme, très bonne qualité.', true, 1),
  ('Lynda M.',   5, '[demo] Le paiement à la livraison m''a rassurée. Je recommande vraiment.', true, 2),
  ('Karim T.',   4, '[demo] Bon rapport qualité-prix, livraison rapide jusqu''à Oran.', true, 3),
  ('Sofiane R.', 5, '[demo] Service client réactif, ils ont appelé pour confirmer la commande.', true, 4);

-- Hero slider ------------------------------------------------------------------
update public.store_settings
set hero_slides = '[
  {"id":"demo-1","image_url":"https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=1200&q=80",
   "title_fr":"Nouvelle collection","title_ar":"تشكيلة جديدة",
   "subtitle_fr":"Livraison dans les 69 wilayas","subtitle_ar":"التوصيل إلى 69 ولاية",
   "link_url":"/shop"},
  {"id":"demo-2","image_url":"https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=1200&q=80",
   "title_fr":"Audio & accessoires","title_ar":"سماعات وإكسسوارات",
   "subtitle_fr":"Payez à la réception","subtitle_ar":"ادفع عند الاستلام",
   "link_url":"/shop?categorie=audio"},
  {"id":"demo-3","image_url":"https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=1200&q=80",
   "title_fr":"Montres connectées","title_ar":"ساعات ذكية",
   "subtitle_fr":"Jusqu''à -30%","subtitle_ar":"تخفيضات تصل إلى 30%",
   "link_url":"/shop?categorie=montres"}
]'::jsonb
where id = 1;

-- =============================================================================
-- TEARDOWN — run this before go-live to remove every trace of the demo.
-- product_images rows go with their product via ON DELETE CASCADE.
-- =============================================================================
-- delete from public.products where slug in (
--   'casque-bluetooth-pro','ecouteurs-sans-fil-air','montre-connectee-fit',
--   'montre-cuir-classic','baskets-urbaines','sneakers-runner',
--   'lunettes-soleil-uv','sac-a-dos-city');
-- delete from public.categories where slug in ('audio','montres','chaussures','accessoires');
-- delete from public.client_reviews where review_text like '[demo]%';
-- update public.store_settings set hero_slides = '[]'::jsonb where id = 1;
