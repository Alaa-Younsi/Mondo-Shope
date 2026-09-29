import { lazy, Suspense } from "react";
import { BrowserRouter, Outlet, Route, Routes, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { MetaPixelProvider } from "@/components/MetaPixelProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { Scanlines } from "@/components/effects/Scanlines";
import { LoadingBlock } from "@/components/ui/Feedback";

import Landing from "@/pages/Landing";
import Shop from "@/pages/Shop";
import Product from "@/pages/Product";
import NotFound from "@/pages/NotFound";

// Pages nobody lands on cold — the checkout and its confirmation — plus
// campaign pages and the whole dashboard are their own bundles: none of them
// belongs in the storefront's first paint.
const Checkout = lazy(() => import("@/pages/Checkout"));
const OrderConfirmation = lazy(() => import("@/pages/OrderConfirmation"));
const LandingPageView = lazy(() => import("@/pages/LandingPageView"));
const AdminApp = lazy(() => import("@/pages/admin/AdminApp"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A catalogue does not change while the shopper tabs away, and refetching
      // burns their mobile data and the client's Supabase egress.
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
});

/**
 * Keyed by slug so moving from one product to another (a related-product card)
 * remounts the page. Reusing the instance would carry the previous product's
 * colour, size, quantity and gallery index over — a colour label the new
 * product does not have, which place_order() then rejects.
 */
function ProductRoute() {
  const { slug } = useParams<{ slug: string }>();
  return <Product key={slug} />;
}

function StorefrontLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        <Suspense fallback={<LoadingBlock />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <BrowserRouter>
            <MetaPixelProvider>
              <ScrollToTop />
              <Scanlines />

              <Routes>
                <Route element={<StorefrontLayout />}>
                  <Route index element={<Landing />} />
                  <Route path="shop" element={<Shop />} />
                  <Route path="produit/:slug" element={<ProductRoute />} />
                  <Route path="checkout" element={<Checkout />} />
                  <Route path="commande/:orderNumber" element={<OrderConfirmation />} />
                  {/* Ranked below every literal path, so it cannot shadow
                      /lp/* or /admin/*. */}
                  <Route path="*" element={<NotFound />} />
                </Route>

                {/* Campaign pages carry their own chrome, chosen per page. */}
                <Route
                  path="/lp/:slug"
                  element={
                    <Suspense fallback={<LoadingBlock />}>
                      <LandingPageView />
                    </Suspense>
                  }
                />

                <Route
                  path="/admin/*"
                  element={
                    <Suspense fallback={<LoadingBlock />}>
                      <AdminApp />
                    </Suspense>
                  }
                />
              </Routes>
            </MetaPixelProvider>
          </BrowserRouter>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
