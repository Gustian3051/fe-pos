import {
  Banknote,
  Barcode,
  ChevronUp,
  CreditCard,
  Minus,
  Plus,
  QrCode,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, apiPage, json, newUUID, requireActiveShiftID } from "../lib/api";
import { asArray, classNames, quantity, rupiah } from "../lib/format";
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
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
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
  const cartQuantity = cart.reduce(
    (sum, item) => sum + item.quantityMilli / 1000,
    0,
  );
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
      setMobileCartOpen(false);
      show("Transaksi berhasil disimpan.");
    } catch (error) {
      show(error instanceof Error ? error.message : "Transaksi gagal", true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="-m-4 min-h-[calc(100dvh-64px)] bg-[#f4f7f5] sm:-m-5 xl:-m-8 xl:grid xl:h-[calc(100dvh-70px)] xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_360px] xl:overflow-hidden 2xl:grid-cols-[minmax(0,1fr)_400px]">
      {toast}

      <section className="min-w-0 p-4 pb-28 sm:p-5 xl:overflow-y-auto xl:p-5 xl:pb-5 2xl:p-7 2xl:pb-7">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between [@media(max-height:760px)]:mb-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-700 text-white shadow-[0_8px_20px_rgba(11,107,71,0.2)]">
              <ShoppingCart className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="m-0 text-[10px] font-extrabold tracking-[.16em] text-brand-700">
                TRANSAKSI PENJUALAN
              </p>
              <h1 className="m-0 mt-1 truncate text-2xl font-semibold tracking-[-.03em] text-slate-950 sm:text-[28px]">
                Kasir
              </h1>
              <p className="m-0 mt-1 text-xs text-slate-500">
                Cari produk, pilih satuan, lalu selesaikan pembayaran.
              </p>
            </div>
          </div>
          <Badge tone="success">Sistem terhubung</Badge>
        </div>

        <div className="sticky top-16 z-20 -mx-1 mb-4 bg-[#f4f7f5]/95 px-1 py-2 backdrop-blur-md xl:top-0">
          <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-[#cedbd3] bg-white px-4 shadow-[0_8px_24px_rgba(20,45,32,0.07)] transition focus-within:border-brand-700 focus-within:ring-4 focus-within:ring-brand-700/10">
            <Search className="h-5 w-5 shrink-0 text-brand-700" />
            <input
              autoFocus
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama, SKU, atau pindai barcode..."
            />
            <span className="hidden items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-500 sm:flex">
              <Barcode className="h-3.5 w-3.5" /> Pindai
            </span>
          </label>
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-sm font-bold text-slate-900">Pilih produk</h2>
            <p className="m-0 mt-1 text-[11px] text-slate-500">
              {products.length} produk ditampilkan
            </p>
          </div>
          {query && (
            <button
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
              onClick={() => setQuery("")}
            >
              Hapus pencarian
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-[repeat(auto-fill,minmax(164px,1fr))] 2xl:grid-cols-[repeat(auto-fill,minmax(176px,1fr))]">
          {products.map((product) => (
            <button
              key={product.id}
              className="group relative flex min-h-[148px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#dfe7e2] bg-white p-3.5 text-left shadow-[0_3px_10px_rgba(20,45,32,0.035)] transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_12px_28px_rgba(20,45,32,0.1)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-700/15 [@media(max-height:760px)]:min-h-[136px]"
              onClick={() => void addProduct(product)}
            >
              <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-xs font-extrabold text-brand-700 transition group-hover:scale-105">
                {product.name.slice(0, 2).toUpperCase()}
              </span>
              <strong className="line-clamp-2 [overflow-wrap:anywhere] text-[13px] leading-5 text-slate-900">
                {product.name}
              </strong>
              <small className="mt-1 truncate text-[10px] text-slate-500">
                {product.brand || "Tanpa merek"}
              </small>
              <span className="mt-auto flex items-center justify-between gap-2 pt-3">
                <code className="min-w-0 truncate rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600">
                  {product.sku}
                </code>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-700 text-white shadow-sm">
                  <Plus className="h-4 w-4" />
                </span>
              </span>
            </button>
          ))}
          {products.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white">
              <EmptyState
                title="Produk tidak ditemukan"
                description="Ubah kata pencarian atau tambahkan produk baru melalui menu Produk."
              />
            </div>
          )}
        </div>
      </section>

      {mobileCartOpen && (
        <button
          className="fixed inset-0 z-40 border-0 bg-black/45 backdrop-blur-[2px] xl:hidden"
          onClick={() => setMobileCartOpen(false)}
          aria-label="Tutup keranjang"
        />
      )}

      <aside
        className={classNames(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] min-h-0 flex-col overflow-hidden rounded-t-[24px] border border-[#dfe7e2] bg-white shadow-[0_-22px_60px_rgba(10,35,22,0.2)] transition-transform duration-300 xl:static xl:h-full xl:max-h-none xl:translate-y-0 xl:rounded-none xl:border-y-0 xl:border-r-0 xl:border-l xl:shadow-none",
          mobileCartOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-slate-300 xl:hidden" />
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5 xl:px-4 [@media(max-height:760px)]:py-2.5">
          <div className="flex min-w-0 items-center gap-3 text-brand-700">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50">
              <ShoppingCart className="h-5 w-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <strong className="text-sm text-slate-900">Keranjang transaksi</strong>
              <small className="text-[10px] text-slate-500">
                {cart.length} jenis · {quantity(Math.round(cartQuantity * 1000))} barang
              </small>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="rounded-lg px-2 py-1.5 text-[10px] font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!cart.length}
              onClick={() => setCart([])}
            >
              Kosongkan
            </button>
            <button
              className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 xl:hidden"
              onClick={() => setMobileCartOpen(false)}
              aria-label="Tutup keranjang"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="shrink-0 border-b border-slate-100 bg-slate-50/70 p-4 sm:p-5 xl:p-3.5 [@media(max-height:760px)]:p-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-500 focus-within:border-brand-700 focus-within:ring-4 focus-within:ring-brand-700/10">
              <Search className="h-4 w-4" />
              <input
                className="h-10 min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-900 outline-none [@media(max-height:760px)]:h-9"
                value={customerQuery}
                onChange={(event) => setCustomerQuery(event.target.value)}
                placeholder="Cari pelanggan..."
              />
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-500 focus-within:border-brand-700 focus-within:ring-4 focus-within:ring-brand-700/10">
              <UserRound className="h-4 w-4" />
              <select
                className="h-10 min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-900 outline-none [@media(max-height:760px)]:h-9"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
              >
                <option value="">Pelanggan umum</option>
                {customers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-500 focus-within:border-brand-700 focus-within:ring-4 focus-within:ring-brand-700/10">
            <WalletCards className="h-4 w-4" />
            <select
              className="h-10 min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-900 outline-none [@media(max-height:760px)]:h-9"
              value={priceTier}
              onChange={(e) => {
                const nextTier = e.target.value as PriceTier;
                setPriceTier(nextTier);
                setCart((current) =>
                  current.map((item) => ({ ...item, priceTier: nextTier })),
                );
              }}
            >
              <option value="general">Harga umum</option>
              <option value="reseller">Harga reseller</option>
              <option value="agent">Harga agen</option>
            </select>
          </label>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4 sm:p-5 xl:p-4 [@media(max-height:760px)]:p-3">
          {cart.map((item) => (
            <article
              key={`${item.unit.id}-${item.priceTier}`}
              className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_2px_8px_rgba(20,45,32,0.035)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block truncate text-xs text-slate-900">
                    {item.product.name}
                  </strong>
                  <small className="mt-1 block text-[10px] leading-4 text-slate-500">
                    {tierLabel(item.priceTier)} · {rupiah(tierPrice(item.unit, item.priceTier))}
                  </small>
                </div>
                <button
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-700"
                  onClick={() =>
                    setCart(
                      cart.filter(
                        (row) =>
                          !(
                            row.unit.id === item.unit.id &&
                            row.priceTier === item.priceTier
                          ),
                      ),
                    )
                  }
                  aria-label={`Hapus ${item.product.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <label className="mt-3 grid gap-1.5">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">
                  Satuan jual
                </span>
                <select
                  className="min-h-10 w-full rounded-xl border border-[#dfe7e2] bg-slate-50 px-3 text-[11px] text-slate-800 outline-none focus:border-brand-700 focus:ring-4 focus:ring-brand-700/10"
                  value={item.unit.id}
                  onChange={(event) => changeCartUnit(item, event.target.value)}
                >
                  {item.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unit_name} — {rupiah(tierPrice(unit, item.priceTier))}{" "}
                      {unit.conversion_factor_milli !== 1000
                        ? `(isi ${quantity(unit.conversion_factor_milli)})`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex overflow-hidden rounded-xl border border-[#dfe7e2] bg-slate-50">
                  <button
                    className="grid h-9 w-9 place-items-center text-slate-600 hover:bg-slate-100"
                    onClick={() =>
                      setCart(
                        cart.map((row) =>
                          row.unit.id === item.unit.id &&
                          row.priceTier === item.priceTier
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
                    aria-label="Kurangi jumlah"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-11 px-2 text-center text-[11px] font-bold leading-9 text-slate-900">
                    {quantity(item.quantityMilli)}
                  </span>
                  <button
                    className="grid h-9 w-9 place-items-center text-slate-600 hover:bg-slate-100"
                    onClick={() =>
                      setCart(
                        cart.map((row) =>
                          row.unit.id === item.unit.id &&
                          row.priceTier === item.priceTier
                            ? {
                                ...row,
                                quantityMilli: row.quantityMilli + 1000,
                              }
                            : row,
                        ),
                      )
                    }
                    aria-label="Tambah jumlah"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <strong className="text-sm text-slate-950">
                  {rupiah(
                    (tierPrice(item.unit, item.priceTier) *
                      item.quantityMilli) /
                      1000 -
                      item.discount,
                  )}
                </strong>
              </div>
            </article>
          ))}

          {cart.length === 0 && (
            <div className="flex h-full min-h-[150px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-5 text-center text-slate-500 xl:min-h-0 [@media(max-height:760px)]:px-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-brand-700 shadow-sm">
                <ShoppingCart className="h-5 w-5" />
              </span>
              <strong className="mt-3 text-sm text-slate-700">
                Keranjang masih kosong
              </strong>
              <span className="mt-1 text-[11px]">
                Pilih produk untuk memulai transaksi.
              </span>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[#dfe7e2] bg-white p-4 shadow-[0_-10px_28px_rgba(20,45,32,0.06)] sm:p-5 xl:p-4 [@media(max-height:760px)]:p-3">
          <label className="mb-3 flex items-center justify-between gap-4 text-[11px] text-slate-600">
            <span>Diskon transaksi</span>
            <input
              className="h-9 w-32 rounded-lg border border-[#dfe7e2] px-3 text-right text-xs font-semibold text-slate-900 outline-none focus:border-brand-700 focus:ring-4 focus:ring-brand-700/10"
              type="number"
              min="0"
              value={transactionDiscount}
              onChange={(e) => setTransactionDiscount(Number(e.target.value))}
            />
          </label>
          <div className="space-y-2 text-[11px] text-slate-600">
            <div className="flex items-center justify-between gap-3">
              <span>Subtotal</span>
              <b className="text-slate-900">{rupiah(subtotal)}</b>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Diskon</span>
              <b className="text-slate-900">- {rupiah(transactionDiscount)}</b>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3 border-t border-dashed border-slate-300 pt-3">
              <span className="font-bold text-slate-700">Total pembayaran</span>
              <strong className="text-xl tracking-tight text-brand-700">
                {rupiah(total)}
              </strong>
            </div>
          </div>
          <Button
            className="mt-4 min-h-11 w-full text-sm [@media(max-height:760px)]:mt-3 [@media(max-height:760px)]:min-h-10"
            disabled={!cart.length}
            onClick={() => setPayOpen(true)}
          >
            <WalletCards /> Bayar sekarang
          </Button>
        </div>
      </aside>

      <div className="fixed inset-x-3 bottom-3 z-30 xl:hidden">
        <button
          className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border border-brand-800 bg-brand-700 px-4 py-3 text-left text-white shadow-[0_16px_36px_rgba(5,54,35,0.34)]"
          onClick={() => setMobileCartOpen(true)}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15">
              <ShoppingCart className="h-5 w-5" />
              {cart.length > 0 && (
                <b className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[9px] text-brand-700">
                  {cart.length}
                </b>
              )}
            </span>
            <span className="min-w-0">
              <strong className="block text-xs">Lihat keranjang</strong>
              <small className="block truncate text-[10px] text-emerald-100">
                {cart.length
                  ? `${quantity(Math.round(cartQuantity * 1000))} barang dipilih`
                  : "Belum ada produk dipilih"}
              </small>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <strong className="text-sm">{rupiah(total)}</strong>
            <ChevronUp className="h-4 w-4" />
          </span>
        </button>
      </div>
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

