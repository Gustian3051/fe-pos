import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { classNames } from "../lib/format";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </header>
  );
}

export function Card({
  children,
  className,
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section className={classNames("card", className)}>
      {(title || action) && (
        <div className="card-header">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Button({
  children,
  variant = "primary",
  loading,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={classNames("button", `button-${variant}`, className)}
    >
      {loading ? <LoaderCircle size={17} className="spin" /> : children}
    </button>
  );
}

export function Input({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
}) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <input {...props} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Select({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <select {...props}>{children}</select>
    </label>
  );
}

export function Textarea({
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <textarea {...props} />
    </label>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Cari data...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-input">
      <Search size={18} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Modal({
  open,
  title,
  children,
  onClose,
  wide,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={classNames("modal", wide && "modal-wide")}>
        <div className="modal-title">
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Tutup">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({
  title = "Belum ada data",
  description = "Data akan tampil di sini setelah ditambahkan.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">◎</div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="loading-state">
      <LoaderCircle className="spin" /> Memuat data...
    </div>
  );
}

export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-state">
      <AlertCircle />
      <span>{message}</span>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Coba lagi
        </Button>
      )}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{
    message: string;
    error?: boolean;
  } | null>(null);
  const show = useCallback((message: string, error = false) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3500);
  }, []);
  const node = useMemo(
    () =>
      toast ? (
        <div className={classNames("toast", toast.error && "toast-error")}>
          {toast.error ? <AlertCircle /> : <CheckCircle2 />}
          {toast.message}
        </div>
      ) : null,
    [toast],
  );
  return { show, node };
}

export function Form({
  children,
  onSubmit,
  className,
}: {
  children: ReactNode;
  onSubmit: () => Promise<void> | void;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await onSubmit();
    } finally {
      setLoading(false);
    }
  };
  return (
    <form className={className} onSubmit={submit}>
      {children}
      <span hidden data-form-loading={loading} />
    </form>
  );
}
