# WarungKasir Frontend

Frontend POS berbasis React, TypeScript, Vite, dan Tailwind CSS untuk toko sembako, kafe/restoran, apotek, dan toko bangunan.

Pemilik toko memiliki akses khusus untuk menghapus produk/karyawan yang belum memiliki riwayat, menghubungkan akun administrasi dengan karyawan, dan mengelola pembayaran gaji bulanan. Katalog menyesuaikan profil usaha, menampilkan HPP rata-rata tertimbang, serta menyediakan penyusun resep dan HPP menu otomatis.

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
