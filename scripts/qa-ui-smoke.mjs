#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = await readFile(path.join(root, "src/App.tsx"), "utf8");
const layout = await readFile(path.join(root, "src/components/AppLayout.tsx"), "utf8");
const ui = await readFile(path.join(root, "src/components/ui.tsx"), "utf8");
const pos = await readFile(path.join(root, "src/pages/POSPage.tsx"), "utf8");
const catalog = await readFile(path.join(root, "src/pages/CatalogPage.tsx"), "utf8");

const checks = [
  ["Kasir", 'path="kasir"', 'label: "Kasir"'],
  ["Produk", 'path="produk"', 'label: "Produk"'],
  ["Persediaan", 'path="persediaan"', 'label: "Persediaan"'],
  ["Pelanggan & Piutang", 'path="pelanggan"', 'label: "Pelanggan & Piutang"'],
  ["Pembelian & Pemasok", 'path="pembelian"', 'label: "Pembelian & Pemasok"'],
  ["Hutang & Piutang", 'path="hutang-piutang"', 'label: "Hutang & Piutang"'],
  ["Sif & Kas", 'path="kas"', 'label: "Sif & Kas"'],
  ["Administrasi", 'path="administrasi"', 'label: "Administrasi"'],
  ["Karyawan & Gaji", 'path="karyawan"', 'label: "Karyawan & Gaji"'],
];

let failed = 0;
for (const [name, route, navigation] of checks) {
  const routeExists = app.includes(route);
  const navigationExists = layout.includes(navigation);
  const passed = routeExists && navigationExists;
  console.log(`${passed ? "LULUS" : "GAGAL"} - ${name}: route=${routeExists}, navigasi=${navigationExists}`);
  if (!passed) failed += 1;
}

if (!app.includes('permission="employee.manage"')) {
  console.error("GAGAL - Route Karyawan & Gaji belum dilindungi permission employee.manage");
  failed += 1;
}
if (!app.includes('permission="purchase.manage"')) {
  console.error("GAGAL - Route pembelian/hutang belum dilindungi permission purchase.manage");
  failed += 1;
}

const responsiveChecks = [
  [
    "Tab halaman tidak memakai scroll horizontal",
    !ui.includes('className="mb-4 flex gap-1 overflow-x-auto'),
  ],
  [
    "Tab halaman membungkus sesuai lebar layar",
    ui.includes("grid-cols-[repeat(auto-fit,minmax(128px,1fr))]"),
  ],
  [
    "Kasir memiliki keranjang responsif untuk mobile dan tablet",
    pos.includes("mobileCartOpen") &&
      pos.includes("xl:grid-cols-[minmax(0,1fr)_360px]") &&
      pos.includes("2xl:grid-cols-[minmax(0,1fr)_400px]"),
  ],
  [
    "Keranjang desktop tidak memotong total pada layar pendek",
    pos.includes("min-h-0 flex-1 space-y-2 overflow-y-auto") &&
      pos.includes("shrink-0 border-t border-[#dfe7e2]"),
  ],
  [
    "Kartu produk menyesuaikan lebar area kasir",
    pos.includes("repeat(auto-fill,minmax(164px,1fr))") &&
      pos.includes("[overflow-wrap:anywhere]"),
  ],
  [
    "Sidebar desktop lebih ringkas pada layar laptop",
    layout.includes("w-[236px]") &&
      layout.includes("[@media(max-height:760px)]:min-h-9") &&
      layout.includes("[scrollbar-width:none]"),
  ],
  [
    "Kasir memiliki tombol keranjang tetap pada layar kecil",
    pos.includes("fixed inset-x-3 bottom-3 z-30 xl:hidden"),
  ],
  [
    "Kartu kategori dan satuan sudah memakai layout responsif",
    catalog.includes("grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"),
  ],
  [
    "Detail produk memakai modal lebar dan kartu harga",
    catalog.includes('title="Detail produk"') &&
      catalog.includes("md:w-[min(940px,calc(100vw-72px))]"),
  ],
];

for (const [name, passed] of responsiveChecks) {
  console.log(`${passed ? "LULUS" : "GAGAL"} - ${name}`);
  if (!passed) failed += 1;
}

if (failed > 0) {
  console.error(`\nUI smoke test gagal: ${failed} pemeriksaan.`);
  process.exit(1);
}
console.log(
  `\nUI smoke test lulus: ${checks.length + 2 + responsiveChecks.length} pemeriksaan.`,
);
