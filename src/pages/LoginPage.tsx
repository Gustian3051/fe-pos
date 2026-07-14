import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Store,
  WifiOff,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../lib/api";

export function LoginPage() {
  const { login, bootstrap } = useAuth();
  const [mode, setMode] = useState<"login" | "bootstrap">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "",
    full_name: "",
    password: "",
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "bootstrap") await bootstrap(form);
      else await login(form);
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
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-brand-700 shadow-lg">
            <Store size={23} />
          </span>
          WarungKasir
        </div>
        <div className="relative z-10 max-w-2xl">
          <p className="mb-4 text-xs font-extrabold tracking-[.18em] text-emerald-200">
            PENGELOLAAN TOKO DALAM SATU TEMPAT
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
            toko sembako dengan alur yang sederhana.
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
            <Boxes size={16} /> Satuan barang lengkap
          </span>
        </div>
        <small className="relative z-10 text-xs text-emerald-100/60">
          © 2026 WarungKasir · Dibangun untuk toko Indonesia
        </small>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-gradient-to-br from-white to-brand-50/50 p-6 sm:p-10">
        <form className="w-full max-w-md" onSubmit={submit}>
          <div className="mb-10 flex items-center gap-3 text-xl font-extrabold text-brand-700 lg:hidden">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-700 text-white">
              <Store size={22} />
            </span>
            WarungKasir
          </div>
          <p className="mb-3 text-xs font-extrabold tracking-[.16em] text-brand-600">
            {mode === "login" ? "SELAMAT DATANG KEMBALI" : "PENGATURAN AWAL"}
          </p>
          <h2 className="text-3xl font-extrabold tracking-[-.035em] text-slate-900">
            {mode === "login" ? "Masuk ke akun Anda" : "Buat akun pemilik"}
          </h2>
          <p className="mb-8 mt-3 text-sm leading-6 text-slate-500">
            {mode === "login"
              ? "Masukkan nama pengguna dan kata sandi untuk melanjutkan."
              : "Langkah ini hanya dilakukan sekali saat toko mulai menggunakan WarungKasir."}
          </p>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {mode === "bootstrap" && (
            <label className="mb-5 block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Nama lengkap
              </span>
              <input
                className={fieldClass}
                value={form.full_name}
                onChange={(event) =>
                  setForm({ ...form, full_name: event.target.value })
                }
                placeholder="Nama pemilik toko"
                required
              />
            </label>
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
                  mode === "bootstrap"
                    ? "Minimal 12 karakter"
                    : "Masukkan kata sandi"
                }
                autoComplete="current-password"
                required
                minLength={mode === "bootstrap" ? 12 : 8}
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
                ? "Masuk ke WarungKasir"
                : "Buat akun & masuk"}
            {!loading && <ArrowRight size={18} />}
          </button>
          <button
            className="mx-auto mt-5 block text-sm font-bold text-brand-700 hover:text-brand-900"
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "bootstrap" : "login");
              setError("");
            }}
          >
            {mode === "login"
              ? "Baru pertama kali menggunakan WarungKasir?"
              : "Sudah memiliki akun? Kembali ke halaman masuk"}
          </button>
        </form>
      </section>
    </main>
  );
}
