/**
 * Order limits shared by the storefront.
 *
 * MAX_QTY_PER_LINE is a hard ceiling on how many pieces of one product a
 * shopper can put on a single line — it applies to every product regardless of
 * how much stock that product actually has. Stock can only lower it, never
 * raise it.
 */
export const MAX_QTY_PER_LINE = 3;
