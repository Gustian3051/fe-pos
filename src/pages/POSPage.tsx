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
import { api, apiPage, json, newUUID, requireActiveShiftID } from "../lib/api";
import { asArray, quantity, rupiah } from "../lib/format";
import { useDebouncedValue } from "../lib/hooks";
import type { Product, ProductUnit } from "../types/api";
import { Badge, Button, EmptyState, Input, Modal, Textarea, useToast } from "../components/ui";

type PriceTier = "general" | "reseller" | "agent";

interface CartItem {
  product: Product;
  units: ProductUnit[];
  unit: ProductUnit;
  quantityMilli: number;
  discount: number;
  priceTier: PriceTier;
}
interface Customer {
  id: string;
  code: string;
  name: string;
  blocked: boolean;
}

interface UnitPickerState {
  product: Product;
  units: ProductUnit[];
}

const nextSequence = () => {
  const value = Number(localStorage.getItem("warungkasir.device_sequence") || 0) + 1;
  localStorage.setItem("warungkasir.device_sequence", String(value));
  return value;
};

const positivePrice = (...values: Array<number | undefined>) =>
  values.find((value) => typeof value === "number" && value > 0) ?? 0;

const tierPrice = (unit: ProductUnit, tier: PriceTier) => {
  if (tier === "reseller") return positivePrice(unit.sale_price_reseller, unit.sale_price_general, unit.sale_price);
  if (tier === "agent") return positivePrice(unit.sale_price_agent, unit.sale_price_reseller, unit.sale_price_general, unit.sale_price);
  return positivePrice(unit.sale_price_general, unit.sale_price);
};

const tierLabel = (tier: PriceTier) =>
  tier === "reseller" ? "Harga reseller" : tier === "agent" ? "Harga agen" : "Harga umum";

const normalize = (value: string) => value.trim().toLowerCase();

const sortUnits = (units: ProductUnit[]) =>
  [...units].sort((a, b) => {
    if (a.is_default_sale !== b.is_default_sale) return a.is_default_sale ? -1 : 1;
    return a.conversion_factor_milli - b.conversion_factor_milli;
  });

const unitDescription = (unit: ProductUnit) => {
  const factor = quantity(unit.conversion_factor_milli);
  const base = unit.conversion_factor_milli === 1000 ? "satuan terkecil" : `isi ${factor} satuan terkecil`;
  return `${unit.unit_name} · ${base}${unit.barcode ? ` · ${unit.barcode}` : ""}`;
};

