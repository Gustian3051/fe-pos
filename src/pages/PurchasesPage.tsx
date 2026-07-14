import {
  Lightbulb,
  PackageCheck,
  Plus,
  Truck,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { activeShiftID, api, json } from "../lib/api";
import { asArray, dateTime, displayLabel, quantity, rupiah } from "../lib/format";
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
  SearchInput,
  Select,
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

export function PurchasesPage() {
  const [tab, setTab] = useState<"purchases" | "suppliers" | "suggestions">(
    "purchases",
  );
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<
    "supplier" | "purchase" | "receive" | null
  >(null);
  const [selected, setSelected] = useState<any>(null);
  const [supplier, setSupplier] = useState({
    code: "",
    name: "",
    phone: "",
    address: "",
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
  const load = useCallback(async () => {
    setError("");
    try {
      const [p, s, g, productsData] = await Promise.all([
        api("/purchases?limit=100"),
        api(`/suppliers?q=${encodeURIComponent(query)}&limit=100`),
        api("/purchases/suggestions"),
        api<Product[]>("/products?status=active&limit=100"),
      ]);
      setPurchases(asArray(p));
      setSuppliers(asArray(s));
      setSuggestions(asArray(g));
      setProducts(asArray(productsData));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat pembelian");
    }
  }, [query]);
  useEffect(() => {
    void load();
  }, [load]);
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
  const createSupplier = async () => {
    setSaving(true);
    try {
      await api(
        "/suppliers",
        json("POST", { ...supplier, status: "active", version: 0 }),
      );
      show("Pemasok berhasil ditambahkan.");
      setModal(null);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal menyimpan pemasok", true);
    } finally {
      setSaving(false);
    }
  };
  const createPurchase = async () => {
    setSaving(true);
    try {
      const shiftId =
        purchase.paid_amount > 0 && purchase.payment_method === "cash"
          ? await activeShiftID()
          : null;
      if (
        purchase.paid_amount > 0 &&
        purchase.payment_method === "cash" &&
        !shiftId
      )
        throw new Error("Buka sif terlebih dahulu untuk pembayaran tunai.");
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
            quantity_milli: item.quantity * 1000,
            unit_cost: item.unit_cost,
            discount: 0,
            batch_number: item.batch_number,
            expires_on: item.expires_on
              ? new Date(`${item.expires_on}T00:00:00Z`).toISOString()
              : null,
          })),
        }),
      );
      show("Pembelian berhasil dicatat dan menunggu penerimaan barang.");
      setModal(null);
      setItems([]);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal mencatat pembelian", true);
    } finally {
      setSaving(false);
    }
  };
  const receive = async () => {
    setSaving(true);
    try {
      await api(
        `/purchases/${selected.id}/receive`,
        json("POST", { due_date: selected.due_date || null }),
      );
      show("Barang berhasil diterima dan stok bertambah.");
      setModal(null);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Penerimaan gagal", true);
    } finally {
      setSaving(false);
    }
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
        description="Kelola pasokan barang, penerimaan stok, dan kewajiban toko."
        action={
          <Button
            onClick={() =>
              setModal(tab === "suppliers" ? "supplier" : "purchase")
            }
          >
            <Plus />{" "}
            {tab === "suppliers" ? "Tambah pemasok" : "Catat pembelian"}
          </Button>
        }
      />
      <div className="tabs">
        <button
          className={tab === "purchases" ? "active" : ""}
          onClick={() => setTab("purchases")}
        >
          <WalletCards /> Pembelian
        </button>
        <button
          className={tab === "suppliers" ? "active" : ""}
          onClick={() => setTab("suppliers")}
        >
          <Truck /> Pemasok
        </button>
        <button
          className={tab === "suggestions" ? "active" : ""}
          onClick={() => setTab("suggestions")}
        >
          <Lightbulb /> Saran belanja
        </button>
      </div>
      <Card>
        {tab === "suppliers" && (
          <div className="table-toolbar">
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
          <div className="data-table-wrap">
            {tab === "purchases" ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nomor</th>
                    <th>Waktu</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.number}</strong>
                        <small>{item.invoice_number || "Tanpa faktur"}</small>
                      </td>
                      <td>{dateTime(item.purchased_at)}</td>
                      <td>
                        <Badge
                          tone={
                            item.status === "received" ? "success" : "warning"
                          }
                        >
                          {displayLabel(item.status)}
                        </Badge>
                      </td>
                      <td>
                        <strong>{rupiah(item.total)}</strong>
                        <small>Dibayar {rupiah(item.paid_amount)}</small>
                      </td>
                      <td>
                        <Button
                          variant="secondary"
                          disabled={item.status !== "draft"}
                          onClick={() => {
                            setSelected(item);
                            setModal("receive");
                          }}
                        >
                          <PackageCheck /> Terima
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : tab === "suppliers" ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pemasok</th>
                    <th>Kontak</th>
                    <th>Alamat</th>
                    <th>Status</th>
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
                        <Badge tone="success">{displayLabel(item.status)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="data-table">
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
      </Card>
      <Modal
        open={modal === "supplier"}
        title="Tambah pemasok"
        onClose={() => setModal(null)}
      >
        <div className="form-grid">
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
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={!supplier.code || !supplier.name}
            onClick={() => void createSupplier()}
          >
            Simpan pemasok
          </Button>
        </div>
      </Modal>
      <Modal
        open={modal === "purchase"}
        title="Catat pembelian"
        onClose={() => setModal(null)}
        wide
      >
        <div className="form-grid">
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
        <div className="purchase-item-builder">
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
            onChange={(e) =>
              setDraftItem({ ...draftItem, product_unit_id: e.target.value })
            }
          >
            <option value="">Pilih satuan</option>
            {productUnits.map((item) => (
              <option key={item.id} value={item.id}>
                {item.unit_name}
              </option>
            ))}
          </Select>
          <Input
            label="Qty"
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
              setDraftItem({ ...draftItem, unit_cost: Number(e.target.value) })
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
            <Plus />
          </Button>
        </div>
        <div className="purchase-lines">
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
        <div className="form-grid">
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
            label="Dibayar"
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
        <div className="purchase-total">
          <span>Total pembelian</span>
          <strong>{rupiah(total)}</strong>
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={
              !purchase.supplier_id ||
              !items.length ||
              total < 0 ||
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
        title="Konfirmasi penerimaan"
        onClose={() => setModal(null)}
      >
        <div className="confirm-panel">
          <PackageCheck />
          <h3>{selected?.number}</h3>
          <p>
            Penerimaan akan menambah stok, memperbarui HPP rata-rata, serta
            membentuk utang bila belum lunas.
          </p>
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button loading={saving} onClick={() => void receive()}>
            Terima semua barang
          </Button>
        </div>
      </Modal>
    </>
  );
}
