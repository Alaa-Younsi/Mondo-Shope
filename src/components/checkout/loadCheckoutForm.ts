/**
 * The checkout form pulls in zod and react-hook-form, which nothing else on a
 * first paint needs. Loading it through this one function lets a page start
 * the download early (on mount) while keeping it out of the entry bundle.
 */
export const loadCheckoutForm = () => import("./CheckoutForm");
