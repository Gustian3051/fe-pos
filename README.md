# WarungKasir Frontend

Frontend POS berbasis React, TypeScript, Vite, dan Tailwind CSS untuk toko sembako, kafe/restoran, apotek, dan toko bangunan.

Pemilik toko memiliki akses khusus untuk menghapus produk/karyawan yang belum memiliki riwayat, membuat akun karyawan melalui Administrasi, menghubungkannya dari menu Karyawan & Gaji, serta mengelola pembayaran gaji bulanan, harian, dan per jam. Kode karyawan dibuat otomatis oleh backend dan tidak dapat diubah manual. Katalog menyesuaikan profil usaha, menampilkan harga pokok rata-rata tertimbang, serta menyediakan penyusun resep dan perhitungan harga pokok menu otomatis.

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
