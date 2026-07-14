import {
  ArrowDownToLine,
  Banknote,
  BarChart3,
  Boxes,
  CreditCard,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { api, downloadReport } from "../lib/api";
import { asArray, quantity, rupiah } from "../lib/format";
import { Button, Card, ErrorState, Input, PageHeader } from "../components/ui";

const iso = (date: Date) => date.toISOString().slice(0, 10);
export function ReportsPage() {
  const { can } = useAuth();
  const [from, setFrom] = useState(iso(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(iso(new Date()));
  const [summary, setSummary] = useState<any>({});
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [debts, setDebts] = useState({
    receivables: {} as any,
    payables: {} as any,
  });
  const [error, setError] = useState("");
  const range = `from=${new Date(from).toISOString()}&to=${new Date(`${to}T23:59:59`).toISOString()}`;
  const load = useCallback(async () => {
    setError("");
    try {
      const [s, p, i, r, d] = await Promise.all([
        api(`/reports/sales-summary?${range}`),
        api(`/reports/products?${range}&limit=8`),
        api("/reports/inventory"),
        can("report.financial")
          ? api("/reports/receivables")
          : Promise.resolve({ open_balance: 0, overdue_balance: 0 }),
        can("report.financial")
          ? api("/reports/payables")
          : Promise.resolve({ open_balance: 0, overdue_balance: 0 }),
      ]);
      setSummary(s);
      setProducts(asArray(p));
      setInventory(asArray(i));
      setDebts({ receivables: r, payables: d });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat laporan");
    }
  }, [range, can]);
  useEffect(() => {
    void load();
  }, [load]);
  const maxSales = Math.max(
    ...products.map((item) => Number(item.sales_total)),
    1,
  );
  return (
    <>
      <PageHeader
        title="Laporan"
        description="Analisis penjualan, laba kotor, persediaan, piutang, dan utang pemasok."
        action={
          <Button
            variant="secondary"
            onClick={() =>
              void downloadReport(
                "sales",
                new Date(from).toISOString(),
                new Date(`${to}T23:59:59`).toISOString(),
              )
            }
          >
            <ArrowDownToLine /> Ekspor CSV
          </Button>
        }
      />
      <Card className="report-filter">
        <div className="filter-dates">
          <Input
            label="Dari"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            label="Sampai"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <Button onClick={() => void load()}>Terapkan periode</Button>
        </div>
      </Card>
      {error ? (
        <ErrorState message={error} retry={() => void load()} />
      ) : (
        <>
          <div className="metric-grid">
            <article className="metric-card">
              <span className="metric-icon green">
                <Banknote />
              </span>
              <div>
                <small>Penjualan bersih</small>
                <strong>{rupiah(summary.net_sales)}</strong>
                <em>{summary.transaction_count || 0} transaksi</em>
              </div>
            </article>
            <article className="metric-card">
              <span className="metric-icon blue">
                <TrendingUp />
              </span>
              <div>
                <small>Estimasi laba kotor</small>
                <strong>{rupiah(summary.estimated_gross_profit)}</strong>
                <em>Setelah estimasi HPP</em>
              </div>
            </article>
            <article className="metric-card">
              <span className="metric-icon amber">
                <CreditCard />
              </span>
              <div>
                <small>Piutang</small>
                <strong>{rupiah(debts.receivables.open_balance)}</strong>
                <em>{rupiah(debts.receivables.overdue_balance)} jatuh tempo</em>
              </div>
            </article>
            <article className="metric-card">
              <span className="metric-icon red">
                <WalletCards />
              </span>
              <div>
                <small>Utang pemasok</small>
                <strong>{rupiah(debts.payables.open_balance)}</strong>
                <em>{rupiah(debts.payables.overdue_balance)} jatuh tempo</em>
              </div>
            </article>
          </div>
          <div className="dashboard-grid">
            <Card title="Produk terlaris" action={<BarChart3 />}>
              <div className="product-sales-bars">
                {products.map((item, index) => (
                  <div key={item.product_id}>
                    <span className="rank">{index + 1}</span>
                    <div>
                      <strong>{item.name}</strong>
                      <i>
                        <b
                          style={{
                            width: `${(Number(item.sales_total) / maxSales) * 100}%`,
                          }}
                        />
                      </i>
                      <small>{quantity(item.quantity_milli)} terjual</small>
                    </div>
                    <strong>{rupiah(item.sales_total)}</strong>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Nilai persediaan" action={<Boxes />}>
              <div className="inventory-summary">
                <strong>
                  {rupiah(
                    inventory.reduce(
                      (sum, item) => sum + Number(item.stock_value || 0),
                      0,
                    ),
                  )}
                </strong>
                <span>Total nilai dari {inventory.length} produk</span>
                <div>
                  <b>{inventory.filter((item) => item.low_stock).length}</b>
                  <small>Produk perlu restok</small>
                </div>
                <Button
                  variant="secondary"
                  onClick={() =>
                    void downloadReport(
                      "inventory",
                      new Date(from).toISOString(),
                      new Date(to).toISOString(),
                    )
                  }
                >
                  <ArrowDownToLine /> Unduh inventori
                </Button>
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
