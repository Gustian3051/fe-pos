import {
  ArrowDownToLine,
  Banknote,
  BarChart3,
  Boxes,
  CreditCard,
  FileText,
  PackageMinus,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useAlert } from "../components/feedback";
import { api, downloadReport } from "../lib/api";
import { asArray, quantity, rupiah } from "../lib/format";
import { printTable } from "../lib/print";
import { Button, Card, ErrorState, Input, MetricCard, PageHeader } from "../components/ui";

const iso = (date: Date) => date.toISOString().slice(0, 10);

interface InventoryOverview {
  product_count: number;
  low_stock_count: number;
  total_stock_value: number;
}

const movementLabel = (type: string) =>
  ({
    personal_use: "Pemakaian pribadi",
    damage: "Rusak",
    loss: "Hilang",
    adjustment: "Koreksi stok",
    opname: "Stok opname",
    opening: "Stok awal",
  })[type] || type;

const formatDateTime = (value: string) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export function ReportsPage() {
  const { can } = useAuth();
  const alert = useAlert();
  const [from, setFrom] = useState(iso(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(iso(new Date()));
  const [summary, setSummary] = useState<any>({});
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<InventoryOverview>({
    product_count: 0,
    low_stock_count: 0,
    total_stock_value: 0,
  });
  const [inventoryMovements, setInventoryMovements] = useState<{ summary: any[]; details: any[] }>({ summary: [], details: [] });
  const [debts, setDebts] = useState({ receivables: {} as any, payables: {} as any });
  const [error, setError] = useState("");
  const range = `from=${new Date(from).toISOString()}&to=${new Date(`${to}T23:59:59`).toISOString()}`;

  const load = useCallback(async () => {
    setError("");
    try {
      const [s, p, i, m, r, d] = await Promise.all([
        api(`/reports/sales-summary?${range}`),
        api(`/reports/products?${range}&limit=8`),
        api<InventoryOverview>("/reports/inventory-overview?limit=1"),
        api(`/reports/inventory-movements?${range}&limit=50`),
        can("report.financial") ? api("/reports/receivables") : Promise.resolve({ open_balance: 0, overdue_balance: 0 }),
        can("report.financial") ? api("/reports/payables") : Promise.resolve({ open_balance: 0, overdue_balance: 0 }),
      ]);
      setSummary(s);
      setProducts(asArray(p));
      setInventory(i);
      setInventoryMovements({
        summary: asArray((m as any)?.summary),
        details: asArray((m as any)?.details),
      });
      setDebts({ receivables: r, payables: d });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat laporan");
    }
  }, [range, can]);

  useEffect(() => {
    void load();
  }, [load]);

  const printInventoryMovements = async () => {
    try {
      printTable(
      "Laporan Pemakaian & Penyesuaian Stok",
      ["Tanggal", "Jenis", "SKU", "Produk", "Satuan yang Dicatat", "Jumlah yang Dicatat", "Perubahan Stok dalam Satuan Terkecil", "Saldo Stok Setelahnya", "Estimasi Nilai", "Catatan"],
      inventoryMovements.details.map((item) => [
        formatDateTime(item.occurred_at),
        movementLabel(item.movement_type),
        item.sku,
        item.name,
        item.display_unit || item.unit,
        quantity(item.display_quantity_milli ?? item.quantity_milli),
        `${quantity(item.quantity_milli)} ${item.unit}`,
        quantity(item.balance_after_milli),
        rupiah(item.estimated_value),
        item.reason || "-",
      ]),
      );
    } catch (error) {
      await alert({
        title: "Laporan belum dapat dicetak",
        message:
          error instanceof Error
            ? error.message
            : "Laporan belum dapat disiapkan. Coba kembali beberapa saat lagi.",
        tone: "error",
      });
    }
  };

  const maxSales = Math.max(...products.map((item) => Number(item.sales_total)), 1);
  const grossProfit = summary.gross_profit ?? summary.estimated_gross_profit ?? 0;
  const personalUse = inventoryMovements.summary.find((item) => item.movement_type === "personal_use") || {};
  const stockOutValue = inventoryMovements.summary
    .filter((item) => ["personal_use", "damage", "loss"].includes(item.movement_type))
    .reduce((sum, item) => sum + Number(item.estimated_value || 0), 0);

  return (
    <>
      <PageHeader
        title="Laporan"
        description="Lihat penjualan, laba kotor, persediaan, piutang, utang pemasok, dan perubahan stok pada periode yang dipilih."
      />
      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3 [&_.field]:w-full md:[&_.field]:w-[190px]">
          <Input label="Dari" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="Sampai" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button onClick={() => void load()}>Terapkan periode</Button>
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
            <ArrowDownToLine /> Unduh data penjualan (CSV)
          </Button>
        </div>
      </Card>
      {error ? (
        <ErrorState message={error} retry={() => void load()} />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <MetricCard
              label="Penjualan bersih"
              value={rupiah(summary.net_sales)}
              description={`${summary.transaction_count || 0} transaksi selesai`}
              icon={<Banknote />}
              tone="green"
            />
            <MetricCard
              label="Laba kotor"
              value={rupiah(grossProfit)}
              description="Penjualan bersih setelah harga pokok dan pemakaian pribadi"
              icon={<TrendingUp />}
              tone="blue"
            />
            <MetricCard
              label="Pemakaian pribadi"
              value={rupiah(personalUse.estimated_value || 0)}
              description={`${quantity(personalUse.absolute_quantity_milli || 0)} stok keluar`}
              icon={<PackageMinus />}
              tone="amber"
            />
            <MetricCard
              label="Stok keluar non-penjualan"
              value={rupiah(stockOutValue)}
              description="Pemakaian pribadi, barang rusak, dan barang hilang"
              icon={<PackageMinus />}
              tone="red"
            />
            <MetricCard
              label="Piutang belum lunas"
              value={rupiah(debts.receivables.open_balance)}
              description={`${rupiah(debts.receivables.overdue_balance)} melewati jatuh tempo`}
              icon={<CreditCard />}
              tone="amber"
            />
            <MetricCard
              label="Utang pemasok"
              value={rupiah(debts.payables.open_balance)}
              description={`${rupiah(debts.payables.overdue_balance)} melewati jatuh tempo`}
              icon={<WalletCards />}
              tone="red"
            />
          </div>
          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
            <Card title="Produk terlaris" action={<BarChart3 />}>
              <div className="[&>div]:my-3 [&>div]:grid [&>div]:grid-cols-[24px_minmax(0,1fr)_100px] [&>div]:items-center [&>div]:gap-3 [&_strong]:text-[10px] [&_i]:h-1.5 [&_i]:overflow-hidden [&_i]:rounded-full [&_i]:bg-slate-100 [&_i_b]:block [&_i_b]:h-full [&_i_b]:bg-brand-700 [&_small]:text-[8px] [&_small]:text-slate-500">
                {products.map((item, index) => (
                  <div key={item.product_id}>
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-[9px] font-extrabold">{index + 1}</span>
                    <div><strong>{item.name}</strong><i><b style={{ width: `${(Number(item.sales_total) / maxSales) * 100}%` }} /></i><small>{quantity(item.quantity_milli)} terjual</small></div>
                    <strong>{rupiah(item.sales_total)}</strong>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Nilai persediaan" action={<Boxes />}>
              <div className="p-4 text-center [&>strong]:text-3xl [&>strong]:text-brand-700 [&>span]:block [&>span]:text-[10px] [&>span]:text-slate-500 [&>div]:my-4 [&>div]:rounded-xl [&>div]:bg-amber-50 [&>div]:p-4 [&_b]:text-xl [&_b]:text-amber-700 [&_small]:text-[10px] [&_small]:text-slate-500">
                <strong>{rupiah(inventory.total_stock_value)}</strong>
                <span>Total nilai dari {inventory.product_count} produk</span>
                <div><b>{inventory.low_stock_count}</b><small>Produk perlu restok</small></div>
                <Button variant="secondary" onClick={() => void downloadReport("inventory", new Date(from).toISOString(), new Date(to).toISOString())}>
                  <ArrowDownToLine /> Unduh data persediaan
                </Button>
              </div>
            </Card>
          </div>
          <Card
            title="Pemakaian & penyesuaian stok"
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={() => void downloadReport("inventory-movements", new Date(from).toISOString(), new Date(`${to}T23:59:59`).toISOString())}>
                  <ArrowDownToLine /> Unduh data (CSV)
                </Button>
                <Button variant="secondary" onClick={() => void printInventoryMovements()}>
                  <FileText /> Cetak laporan
                </Button>
              </div>
            }
          >
            <div className="w-full overflow-auto rounded-xl">
              <table className="w-full min-w-[760px] border-collapse text-[11px] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-[#dfe7e2] [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_td]:text-slate-700 [&_tbody_tr:hover]:bg-slate-50 [&_td>strong]:block [&_td>small]:mt-1 [&_td>small]:block [&_td>small]:text-[10px] [&_td>small]:text-slate-500 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-1 [&_code]:text-[9px]">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Jenis</th>
                    <th>Produk</th>
                    <th>Jumlah yang dicatat</th>
                    <th>Perubahan stok</th>
                    <th>Estimasi nilai</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryMovements.details.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDateTime(item.occurred_at)}</td>
                      <td>{movementLabel(item.movement_type)}</td>
                      <td>
                        <strong>{item.name}</strong>
                        <small>{item.sku}</small>
                      </td>
                      <td>{quantity(item.display_quantity_milli ?? item.quantity_milli)} {item.display_unit || item.unit}</td>
                      <td>{quantity(item.quantity_milli)} {item.unit}</td>
                      <td>{rupiah(item.estimated_value)}</td>
                      <td>{item.reason || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!inventoryMovements.details.length && (
                <div className="flex flex-col items-center px-5 py-14 text-center text-slate-500 [&_strong]:mt-3 [&_strong]:text-sm [&_strong]:text-slate-700 [&_p]:mt-1 [&_p]:text-xs py-8">
                  <strong>Belum ada pemakaian atau penyesuaian stok pada periode ini.</strong>
                  <span>Pemakaian pribadi akan tampil di sini setelah stok disesuaikan dari menu Persediaan.</span>
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
