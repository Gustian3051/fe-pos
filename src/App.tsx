import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { LoadingState } from "./components/ui";

const AdminPage = lazy(() =>
  import("./pages/AdminPage").then((module) => ({ default: module.AdminPage })),
);
const CashPage = lazy(() =>
  import("./pages/CashPage").then((module) => ({ default: module.CashPage })),
);
const CatalogPage = lazy(() =>
  import("./pages/CatalogPage").then((module) => ({
    default: module.CatalogPage,
  })),
);
const CustomersPage = lazy(() =>
  import("./pages/CustomersPage").then((module) => ({
    default: module.CustomersPage,
  })),
);
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const DebtsPage = lazy(() =>
  import("./pages/DebtsPage").then((module) => ({
    default: module.DebtsPage,
  })),
);
const EmployeesPage = lazy(() =>
  import("./pages/EmployeesPage").then((module) => ({
    default: module.EmployeesPage,
  })),
);
const InventoryPage = lazy(() =>
  import("./pages/InventoryPage").then((module) => ({
    default: module.InventoryPage,
  })),
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const POSPage = lazy(() =>
  import("./pages/POSPage").then((module) => ({ default: module.POSPage })),
);
const PurchasesPage = lazy(() =>
  import("./pages/PurchasesPage").then((module) => ({
    default: module.PurchasesPage,
  })),
);
const ReportsPage = lazy(() =>
  import("./pages/ReportsPage").then((module) => ({
    default: module.ReportsPage,
  })),
);
const SalesPage = lazy(() =>
  import("./pages/SalesPage").then((module) => ({ default: module.SalesPage })),
);
const SyncPage = lazy(() =>
  import("./pages/SyncPage").then((module) => ({ default: module.SyncPage })),
);

function PageLoader() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <LoadingState />
    </div>
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

function Protected() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center">
        <LoadingState />
      </div>
    );
  return user ? <AppLayout /> : <Navigate to="/login" replace />;
}

function HomeRoute() {
  const { can } = useAuth();
  if (can("report.operational"))
    return (
      <LazyPage>
        <DashboardPage />
      </LazyPage>
    );
  if (can("sale.create")) return <Navigate to="/kasir" replace />;
  return <Navigate to="/persediaan" replace />;
}

function Allowed({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { can } = useAuth();
  return can(permission) ? (
    <LazyPage>{children}</LazyPage>
  ) : (
    <Navigate to="/" replace />
  );
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/" replace />
          ) : (
            <LazyPage>
              <LoginPage />
            </LazyPage>
          )
        }
      />
      <Route element={<Protected />}>
        <Route index element={<HomeRoute />} />
        <Route
          path="kasir"
          element={
            <Allowed permission="sale.create">
              <POSPage />
            </Allowed>
          }
        />
        <Route
          path="penjualan"
          element={
            <Allowed permission="sale.read">
              <SalesPage />
            </Allowed>
          }
        />
        <Route
          path="produk"
          element={
            <LazyPage>
              <CatalogPage />
            </LazyPage>
          }
        />
        <Route
          path="persediaan"
          element={
            <LazyPage>
              <InventoryPage />
            </LazyPage>
          }
        />
        <Route
          path="pelanggan"
          element={
            <Allowed permission="customer.read">
              <CustomersPage />
            </Allowed>
          }
        />
        <Route
          path="pembelian"
          element={
            <Allowed permission="purchase.manage">
              <PurchasesPage />
            </Allowed>
          }
        />
        <Route
          path="hutang-piutang"
          element={
            <Allowed permission="purchase.manage">
              <DebtsPage />
            </Allowed>
          }
        />
        <Route
          path="kas"
          element={
            <Allowed permission="shift.manage">
              <CashPage />
            </Allowed>
          }
        />
        <Route
          path="laporan"
          element={
            <Allowed permission="report.operational">
              <ReportsPage />
            </Allowed>
          }
        />
        <Route
          path="sinkronisasi"
          element={
            <Allowed permission="sync.monitor">
              <SyncPage />
            </Allowed>
          }
        />
        <Route
          path="administrasi"
          element={
            <Allowed permission="user.manage">
              <AdminPage />
            </Allowed>
          }
        />
        <Route
          path="karyawan"
          element={
            <Allowed permission="employee.manage">
              <EmployeesPage />
            </Allowed>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
