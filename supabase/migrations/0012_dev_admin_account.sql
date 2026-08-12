-- =============================================================================
-- 0012_dev_admin_account.sql — add dev@mondoshope.shop to the dashboard
-- allow-list.
--
-- BACKGROUND: 0008_admin_account.sql closed with a deliberate single-operator
-- clause:
--
--     update public.admin_users set active = false
--     where email is distinct from 'admin@mondoshope.shop';
--
-- That statement is what this migration has to supersede. It ran once, at the
-- time 0008 was applied, so it is not still firing — but re-running 0008
-- against this database (a rebuild, a fresh branch, `db reset`) WOULD switch
-- the dev account straight back off. So the allow-list is redefined here as a
-- set rather than a single value, and 0012 is the file that now owns it: add
-- or remove operators here, not in 0008.
--
-- PREREQUISITE: the auth user must already exist.
--   Supabase → Authentication → Users → Add user
--   Email: dev@mondoshope.shop   (tick "Auto Confirm User")
--   As in 0008, the password is set there and is deliberately NOT in this
--   file — migrations are committed to git, and a password in git is a
--   password you have to rotate.
--
-- SCOPE: admin_users has no per-section permission column, so this grants the
-- dev account exactly what the owner account has — every RLS policy in
-- 0002_rls.sql gates on a bare public.is_admin() with no finer grain. There is
-- no read-only or partial-access tier to put it in.
-- =============================================================================

insert into public.admin_users (user_id, email, active)
select id, email, true
from auth.users
where email in ('admin@mondoshope.shop', 'dev@mondoshope.shop')
on conflict (user_id) do update set active = true;

-- Fail loudly rather than leaving you staring at "Accès refusé": if the auth
-- user was not created first, the insert above silently matches no rows.
do $$
begin
  if not exists (
    select 1 from public.admin_users where email = 'dev@mondoshope.shop' and active
  ) then
    raise exception
      'No auth user with email dev@mondoshope.shop. Create it under Authentication → Users (Auto Confirm User), then re-run this migration.';
  end if;
end $$;

-- Same belt-and-braces as 0008, widened from one operator to the two listed
-- above. Anyone who ever ends up in the allow-list by another route is revoked
-- rather than left active: the anon key ships inside the public JS bundle, so
-- a stray active row is a full store-owner write grant.
update public.admin_users
set active = false
where email is null
   or email not in ('admin@mondoshope.shop', 'dev@mondoshope.shop');
