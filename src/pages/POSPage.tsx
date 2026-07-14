import {
  Banknote,
  Barcode,
  CreditCard,
  Minus,
  Plus,
  QrCode,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { activeShiftID, api, json, newUUID } from "../lib/api";
import { asArray, quantity, rupiah } from "../lib/format";
import type { Product, ProductUnit } from "../types/api";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Modal,
  useToast,
} from "../components/ui";

interface CartItem {
  product: Product;
  unit: ProductUnit;
  quantityMilli: number;
  discount: number;
}
interface Customer {
  id: string;
  code: string;
  name: string;
  blocked: boolean;
}

const nextSequence = () => {
  const value =
    Number(localStorage.getItem("warungkasir.device_sequence") || 0) + 1;
  localStorage.setItem("warungkasir.device_sequence", String(value));
  return value;
};

export function POSPage() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState(0);
  const [transactionDiscount, setTransactionDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const { show, node: toast } = useToast();

  const search = useCallback(async () => {
    try {
      setProducts(
        asArray(
          await api<Product[]>(
            `/products?q=${encodeURIComponent(query)}&status=active&limit=40`,
          ),
        ),
      );
    } catch (error) {
      show(
        error instanceof Error ? error.message : "Gagal mencari produk",
        true,
      );
    }
  }, [query, show]);
  useEffect(() => {
    const timer = window.setTimeout(() => void search(), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    api<Customer[]>("/customers?limit=100")
      .then((data) =>
        setCustomers(asArray<Customer>(data).filter((item) => !item.blocked)),
      )
      .catch(() => undefined);
  }, []);

  const addProduct = async (product: Product) => {
    try {
      const detail = await api<{ product: Product; units: ProductUnit[] }>(
        `/products/${product.id}`,
      );
      const unit =
        detail.units.find((item) => item.is_default_sale) || detail.units[0];
      if (!unit)
        return show("Produk belum memiliki satuan dan harga jual.", true);
      setCart((current) => {
        const found = current.find((item) => item.unit.id === unit.id);
        return found
          ? current.map((item) =>
              item.unit.id === unit.id
                ? { ...item, quantityMilli: item.quantityMilli + 1000 }
                : item,
            )
          : [...current, { product, unit, quantityMilli: 1000, discount: 0 }];
      });
    } catch (error) {
      show(
        error instanceof Error ? error.message : "Gagal menambahkan produk",
        true,
      );
    }
  };

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum +
          Math.round((item.unit.sale_price * item.quantityMilli) / 1000) -
          item.discount,
        0,
      ),
    [cart],
  );
  const total = Math.max(0, subtotal - transactionDiscount);
  const change = Math.max(0, paidAmount - total);
  useEffect(() => {
    if (payOpen) setPaidAmount(total);
  }, [payOpen, total]);

  const checkout = async () => {
    if (!cart.length || paidAmount < total) return;
    setLoading(true);
    try {
      const shiftId = paymentMethod === "cash" ? await activeShiftID() : null;
      if (paymentMethod === "cash" && !shiftId)
        throw new Error(
          "Buka sif terlebih dahulu untuk menerima pembayaran tunai.",
        );
      const id = newUUID();
      const result = await api<any>(
        "/sales",
        json(
          "POST",
          {
            id,
            device_sequence: nextSequence(),
            customer_id: customerId || null,
            shift_id: shiftId,
            items: cart.map((item) => ({
              product_unit_id: item.unit.id,
              quantity_milli: item.quantityMilli,
              discount: item.discount,
            })),
            payments: [{ method: paymentMethod, amount: total, reference: "" }],
            transaction_discount: transactionDiscount,
            rounding: 0,
            notes,
            due_date:
              paymentMethod === "debt"
                ? new Date(Date.now() + 14 * 86400000).toISOString()
                : null,
            business_at: new Date().toISOString(),
          },
          { "Idempotency-Key": id },
        ),
      );
      setReceipt(result);
      setCart([]);
      setCustomerId("");
      setTransactionDiscount(0);
      setNotes("");
      setPayOpen(false);
      show("Transaksi berhasil disimpan.");
    } catch (error) {
      show(error instanceof Error ? error.message : "Transaksi gagal", true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pos-page">
      {toast}
      <section className="pos-products">
        <div className="pos-title">
          <div>
            <p className="eyebrow">TRANSAKSI PENJUALAN</p>
            <h1>Transaksi baru</h1>
          </div>
          <Badge tone="success">Terhubung</Badge>
        </div>
        <label className="product-search">
          <Search />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, kode barang, atau pindai barcode..."
          />
          <span>
            <Barcode /> Pindai
          </span>
        </label>
        <div className="product-grid">
          {products.map((product) => (
            <button
              key={product.id}
              className="product-tile"
              onClick={() => void addProduct(product)}
            >
              <span className="product-art">
                {product.name.slice(0, 2).toUpperCase()}
              </span>
              <span>
                <strong>{product.name}</strong>
                <small>{product.brand || product.sku}</small>
                <em>{product.barcode || product.sku}</em>
              </span>
              <Plus className="tile-plus" />
            </button>
          ))}
          {products.length === 0 && (
            <EmptyState
              title="Produk tidak ditemukan"
              description="Ubah kata pencarian atau tambahkan produk baru."
            />
          )}
        </div>
      </section>
      <aside className="cart-panel">
        <header>
          <div>
            <ShoppingCart />
            <span>
              <strong>Keranjang</strong>
              <small>{cart.length} item berbeda</small>
            </span>
          </div>
          <button disabled={!cart.length} onClick={() => setCart([])}>
            Kosongkan
          </button>
        </header>
        <div className="customer-select">
          <UserRound />
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Pelanggan umum</option>
            {customers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="cart-items">
          {cart.map((item) => (
            <article key={item.unit.id}>
              <div className="cart-item-top">
                <div>
                  <strong>{item.product.name}</strong>
                  <small>
                    {item.unit.unit_name} · {rupiah(item.unit.sale_price)}
                  </small>
                </div>
                <button
                  onClick={() =>
                    setCart(cart.filter((row) => row.unit.id !== item.unit.id))
                  }
                >
                  <Trash2 />
                </button>
              </div>
              <div className="cart-item-bottom">
                <div className="qty-control">
                  <button
                    onClick={() =>
                      setCart(
                        cart.map((row) =>
                          row.unit.id === item.unit.id
                            ? {
                                ...row,
                                quantityMilli: Math.max(
                                  1000,
                                  row.quantityMilli - 1000,
                                ),
                              }
                            : row,
                        ),
                      )
                    }
                  >
                    <Minus />
                  </button>
                  <span>{quantity(item.quantityMilli)}</span>
                  <button
                    onClick={() =>
                      setCart(
                        cart.map((row) =>
                          row.unit.id === item.unit.id
                            ? {
                                ...row,
                                quantityMilli: row.quantityMilli + 1000,
                              }
                            : row,
                        ),
                      )
                    }
                  >
                    <Plus />
                  </button>
                </div>
                <strong>
                  {rupiah(
                    (item.unit.sale_price * item.quantityMilli) / 1000 -
                      item.discount,
                  )}
                </strong>
              </div>
            </article>
          ))}
          {cart.length === 0 && (
            <div className="empty-cart">
              <ShoppingCart />
              <strong>Keranjang masih kosong</strong>
              <span>Pilih produk untuk memulai transaksi.</span>
            </div>
          )}
        </div>
        <div className="cart-summary">
          <label>
            Diskon transaksi{" "}
            <input
              type="number"
              min="0"
              value={transactionDiscount}
              onChange={(e) => setTransactionDiscount(Number(e.target.value))}
            />
          </label>
          <div>
            <span>Subtotal</span>
            <b>{rupiah(subtotal)}</b>
          </div>
          <div>
            <span>Diskon</span>
            <b>- {rupiah(transactionDiscount)}</b>
          </div>
          <div className="cart-total">
            <span>Total</span>
            <strong>{rupiah(total)}</strong>
          </div>
          <Button disabled={!cart.length} onClick={() => setPayOpen(true)}>
            <WalletCards /> Bayar sekarang
          </Button>
        </div>
      </aside>
      <Modal
        open={payOpen}
        title="Pembayaran"
        onClose={() => setPayOpen(false)}
      >
        <div className="payment-total">
          <span>Total tagihan</span>
          <strong>{rupiah(total)}</strong>
        </div>
        <div className="payment-methods">
          {[
            { id: "cash", label: "Tunai", icon: Banknote },
            { id: "transfer", label: "Transfer", icon: CreditCard },
            { id: "qris", label: "QRIS", icon: QrCode },
            { id: "debt", label: "Utang", icon: WalletCards },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={paymentMethod === id ? "active" : ""}
              onClick={() => setPaymentMethod(id)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </div>
        {paymentMethod === "debt" && !customerId && (
          <div className="form-error">
            Pilih pelanggan terlebih dahulu untuk pembayaran utang.
          </div>
        )}
        <Input
          label="Jumlah dibayar"
          type="number"
          min={0}
          value={paidAmount}
          onChange={(e) => setPaidAmount(Number(e.target.value))}
        />
        <TextareaLite value={notes} onChange={setNotes} />
        <div className="payment-change">
          <span>Kembalian</span>
          <strong>{rupiah(change)}</strong>
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setPayOpen(false)}>
            Batal
          </Button>
          <Button
            loading={loading}
            disabled={
              paidAmount < total || (paymentMethod === "debt" && !customerId)
            }
            onClick={() => void checkout()}
          >
            Selesaikan transaksi
          </Button>
        </div>
      </Modal>
      <Modal
        open={Boolean(receipt)}
        title="Transaksi berhasil"
        onClose={() => setReceipt(null)}
      >
        <div className="success-receipt">
          <span>✓</span>
          <h3>{receipt?.sale?.number || "Penjualan tersimpan"}</h3>
          <p>Transaksi sudah tersimpan dan stok telah diperbarui.</p>
          <Button onClick={() => setReceipt(null)}>Transaksi berikutnya</Button>
        </div>
      </Modal>
    </div>
  );
}

function TextareaLite({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>Catatan (opsional)</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
      />
    </label>
  );
}
