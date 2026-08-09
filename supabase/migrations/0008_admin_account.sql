-- =============================================================================
-- 0008_admin_account.sql — grant the store owner dashboard access
--
-- WHY "Accès refusé" HAPPENED
--   Creating a user under Authentication → Users only creates an auth identity.
--   Every table's RLS policy gates writes on public.is_admin(), which checks
--   the public.admin_users allow-list — and 0002_rls.sql shipped with the
--   placeholder 'owner@mondoshope.com' that was never changed. The account
--   existed but was on nobody's list, so the dashboard correctly refused it.
--
-- This is NOT a "team" feature. There is no UI anywhere in the dashboard for
-- creating or managing other users, and this migration does not add one. The
-- allow-list is a security boundary: the anon key ships inside the public JS
-- bundle, so without it, anyone who self-registers lands in the `authenticated`
-- role and — under a blanket `TO authenticated` policy — would have full
-- store-owner write access without ever visiting /admin/login. One row here is
-- what keeps that shut.
--
-- PREREQUISITE: the auth user must already exist.
--   Supabase → Authentication → Users → Add user
--   Email: admin@mondoshope.shop   (tick "Auto Confirm User")
--   The password is set there, in the dashboard. It is deliberately not in
--   this file — migrations are committed to git, and a password in git is a
--   password you have to rotate.
--
-- Password changes afterwards are self-service in the dashboard itself:
--   /admin/compte → "Changer le mot de passe".
-- =============================================================================

insert into public.admin_users (user_id, email, active)
select id, email, true
from auth.users
where email = 'admin@mondoshope.shop'
on conflict (user_id) do update set active = true;

-- Fail loudly instead of leaving you staring at "Accès refusé" again: if the
-- auth user was not created first, the insert above silently matches no rows.
do $$
begin
  if not exists (
    select 1 from public.admin_users where email = 'admin@mondoshope.shop' and active
  ) then
    raise exception
      'No auth user with email admin@mondoshope.shop. Create it under Authentication → Users (Auto Confirm User), then re-run this migration.';
  end if;
end $$;

-- Belt and braces: this store has exactly one operator, so anyone else who
-- ever ends up in the allow-list is revoked here rather than left active.
update public.admin_users
set active = false
where email is distinct from 'admin@mondoshope.shop';
