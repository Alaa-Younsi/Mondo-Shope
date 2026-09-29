import { lazy, Suspense, type ComponentProps } from "react";
import { Skeleton } from "@/components/ui/Feedback";
import { loadCheckoutForm } from "./loadCheckoutForm";

const CheckoutForm = lazy(async () => ({ default: (await loadCheckoutForm()).CheckoutForm }));

/**
 * CheckoutForm, code-split. The fallback reserves roughly the form's height so
 * nothing below it jumps when the chunk lands.
 */
export function LazyCheckoutForm(props: ComponentProps<typeof CheckoutForm>) {
  return (
    <Suspense fallback={<Skeleton className="h-[30rem] w-full" />}>
      <CheckoutForm {...props} />
    </Suspense>
  );
}
