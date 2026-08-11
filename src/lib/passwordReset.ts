import { supabase } from "@/lib/supabase";

/**
 * Where Supabase drops the visitor after they click the recovery e-mail.
 *
 * This exact URL (origin + path) has to be listed under
 * Supabase → Authentication → URL Configuration → Redirect URLs, otherwise the
 * link falls back to the Site URL and the token never reaches this app.
 */
export const PASSWORD_RESET_PATH = "/admin/nouveau-mot-de-passe";

export function passwordResetRedirectUrl(): string {
  return `${window.location.origin}${PASSWORD_RESET_PATH}`;
}

/**
 * Sends the recovery e-mail. Supabase answers 200 whether or not the address
 * exists, which is what we want — the caller must never reveal which is which.
 */
export async function sendPasswordResetEmail(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: passwordResetRedirectUrl(),
  });
}
