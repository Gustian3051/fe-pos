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
import { Card, ErrorState, LoadingState, PageHeader } from "../components/ui";

interface Summary {
  transaction_count: number;
  net_sales: number;
  estimated_gross_profit: number;
  payments: Record<string, number>;
}
interface Inventory {
  product_id: string;
  name: string;
  sku: string;
  quantity_milli: number;
  minimum_stock_milli: number;
  unit: string;
  low_stock: boolean;
}

export function DashboardPage() {
  const { can } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [inventory, setInventory] = useState<Inventory[]>([]);
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
        api<Inventory[]>("/reports/inventory"),
        can("report.financial")
          ? api<typeof receivable>("/reports/receivables")
          : Promise.resolve({ open_balance: 0, overdue_balance: 0 }),
      ]);
      setSummary(sales);
      setInventory(asArray(stock));
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
  const lowStock = inventory.filter((item) => item.low_stock);
  const stockValue = inventory.reduce(
    (sum, item: any) => sum + Number(item.stock_value || 0),
    0,
  );
  const maxQty = Math.max(
    ...inventory.slice(0, 6).map((item) => item.quantity_milli),
    1,
  );

  return (
    <>
      <PageHeader
        title="Ringkasan toko"
        description={`Aktivitas 30 hari terakhir · diperbarui ${new Intl.DateTimeFormat("id-ID", { timeStyle: "short" }).format(new Date())}`}
        action={
          <button className="icon-action" onClick={() => void load()}>
            <RefreshCw size={18} /> Perbarui
          </button>
        }
      />
      <div className="metric-grid">
        <article className="metric-card">
          <span className="metric-icon green">
            <Banknote />
          </span>
          <div>
            <small>Penjualan bersih</small>
            <strong>{rupiah(summary?.net_sales)}</strong>
            <em className="positive">
              <ArrowUpRight /> 30 hari terakhir
            </em>
          </div>
        </article>
        <article className="metric-card">
          <span className="metric-icon blue">
            <ReceiptText />
          </span>
          <div>
            <small>Total transaksi</small>
            <strong>{summary?.transaction_count ?? 0}</strong>
            <em>Transaksi selesai</em>
          </div>
        </article>
        <article className="metric-card">
          <span className="metric-icon amber">
            <Boxes />
          </span>
          <div>
            <small>Nilai persediaan</small>
            <strong>{rupiah(stockValue)}</strong>
            <em>{inventory.length} produk tercatat</em>
          </div>
        </article>
        <article className="metric-card">
          <span className="metric-icon red">
            <CreditCard />
          </span>
          <div>
            <small>Piutang terbuka</small>
            <strong>{rupiah(receivable.open_balance)}</strong>
            <em className={receivable.overdue_balance > 0 ? "negative" : ""}>
              <ArrowDownRight /> {rupiah(receivable.overdue_balance)} jatuh
              tempo
            </em>
          </div>
        </article>
      </div>
      <div className="dashboard-grid">
        <Card
          title="Posisi stok"
          action={<Link to="/persediaan">Lihat semua</Link>}
        >
          <div className="stock-chart">
            {inventory.slice(0, 6).map((item) => (
              <div className="stock-bar-row" key={item.product_id}>
                <span title={item.name}>{item.name}</span>
                <div>
                  <i
                    style={{
                      width: `${Math.max(4, (item.quantity_milli / maxQty) * 100)}%`,
                    }}
                    className={item.low_stock ? "low" : ""}
                  />
                </div>
                <b>
                  {quantity(item.quantity_milli)} {item.unit}
                </b>
              </div>
            ))}
            {inventory.length === 0 && (
              <div className="mini-empty">Belum ada data persediaan</div>
            )}
          </div>
        </Card>
        <Card
          title="Perlu perhatian"
          action={<span className="attention-count">{lowStock.length}</span>}
        >
          <div className="attention-list">
            {lowStock.slice(0, 5).map((item) => (
              <div key={item.product_id}>
                <span className="attention-icon">
                  <AlertTriangle />
                </span>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {item.sku} · tersisa {quantity(item.quantity_milli)}{" "}
                    {item.unit}
                  </small>
                </div>
                {can("purchase.manage") && <Link to="/pembelian">Pesan</Link>}
              </div>
            ))}
            {lowStock.length === 0 && (
              <div className="all-good">
                <PackageCheck />
                <strong>Stok dalam kondisi baik</strong>
                <span>Tidak ada produk di bawah batas minimum.</span>
              </div>
            )}
          </div>
        </Card>
      </div>
      <Card title="Akses cepat" className="quick-card">
        <div className="quick-actions">
          {can("sale.create") && (
            <Link to="/kasir">
              <ShoppingBag />
              <span>
                <strong>Transaksi baru</strong>
                <small>Buka layar kasir</small>
              </span>
            </Link>
          )}
          {can("product.manage") && (
            <Link to="/produk">
              <Boxes />
              <span>
                <strong>Tambah produk</strong>
                <small>Kelola katalog</small>
              </span>
            </Link>
          )}
          {can("purchase.manage") && (
            <Link to="/pembelian">
              <WalletCards />
              <span>
                <strong>Catat pembelian</strong>
                <small>Stok dari pemasok</small>
              </span>
            </Link>
          )}
          {can("shift.manage") && (
            <Link to="/kas">
              <Banknote />
              <span>
                <strong>Kelola kas</strong>
                <small>Sif dan pergerakan</small>
              </span>
            </Link>
          )}
        </div>
      </Card>
    </>
  );
}
