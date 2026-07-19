import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  WifiOff,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import kitaPosLogo from "../assets/kita-pos-logo.png";
import { ApiError } from "../lib/api";
import { businessTypeOptions, getBusinessProfile } from "../lib/business";

export function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    store_name: "",
    business_type: "grocery",
    username: "",
    full_name: "",
    password: "",
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "register") {
        if (!form.store_name.trim()) {
          setError("Nama toko wajib diisi.");
          return;
        }
        if (!form.business_type) {
          setError("Jenis usaha wajib dipilih.");
          return;
        }
        await register(form);
      } else {
        await login({
          username: form.username.trim(),
          password: form.password,
        });
      }
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Layanan belum dapat dihubungi. Pastikan aplikasi utama sedang berjalan.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100";

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-gradient-to-br from-brand-950 via-brand-800 to-brand-700 p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full border border-white/10 shadow-[0_0_0_70px_rgba(255,255,255,.025),0_0_0_140px_rgba(255,255,255,.018)]" />
        <div className="absolute -bottom-44 -left-32 h-96 w-96 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative z-10 flex items-center gap-3 text-xl font-extrabold">
          <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-white/10">
            <img
              src={kitaPosLogo}
              alt="Logo Kita POS"
              className="h-full w-full object-contain"
            />
          </span>
          Kita POS
        </div>
        <div className="relative z-10 max-w-2xl">
          <p className="mb-4 text-xs font-extrabold tracking-[.18em] text-emerald-200">
            PENGELOLAAN USAHA DALAM SATU TEMPAT
          </p>
          <h1 className="text-5xl font-extrabold leading-[1.06] tracking-[-.045em] xl:text-7xl">
            Kasir cepat.
            <br />
            Stok akurat.
            <br />
            <span className="text-emerald-200">Usaha bertumbuh.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-8 text-emerald-50/80">
            Kelola penjualan, persediaan, pembelian, utang-piutang, dan laporan
            usaha dengan alur yang sederhana untuk berbagai jenis bisnis.
          </p>
        </div>
        <div className="relative z-10 flex flex-wrap gap-3 text-xs font-semibold text-emerald-50/90">
          <span className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5">
            <CheckCircle2 size={16} /> Pencatatan otomatis
          </span>
          <span className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5">
            <WifiOff size={16} /> Tetap aman saat koneksi terganggu
          </span>
          <span className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5">
            <Boxes size={16} /> Cocok untuk banyak jenis usaha
          </span>
        </div>
        <small className="relative z-10 text-xs text-emerald-100/60">
          © 2026 Kita POS · Dibangun untuk toko dan usaha di Indonesia
        </small>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-gradient-to-br from-white to-brand-50/50 p-6 sm:p-10">
        <form className="w-full max-w-md" onSubmit={submit}>
          <div className="mb-10 flex items-center gap-3 text-xl font-extrabold text-brand-700 lg:hidden">
            <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-white p-1.5 shadow-md ring-1 ring-brand-100">
              <img
                src={kitaPosLogo}
                alt="Logo Kita POS"
                className="h-full w-full object-contain"
              />
            </span>
            Kita POS
          </div>
          <p className="mb-3 text-xs font-extrabold tracking-[.16em] text-brand-600">
            {mode === "login" ? "SELAMAT DATANG KEMBALI" : "DAFTARKAN USAHA"}
          </p>
          <h2 className="text-3xl font-extrabold tracking-[-.035em] text-slate-900">
            {mode === "login" ? "Masuk ke akun Anda" : "Buat usaha dan akun pemilik"}
          </h2>
          <p className="mb-8 mt-3 text-sm leading-6 text-slate-500">
            {mode === "login"
              ? "Masukkan nama pengguna dan kata sandi untuk melanjutkan ke Kita POS."
              : "Pilih jenis usaha agar kategori, satuan, dan panduan input produk langsung menyesuaikan kebutuhan usaha Anda."}
          </p>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {mode === "register" && (
            <>
              <label className="mb-5 block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Nama usaha / toko
                </span>
                <input
                  className={fieldClass}
                  value={form.store_name}
                  onChange={(event) =>
                    setForm({ ...form, store_name: event.target.value })
                  }
                  placeholder="Contoh: Toko Sumber Rezeki"
                  autoComplete="organization"
                  required
                  minLength={2}
                  maxLength={150}
                />
              </label>
              <label className="mb-5 block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Jenis usaha
                </span>
                <select
                  className={fieldClass}
                  value={form.business_type}
                  onChange={(event) =>
                    setForm({ ...form, business_type: event.target.value })
                  }
                  required
                >
                  {businessTypeOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <small className="mt-2 block text-xs leading-5 text-slate-500">
                  {getBusinessProfile(form.business_type).description} Sistem hanya menyiapkan kategori dan satuan awal; produk serta transaksi tetap kosong.
                </small>
              </label>
              <label className="mb-5 block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Nama lengkap pemilik
                </span>
                <input
                  className={fieldClass}
                  value={form.full_name}
                  onChange={(event) =>
                    setForm({ ...form, full_name: event.target.value })
                  }
                  placeholder="Nama pemilik usaha"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={150}
                />
              </label>
            </>
          )}
          <label className="mb-5 block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Nama pengguna
            </span>
            <input
              className={fieldClass}
              value={form.username}
              onChange={(event) =>
                setForm({ ...form, username: event.target.value })
              }
              placeholder="Masukkan nama pengguna"
              autoComplete="username"
              required
              minLength={mode === "register" ? 3 : undefined}
              maxLength={80}
            />
          </label>
          <label className="mb-5 block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Kata sandi
            </span>
            <div className="flex items-center rounded-xl border border-slate-200 bg-white transition focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-100">
              <LockKeyhole className="ml-4 text-slate-400" size={18} />
              <input
                className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-slate-400"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) =>
                  setForm({ ...form, password: event.target.value })
                }
                placeholder={
                  mode === "register"
                    ? "Minimal 12 karakter"
                    : "Masukkan kata sandi"
                }
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                required
                minLength={mode === "register" ? 12 : 8}
                maxLength={mode === "register" ? 128 : undefined}
              />
              <button
                className="px-4 text-slate-400 hover:text-brand-700"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={
                  showPassword
                    ? "Sembunyikan kata sandi"
                    : "Tampilkan kata sandi"
                }
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <button
            className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 text-sm font-extrabold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Mohon tunggu..."
              : mode === "login"
                ? "Masuk ke Kita POS"
                : "Daftarkan usaha & masuk"}
            {!loading && <ArrowRight size={18} />}
          </button>
          <button
            className="mx-auto mt-5 block text-sm font-bold text-brand-700 hover:text-brand-900"
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login"
              ? "Belum memiliki akun? Daftarkan usaha"
              : "Sudah memiliki akun? Kembali ke halaman masuk"}
          </button>
        </form>
      </section>
    </main>
  );
}
