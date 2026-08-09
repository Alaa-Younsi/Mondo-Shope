import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { MetaPixelProvider } from "@/components/MetaPixelProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { Scanlines } from "@/components/effects/Scanlines";
import { LoadingBlock } from "@/components/ui/Feedback";
import { SUPABASE_ORIGIN } from "@/lib/supabase";

import Landing from "@/pages/Landing";
import Shop from "@/pages/Shop";
import Product from "@/pages/Product";
import Checkout from "@/pages/Checkout";
import OrderConfirmation from "@/pages/OrderConfirmation";
import NotFound from "@/pages/NotFound";

// Campaign pages and the whole dashboard are their own bundles: neither belongs
// in the storefront's first paint.
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

/** The first query and every product image come from the Supabase origin. */
function Preconnect() {
  useEffect(() => {
    if (document.querySelector(`link[rel="preconnect"][href="${SUPABASE_ORIGIN}"]`)) return;
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = SUPABASE_ORIGIN;
    link.crossOrigin = "";
    document.head.appendChild(link);
  }, []);
  return null;
}

function StorefrontLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
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
              <Preconnect />
              <ScrollToTop />
              <Scanlines />

              <Routes>
                <Route element={<StorefrontLayout />}>
                  <Route index element={<Landing />} />
                  <Route path="shop" element={<Shop />} />
                  <Route path="produit/:slug" element={<Product />} />
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
