# Kita POS Frontend

Frontend POS berbasis React, TypeScript, Vite, dan Tailwind CSS untuk toko sembako, kafe/restoran, apotek, toko bangunan, toko mebel, serta bengkel dan sparepart.

Pemilik toko memiliki akses khusus untuk menghapus produk/karyawan yang belum memiliki riwayat, membuat akun karyawan melalui Administrasi, menghubungkannya dari menu Karyawan & Gaji, serta mengelola pembayaran gaji bulanan, harian, dan per jam. Kode karyawan dibuat otomatis oleh backend dan tidak dapat diubah manual. Registrasi meminta jenis usaha dan backend menyiapkan kategori/satuan awal yang sesuai. Katalog menyesuaikan profil usaha, menampilkan harga pokok rata-rata tertimbang, serta menyediakan penyusun resep dan perhitungan harga pokok menu otomatis.

Pada formulir produk, pilih **Produk siap jual — tanpa bahan** untuk barang seperti air mineral. Pilih **Produk racikan — wajib memiliki bahan** untuk produk seperti Red Velvet, lalu tambahkan satu atau banyak bahan. Bahan seperti susu, bubuk Red Velvet, gula, dan es harus dibuat terlebih dahulu sebagai **Bahan baku**.

## Menjalankan

Pastikan Node.js 20 atau lebih baru sudah terpasang, kemudian jalankan:

```bash
npm install
npm run dev
```

Frontend tersedia di `http://localhost:5173`. Saat mode pengembangan, permintaan `/api` dan `/health` diteruskan ke backend di `http://localhost:8080`.

## Pemeriksaan

```bash
npm run build
npm run lint
```

Proyek menggunakan integrasi Tailwind melalui plugin Vite. Tidak diperlukan `postcss.config.js`, `autoprefixer`, atau paket font tambahan.

## Pengujian otomatis

Pemeriksaan struktur route, menu utama, lint, TypeScript, dan production build:

```bash
npm run test:production
```

Pengujian alur bisnis Kafe & Restoran yang menyimpan data permanen dan memverifikasinya langsung pada PostgreSQL berada pada paket backend, melalui `run-qa-cafe.bat`. Pemeriksaan frontend memastikan route dan navigasi sembilan modul tersedia sebelum lint serta production build dijalankan.

## Perbaikan tampilan Kasir pada zoom 100%

Versi ini menyesuaikan halaman Kasir untuk layar laptop 1366x768 dan ukuran lain tanpa bergantung pada zoom browser:

- Sidebar desktop memakai lebar adaptif 236px dan 252px pada layar sangat lebar.
- Menu sidebar menjadi lebih ringkas ketika tinggi layar maksimal 760px, sehingga seluruh menu tetap dapat dijangkau tanpa scrollbar yang mengganggu.
- Panel keranjang memakai lebar 360px pada desktop standar dan 400px pada layar sangat lebar.
- Area isi keranjang dapat menyusut dan menggulir secara mandiri, sedangkan ringkasan serta tombol pembayaran selalu terlihat.
- Grid produk menyesuaikan lebar area yang tersedia, bukan hanya breakpoint lebar layar.
- Nama produk panjang dibungkus dengan aman dan tidak keluar dari kartu.

Jalankan pemeriksaan berikut sebelum produksi:

```bash
npm run test:production
```
