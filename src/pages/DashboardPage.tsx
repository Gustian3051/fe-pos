import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Boxes,
  CreditCard,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import { asArray, quantity, rupiah } from "../lib/format";
import { Card, ErrorState, LoadingState, MetricCard, PageHeader } from "../components/ui";

interface Summary {
  transaction_count: number;
  net_sales: number;
  estimated_gross_profit: number;
  payments: Record<string, number>;
}
interface InventoryItem {
  product_id: string;
  name: string;
  sku: string;
  quantity_milli: number;
  minimum_stock_milli: number;
  unit: string;
  low_stock: boolean;
}
interface InventoryOverview {
  product_count: number;
  low_stock_count: number;
  total_stock_value: number;
  items: InventoryItem[];
}

export function DashboardPage() {
  const { can } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [inventory, setInventory] = useState<InventoryOverview>({
    product_count: 0,
    low_stock_count: 0,
    total_stock_value: 0,
    items: [],
  });
  const [receivable, setReceivable] = useState({
    open_balance: 0,
    overdue_balance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sales, stock, debt] = await Promise.all([
        api<Summary>("/reports/sales-summary"),
        api<InventoryOverview>("/reports/inventory-overview?limit=6"),
        can("report.financial")
          ? api<typeof receivable>("/reports/receivables")
          : Promise.resolve({ open_balance: 0, overdue_balance: 0 }),
      ]);
      setSummary(sales);
      setInventory({ ...stock, items: asArray(stock.items) });
      setReceivable(debt);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Gagal memuat dashboard",
      );
    } finally {
      setLoading(false);
    }
  }, [can]);
  useEffect(() => {
    void load();
  }, [load]);

  if (loading)
    return (
      <>
        <PageHeader title="Dashboard" />
        <LoadingState />
      </>
    );
  if (error)
    return (
      <>
        <PageHeader title="Dashboard" />
        <ErrorState message={error} retry={() => void load()} />
      </>
    );
  const lowStock = inventory.items.filter((item) => item.low_stock);
  const stockValue = inventory.total_stock_value;
  const maxQty = Math.max(
    ...inventory.items.map((item) => item.quantity_milli),
    1,
  );

  return (
    <>
      <PageHeader
        title="Ringkasan toko"
        description={`Aktivitas 30 hari terakhir · diperbarui ${new Intl.DateTimeFormat("id-ID", { timeStyle: "short" }).format(new Date())}`}
        action={
          <button className="inline-flex items-center gap-2 border-0 bg-transparent text-xs font-bold text-brand-700 hover:text-brand-900 [&_svg]:h-4 [&_svg]:w-4" onClick={() => void load()}>
            <RefreshCw size={18} /> Perbarui
          </button>
        }
      />
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Penjualan bersih"
          value={rupiah(summary?.net_sales)}
          description={
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <ArrowUpRight className="h-3 w-3" /> 30 hari terakhir
            </span>
          }
          icon={<Banknote />}
          tone="green"
        />
        <MetricCard
          label="Total transaksi"
          value={summary?.transaction_count ?? 0}
          description="Transaksi yang sudah selesai"
          icon={<ReceiptText />}
          tone="blue"
        />
        <MetricCard
          label="Nilai persediaan"
          value={rupiah(stockValue)}
          description={`${inventory.product_count} produk tercatat`}
          icon={<Boxes />}
          tone="amber"
        />
        <MetricCard
          label="Piutang belum lunas"
          value={rupiah(receivable.open_balance)}
          description={
            <span
              className={
                receivable.overdue_balance > 0
                  ? "inline-flex items-center gap-1 text-red-700"
                  : "inline-flex items-center gap-1"
              }
            >
              <ArrowDownRight className="h-3 w-3" />
              {rupiah(receivable.overdue_balance)} sudah melewati jatuh tempo
            </span>
          }
          icon={<CreditCard />}
          tone="red"
        />
      </div>
      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
        <Card
          title="Posisi stok"
          action={<Link className="text-xs font-bold text-brand-700 hover:text-brand-900" to="/persediaan">Lihat semua</Link>}
        >
          <div className="flex flex-col gap-4">
            {inventory.items.map((item) => (
              <div className="grid grid-cols-[120px_minmax(0,1fr)_90px] items-center gap-3 text-[10px] max-sm:grid-cols-[90px_minmax(0,1fr)_70px] [&>span]:truncate [&>span]:font-bold [&>div]:h-2 [&>div]:overflow-hidden [&>div]:rounded-full [&>div]:bg-slate-100 [&_i]:block [&_i]:h-full [&_i]:rounded-full [&_i]:bg-emerald-500 [&_b]:text-right [&_b]:text-[9px]" key={item.product_id}>
                <span title={item.name}>{item.name}</span>
                <div>
                  <i
                    style={{
                      width: `${Math.max(4, (item.quantity_milli / maxQty) * 100)}%`,
                    }}
                    className={item.low_stock ? "bg-amber-500" : ""}
                  />
                </div>
                <b>
                  {quantity(item.quantity_milli)} {item.unit}
                </b>
              </div>
            ))}
            {inventory.product_count === 0 && (
              <div className="flex flex-col items-center gap-1 p-8 text-center text-slate-500">Belum ada data persediaan</div>
            )}
          </div>
        </Card>
        <Card
          title="Perlu perhatian"
          action={<span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">{inventory.low_stock_count}</span>}
        >
          <div className="flex flex-col [&>div]:flex [&>div]:items-center [&>div]:gap-3 [&>div]:border-b [&>div]:border-slate-100 [&>div]:py-2.5 [&>div:last-child]:border-0 [&_strong]:text-xs [&_small]:text-[10px] [&_small]:text-slate-500 [&_a]:ml-auto [&_a]:text-[10px] [&_a]:font-bold [&_a]:text-brand-700">
            {lowStock.slice(0, 5).map((item) => (
              <div key={item.product_id}>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-700 [&_svg]:h-4 [&_svg]:w-4">
                  <AlertTriangle />
                </span>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {item.sku} · tersisa {quantity(item.quantity_milli)}{" "}
                    {item.unit}
                  </small>
                </div>
                {can("purchase.manage") && <Link to="/pembelian">Buat pembelian</Link>}
              </div>
            ))}
            {lowStock.length === 0 && (
              <div className="flex flex-col items-center gap-2 p-8 text-center text-slate-500 [&_svg]:text-brand-700 [&_strong]:text-xs [&_strong]:text-slate-700">
                <PackageCheck />
                <strong>Stok dalam kondisi baik</strong>
                <span>Tidak ada produk di bawah batas minimum.</span>
              </div>
            )}
          </div>
        </Card>
      </div>
      <Card title="Akses cepat" className="">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 [&_a]:flex [&_a]:items-center [&_a]:gap-3 [&_a]:rounded-xl [&_a]:border [&_a]:border-[#dfe7e2] [&_a]:p-4 [&_a]:hover:border-brand-200 [&_a]:hover:bg-brand-50/50 [&_a]:hover:-translate-y-px [&_a]:transition [&_a>svg]:h-5 [&_a>svg]:w-5 [&_a>svg]:text-brand-700 [&_span]:flex [&_span]:flex-col [&_strong]:text-xs [&_small]:text-[10px] [&_small]:text-slate-500">
          {can("sale.create") && (
            <Link to="/kasir">
              <ShoppingBag />
              <span>
                <strong>Transaksi baru</strong>
                <small>Mulai pencatatan penjualan</small>
              </span>
            </Link>
          )}
          {can("product.manage") && (
            <Link to="/produk">
              <Boxes />
              <span>
                <strong>Tambah produk</strong>
                <small>Tambah atau ubah data produk</small>
              </span>
            </Link>
          )}
          {can("purchase.manage") && (
            <Link to="/pembelian">
              <WalletCards />
              <span>
                <strong>Catat pembelian</strong>
                <small>Catat barang dari pemasok</small>
              </span>
            </Link>
          )}
          {can("shift.manage") && (
            <Link to="/kas">
              <Banknote />
              <span>
                <strong>Kelola kas</strong>
                <small>Buka sif dan catat kas</small>
              </span>
            </Link>
          )}
        </div>
      </Card>
    </>
  );
}
