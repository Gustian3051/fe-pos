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
      const result = await api(
        `/sync/pull?cursor=${encodeURIComponent(localStorage.getItem("warungkasir.sync_cursor") || new Date(0).toISOString())}`,
      );
      setPull(result);
      localStorage.setItem("warungkasir.sync_cursor", (result as any).cursor);
      show("Data toko berhasil diperbarui.");
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
        description="Pastikan seluruh komputer kasir memakai data produk, pelanggan, dan harga terbaru."
        action={
          <Button loading={loading} onClick={() => void pullNow()}>
            <CloudDownload /> Perbarui data sekarang
          </Button>
        }
      />
      <div className="sync-stats">
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
        <Card className="sync-result">
          <CheckCircle2 />
          <div>
            <strong>Data toko berhasil diperbarui</strong>
            <span>
              {asArray(pull.products).length} produk,{" "}
              {asArray(pull.customers).length} pelanggan, dan{" "}
              {asArray(pull.categories).length} kategori diperbarui.
            </span>
          </div>
        </Card>
      )}
      <Card
        title="Komputer kasir"
        action={
          <button className="icon-action" onClick={() => void load()}>
            <RefreshCw /> Muat ulang
          </button>
        }
      >
        {error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : (
          <div className="device-list">
            {devices.map((item) => (
              <article key={item.id}>
                <span
                  className={
                    item.status === "active"
                      ? "device-online"
                      : "device-offline"
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
