export type BusinessType =
  | "grocery"
  | "cafe_restaurant"
  | "pharmacy"
  | "building_materials"
  | "furniture"
  | "workshop_spareparts";

export interface BusinessProfile {
  value: BusinessType;
  label: string;
  description: string;
  defaultProductKind: string;
  productKinds: [string, string][];
  skuExample: string;
  barcodeHint: string;
  productNamePlaceholder: string;
  brandPlaceholder: string;
  minimumStockHint: string;
  kindHelp: Record<string, { title: string; description: string }>;
  unitFlowDescription: string;
  priceSectionDescription: string;
  unitExampleTitle: string;
  unitExamples: string[];
  unitBarcodePlaceholder: string;
  conversionHint: string;
  batchHint: string;
}

const composableKinds: [string, string][] = [
  ["stock", "Produk siap jual — tanpa bahan"],
  ["menu", "Produk racikan — wajib memiliki bahan"],
  ["ingredient", "Bahan baku — untuk produk racikan"],
  ["service", "Jasa — tanpa stok dan bahan"],
];

export const businessProfiles: Record<BusinessType, BusinessProfile> = {
  grocery: {
    value: "grocery",
    label: "Toko sembako",
    description: "Barang kebutuhan harian, makanan, minuman, rokok, dan produk rumah tangga.",
    defaultProductKind: "stock",
    productKinds: composableKinds,
    skuExample: "Contoh: BERAS-5KG atau SURYA-12",
    barcodeHint: "Isi barcode kemasan terkecil. Barcode dus, pak, atau slop dapat ditambahkan pada bagian satuan jual.",
    productNamePlaceholder: "Contoh: Beras Premium 5 kg",
    brandPlaceholder: "Contoh: Nusantara",
    minimumStockHint: "Dihitung dalam satuan terkecil. Contoh: 24 botol atau 12 bungkus.",
    kindHelp: {
      stock: { title: "Produk siap jual", description: "Contoh beras, air mineral, sabun, atau rokok. Stok produk langsung berkurang saat dijual." },
      menu: { title: "Produk racikan", description: "Gunakan bila toko juga menjual produk olahan yang dibuat dari beberapa bahan." },
      ingredient: { title: "Bahan baku", description: "Bahan yang digunakan untuk membuat produk racikan, misalnya gula, susu, atau es." },
      service: { title: "Jasa", description: "Layanan tanpa stok, misalnya ongkos antar atau biaya layanan." },
    },
    unitFlowDescription: "Mulai dari satuan terkecil. Contoh rokok: batang, lalu bungkus dan slop. Contoh minuman: botol, lalu dus.",
    priceSectionDescription: "Masukkan seluruh satuan yang benar-benar dijual. Harga beli pada satuan besar akan dihitung menjadi harga pokok satuan terkecil.",
    unitExampleTitle: "Contoh sembako",
    unitExamples: ["Batang = isi 1", "Bungkus = isi 12 batang", "Slop = isi 120 batang"],
    unitBarcodePlaceholder: "Barcode bungkus, dus, slop, atau bal",
    conversionHint: "Contoh: dus 24 botol atau slop 120 batang.",
    batchHint: "Aktifkan untuk produk yang perlu dicatat nomor batch atau tanggal kedaluwarsanya.",
  },
  cafe_restaurant: {
    value: "cafe_restaurant",
    label: "Kafe & restoran",
    description: "Menu makanan, minuman, bahan baku, topping, dan kemasan.",
    defaultProductKind: "menu",
    productKinds: composableKinds,
    skuExample: "Contoh: NASGOR-ORI atau REDVELVET-M",
    barcodeHint: "Barcode biasanya dipakai untuk minuman kemasan atau bahan baku siap beli; menu racikan boleh tanpa barcode.",
    productNamePlaceholder: "Contoh: Nasi Goreng Spesial",
    brandPlaceholder: "Opsional untuk menu; isi merek pemasok untuk produk kemasan",
    minimumStockHint: "Untuk menu racikan, stok mengikuti bahan. Untuk produk siap jual, isi batas stok satuan terkecil.",
    kindHelp: {
      stock: { title: "Produk siap jual", description: "Contoh air mineral atau minuman kaleng yang dijual tanpa proses produksi." },
      menu: { title: "Menu racikan", description: "Contoh Red Velvet atau nasi goreng. Wajib memiliki satu atau lebih bahan." },
      ingredient: { title: "Bahan baku", description: "Contoh beras, ayam, susu, gula, bubuk minuman, atau es." },
      service: { title: "Jasa", description: "Contoh biaya tambahan, sewa tempat, atau layanan khusus tanpa stok." },
    },
    unitFlowDescription: "Pilih porsi, gelas, atau pcs sebagai satuan menu. Bahan baku dapat memakai gram, kilogram, mililiter, atau liter.",
    priceSectionDescription: "Harga menu biasanya per porsi atau gelas. Produk kemasan tetap dapat memiliki harga per botol dan per dus.",
    unitExampleTitle: "Contoh kafe",
    unitExamples: ["Porsi = isi 1", "Gelas = isi 1", "Dus minuman = isi 24 botol"],
    unitBarcodePlaceholder: "Barcode botol, kemasan, atau dus",
    conversionHint: "Contoh: dus 24 botol. Menu per porsi tetap bernilai 1.",
    batchHint: "Aktifkan untuk bahan atau minuman kemasan yang perlu dicatat kedaluwarsanya.",
  },
  pharmacy: {
    value: "pharmacy",
    label: "Apotek",
    description: "Obat, vitamin, alat kesehatan, produk ibu-anak, dan perawatan tubuh.",
    defaultProductKind: "medicine",
    productKinds: [["medicine", "Obat jadi — dengan data izin edar dan dosis"], ...composableKinds],
    skuExample: "Contoh: PARA-500-TAB atau VITC-STRIP",
    barcodeHint: "Isi barcode unit terkecil yang dijual. Barcode strip, botol, atau dus dapat dibedakan.",
    productNamePlaceholder: "Contoh: Paracetamol 500 mg",
    brandPlaceholder: "Contoh: Generik atau nama produsen",
    minimumStockHint: "Dihitung dalam tablet, kapsul, strip, botol, atau satuan terkecil lainnya.",
    kindHelp: {
      medicine: { title: "Obat jadi", description: "Gunakan untuk obat yang memerlukan data izin edar, dosis, dan penanda resep dokter." },
      stock: { title: "Produk kesehatan siap jual", description: "Contoh masker, termometer, popok, atau produk perawatan tubuh." },
      menu: { title: "Produk racikan", description: "Gunakan hanya untuk racikan yang stok bahannya perlu dikurangi otomatis." },
      ingredient: { title: "Bahan racikan", description: "Bahan yang digunakan dalam produk racikan apotek." },
      service: { title: "Jasa", description: "Contoh biaya pemeriksaan sederhana atau layanan tanpa stok." },
    },
    unitFlowDescription: "Pilih tablet, kapsul, mililiter, atau pcs sebagai satuan terkecil, lalu tambahkan strip, botol, blister, atau dus.",
    priceSectionDescription: "Pastikan harga per tablet, strip, botol, dan dus tidak tertukar. Setiap kemasan dapat memiliki barcode sendiri.",
    unitExampleTitle: "Contoh apotek",
    unitExamples: ["Tablet = isi 1", "Strip = isi 10 tablet", "Dus = isi 10 strip"],
    unitBarcodePlaceholder: "Barcode strip, botol, blister, atau dus",
    conversionHint: "Contoh: strip 10 tablet atau dus 100 tablet.",
    batchHint: "Disarankan aktif untuk obat agar nomor batch dan tanggal kedaluwarsa dapat ditelusuri.",
  },
  building_materials: {
    value: "building_materials",
    label: "Toko bangunan",
    description: "Semen, besi, cat, kayu, plumbing, listrik, keramik, dan perkakas.",
    defaultProductKind: "material",
    productKinds: [["material", "Material bangunan — dengan spesifikasi dan ukuran"], ...composableKinds],
    skuExample: "Contoh: SEMEN-50KG atau BESI-10MM",
    barcodeHint: "Produk seperti semen atau cat dapat memakai barcode kemasan; material potongan boleh tanpa barcode.",
    productNamePlaceholder: "Contoh: Besi Beton 10 mm x 12 m",
    brandPlaceholder: "Contoh: Maju Beton",
    minimumStockHint: "Dihitung dalam sak, batang, lembar, meter, liter, atau satuan terkecil yang dipilih.",
    kindHelp: {
      material: { title: "Material bangunan", description: "Gunakan untuk semen, besi, cat, kayu, pipa, keramik, dan material siap jual." },
      stock: { title: "Barang siap jual", description: "Cocok untuk perkakas atau aksesori yang tidak memerlukan data spesifikasi material." },
      menu: { title: "Produk rakitan", description: "Gunakan bila produk dibuat dari beberapa bahan yang stoknya harus berkurang." },
      ingredient: { title: "Bahan produksi", description: "Bahan yang digunakan untuk produk rakitan." },
      service: { title: "Jasa", description: "Contoh jasa potong, antar, atau pemasangan." },
    },
    unitFlowDescription: "Gunakan satuan terkecil sesuai cara stok disimpan: pcs, batang, lembar, meter, kilogram, atau liter.",
    priceSectionDescription: "Material dapat dijual per batang, meter, lembar, sak, atau dus. Isi konversi sesuai ukuran sebenarnya.",
    unitExampleTitle: "Contoh bangunan",
    unitExamples: ["Meter = isi 1", "Batang = isi 12 meter", "Dus keramik = isi 4 lembar"],
    unitBarcodePlaceholder: "Barcode sak, batang, kaleng, atau dus",
    conversionHint: "Contoh: satu batang pipa berisi 4 meter atau satu dus berisi 4 lembar.",
    batchHint: "Aktifkan bila perlu melacak lot produksi, warna cat, atau masa simpan bahan tertentu.",
  },
  furniture: {
    value: "furniture",
    label: "Toko mebel",
    description: "Kursi, meja, lemari, tempat tidur, sofa, rak, bahan, dan jasa perakitan.",
    defaultProductKind: "material",
    productKinds: [["material", "Produk mebel — dengan bahan dan ukuran"], ...composableKinds],
    skuExample: "Contoh: KURSI-JATI-01 atau LEMARI-3P",
    barcodeHint: "Produk mebel dapat memakai kode internal bila tidak memiliki barcode pabrik.",
    productNamePlaceholder: "Contoh: Lemari Jati 3 Pintu",
    brandPlaceholder: "Contoh: Mebel Sejahtera",
    minimumStockHint: "Dihitung per pcs, unit, set, lembar, atau satuan terkecil yang dipilih.",
    kindHelp: {
      material: { title: "Produk mebel", description: "Gunakan untuk kursi, meja, lemari, sofa, atau bahan mebel dengan ukuran dan material tertentu." },
      stock: { title: "Barang siap jual", description: "Cocok untuk aksesori atau produk jadi sederhana." },
      menu: { title: "Produk rakitan", description: "Gunakan bila satu produk dibuat dari beberapa bahan yang stoknya dikurangi otomatis." },
      ingredient: { title: "Bahan mebel", description: "Contoh papan, kain, busa, engsel, atau aksesori produksi." },
      service: { title: "Jasa", description: "Contoh perakitan, reparasi, pengiriman, atau pemasangan." },
    },
    unitFlowDescription: "Produk jadi biasanya memakai unit, pcs, atau set. Bahan dapat memakai lembar, meter, rol, atau dus.",
    priceSectionDescription: "Pisahkan harga produk per unit/set dan bahan per lembar/meter agar stok dan harga pokok tetap akurat.",
    unitExampleTitle: "Contoh mebel",
    unitExamples: ["Unit = isi 1", "Set kursi = isi 4 unit", "Rol kain = isi 20 meter"],
    unitBarcodePlaceholder: "Kode internal unit, set, lembar, atau rol",
    conversionHint: "Contoh: satu set berisi 4 kursi atau satu rol berisi 20 meter kain.",
    batchHint: "Aktifkan bila perlu membedakan lot warna, bahan, atau produksi.",
  },
  workshop_spareparts: {
    value: "workshop_spareparts",
    label: "Bengkel & sparepart",
    description: "Suku cadang, oli, ban, aksesori kendaraan, perkakas, dan jasa bengkel.",
    defaultProductKind: "stock",
    productKinds: composableKinds,
    skuExample: "Contoh: OLI-10W40-1L atau BUSI-MTR-01",
    barcodeHint: "Gunakan barcode pabrik atau kode part. Jasa bengkel tidak memerlukan barcode.",
    productNamePlaceholder: "Contoh: Oli Mesin 10W-40 1 Liter",
    brandPlaceholder: "Contoh: MotorPro",
    minimumStockHint: "Dihitung per pcs, set, pasang, botol, liter, atau satuan terkecil lainnya.",
    kindHelp: {
      stock: { title: "Sparepart siap jual", description: "Contoh busi, kampas rem, oli, aki, ban, atau aksesori kendaraan." },
      menu: { title: "Paket rakitan", description: "Gunakan bila satu paket terdiri dari beberapa barang yang stoknya harus berkurang." },
      ingredient: { title: "Bahan habis pakai", description: "Contoh grease, cairan pembersih, kabel, atau bahan yang dipakai pada paket layanan." },
      service: { title: "Jasa bengkel", description: "Contoh ganti oli, servis ringan, spooring, tambal ban, atau pemasangan sparepart." },
    },
    unitFlowDescription: "Sparepart umumnya per pcs, unit, set, atau pasang. Oli dapat dijual per botol atau liter.",
    priceSectionDescription: "Pisahkan harga barang dan jasa. Kode part, kompatibilitas kendaraan, dan satuan kemasan harus dicatat jelas.",
    unitExampleTitle: "Contoh bengkel",
    unitExamples: ["Pcs = isi 1", "Set kampas = isi 2 pcs", "Dus busi = isi 10 pcs"],
    unitBarcodePlaceholder: "Barcode atau kode part pcs, set, botol, atau dus",
    conversionHint: "Contoh: satu set berisi 2 pcs atau satu dus berisi 10 pcs.",
    batchHint: "Aktifkan untuk oli, aki, ban, atau barang yang perlu ditelusuri nomor lotnya.",
  },
};

export const businessTypeOptions = Object.values(businessProfiles).map((profile) => ({
  value: profile.value,
  label: profile.label,
  description: profile.description,
}));

export const getBusinessProfile = (value?: string): BusinessProfile =>
  businessProfiles[(value as BusinessType) || "grocery"] || businessProfiles.grocery;
