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
  Truck,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { classNames, displayLabel } from "../lib/format";
import kitaPosLogo from "../assets/kita-pos-logo.png";

const navigation = [
  {
    to: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: "report.operational",
  },
  {
    to: "/kasir",
    label: "Kasir",
    icon: ShoppingBasket,
    permission: "sale.create",
  },
  {
    to: "/penjualan",
    label: "Riwayat Penjualan",
    icon: ReceiptText,
    permission: "sale.read",
  },
  { to: "/produk", label: "Produk", icon: Boxes },
  { to: "/persediaan", label: "Persediaan", icon: ArchiveRestore },
  {
    to: "/pelanggan",
    label: "Pelanggan & Piutang",
    icon: Users,
    permission: "customer.read",
  },
  {
    to: "/pembelian",
    label: "Pembelian & Pemasok",
    icon: Truck,
    permission: "purchase.manage",
  },
  {
    to: "/hutang-piutang",
    label: "Hutang & Piutang",
    icon: ReceiptText,
    permission: "purchase.manage",
  },
  {
    to: "/kas",
    label: "Sif & Kas",
    icon: WalletCards,
    permission: "shift.manage",
  },
  {
    to: "/laporan",
    label: "Laporan",
    icon: BarChart3,
    permission: "report.operational",
  },
  {
    to: "/sinkronisasi",
    label: "Pembaruan Data",
    icon: PackagePlus,
    permission: "sync.monitor",
  },
  {
    to: "/administrasi",
    label: "Administrasi",
    icon: Settings,
    permission: "user.manage",
  },
  {
    to: "/karyawan",
    label: "Karyawan & Gaji",
    icon: ContactRound,
    permission: "employee.manage",
  },
];

export function AppLayout() {
  const { user, logout, can } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={classNames(
          "fixed inset-y-0 left-0 z-40 flex w-[236px] -translate-x-full flex-col bg-[#083d2c] px-3 py-4 text-[#dcece4] transition-transform lg:translate-x-0 2xl:w-[252px] [@media(max-height:760px)]:py-3",
          open && "translate-x-0",
        )}
      >
        <div className="flex items-center gap-3 px-2 pb-4 [@media(max-height:760px)]:pb-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-white/10">
            <img
              src={kitaPosLogo}
              alt="Logo Kita POS"
              className="h-full w-full object-contain"
            />
          </span>
          <div className="flex min-w-0 flex-col">
            <strong className="text-[17px] text-white">Kita POS</strong>
            <small className="text-[10px] text-emerald-100/70 [@media(max-height:760px)]:hidden">
              Kelola usaha lebih mudah
            </small>
          </div>
          <button
            className="ml-auto border-0 bg-transparent text-white lg:hidden"
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navigation
            .filter((item) => !item.permission || can(item.permission))
            .map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  classNames(
                    "flex min-h-10 items-center gap-3 rounded-[9px] px-3 py-2 text-[12.5px] font-bold text-emerald-100/75 hover:bg-white/10 hover:text-white [@media(max-height:760px)]:min-h-9 [@media(max-height:760px)]:py-1.5 [@media(max-height:760px)]:text-xs",
                    isActive &&
                      "bg-black text-brand-800 shadow-lg hover:bg-white hover:text-brand-800",
                  )
                }
              >
                <Icon size={18} className="shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
        </nav>
        <div className="mt-auto flex shrink-0 items-center gap-3 border-t border-white/10 px-2 pt-3 [@media(max-height:760px)]:pt-2">
          <CircleDollarSign className="text-emerald-200" />
          <div className="flex flex-col">
            <strong className="text-[11px] text-emerald-50">
              Pencatatan Rupiah
            </strong>
            <small className="text-[9px] text-emerald-100/65 [@media(max-height:760px)]:hidden">
              Nilai tercatat dengan tepat
            </small>
          </div>
        </div>
      </aside>
      {open && (
        <button
          className="fixed inset-0 z-30 border-0 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Tutup navigasi"
        />
      )}
      <div className="min-w-0 flex-1 lg:ml-[236px] 2xl:ml-[252px]">
        <header className="sticky top-0 z-30 flex h-[70px] items-center border-b border-[#dfe7e2] bg-white/95 px-8 backdrop-blur-md max-lg:h-16 max-lg:px-5">
          <button
            className="mr-3 border-0 bg-transparent lg:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <div className="flex gap-2 text-xs text-slate-500">
            <span className="max-sm:hidden">Kita POS</span>
            <b className="text-slate-300 max-sm:hidden">/</b>
            <strong className="text-slate-800">
              {navigation.find((item) => item.to === location.pathname)
                ?.label || "Operasional"}
            </strong>
          </div>
          <div className="relative ml-auto">
            <button
              className="flex items-center gap-3 border-0 bg-transparent text-left"
              onClick={() => setProfileOpen(!profileOpen)}
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 font-extrabold text-brand-700">
                {user?.full_name?.slice(0, 1).toUpperCase()}
              </span>
              <span className="flex flex-col max-sm:hidden">
                <strong className="text-xs text-slate-900">
                  {user?.full_name}
                </strong>
                <small className="text-[10px] capitalize text-slate-500">
                  {displayLabel(user?.role)}
                </small>
              </span>
              <ChevronDown size={16} className="max-sm:hidden" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-12 z-50 w-[230px] rounded-xl border border-[#dfe7e2] bg-white p-2.5 shadow-xl">
                <div className="flex flex-col border-b border-[#dfe7e2] px-2 py-2">
                  <strong className="text-xs text-slate-900">
                    {user?.full_name}
                  </strong>
                  <small className="overflow-hidden text-ellipsis text-[10px] text-slate-500">
                    @{user?.username} · {displayLabel(user?.role)}
                  </small>
                </div>
                <button
                  className="mt-1 flex w-full items-center gap-2 rounded-lg border-0 bg-transparent p-2 text-xs text-red-700 hover:bg-red-50"
                  onClick={() => void logout()}
                >
                  <LogOut size={17} /> Keluar
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] p-8 max-lg:p-5 max-sm:p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
