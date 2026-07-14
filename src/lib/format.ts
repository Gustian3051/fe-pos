export const rupiah = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

export const quantity = (milli: number | string | null | undefined) => {
  const value = Number(milli ?? 0) / 1000;
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(
    value,
  );
};

export const dateTime = (value?: string | null) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export const dateOnly = (value?: string | null) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    new Date(value),
  );
};

export const asArray = <T = Record<string, any>>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

export const classNames = (
  ...items: Array<string | false | null | undefined>
) => items.filter(Boolean).join(" ");

const labels: Record<string, string> = {
  active: "Aktif",
  inactive: "Tidak aktif",
  locked: "Terkunci",
  revoked: "Dicabut",
  completed: "Selesai",
  returned: "Ada retur",
  voided: "Dibatalkan",
  open: "Aktif",
  draft: "Menunggu barang",
  received: "Diterima",
  paid: "Lunas",
  owner: "Pemilik",
  cashier: "Kasir",
  stock_admin: "Pengelola stok",
  supervisor: "Pengawas",
  cash: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
  debt: "Utang",
  other: "Lainnya",
  catalog: "Produk",
  inventory: "Persediaan",
  sale: "Penjualan",
  purchase: "Pembelian",
  customer: "Pelanggan",
  user: "Pengguna",
  stock_movement: "Persediaan",
  stock_opname: "Stok opname",
};

export const displayLabel = (value?: string | null) =>
  value ? labels[value] || value.replaceAll("_", " ") : "—";

const activityLabels: Record<string, string> = {
  "auth.bootstrap": "Membuat akun pemilik",
  "auth.login": "Masuk ke aplikasi",
  "auth.login_failed": "Percobaan masuk gagal",
  "category.create": "Menambah kategori",
  "category.update": "Mengubah kategori",
  "product.create": "Menambah produk",
  "product.update": "Mengubah produk",
  "product_unit.create": "Menambah satuan produk",
  "price_rule.create": "Menambah aturan harga",
  "inventory.adjust": "Menyesuaikan stok",
  "opname.create": "Membuat stok opname",
  "opname.confirm": "Mengonfirmasi stok opname",
  "sale.create": "Mencatat penjualan",
  "supplier.create": "Menambah pemasok",
  "purchase.create": "Mencatat pembelian",
  "purchase.receive": "Menerima barang",
  "customer.create": "Menambah pelanggan",
  "cash_movement.create": "Mencatat pergerakan kas",
};

export const activityLabel = (value?: string | null) =>
  value ? activityLabels[value] || "Memperbarui data" : "Aktivitas toko";
