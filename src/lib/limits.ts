/**
 * Order limits shared by the storefront.
 *
 * MAX_QTY_PER_LINE is a hard ceiling on how many pieces of one product a
 * shopper can put on a single line — it applies to every product regardless of
 * how much stock that product actually has. Stock can only lower it, never
 * raise it.
 *
 * The server enforces the same number: the order_items quantity trigger in
 * supabase/migrations/0014_hardening.sql rejects any order carrying more than
 * this for one product/option combination. Change both together.
 */
export const MAX_QTY_PER_LINE = 3;
