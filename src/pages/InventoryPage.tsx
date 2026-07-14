import {
  ClipboardCheck,
  PackageMinus,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { api, json, newUUID } from "../lib/api";
import { asArray, quantity } from "../lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Textarea,
  useToast,
} from "../components/ui";

export function InventoryPage() {
  const { can } = useAuth();
  const [balances, setBalances] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"adjust" | "opname" | null>(null);
  const [adjustment, setAdjustment] = useState({
    product_id: "",
    movement_type: "adjustment",
    quantity: 0,
    reason: "",
    batch_number: "",
  });
  const [physical, setPhysical] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { show, node } = useToast();
  const load = useCallback(async () => {
    setError("");
    try {
      setBalances(
        asArray(
          await api(
            `/inventory/balances?q=${encodeURIComponent(query)}&low_stock=${lowOnly}&limit=100`,
          ),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat stok");
    }
  }, [query, lowOnly]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);
  const adjust = async () => {
    setSaving(true);
    try {
      await api(
        "/inventory/adjustments",
        json("POST", {
          id: newUUID(),
          product_id: adjustment.product_id,
          movement_type: adjustment.movement_type,
          quantity_milli: ["damage", "loss", "personal_use"].includes(
            adjustment.movement_type,
          )
            ? -Math.abs(adjustment.quantity * 1000)
            : adjustment.quantity * 1000,
          reason: adjustment.reason,
          occurred_at: new Date().toISOString(),
          batch_number: adjustment.batch_number,
          expires_on: null,
        }),
      );
      show("Penyesuaian stok berhasil.");
      setModal(null);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Penyesuaian gagal", true);
    } finally {
      setSaving(false);
    }
  };
  const opname = async () => {
    setSaving(true);
    try {
      const created: any = await api(
        "/inventory/opnames",
        json("POST", {
          notes,
          items: balances.map((item) => ({
            product_id: item.product_id,
            physical_quantity_milli:
              (physical[item.product_id] ??
                Number(item.quantity_milli) / 1000) * 1000,
          })),
        }),
      );
      await api(`/inventory/opnames/${created.id}/confirm`, json("POST"));
      show("Stok opname berhasil dikonfirmasi.");
      setModal(null);
      setPhysical({});
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Stok opname gagal", true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      {node}
      <PageHeader
        title="Persediaan"
        description="Pantau saldo stok, lakukan penyesuaian, dan konfirmasi stok opname."
        action={can("inventory.manage") ?
          <div className="button-row">
            <Button variant="secondary" onClick={() => setModal("opname")}>
              <ClipboardCheck /> Stok opname
            </Button>
            <Button onClick={() => setModal("adjust")}>
              <Plus /> Penyesuaian
            </Button>
          </div>
        : undefined}
      />
      <Card>
        <div className="table-toolbar">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Cari produk atau SKU..."
          />
          <button
            className={lowOnly ? "filter-button active" : "filter-button"}
            onClick={() => setLowOnly(!lowOnly)}
          >
            <SlidersHorizontal /> Stok menipis
          </button>
        </div>
        {error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Stok tersedia</th>
                  <th>Minimum</th>
                  <th>Kondisi</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {balances.map((item) => {
                  const low =
                    Number(item.quantity_milli) <=
                    Number(item.minimum_stock_milli);
                  return (
                    <tr key={item.product_id}>
                      <td>
                        <strong>{item.name}</strong>
                        <small>{item.sku}</small>
                      </td>
                      <td>
                        <strong>
                          {quantity(item.quantity_milli)} {item.unit}
                        </strong>
                      </td>
                      <td>
                        {quantity(item.minimum_stock_milli)} {item.unit}
                      </td>
                      <td>
                        <Badge tone={low ? "danger" : "success"}>
                          {low ? "Perlu restok" : "Aman"}
                        </Badge>
                      </td>
                      <td>
                        {can("inventory.manage") &&
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setAdjustment({
                              ...adjustment,
                              product_id: item.product_id,
                            });
                            setModal("adjust");
                          }}
                        >
                          <PackageMinus /> Sesuaikan
                        </Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!balances.length && <EmptyState title="Belum ada saldo stok" />}
          </div>
        )}
      </Card>
      <Modal
        open={modal === "adjust"}
        title="Penyesuaian stok"
        onClose={() => setModal(null)}
      >
        <Select
          label="Produk"
          value={adjustment.product_id}
          onChange={(e) =>
            setAdjustment({ ...adjustment, product_id: e.target.value })
          }
        >
          <option value="">Pilih produk</option>
          {balances.map((item) => (
            <option key={item.product_id} value={item.product_id}>
              {item.name} ({quantity(item.quantity_milli)} {item.unit})
            </option>
          ))}
        </Select>
        <Select
          label="Jenis penyesuaian"
          value={adjustment.movement_type}
          onChange={(e) =>
            setAdjustment({ ...adjustment, movement_type: e.target.value })
          }
        >
          <option value="opening">Stok awal</option>
          <option value="adjustment">Koreksi</option>
          <option value="damage">Rusak</option>
          <option value="loss">Hilang</option>
          <option value="personal_use">Pemakaian pribadi</option>
        </Select>
        <Input
          label="Perubahan kuantitas"
          type="number"
          step="0.001"
          value={adjustment.quantity}
          onChange={(e) =>
            setAdjustment({ ...adjustment, quantity: Number(e.target.value) })
          }
          hint="Gunakan nilai negatif untuk mengurangi stok."
        />
        <Input
          label="Nomor batch (opsional)"
          value={adjustment.batch_number}
          onChange={(e) =>
            setAdjustment({ ...adjustment, batch_number: e.target.value })
          }
        />
        <Textarea
          label="Alasan"
          value={adjustment.reason}
          onChange={(e) =>
            setAdjustment({ ...adjustment, reason: e.target.value })
          }
        />
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={
              !adjustment.product_id ||
              adjustment.quantity === 0 ||
              adjustment.reason.length < 3 ||
              (balances.find(
                (item) => item.product_id === adjustment.product_id,
              )?.track_batch && !adjustment.batch_number)
            }
            onClick={() => void adjust()}
          >
            Simpan penyesuaian
          </Button>
        </div>
      </Modal>
      <Modal
        open={modal === "opname"}
        title="Stok opname"
        onClose={() => setModal(null)}
        wide
      >
        <Textarea
          label="Catatan opname"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="opname-list">
          {balances.map((item) => (
            <div key={item.product_id}>
              <span>
                <strong>{item.name}</strong>
                <small>
                  Sistem: {quantity(item.quantity_milli)} {item.unit}
                </small>
              </span>
              <Input
                label="Fisik"
                type="number"
                step="0.001"
                value={
                  physical[item.product_id] ??
                  Number(item.quantity_milli) / 1000
                }
                onChange={(e) =>
                  setPhysical({
                    ...physical,
                    [item.product_id]: Number(e.target.value),
                  })
                }
              />
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={!balances.length}
            onClick={() => void opname()}
          >
            Konfirmasi opname
          </Button>
        </div>
      </Modal>
    </>
  );
}
