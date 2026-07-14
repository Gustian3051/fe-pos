import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ArchiveRestore,
  BarChart3,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  ContactRound,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  ReceiptText,
  Settings,
  ShoppingBasket,
  Store,
  Truck,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { classNames, displayLabel } from "../lib/format";

const navigation = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, permission: "report.operational" },
  { to: "/kasir", label: "Kasir", icon: ShoppingBasket, permission: "sale.create" },
  { to: "/penjualan", label: "Penjualan", icon: ReceiptText, permission: "sale.read" },
  { to: "/produk", label: "Produk", icon: Boxes },
  { to: "/persediaan", label: "Persediaan", icon: ArchiveRestore },
  { to: "/pelanggan", label: "Pelanggan & Piutang", icon: Users, permission: "customer.read" },
  { to: "/pembelian", label: "Pembelian & Pemasok", icon: Truck, permission: "purchase.manage" },
  { to: "/kas", label: "Sif & Kas", icon: WalletCards, permission: "shift.manage" },
  { to: "/laporan", label: "Laporan", icon: BarChart3, permission: "report.operational" },
  { to: "/sinkronisasi", label: "Pembaruan Data", icon: PackagePlus, permission: "sync.monitor" },
  { to: "/administrasi", label: "Administrasi", icon: Settings, permission: "user.manage" },
  { to: "/karyawan", label: "Karyawan & Gaji", icon: ContactRound, permission: "employee.manage" },
];

export function AppLayout() {
  const { user, logout, can } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  return (
    <div className="app-shell">
      <aside className={classNames("sidebar", open && "sidebar-open")}>
        <div className="brand">
          <span className="brand-mark">
            <Store />
          </span>
          <div>
            <strong>WarungKasir</strong>
            <small>Kelola toko lebih mudah</small>
          </div>
          <button className="sidebar-close" onClick={() => setOpen(false)}>
            <X />
          </button>
        </div>
        <nav>
          {navigation
            .filter((item) => !item.permission || can(item.permission))
            .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
            ))}
        </nav>
        <div className="sidebar-footer">
          <CircleDollarSign />
          <div>
            <strong>Pencatatan Rupiah</strong>
            <small>Nilai tercatat dengan tepat</small>
          </div>
        </div>
      </aside>
      {open && (
        <button
          className="sidebar-overlay"
          onClick={() => setOpen(false)}
          aria-label="Tutup navigasi"
        />
      )}
      <div className="app-main">
        <header className="topbar">
          <button className="menu-button" onClick={() => setOpen(true)}>
            <Menu />
          </button>
          <div className="breadcrumb">
            <span>WarungKasir</span>
            <b>/</b>
            <strong>
              {navigation.find((item) => item.to === location.pathname)
                ?.label || "Operasional"}
            </strong>
          </div>
          <div className="profile-wrap">
            <button
              className="profile-button"
              onClick={() => setProfileOpen(!profileOpen)}
            >
              <span className="avatar">
                {user?.full_name?.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <strong>{user?.full_name}</strong>
                <small>{displayLabel(user?.role)}</small>
              </span>
              <ChevronDown size={16} />
            </button>
            {profileOpen && (
              <div className="profile-menu">
                <div>
                  <strong>{user?.full_name}</strong>
                  <small>
                    @{user?.username} · {displayLabel(user?.role)}
                  </small>
                </div>
                <button onClick={() => void logout()}>
                  <LogOut size={17} /> Keluar
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