export function POSPage() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [customerQuery, setCustomerQuery] = useState("");
  const debouncedCustomerQuery = useDebouncedValue(customerQuery, 300);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [priceTier, setPriceTier] = useState<PriceTier>("general");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState(0);
  const [transactionDiscount, setTransactionDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [unitPicker, setUnitPicker] = useState<UnitPickerState | null>(null);
  const { show, node: toast } = useToast();

  const search = useCallback(async () => {
    try {
      const result = await apiPage<Product>(
        `/products?q=${encodeURIComponent(debouncedQuery)}&status=active&page=1&limit=40`,
      );
      setProducts(result.items);
    } catch (error) {
      show(error instanceof Error ? error.message : "Gagal mencari produk", true);
    }
  }, [debouncedQuery, show]);

  useEffect(() => {
    void search();
  }, [search]);

  useEffect(() => {
    apiPage<Customer>(
      `/customers?q=${encodeURIComponent(debouncedCustomerQuery)}&page=1&limit=30`,
    )
      .then((result) =>
        setCustomers(result.items.filter((item) => !item.blocked)),
      )
      .catch(() => undefined);
  }, [debouncedCustomerQuery]);

  const addUnitToCart = useCallback(
    (product: Product, unit: ProductUnit, units: ProductUnit[], tier: PriceTier = priceTier) => {
      setCart((current) => {
        const found = current.find((item) => item.unit.id === unit.id && item.priceTier === tier);
        return found
          ? current.map((item) =>
              item.unit.id === unit.id && item.priceTier === tier
                ? { ...item, quantityMilli: item.quantityMilli + 1000, units: sortUnits(units) }
                : item,
            )
          : [
              ...current,
              {
                product,
                units: sortUnits(units),
                unit,
                quantityMilli: 1000,
                discount: 0,
                priceTier: tier,
              },
            ];
      });
      setUnitPicker(null);
      setQuery("");
    },
    [priceTier],
  );

  const addProduct = async (product: Product) => {
    try {
      const detail = await api<{ product: Product; units: ProductUnit[] }>(`/products/${product.id}`);
      const units = sortUnits(asArray<ProductUnit>(detail.units));
      const scanned = normalize(query);
      const scannedUnit = scanned
        ? units.find((item) => normalize(item.barcode || "") === scanned)
        : undefined;

      if (!units.length) return show("Produk belum memiliki satuan dan harga jual.", true);

      if (scannedUnit) {
        addUnitToCart(detail.product || product, scannedUnit, units);
        return;
      }

      if (units.length > 1) {
        setUnitPicker({ product: detail.product || product, units });
        return;
      }

      addUnitToCart(detail.product || product, units[0], units);
    } catch (error) {
      show(error instanceof Error ? error.message : "Gagal menambahkan produk", true);
    }
  };

  const changeCartUnit = (row: CartItem, nextUnitID: string) => {
    const nextUnit = row.units.find((unit) => unit.id === nextUnitID);
    if (!nextUnit || nextUnit.id === row.unit.id) return;
    setCart((current) => {
      const duplicate = current.find(
        (item) =>
          item !== row && item.unit.id === nextUnit.id && item.priceTier === row.priceTier,
      );
      if (duplicate) {
        return current
          .filter((item) => item !== row)
          .map((item) =>
            item === duplicate
              ? { ...item, quantityMilli: item.quantityMilli + row.quantityMilli }
              : item,
          );
      }
      return current.map((item) => (item === row ? { ...item, unit: nextUnit } : item));
    });
  };

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + Math.round((tierPrice(item.unit, item.priceTier) * item.quantityMilli) / 1000) - item.discount,
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
      const shiftId = paymentMethod === "cash" ? await requireActiveShiftID() : null;
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
              price_tier: item.priceTier,
            })),
            payments: [{ method: paymentMethod, amount: total, reference: "", tendered_amount: paymentMethod === "cash" ? paidAmount : total, change_amount: paymentMethod === "cash" ? change : 0 }],
            transaction_discount: transactionDiscount,
            rounding: 0,
            notes,
            due_date: paymentMethod === "debt" ? new Date(Date.now() + 14 * 86400000).toISOString() : null,
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
    <div className="-m-8 grid h-[calc(100vh-70px)] grid-cols-[minmax(0,1fr)_380px] overflow-hidden max-lg:-m-5 max-lg:flex max-lg:h-auto max-lg:flex-col max-lg:overflow-visible">
      {toast}
      <section className="overflow-auto p-7 max-lg:overflow-visible max-lg:p-5">
        <div className="flex items-center justify-between gap-4 max-md:flex-col max-md:items-start [&_h1]:m-0 [&_h1]:text-2xl [&_h1]:font-bold">
          <div>
            <p className="mb-3 text-[11px] font-extrabold tracking-[.16em] text-brand-700">TRANSAKSI PENJUALAN</p>
            <h1>Transaksi baru</h1>
          </div>
          <Badge tone="success">Terhubung</Badge>
        </div>
        <label className="sticky top-0 z-10 flex min-h-12 items-center gap-3 rounded-xl border border-[#cedbd3] bg-white px-4 shadow-sm focus-within:border-brand-700 [&_input]:min-w-0 [&_input]:flex-1 [&_input]:border-0 [&_input]:outline-none [&_svg]:text-brand-700 [&_span]:flex [&_span]:items-center [&_span]:gap-1 [&_span]:rounded-md [&_span]:bg-slate-100 [&_span]:px-2 [&_span]:py-1 [&_span]:text-[9px] [&_span]:text-slate-500">
          <Search />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama, kode barang, atau pindai barcode satuan..." />
          <span><Barcode /> Pindai</span>
        </label>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
          {products.map((product) => (
            <button key={product.id} className="relative flex min-h-[84px] items-center gap-3 rounded-xl border border-[#dfe7e2] bg-white p-3 text-left transition hover:-translate-y-px hover:border-brand-200 hover:shadow-lg" onClick={() => void addProduct(product)}>
              <span className="grid h-14 w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 text-xs font-extrabold text-brand-700">{product.name.slice(0, 2).toUpperCase()}</span>
              <span>
                <strong>{product.name}</strong>
                <small>{product.brand || product.sku}</small>
                <em>{product.barcode || product.sku}</em>
              </span>
              <Plus className="absolute bottom-2 right-2 h-4 w-4 text-brand-300" />
            </button>
          ))}
          {products.length === 0 && <EmptyState title="Produk tidak ditemukan" description="Ubah kata pencarian atau tambahkan produk baru." />}
        </div>
      </section>
      <aside className="flex min-h-0 flex-col border-l border-[#dfe7e2] bg-white max-lg:border-l-0 max-lg:border-t">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
          <div className="flex items-center gap-2 text-brand-700">
            <ShoppingCart className="h-5 w-5" />
            <span className="flex flex-col">
              <strong className="text-sm text-slate-900">Keranjang</strong>
              <small className="text-[10px] text-slate-500">{cart.length} jenis barang</small>
            </span>
          </div>
          <button
            className="rounded-lg px-2 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!cart.length}
            onClick={() => setCart([])}
          >
            Kosongkan
          </button>
        </header>
        <div className="mx-4 mt-3 space-y-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-500 focus-within:border-brand-700 focus-within:ring-4 focus-within:ring-brand-700/10">
            <Search className="h-4 w-4" />
            <input
              className="h-9 min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-900 outline-none"
              value={customerQuery}
              onChange={(event) => setCustomerQuery(event.target.value)}
              placeholder="Cari pelanggan..."
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-500">
            <UserRound className="h-4 w-4" />
            <select
              className="h-10 min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-900 outline-none"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
            >
              <option value="">Pelanggan umum</option>
              {customers.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-[#dfe7e2] px-2 text-slate-500 [&_select]:h-10 [&_select]:min-w-0 [&_select]:flex-1 [&_select]:border-0 [&_select]:bg-transparent [&_select]:text-xs [&_select]:outline-none [&_svg]:h-4 [&_svg]:w-4">
          <WalletCards />
          <select
            value={priceTier}
            onChange={(e) => {
              const nextTier = e.target.value as PriceTier;
              setPriceTier(nextTier);
              setCart((current) => current.map((item) => ({ ...item, priceTier: nextTier })));
            }}
          >
            <option value="general">Harga umum</option>
            <option value="reseller">Harga reseller</option>
            <option value="agent">Harga agen</option>
          </select>
        </div>
        <div className="flex-1 overflow-auto px-4 py-2 [&_article]:border-b [&_article]:border-slate-100 [&_article]:py-3">
          {cart.map((item) => (
            <article key={`${item.unit.id}-${item.priceTier}`}>
              <div className="flex items-start justify-between gap-3 [&_strong]:text-xs [&_small]:text-[10px] [&_small]:text-slate-500 [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-slate-400">
                <div>
                  <strong>{item.product.name}</strong>
                  <small>{item.unit.unit_name} · {tierLabel(item.priceTier)} · {rupiah(tierPrice(item.unit, item.priceTier))}</small>
                </div>
                <button onClick={() => setCart(cart.filter((row) => !(row.unit.id === item.unit.id && row.priceTier === item.priceTier)))}><Trash2 /></button>
              </div>
              <label className="mt-3 grid gap-1.5 [&_span]:text-[8px] [&_span]:font-extrabold [&_span]:uppercase [&_span]:tracking-wider [&_span]:text-slate-500 [&_select]:min-h-9 [&_select]:rounded-lg [&_select]:border [&_select]:border-[#dfe7e2] [&_select]:bg-slate-50 [&_select]:px-2 [&_select]:text-[10px]">
                <span>Satuan</span>
                <select value={item.unit.id} onChange={(event) => changeCartUnit(item, event.target.value)}>
                  {item.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unit_name} — {rupiah(tierPrice(unit, item.priceTier))} {unit.conversion_factor_milli !== 1000 ? `(isi ${quantity(unit.conversion_factor_milli)})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-3 flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start">
                <div className="flex overflow-hidden rounded-lg border border-[#dfe7e2] [&_button]:h-7 [&_button]:w-7 [&_button]:border-0 [&_button]:bg-slate-50 [&_span]:min-w-9 [&_span]:text-center [&_span]:text-[10px] [&_span]:leading-7">
                  <button onClick={() => setCart(cart.map((row) => row.unit.id === item.unit.id && row.priceTier === item.priceTier ? { ...row, quantityMilli: Math.max(1000, row.quantityMilli - 1000) } : row))}><Minus /></button>
                  <span>{quantity(item.quantityMilli)}</span>
                  <button onClick={() => setCart(cart.map((row) => row.unit.id === item.unit.id && row.priceTier === item.priceTier ? { ...row, quantityMilli: row.quantityMilli + 1000 } : row))}><Plus /></button>
                </div>
                <strong>{rupiah((tierPrice(item.unit, item.priceTier) * item.quantityMilli) / 1000 - item.discount)}</strong>
              </div>
            </article>
          ))}
          {cart.length === 0 && <div className="flex h-full flex-col items-center justify-center text-slate-500 [&>svg]:h-10 [&>svg]:w-10 [&>svg]:rounded-full [&>svg]:bg-slate-100 [&>svg]:p-2 [&_strong]:mt-3 [&_strong]:text-xs [&_span]:text-[10px]"><ShoppingCart /><strong>Keranjang masih kosong</strong><span>Pilih produk untuk memulai transaksi.</span></div>}
        </div>
        <div className="border-t border-[#dfe7e2] bg-slate-50 p-4 [&>label]:my-2 [&>label]:flex [&>label]:items-center [&>label]:justify-between [&>label]:text-[10px] [&>div]:my-2 [&>div]:flex [&>div]:items-center [&>div]:justify-between [&>div]:text-[10px] [&_input]:w-24 [&_input]:rounded-md [&_input]:border [&_input]:border-[#dfe7e2] [&_input]:px-2 [&_input]:py-1 [&_input]:text-right">
          <label>Diskon transaksi <input type="number" min="0" value={transactionDiscount} onChange={(e) => setTransactionDiscount(Number(e.target.value))} /></label>
          <div><span>Subtotal</span><b>{rupiah(subtotal)}</b></div>
          <div><span>Diskon</span><b>- {rupiah(transactionDiscount)}</b></div>
          <div className="border-t border-dashed border-slate-300 pt-3 [&_strong]:text-xl [&_strong]:text-brand-700"><span>Total</span><strong>{rupiah(total)}</strong></div>
          <Button disabled={!cart.length} onClick={() => setPayOpen(true)}><WalletCards /> Bayar sekarang</Button>
        </div>
      </aside>
      <Modal open={Boolean(unitPicker)} title="Pilih satuan transaksi" onClose={() => setUnitPicker(null)}>
        <div className="mb-3 grid gap-1.5 rounded-xl border border-[#dfe7e2] bg-slate-50 p-3 [&_strong]:text-sm [&_span]:text-xs [&_span]:leading-6 [&_span]:text-slate-500">
          <strong>{unitPicker?.product.name}</strong>
          <span>Pilih satuan yang dijual. Contoh rokok: pilih Bungkus agar harga 1 bungkus, bukan harga 1 batang.</span>
        </div>
        <div className="grid gap-2 [&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:justify-between [&_button]:gap-3 [&_button]:rounded-xl [&_button]:border [&_button]:border-[#dfe7e2] [&_button]:bg-white [&_button]:p-3 [&_button]:text-left [&_button]:hover:border-brand-200 [&_button]:hover:shadow-md [&_span]:grid [&_span]:min-w-0 [&_span]:gap-1 [&_small]:text-xs [&_small]:text-slate-500 [&_b]:whitespace-nowrap [&_b]:text-brand-700">
          {unitPicker?.units.map((unit) => (
            <button key={unit.id} onClick={() => unitPicker && addUnitToCart(unitPicker.product, unit, unitPicker.units)}>
              <span>
                <strong>{unit.unit_name}</strong>
                <small>{unitDescription(unit)}</small>
              </span>
              <b>{rupiah(tierPrice(unit, priceTier))}</b>
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          <Button variant="secondary" onClick={() => setUnitPicker(null)}>Batal</Button>
        </div>
      </Modal>
      <Modal open={payOpen} title="Pembayaran" onClose={() => setPayOpen(false)}>
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-brand-50 p-4 [&_span]:text-xs [&_span]:text-slate-500 [&_strong]:text-2xl [&_strong]:text-brand-700"><span>Total tagihan</span><strong>{rupiah(total)}</strong></div>
        <div className="my-4 grid grid-cols-2 gap-2 sm:grid-cols-4 [&_button]:flex [&_button]:flex-col [&_button]:items-center [&_button]:gap-1.5 [&_button]:rounded-xl [&_button]:border [&_button]:border-[#dfe7e2] [&_button]:bg-white [&_button]:p-3 [&_button]:text-[10px] [&_button]:text-slate-500 [&_button_svg]:h-5 [&_button_svg]:w-5">
          {[
            { id: "cash", label: "Tunai", icon: Banknote },
            { id: "transfer", label: "Transfer", icon: CreditCard },
            { id: "qris", label: "QRIS", icon: QrCode },
            { id: "debt", label: "Utang", icon: WalletCards },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={
                paymentMethod === id
                  ? "border-brand-700 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-500 hover:border-brand-200 hover:bg-brand-50"
              }
              onClick={() => setPaymentMethod(id)}
            >
              <Icon /><span>{label}</span>
            </button>
          ))}
        </div>
        {paymentMethod === "debt" && !customerId && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Pilih pelanggan terlebih dahulu untuk pembayaran utang.</div>}
        <Input label="Jumlah dibayar" type="number" min={0} value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value))} />
        <Textarea label="Catatan (opsional)" value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-brand-50 p-4 [&_span]:text-xs [&_span]:text-slate-500"><span>Kembalian</span><strong>{rupiah(change)}</strong></div>
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          <Button variant="secondary" onClick={() => setPayOpen(false)}>Batal</Button>
          <Button loading={loading} disabled={paidAmount < total || (paymentMethod === "debt" && !customerId)} onClick={() => void checkout()}>Selesaikan transaksi</Button>
        </div>
      </Modal>
      <Modal open={Boolean(receipt)} title="Transaksi berhasil" onClose={() => setReceipt(null)}>
        <div className="p-4 text-center [&>span]:mx-auto [&>span]:grid [&>span]:h-14 [&>span]:w-14 [&>span]:place-items-center [&>span]:rounded-full [&>span]:bg-brand-50 [&>span]:text-3xl [&>span]:text-brand-700 [&_p]:text-xs [&_p]:text-slate-500"><span>✓</span><h3>{receipt?.sale?.number || "Penjualan tersimpan"}</h3><p>Transaksi sudah tersimpan dan stok telah diperbarui.</p><Button onClick={() => setReceipt(null)}>Transaksi berikutnya</Button></div>
      </Modal>
    </div>
  );
}

