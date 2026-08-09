import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { AdminLayout } from "./AdminLayout";
import AdminLogin from "./Login";

/**
 * Every dashboard screen is its own chunk: a shopper who never opens /admin
 * should never download it.
 */
const Dashboard = lazy(() => import("./Dashboard"));
const Products = lazy(() => import("./Products"));
const ProductForm = lazy(() => import("./ProductForm"));
const Categories = lazy(() => import("./Categories"));
const Orders = lazy(() => import("./Orders"));
const OrderDetail = lazy(() => import("./OrderDetail"));
const DeliveryPrices = lazy(() => import("./DeliveryPrices"));
const Reviews = lazy(() => import("./Reviews"));
const LandingPages = lazy(() => import("./LandingPages"));
const LandingPageForm = lazy(() => import("./LandingPageForm"));
const Pixels = lazy(() => import("./Pixels"));
const Settings = lazy(() => import("./Settings"));
const Account = lazy(() => import("./Account"));
const AdminNotFound = lazy(() => import("./AdminNotFound"));

export default function AdminApp() {
  return (
    <Routes>
      {/* The only unauthenticated admin route. */}
      <Route path="login" element={<AdminLogin />} />

      <Route element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="produits" element={<Products />} />
        <Route path="produits/:id" element={<ProductForm />} />
        <Route path="categories" element={<Categories />} />
        <Route path="commandes" element={<Orders />} />
        <Route path="commandes/:id" element={<OrderDetail />} />
        <Route path="pages" element={<LandingPages />} />
        <Route path="pages/:id" element={<LandingPageForm />} />
        <Route path="livraison" element={<DeliveryPrices />} />
        <Route path="avis" element={<Reviews />} />
        <Route path="pixels" element={<Pixels />} />
        <Route path="parametres" element={<Settings />} />
        <Route path="compte" element={<Account />} />
        <Route path="*" element={<AdminNotFound />} />
      </Route>
    </Routes>
  );
}
