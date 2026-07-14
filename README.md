# WarungKasir Frontend

Frontend POS berbasis React, TypeScript, Vite, dan Tailwind CSS.

Pemilik toko memiliki akses khusus untuk menghapus produk baru yang belum memiliki riwayat serta mengelola data karyawan dan pembayaran gaji bulanan.

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
