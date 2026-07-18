import {
  Lightbulb,
  PackageCheck,
  Pencil,
  Plus,
  Trash2,
  Truck,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useConfirm } from "../components/feedback";
import { api, apiPage, json, requireActiveShiftID } from "../lib/api";
import {
  asArray,
  dateTime,
  displayLabel,
  quantity,
  rupiah,
} from "../lib/format";
import { useDebouncedValue } from "../lib/hooks";
import type { Product, ProductUnit } from "../types/api";
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
  Tabs,
  Textarea,
  useToast,
} from "../components/ui";

interface PurchaseItemForm {
  product_id: string;
  product_unit_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  track_batch: boolean;
  batch_number: string;
  expires_on: string;
}

const parseReceiveQuantity = (value: string | number | undefined) => {
  const normalized = String(value ?? "")
    .replace(",", ".")
    .trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatReceiveInput = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));

export function PurchasesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"purchases" | "suppliers" | "suggestions">(
    "purchases",
  );
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [productQuery, setProductQuery] = useState("");
  const debouncedProductQuery = useDebouncedValue(productQuery, 300);
  const [purchasePage, setPurchasePage] = useState(1);
  const [supplierPage, setSupplierPage] = useState(1);
  const [suggestionPage, setSuggestionPage] = useState(1);
  const [purchaseMeta, setPurchaseMeta] = useState({
    page: 1,
    limit: 50,
    has_more: false,
  });
  const [supplierMeta, setSupplierMeta] = useState({
    page: 1,
    limit: 50,
    has_more: false,
  });
  const [suggestionMeta, setSuggestionMeta] = useState({
    page: 1,
    limit: 50,
    has_more: false,
  });
  const [modal, setModal] = useState<
    "supplier" | "purchase" | "receive" | null
  >(null);
  const [selected, setSelected] = useState<any>(null);
  const [receiveDetail, setReceiveDetail] = useState<any>(null);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [receiveNote, setReceiveNote] = useState("");
  const [supplier, setSupplier] = useState({
    code: "",
    name: "",
    phone: "",
    address: "",
    status: "active",
    version: 0,
  });
  const [purchase, setPurchase] = useState({
    supplier_id: "",
    invoice_number: "",
    discount: 0,
    additional_cost: 0,
    paid_amount: 0,
    payment_method: "cash",
    due_date: "",
  });
  const [items, setItems] = useState<PurchaseItemForm[]>([]);
  const [draftItem, setDraftItem] = useState<PurchaseItemForm>({
    product_id: "",
    product_unit_id: "",
    product_name: "",
    quantity: 1,
    unit_cost: 0,
    track_batch: false,
    batch_number: "",
    expires_on: "",
  });
  const [productUnits, setProductUnits] = useState<ProductUnit[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { show, node } = useToast();
  const confirm = useConfirm();
  const load = useCallback(async () => {
    setError("");
    try {
      const [purchaseResult, supplierResult, suggestionResult, productResult] =
        await Promise.all([
          apiPage<any>(`/purchases?page=${purchasePage}&limit=50`),
          apiPage<any>(
            `/suppliers?q=${encodeURIComponent(debouncedQuery)}&page=${supplierPage}&limit=50`,
          ),
          apiPage<any>(
            `/purchases/suggestions?page=${suggestionPage}&limit=50`,
          ),
          apiPage<Product>(
            `/products?q=${encodeURIComponent(debouncedProductQuery)}&status=active&page=1&limit=50`,
          ),
        ]);
      setPurchases(purchaseResult.items);
      setPurchaseMeta(purchaseResult.meta);
      setSuppliers(supplierResult.items);
      setSupplierMeta(supplierResult.meta);
      setSuggestions(suggestionResult.items);
      setSuggestionMeta(suggestionResult.meta);
      setProducts(
        productResult.items.filter(
          (item) =>
            item.product_kind !== "menu" && item.product_kind !== "service",
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat pembelian");
    }
  }, [
    debouncedProductQuery,
    debouncedQuery,
    purchasePage,
    supplierPage,
    suggestionPage,
  ]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setSupplierPage(1);
  }, [debouncedQuery]);
  const selectProduct = async (productId: string) => {
    const product = products.find((item) => item.id === productId);
    setDraftItem({
      ...draftItem,
      product_id: productId,
      product_name: product?.name || "",
      product_unit_id: "",
      track_batch: Boolean(product?.track_batch),
      batch_number: "",
      expires_on: "",
    });
    if (productId) {
      try {
        const detail = await api<{ units: ProductUnit[] }>(
          `/products/${productId}`,
        );
        setProductUnits(detail.units);
      } catch {
        setProductUnits([]);
      }
    }
  };
  const addItem = () => {
    if (!draftItem.product_unit_id || draftItem.quantity <= 0) return;
    setItems([...items, draftItem]);
    setDraftItem({
      product_id: "",
      product_unit_id: "",
      product_name: "",
      quantity: 1,
      unit_cost: 0,
      track_batch: false,
      batch_number: "",
      expires_on: "",
    });
    setProductUnits([]);
  };
  const openCreateSupplier = () => {
    setSelected(null);
    setSupplier({
      code: "",
      name: "",
      phone: "",
      address: "",
      status: "active",
      version: 0,
    });
    setModal("supplier");
  };
  const openEditSupplier = (item: any) => {
    setSelected(item);
    setSupplier({
      code: item.code,
      name: item.name,
      phone: item.phone || "",
      address: item.address || "",
      status: item.status || "active",
      version: item.version,
    });
    setModal("supplier");
  };
  const saveSupplier = async () => {
    setSaving(true);
    try {
      await api(
        selected ? `/suppliers/${selected.id}` : "/suppliers",
        json(selected ? "PUT" : "POST", supplier),
      );
      show(`Pemasok berhasil ${selected ? "diperbarui" : "ditambahkan"}.`);
      setModal(null);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal menyimpan pemasok", true);
    } finally {
      setSaving(false);
    }
  };
  const deleteSupplier = async (item: any) => {
    if (
      !(await confirm({
        title: "Hapus pemasok?",
        message: `Pemasok ${item.name} akan dihapus. Pemasok yang sudah memiliki riwayat pembelian atau masih terhubung ke produk tidak dapat dihapus.`,
        confirmLabel: "Hapus pemasok",
        tone: "danger",
      }))
    )
      return;
    setSaving(true);
    try {
      await api(`/suppliers/${item.id}`, json("DELETE"));
      show("Pemasok berhasil dihapus.");
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal menghapus pemasok", true);
    } finally {
      setSaving(false);
    }
  };
  const createPurchase = async () => {
    if (
      !(await confirm({
        title: "Simpan pembelian?",
        message: `Pembelian senilai ${rupiah(total)} akan dicatat. ${total > purchase.paid_amount ? `Sisa ${rupiah(total - purchase.paid_amount)} otomatis menjadi hutang pemasok. ` : ""}Stok baru bertambah setelah barang diterima.`,
        confirmLabel: "Simpan pembelian",
      }))
    )
      return;
    setSaving(true);
    try {
      const shiftId =
        purchase.payment_method === "cash" &&
        Number(purchase.paid_amount || 0) > 0
          ? await requireActiveShiftID()
          : null;
      await api(
        "/purchases",
        json("POST", {
          ...purchase,
          due_date: purchase.due_date
            ? new Date(purchase.due_date).toISOString()
            : null,
          purchased_at: new Date().toISOString(),
          shift_id: shiftId,
          payment_reference: "",
          items: items.map((item) => ({
            product_unit_id: item.product_unit_id,
            quantity_milli: Math.round(item.quantity * 1000),
            unit_cost: item.unit_cost,
            discount: 0,
            batch_number: item.batch_number,
            expires_on: item.expires_on
              ? new Date(`${item.expires_on}T00:00:00Z`).toISOString()
              : null,
          })),
        }),
      );
      show(
        total > purchase.paid_amount
          ? "Pembelian berhasil dicatat. Sisa pembayaran masuk ke Hutang & Piutang."
          : "Pembelian berhasil dicatat dan menunggu penerimaan barang.",
      );
      setModal(null);
      setItems([]);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal mencatat pembelian", true);
    } finally {
      setSaving(false);
    }
  };
  const openReceive = async (item: any) => {
    try {
      setSelected(item);
      const detail = await api(`/purchases/${item.id}`);
      setReceiveDetail(detail);
      const nextQty: Record<string, string> = {};
      asArray<any>(detail.items).forEach((line) => {
        // Default dikosongkan agar user mengisi hanya barang yang benar-benar datang.
        nextQty[line.id] = "";
      });
      setReceiveQty(nextQty);
      setReceiveNote("");
      setModal("receive");
    } catch (e) {
      show(
        e instanceof Error ? e.message : "Gagal memuat detail pembelian",
        true,
      );
    }
  };
  const receive = async () => {
    if (!selected || !receiveDetail) return;
    const receiveItems = asArray<any>(receiveDetail.items)
      .map((item) => {
        const remainingMilli =
          Number(item.quantity_milli || 0) -
          Number(item.received_quantity_milli || 0);
        const requestedQty = parseReceiveQuantity(receiveQty[item.id]);
        const requestedMilli = Math.round(requestedQty * 1000);
        return { item, remainingMilli, requestedMilli };
      })
      .filter(({ requestedMilli }) => requestedMilli > 0);
    if (!receiveItems.length) {
      show("Isi minimal satu jumlah barang yang diterima.", true);
      return;
    }
    if (
      receiveItems.some(
        ({ requestedMilli, remainingMilli }) => requestedMilli > remainingMilli,
      )
    ) {
      show("Jumlah diterima tidak boleh melebihi sisa pesanan.", true);
      return;
    }
    setSaving(true);
    try {
      await api(
        `/purchases/${selected.id}/receive`,
        json("POST", {
          due_date: receiveDetail?.purchase?.due_date
            ? new Date(receiveDetail.purchase.due_date).toISOString()
            : null,
          notes: receiveNote.trim(),
          items: receiveItems.map(({ item, requestedMilli }) => ({
            purchase_item_id: item.id,
            quantity_milli: requestedMilli,
          })),
        }),
      );
      show("Barang berhasil diterima dan stok bertambah.");
      setModal(null);
      setReceiveDetail(null);
      setReceiveQty({});
      setReceiveNote("");
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Penerimaan gagal", true);
    } finally {
      setSaving(false);
    }
  };
  const setReceiveRemaining = (fillAll: boolean) => {
    const nextQty: Record<string, string> = {};
    asArray<any>(receiveDetail?.items).forEach((item) => {
      const remainingMilli = Math.max(
        0,
        Number(item.quantity_milli || 0) -
          Number(item.received_quantity_milli || 0),
      );
      nextQty[item.id] =
        fillAll && remainingMilli > 0
          ? formatReceiveInput(remainingMilli / 1000)
          : "";
    });
    setReceiveQty(nextQty);
  };
  const total =
    items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0) -
    purchase.discount +
    purchase.additional_cost;
  return (
    <>
      {node}
      <PageHeader
        title="Pembelian & pemasok"
        description="Kelola pasokan barang, penerimaan stok, pembayaran sebagian, dan hutang pemasok."
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/hutang-piutang">
              <Button variant="secondary">
                <WalletCards /> Hutang & Piutang
              </Button>
            </Link>
            <Button
              onClick={() =>
                tab === "suppliers"
                  ? openCreateSupplier()
                  : setModal("purchase")
              }
            >
              <Plus />{" "}
              {tab === "suppliers" ? "Tambah pemasok" : "Catat pembelian"}
            </Button>
          </div>
        }
      />
      <Tabs
        value={tab}
        onChange={(value) => setTab(value as typeof tab)}
        items={[
          { value: "purchases", label: "Pembelian", icon: <WalletCards /> },
          { value: "suppliers", label: "Pemasok", icon: <Truck /> },
          { value: "suggestions", label: "Saran belanja", icon: <Lightbulb /> },
        ]}
      />
      <Card>
        {tab === "suppliers" && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Cari pemasok..."
            />
          </div>
        )}
        {error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : (
          <div className="w-full overflow-auto rounded-xl">
            {tab === "purchases" ? (
              <table className="w-full min-w-[760px] border-collapse text-[11px] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-[#dfe7e2] [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_td]:text-slate-700 [&_tbody_tr:hover]:bg-slate-50 [&_td>strong]:block [&_td>small]:mt-1 [&_td>small]:block [&_td>small]:text-[10px] [&_td>small]:text-slate-500 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-1 [&_code]:text-[9px]">
                <thead>
                  <tr>
                    <th>Nomor</th>
                    <th>Pemasok</th>
                    <th>Waktu</th>
                    <th>Status</th>
                    <th>Progress terima</th>
                    <th>Catatan</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((item) => {
                    const orderedMilli = Number(
                      item.ordered_quantity_milli || 0,
                    );
                    const receivedMilli = Number(
                      item.received_quantity_milli || 0,
                    );
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.number}</strong>
                          <small>{item.invoice_number || "Tanpa faktur"}</small>
                        </td>
                        <td>{item.supplier_name || "—"}</td>
                        <td>{dateTime(item.purchased_at)}</td>
                        <td>
                          <Badge
                            tone={
                              item.status === "received"
                                ? "success"
                                : item.status === "partially_received"
                                  ? "info"
                                  : "warning"
                            }
                          >
                            {displayLabel(item.status)}
                          </Badge>
                        </td>
                        <td>
                          <strong>
                            {quantity(receivedMilli)} / {quantity(orderedMilli)}
                          </strong>
                          <small>
                            Sisa{" "}
                            {quantity(
                              Math.max(orderedMilli - receivedMilli, 0),
                            )}
                          </small>
                        </td>
                        <td>
                          <span>{item.receive_notes || "—"}</span>
                          {item.last_received_at && (
                            <small>{dateTime(item.last_received_at)}</small>
                          )}
                        </td>
                        <td>
                          <strong>{rupiah(item.total)}</strong>
                          <small>Dibayar {rupiah(item.paid_amount)}</small>
                        </td>
                        <td>
                          <Button
                            variant="secondary"
                            disabled={
                              item.status !== "draft" &&
                              item.status !== "partially_received"
                            }
                            onClick={() => void openReceive(item)}
                          >
                            <PackageCheck /> Terima
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : tab === "suppliers" ? (
              <table className="w-full min-w-[760px] border-collapse text-[11px] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-[#dfe7e2] [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_td]:text-slate-700 [&_tbody_tr:hover]:bg-slate-50 [&_td>strong]:block [&_td>small]:mt-1 [&_td>small]:block [&_td>small]:text-[10px] [&_td>small]:text-slate-500 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-1 [&_code]:text-[9px]">
                <thead>
                  <tr>
                    <th>Pemasok</th>
                    <th>Kontak</th>
                    <th>Alamat</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        <small>{item.code}</small>
                      </td>
                      <td>{item.phone || "—"}</td>
                      <td>{item.address || "—"}</td>
                      <td>
                        <Badge tone="success">
                          {displayLabel(item.status)}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            onClick={() => openEditSupplier(item)}
                          >
                            <Pencil /> Edit
                          </Button>
                          {user?.role === "owner" && (
                            <Button
                              variant="ghost"
                              loading={saving}
                              onClick={() => void deleteSupplier(item)}
                            >
                              <Trash2 /> Hapus
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[760px] border-collapse text-[11px] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-[#dfe7e2] [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_td]:text-slate-700 [&_tbody_tr:hover]:bg-slate-50 [&_td>strong]:block [&_td>small]:mt-1 [&_td>small]:block [&_td>small]:text-[10px] [&_td>small]:text-slate-500 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-1 [&_code]:text-[9px]">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Stok</th>
                    <th>Minimum</th>
                    <th>Saran</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((item) => (
                    <tr key={item.product_id}>
                      <td>
                        <strong>{item.name}</strong>
                        <small>{item.sku}</small>
                      </td>
                      <td>{quantity(item.current_stock_milli)}</td>
                      <td>{quantity(item.minimum_stock_milli)}</td>
                      <td>
                        <Badge tone="warning">
                          Pesan {quantity(item.suggested_base_quantity_milli)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!(
              tab === "purchases"
                ? purchases
                : tab === "suppliers"
                  ? suppliers
                  : suggestions
            ).length && <EmptyState title="Belum ada data" />}
          </div>
        )}
        {!error && (
          <Pagination
            meta={
              tab === "purchases"
                ? purchaseMeta
                : tab === "suppliers"
                  ? supplierMeta
                  : suggestionMeta
            }
            onPageChange={
              tab === "purchases"
                ? setPurchasePage
                : tab === "suppliers"
                  ? setSupplierPage
                  : setSuggestionPage
            }
          />
        )}
      </Card>
      <Modal
        open={modal === "supplier"}
        title={selected ? "Edit pemasok" : "Tambah pemasok"}
        onClose={() => setModal(null)}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Kode"
            value={supplier.code}
            onChange={(e) => setSupplier({ ...supplier, code: e.target.value })}
          />
          <Input
            label="Nama"
            value={supplier.name}
            onChange={(e) => setSupplier({ ...supplier, name: e.target.value })}
          />
          <Input
            label="Telepon"
            value={supplier.phone}
            onChange={(e) =>
              setSupplier({ ...supplier, phone: e.target.value })
            }
          />
        </div>
        <Textarea
          label="Alamat"
          value={supplier.address}
          onChange={(e) =>
            setSupplier({ ...supplier, address: e.target.value })
          }
        />
        {selected && (
          <Select
            label="Status"
            value={supplier.status}
            onChange={(e) =>
              setSupplier({ ...supplier, status: e.target.value })
            }
          >
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </Select>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={!supplier.code || !supplier.name}
            onClick={() => void saveSupplier()}
          >
            {selected ? "Simpan perubahan" : "Simpan pemasok"}
          </Button>
        </div>
      </Modal>
      <Modal
        open={modal === "purchase"}
        title="Catat pembelian"
        onClose={() => setModal(null)}
        wide
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="Pemasok"
            value={purchase.supplier_id}
            onChange={(e) =>
              setPurchase({ ...purchase, supplier_id: e.target.value })
            }
          >
            <option value="">Pilih pemasok</option>
            {suppliers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Input
            label="Nomor faktur"
            value={purchase.invoice_number}
            onChange={(e) =>
              setPurchase({ ...purchase, invoice_number: e.target.value })
            }
          />
          <Input
            label="Jatuh tempo"
            type="date"
            value={purchase.due_date}
            onChange={(e) =>
              setPurchase({ ...purchase, due_date: e.target.value })
            }
          />
        </div>
        <div className="my-4 rounded-xl bg-slate-50 p-3">
          <div className="mb-3 max-w-md">
            <SearchInput
              value={productQuery}
              onChange={setProductQuery}
              placeholder="Cari produk yang akan dibeli..."
            />
          </div>
          <div className="grid grid-cols-1 items-end gap-2 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_.65fr_.8fr_auto] [&_button]:h-[39px]">
            <Select
              label="Produk"
              value={draftItem.product_id}
              onChange={(e) => void selectProduct(e.target.value)}
            >
              <option value="">Pilih produk</option>
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
            <Select
              label="Satuan"
              value={draftItem.product_unit_id}
              onChange={(e) => {
                const selectedUnit = productUnits.find(
                  (unit) => unit.id === e.target.value,
                );
                setDraftItem({
                  ...draftItem,
                  product_unit_id: e.target.value,
                  unit_cost:
                    selectedUnit?.purchase_price || draftItem.unit_cost,
                });
              }}
            >
              <option value="">Pilih satuan</option>
              {productUnits.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.unit_name} · isi{" "}
                  {quantity(item.conversion_factor_milli)}
                  {item.barcode ? ` · ${item.barcode}` : ""}
                </option>
              ))}
            </Select>
            <Input
              label="Jumlah"
              type="number"
              min="0.001"
              step="0.001"
              value={draftItem.quantity}
              onChange={(e) =>
                setDraftItem({ ...draftItem, quantity: Number(e.target.value) })
              }
            />
            <Input
              label="Harga beli"
              type="number"
              min="1"
              value={draftItem.unit_cost}
              onChange={(e) =>
                setDraftItem({
                  ...draftItem,
                  unit_cost: Number(e.target.value),
                })
              }
            />
            {draftItem.track_batch && (
              <>
                <Input
                  label="Nomor batch"
                  value={draftItem.batch_number}
                  onChange={(e) =>
                    setDraftItem({ ...draftItem, batch_number: e.target.value })
                  }
                />
                <Input
                  label="Kedaluwarsa"
                  type="date"
                  value={draftItem.expires_on}
                  onChange={(e) =>
                    setDraftItem({ ...draftItem, expires_on: e.target.value })
                  }
                />
              </>
            )}
            <Button
              variant="secondary"
              disabled={
                !draftItem.product_unit_id ||
                draftItem.quantity <= 0 ||
                draftItem.unit_cost <= 0 ||
                (draftItem.track_batch && !draftItem.batch_number)
              }
              onClick={addItem}
            >
              <Plus /> Tambahkan
            </Button>
          </div>
        </div>
        <div className="[&>div]:flex [&>div]:items-center [&>div]:gap-3 [&>div]:border-b [&>div]:border-[#dfe7e2] [&>div]:p-2 [&>div]:text-xs [&>div>span]:flex [&>div>span]:flex-1 [&>div>span]:flex-col [&_small]:text-[10px] [&_small]:text-slate-500 [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-red-700">
          {items.map((item, index) => (
            <div key={`${item.product_unit_id}-${index}`}>
              <span>
                <strong>{item.product_name}</strong>
                <small>
                  {item.quantity} × {rupiah(item.unit_cost)}
                </small>
              </span>
              <strong>{rupiah(item.quantity * item.unit_cost)}</strong>
              <button
                onClick={() => setItems(items.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Diskon"
            type="number"
            value={purchase.discount}
            onChange={(e) =>
              setPurchase({ ...purchase, discount: Number(e.target.value) })
            }
          />
          <Input
            label="Biaya tambahan"
            type="number"
            value={purchase.additional_cost}
            onChange={(e) =>
              setPurchase({
                ...purchase,
                additional_cost: Number(e.target.value),
              })
            }
          />
          <Input
            label="Jumlah yang dibayar"
            type="number"
            value={purchase.paid_amount}
            onChange={(e) =>
              setPurchase({ ...purchase, paid_amount: Number(e.target.value) })
            }
          />
          <Select
            label="Metode"
            value={purchase.payment_method}
            onChange={(e) =>
              setPurchase({ ...purchase, payment_method: e.target.value })
            }
          >
            <option value="cash">Tunai</option>
            <option value="transfer">Transfer</option>
            <option value="qris">QRIS</option>
            <option value="other">Lainnya</option>
          </Select>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-brand-50 p-4 text-xs sm:grid-cols-3">
          <div>
            <span className="text-slate-500">Total pembelian</span>
            <strong className="mt-1 block text-lg text-brand-700">
              {rupiah(total)}
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Dibayar sekarang</span>
            <strong className="mt-1 block text-lg text-brand-700">
              {rupiah(purchase.paid_amount)}
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Menjadi hutang pemasok</span>
            <strong className="mt-1 block text-lg text-brand-700">
              {rupiah(Math.max(total - purchase.paid_amount, 0))}
            </strong>
          </div>
        </div>
        {total > purchase.paid_amount && (
          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            Sisa pembayaran otomatis masuk ke menu Hutang & Piutang dan dapat
            dibayar bertahap sampai lunas.
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={
              !purchase.supplier_id ||
              !items.length ||
              total < 0 ||
              purchase.paid_amount < 0 ||
              purchase.paid_amount > total
            }
            onClick={() => void createPurchase()}
          >
            Simpan pembelian
          </Button>
        </div>
      </Modal>
      <Modal
        open={modal === "receive"}
        title="Terima barang"
        onClose={() => setModal(null)}
        wide
      >
        <div className="p-3 text-center [&>svg]:mx-auto [&>svg]:h-11 [&>svg]:w-11 [&>svg]:rounded-full [&>svg]:bg-brand-50 [&>svg]:p-2.5 [&>svg]:text-brand-700 [&_p]:text-xs [&_p]:leading-6 [&_p]:text-slate-500">
          <PackageCheck />
          <h3>{selected?.number}</h3>
          <p>
            Isi jumlah barang yang benar-benar diterima. Stok dan harga pokok
            hanya bertambah sesuai barang yang diterima.
          </p>
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <Button variant="secondary" onClick={() => setReceiveRemaining(true)}>
            Isi semua sisa
          </Button>
          <Button variant="ghost" onClick={() => setReceiveRemaining(false)}>
            Kosongkan
          </Button>
        </div>
        <div className="w-full overflow-auto rounded-xl">
          <table className="w-full min-w-[760px] border-collapse text-[11px] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-[#dfe7e2] [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_td]:text-slate-700 [&_tbody_tr:hover]:bg-slate-50 [&_td>strong]:block [&_td>small]:mt-1 [&_td>small]:block [&_td>small]:text-[10px] [&_td>small]:text-slate-500 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-1 [&_code]:text-[9px]">
            <thead>
              <tr>
                <th>Produk</th>
                <th>Dipesan</th>
                <th>Sudah diterima</th>
                <th>Sisa</th>
                <th>Diterima sekarang</th>
              </tr>
            </thead>
            <tbody>
              {asArray<any>(receiveDetail?.items).map((item) => {
                const remainingMilli = Math.max(
                  0,
                  Number(item.quantity_milli || 0) -
                    Number(item.received_quantity_milli || 0),
                );
                const remaining = remainingMilli / 1000;
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.product_name}</strong>
                      <small>{item.unit_name}</small>
                    </td>
                    <td>{quantity(item.quantity_milli)}</td>
                    <td>{quantity(item.received_quantity_milli)}</td>
                    <td>{quantity(remainingMilli)}</td>
                    <td>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Input
                          label=""
                          type="number"
                          min="0"
                          max={remaining}
                          step="0.001"
                          value={receiveQty[item.id] ?? ""}
                          placeholder="0"
                          disabled={remainingMilli <= 0}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const parsed = parseReceiveQuantity(raw);
                            setReceiveQty({
                              ...receiveQty,
                              [item.id]:
                                raw === ""
                                  ? ""
                                  : formatReceiveInput(
                                      Math.min(remaining, Math.max(0, parsed)),
                                    ),
                            });
                          }}
                        />
                        <Button
                          variant="ghost"
                          disabled={remainingMilli <= 0}
                          onClick={() =>
                            setReceiveQty({
                              ...receiveQty,
                              [item.id]: formatReceiveInput(remaining),
                            })
                          }
                        >
                          Isi sisa
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Textarea
          label="Catatan penerimaan"
          value={receiveNote}
          maxLength={500}
          placeholder="Contoh: Pesan 10, barang datang 5 dulu. Sisanya menyusul dari pemasok."
          onChange={(e) => setReceiveNote(e.target.value)}
        />
        {asArray<any>(receiveDetail?.receipts).length > 0 && (
          <div className="w-full overflow-auto rounded-xl">
            <table className="w-full min-w-[760px] border-collapse text-[11px] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-[#dfe7e2] [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_td]:text-slate-700 [&_tbody_tr:hover]:bg-slate-50 [&_td>strong]:block [&_td>small]:mt-1 [&_td>small]:block [&_td>small]:text-[10px] [&_td>small]:text-slate-500 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-1 [&_code]:text-[9px]">
              <thead>
                <tr>
                  <th>Riwayat</th>
                  <th>Item diterima</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {asArray<any>(receiveDetail?.receipts).map((receipt) => (
                  <tr key={receipt.id}>
                    <td>
                      <strong>{dateTime(receipt.received_at)}</strong>
                      <small>{receipt.received_by_name || "—"}</small>
                    </td>
                    <td>
                      {asArray<any>(receipt.items).length
                        ? asArray<any>(receipt.items)
                            .map(
                              (line) =>
                                `${line.product_name} ${quantity(line.quantity_milli)} ${line.unit_name}`,
                            )
                            .join(", ")
                        : "—"}
                    </td>
                    <td>{receipt.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={
              !Object.values(receiveQty).some(
                (value) => parseReceiveQuantity(value) > 0,
              )
            }
            onClick={() => void receive()}
          >
            Terima barang
          </Button>
        </div>
      </Modal>
    </>
  );
}
