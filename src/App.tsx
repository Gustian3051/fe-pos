import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { LoadingState } from "./components/ui";
import { AdminPage } from "./pages/AdminPage";
import { CashPage } from "./pages/CashPage";
import { CatalogPage } from "./pages/CatalogPage";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { InventoryPage } from "./pages/InventoryPage";
import { LoginPage } from "./pages/LoginPage";
import { POSPage } from "./pages/POSPage";
import { PurchasesPage } from "./pages/PurchasesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SalesPage } from "./pages/SalesPage";
import { SyncPage } from "./pages/SyncPage";

function Protected() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="screen-center">
        <LoadingState />
      </div>
    );
  return user ? <AppLayout /> : <Navigate to="/login" replace />;
}

function HomeRoute() {
  const { can } = useAuth();
  if (can("report.operational")) return <DashboardPage />;
  if (can("sale.create")) return <Navigate to="/kasir" replace />;
  return <Navigate to="/persediaan" replace />;
}

function Allowed({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { can } = useAuth();
  return can(permission) ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route element={<Protected />}>
        <Route index element={<HomeRoute />} />
        <Route path="kasir" element={<Allowed permission="sale.create"><POSPage /></Allowed>} />
        <Route path="penjualan" element={<Allowed permission="sale.read"><SalesPage /></Allowed>} />
        <Route path="produk" element={<CatalogPage />} />
        <Route path="persediaan" element={<InventoryPage />} />
        <Route path="pelanggan" element={<Allowed permission="customer.read"><CustomersPage /></Allowed>} />
        <Route path="pembelian" element={<Allowed permission="purchase.manage"><PurchasesPage /></Allowed>} />
        <Route path="kas" element={<Allowed permission="shift.manage"><CashPage /></Allowed>} />
        <Route path="laporan" element={<Allowed permission="report.operational"><ReportsPage /></Allowed>} />
        <Route path="sinkronisasi" element={<Allowed permission="sync.monitor"><SyncPage /></Allowed>} />
        <Route path="administrasi" element={<Allowed permission="user.manage"><AdminPage /></Allowed>} />
        <Route path="karyawan" element={<Allowed permission="employee.manage"><EmployeesPage /></Allowed>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
