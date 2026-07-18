import {
  ClipboardCheck,
  FileText,
  PackageMinus,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useAlert, useConfirm } from "../components/feedback";
import { api, apiPage, fetchAllPages, json, newUUID } from "../lib/api";
import { asArray, quantity, rupiah } from "../lib/format";
import { printTable } from "../lib/print";
import { useDebouncedValue } from "../lib/hooks";
import type { ProductUnit } from "../types/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Textarea,
  useToast,
} from "../components/ui";

const outgoingMovements = ["damage", "loss", "personal_use"];

const sortProductUnits = (units: ProductUnit[]) =>
  [...units].sort(
    (a, b) =>
      Number(a.conversion_factor_milli) - Number(b.conversion_factor_milli),
  );

const unitLabel = (unit: ProductUnit) =>
  `${unit.unit_name || unit.unit_code} (isi ${quantity(unit.conversion_factor_milli)} satuan terkecil)`;

export function InventoryPage() {
  const { can } = useAuth();
  const [balances, setBalances] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [page, setPage] = useState(1);
  const [pageMeta, setPageMeta] = useState({ page: 1, limit: 50, has_more: false });
  const [opnameBalances, setOpnameBalances] = useState<any[]>([]);
  const [loadingOpname, setLoadingOpname] = useState(false);
  const [lowOnly, setLowOnly] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"adjust" | "opname" | null>(null);
  const [adjustment, setAdjustment] = useState({
    product_id: "",
    product_unit_id: "",
    movement_type: "adjustment",
    quantity: 0,
    reason: "",
    batch_number: "",
  });
  const [adjustUnits, setAdjustUnits] = useState<ProductUnit[]>([]);
  const [physical, setPhysical] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { show, node } = useToast();
  const confirm = useConfirm();
  const alert = useAlert();

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await apiPage<any>(
        `/inventory/balances?q=${encodeURIComponent(debouncedQuery)}&low_stock=${lowOnly}&page=${page}&limit=50`,
      );
      setBalances(result.items);
      setPageMeta(result.meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat stok");
    }
  }, [debouncedQuery, lowOnly, page]);

  const openOpname = async () => {
    setLoadingOpname(true);
    try {
      const allBalances = await fetchAllPages<any>(
        "/inventory/balances?low_stock=false",
        { pageSize: 100, maxItems: 20_000 },
      );
      setOpnameBalances(allBalances);
      setPhysical({});
      setNotes("");
      setModal("opname");
    } catch (e) {
      show(
        e instanceof Error ? e.message : "Gagal menyiapkan daftar stok opname",
        true,
      );
    } finally {
      setLoadingOpname(false);
    }
  };

  const loadAdjustmentUnits = useCallback(
    async (productID: string) => {
      if (!productID) {
        setAdjustUnits([]);
        setAdjustment((current) => ({ ...current, product_unit_id: "" }));
        return;
      }
      try {
        const detail = await api<{ units: ProductUnit[] }>(
          `/products/${productID}`,
        );
        const units = sortProductUnits(asArray<ProductUnit>(detail.units));
        setAdjustUnits(units);
        setAdjustment((current) => ({
          ...current,
          product_id: productID,
          product_unit_id:
            units.find((unit) => unit.conversion_factor_milli === 1000)?.id ||
            units[0]?.id ||
            "",
        }));
      } catch (e) {
        setAdjustUnits([]);
        setAdjustment((current) => ({ ...current, product_unit_id: "" }));
        show(
          e instanceof Error ? e.message : "Gagal memuat satuan produk",
          true,
        );
      }
    },
    [show],
  );

  const openAdjust = (productID = "") => {
    setModal("adjust");
    setAdjustment((current) => ({
      ...current,
      product_id: productID,
      product_unit_id: "",
      quantity: 0,
      reason: "",
      batch_number: "",
    }));
    void loadAdjustmentUnits(productID);
  };

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, lowOnly]);

  const selectedUnit = adjustUnits.find(
    (unit) => unit.id === adjustment.product_unit_id,
  );
  const selectedBalance = balances.find(
    (item) => item.product_id === adjustment.product_id,
  );
  const unitQuantityMilli = Math.round(Number(adjustment.quantity || 0) * 1000);
  const signedUnitQuantityMilli = outgoingMovements.includes(
    adjustment.movement_type,
  )
    ? -Math.abs(unitQuantityMilli)
    : unitQuantityMilli;
  const convertedBaseQuantityMilli = selectedUnit
    ? Math.trunc(
        (signedUnitQuantityMilli *
          Number(selectedUnit.conversion_factor_milli)) /
          1000,
      )
    : signedUnitQuantityMilli;

  const adjust = async () => {
    if (
      !(await confirm({
        title: "Simpan penyesuaian stok?",
        message:
          "Saldo persediaan akan langsung berubah sesuai jumlah dan alasan yang dimasukkan.",
        confirmLabel: "Simpan penyesuaian",
      }))
    )
      return;
    setSaving(true);
    try {
      await api(
        "/inventory/adjustments",
        json("POST", {
          id: newUUID(),
          product_id: adjustment.product_id,
          product_unit_id: adjustment.product_unit_id || undefined,
          movement_type: adjustment.movement_type,
          quantity_milli: signedUnitQuantityMilli,
          reason: adjustment.reason,
          occurred_at: new Date().toISOString(),
          batch_number: adjustment.batch_number,
          expires_on: null,
        }),
      );
      show("Penyesuaian stok berhasil.");
      setModal(null);
      setAdjustUnits([]);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Penyesuaian gagal", true);
    } finally {
      setSaving(false);
    }
  };

  const printInventory = async () => {
    try {
      const allBalances = await fetchAllPages<any>(
        "/inventory/balances?low_stock=false",
        { pageSize: 100, maxItems: 20_000 },
      );
      printTable(
        "Laporan Stok Produk",
        ["SKU", "Nama produk", "Satuan", "Stok", "Stok minimum", "Nilai stok"],
        allBalances.map((item) => [
          item.sku,
          item.name,
          item.unit,
          quantity(item.quantity_milli),
          quantity(item.minimum_stock_milli),
          rupiah(item.stock_value),
        ]),
      );
    } catch (e) {
      await alert({
        title: "Laporan stok belum dapat dicetak",
        message:
          e instanceof Error
            ? e.message
            : "Laporan stok belum dapat disiapkan. Coba kembali beberapa saat lagi.",
        tone: "error",
      });
    }
  };

  const opname = async () => {
    if (
      !(await confirm({
        title: "Konfirmasi stok opname?",
        message:
          "Saldo sistem akan disesuaikan dengan jumlah fisik yang Anda masukkan. Pastikan seluruh jumlah sudah diperiksa.",
        confirmLabel: "Konfirmasi opname",
      }))
    )
      return;
    setSaving(true);
    try {
      const created: any = await api(
        "/inventory/opnames",
        json("POST", {
          notes,
          items: opnameBalances.map((item) => ({
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
        description="Pantau jumlah barang, koreksi selisih stok, dan cocokkan stok sistem dengan hasil hitung fisik."
        action={
          can("inventory.manage") ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => void printInventory()}>
                <FileText /> Cetak PDF stok
              </Button>
              <Button
                variant="secondary"
                loading={loadingOpname}
                onClick={() => void openOpname()}
              >
                <ClipboardCheck /> Stok opname
              </Button>
              <Button onClick={() => openAdjust()}>
                <Plus /> Penyesuaian
              </Button>
            </div>
          ) : undefined
        }
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Cari produk atau SKU..."
          />
          <button
            className={
              lowOnly
                ? "inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-[11px] font-bold text-brand-700"
                : "inline-flex items-center gap-2 rounded-lg border border-[#d7e1db] bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 hover:border-brand-200 hover:bg-brand-50"
            }
            onClick={() => setLowOnly(!lowOnly)}
          >
            <SlidersHorizontal /> Stok menipis
          </button>
        </div>
        {error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : (
          <div className="w-full overflow-auto rounded-xl">
            <table className="w-full min-w-[760px] border-collapse text-[11px] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-[#dfe7e2] [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_td]:text-slate-700 [&_tbody_tr:hover]:bg-slate-50 [&_td>strong]:block [&_td>small]:mt-1 [&_td>small]:block [&_td>small]:text-[10px] [&_td>small]:text-slate-500 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-1 [&_code]:text-[9px]">
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
                        {can("inventory.manage") && (
                          <Button
                            variant="ghost"
                            onClick={() => openAdjust(item.product_id)}
                          >
                            <PackageMinus /> Sesuaikan
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!balances.length && <EmptyState title="Belum ada saldo stok" />}
          </div>
        )}
        {!error && (
          <Pagination meta={pageMeta} onPageChange={setPage} />
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
          onChange={(e) => {
            const productID = e.target.value;
            setAdjustment({
              ...adjustment,
              product_id: productID,
              product_unit_id: "",
              quantity: 0,
            });
            void loadAdjustmentUnits(productID);
          }}
        >
          <option value="">Pilih produk</option>
          {balances.map((item) => (
            <option key={item.product_id} value={item.product_id}>
              {item.name} ({quantity(item.quantity_milli)} {item.unit})
            </option>
          ))}
        </Select>
        <Select
          label="Satuan penyesuaian"
          value={adjustment.product_unit_id}
          disabled={!adjustUnits.length}
          onChange={(e) =>
            setAdjustment({ ...adjustment, product_unit_id: e.target.value })
          }
        >
          <option value="">Pilih satuan produk</option>
          {adjustUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unitLabel(unit)}
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
          label="Jumlah penyesuaian"
          type="number"
          step="0.001"
          value={adjustment.quantity}
          onChange={(e) =>
            setAdjustment({ ...adjustment, quantity: Number(e.target.value) })
          }
          hint={
            selectedUnit
              ? `Contoh: isi 1 ${selectedUnit.unit_name || selectedUnit.unit_code} akan dikonversi menjadi ${quantity(selectedUnit.conversion_factor_milli)} satuan terkecil. Untuk barang rusak, hilang, dan pemakaian pribadi, stok otomatis berkurang.`
              : "Pilih produk dan satuan terlebih dahulu."
          }
        />
        {selectedUnit && selectedBalance && adjustment.quantity !== 0 && (
          <div className="flex flex-col items-center px-5 py-14 text-center text-slate-500 [&_strong]:mt-3 [&_strong]:text-sm [&_strong]:text-slate-700 [&_p]:mt-1 [&_p]:text-xs py-8">
            <strong>Pratinjau konversi stok</strong>
            <span>
              Input: {quantity(signedUnitQuantityMilli)}{" "}
              {selectedUnit.unit_name || selectedUnit.unit_code}
              {" → "}
              Perubahan stok dasar: {quantity(convertedBaseQuantityMilli)}{" "}
              {selectedBalance.unit}
            </span>
          </div>
        )}
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
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={
              !adjustment.product_id ||
              !adjustment.product_unit_id ||
              unitQuantityMilli === 0 ||
              convertedBaseQuantityMilli === 0 ||
              adjustment.reason.length < 3 ||
              (balances.find(
                (item) => item.product_id === adjustment.product_id,
              )?.track_batch &&
                !adjustment.batch_number)
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
        <div className="mt-4 max-h-[48vh] overflow-auto rounded-xl border border-[#dfe7e2] px-4 [&>div]:flex [&>div]:items-center [&>div]:justify-between [&>div]:gap-3 [&>div]:border-b [&>div]:border-[#dfe7e2] [&>div]:py-2.5 [&_small]:text-[10px] [&_small]:text-slate-500 [&_.field]:w-[150px] max-sm:[&>div]:flex-col max-sm:[&>div]:items-stretch max-sm:[&_.field]:w-full">
          {opnameBalances.map((item) => (
            <div key={item.product_id}>
              <span>
                <strong>{item.name}</strong>
                <small>
                  Sistem: {quantity(item.quantity_milli)} {item.unit}
                </small>
              </span>
              <Input
                label={`Fisik (${item.unit})`}
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
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={!opnameBalances.length}
            onClick={() => void opname()}
          >
            Konfirmasi opname
          </Button>
        </div>
      </Modal>
    </>
  );
}
