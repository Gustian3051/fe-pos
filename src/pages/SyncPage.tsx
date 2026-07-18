import {
  CheckCircle2,
  CloudDownload,
  Clock3,
  MonitorSmartphone,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { asArray, dateTime, displayLabel } from "../lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  useToast,
} from "../components/ui";

export function SyncPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [pull, setPull] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { show, node } = useToast();
  const load = useCallback(async () => {
    try {
      setDevices(asArray(await api("/sync/devices")));
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Gagal memuat daftar komputer kasir",
      );
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const pullNow = async () => {
    setLoading(true);
    try {
      let cursor =
        localStorage.getItem("warungkasir.sync_cursor") ||
        new Date(0).toISOString();
      const totals = { products: 0, customers: 0, categories: 0, product_units: 0 };
      let pages = 0;

      while (pages < 100) {
        const result: any = await api(
          `/sync/pull?cursor=${encodeURIComponent(cursor)}&limit=500`,
        );
        totals.products += asArray(result.products).length;
        totals.customers += asArray(result.customers).length;
        totals.categories += asArray(result.categories).length;
        totals.product_units += asArray(result.product_units).length;
        cursor = result.cursor;
        localStorage.setItem("warungkasir.sync_cursor", cursor);
        pages += 1;
        if (!result.has_more) break;
      }

      if (pages >= 100) {
        throw new Error(
          "Data yang diperbarui sangat banyak. Jalankan pembaruan sekali lagi untuk melanjutkan.",
        );
      }

      setPull({ ...totals, pages });
      show("Data produk, pelanggan, dan harga berhasil diperbarui.");
    } catch (e) {
      show(e instanceof Error ? e.message : "Pembaruan data gagal", true);
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      {node}
      <PageHeader
        title="Pembaruan data"
        description="Perbarui data produk, pelanggan, satuan, dan harga secara bertahap agar seluruh komputer kasir memakai informasi terbaru."
        action={
          <Button loading={loading} onClick={() => void pullNow()}>
            <CloudDownload /> Perbarui data sekarang
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3 [&_.card]:flex [&_.card]:items-center [&_.card]:gap-3 [&_.card>svg]:text-brand-700 [&_strong]:text-lg [&_span]:text-[10px] [&_span]:text-slate-500">
        <Card>
          <MonitorSmartphone />
          <div>
            <strong>{devices.length}</strong>
            <span>Komputer kasir terdaftar</span>
          </div>
        </Card>
        <Card>
          <Wifi />
          <div>
            <strong>
              {devices.filter((item) => item.status === "active").length}
            </strong>
            <span>Komputer siap digunakan</span>
          </div>
        </Card>
        <Card>
          <Clock3 />
          <div>
            <strong>
              {localStorage.getItem("warungkasir.sync_cursor")
                ? "Sudah"
                : "Belum"}
            </strong>
            <span>Pembaruan pernah dilakukan</span>
          </div>
        </Card>
      </div>
      {pull && (
        <Card className="mb-4 flex items-center gap-3 bg-brand-50 [&>svg]:text-brand-700 [&_strong]:text-xs [&_span]:text-[10px] [&_span]:text-slate-500">
          <CheckCircle2 />
          <div>
            <strong>Data toko berhasil diperbarui</strong>
            <span>
              {pull.products} produk,{" "}
              {pull.customers} pelanggan, dan{" "}
              {pull.categories} kategori serta {pull.product_units} harga satuan diperbarui.
            </span>
          </div>
        </Card>
      )}
      <Card
        title="Komputer kasir"
        action={
          <button className="inline-flex items-center gap-2 border-0 bg-transparent text-xs font-bold text-brand-700 hover:text-brand-900 [&_svg]:h-4 [&_svg]:w-4" onClick={() => void load()}>
            <RefreshCw /> Muat ulang
          </button>
        }
      >
        {error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : (
          <div className="[&_article]:flex [&_article]:items-center [&_article]:gap-3 [&_article]:border-b [&_article]:border-[#dfe7e2] [&_article]:py-3 [&_strong]:text-xs [&_small]:text-[10px] [&_small]:text-slate-500">
            {devices.map((item) => (
              <article key={item.id}>
                <span
                  className={
                    item.status === "active"
                      ? "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"
                      : "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700"
                  }
                >
                  {item.status === "active" ? <Wifi /> : <WifiOff />}
                </span>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    Terakhir digunakan {dateTime(item.last_sync_at)}
                  </small>
                </div>
                <div>
                  <Badge tone={item.status === "active" ? "success" : "danger"}>
                    {displayLabel(item.status)}
                  </Badge>
                </div>
              </article>
            ))}
            {!devices.length && (
              <EmptyState
                title="Belum ada komputer kasir"
                description="Komputer akan tercatat secara otomatis setelah pengguna masuk."
              />
            )}
          </div>
        )}
      </Card>
    </>
  );
}
