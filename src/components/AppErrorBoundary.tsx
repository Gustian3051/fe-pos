import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the technical detail in the developer console while users receive
    // a short, actionable message on screen.
    console.error("Aplikasi gagal menampilkan halaman", error, info);
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
        <section className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-center shadow-xl">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-red-700">
            <AlertTriangle className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold text-slate-950">
            Halaman belum dapat ditampilkan
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Terjadi kendala saat membuka halaman ini. Muat ulang aplikasi. Data
            transaksi yang sudah tersimpan tidak akan dihapus.
          </p>
          <button
            type="button"
            onClick={this.reload}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 text-sm font-extrabold text-white shadow-lg shadow-brand-700/20 hover:bg-brand-800"
          >
            <RefreshCw className="h-4 w-4" /> Muat ulang aplikasi
          </button>
        </section>
      </main>
    );
  }
}
