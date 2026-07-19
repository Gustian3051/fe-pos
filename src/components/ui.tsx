/* oxlint-disable react/only-export-components */
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { classNames } from "../lib/format";
import { useFeedback } from "./feedback";

const fieldClass =
  "flex w-full min-w-0 flex-col gap-1.5 text-xs text-slate-700 [&>span]:min-h-4 [&>span]:font-bold [&>span]:leading-4 [&_input]:min-h-[42px] [&_select]:min-h-[42px] [&_textarea]:min-h-[84px] [&_input]:w-full [&_select]:w-full [&_textarea]:w-full [&_input]:min-w-0 [&_select]:min-w-0 [&_textarea]:min-w-0 [&_input]:rounded-[9px] [&_select]:rounded-[9px] [&_textarea]:rounded-[9px] [&_input]:border [&_select]:border [&_textarea]:border [&_input]:border-[#d6e0da] [&_select]:border-[#d6e0da] [&_textarea]:border-[#d6e0da] [&_input]:bg-white [&_select]:bg-white [&_textarea]:bg-white [&_input]:px-3 [&_select]:px-3 [&_textarea]:px-3 [&_input]:py-2.5 [&_select]:py-2.5 [&_textarea]:py-2.5 [&_input]:text-slate-900 [&_select]:text-slate-900 [&_textarea]:text-slate-900 [&_input]:outline-none [&_select]:outline-none [&_textarea]:outline-none [&_input:focus]:border-brand-700 [&_select:focus]:border-brand-700 [&_textarea:focus]:border-brand-700 [&_input:focus]:ring-4 [&_select:focus]:ring-4 [&_textarea:focus]:ring-4 [&_input:focus]:ring-brand-700/10 [&_select:focus]:ring-brand-700/10 [&_textarea:focus]:ring-brand-700/10 [&_input:disabled]:cursor-not-allowed [&_select:disabled]:cursor-not-allowed [&_textarea:disabled]:cursor-not-allowed [&_input:disabled]:bg-slate-100 [&_select:disabled]:bg-slate-100 [&_textarea:disabled]:bg-slate-100 [&_input:disabled]:text-slate-500 [&_select:disabled]:text-slate-500 [&_textarea:disabled]:text-slate-500 [&_input::placeholder]:text-slate-400 [&_textarea::placeholder]:text-slate-400 [&_small]:text-[10px] [&_small]:leading-snug [&_small]:text-slate-500";

const buttonVariants = {
  primary:
    "border-transparent bg-brand-700 text-white shadow-[0_5px_13px_rgba(11,107,71,0.18)] hover:bg-brand-800",
  secondary:
    "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
  ghost:
    "border-transparent bg-transparent px-2.5 py-2 text-brand-700 hover:bg-brand-50",
  danger: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
};

const badgeVariants = {
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
  neutral: "bg-slate-100 text-slate-600",
};

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
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <h1 className="m-0 text-2xl font-semibold tracking-[-.035em] text-slate-950 sm:text-[27px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {action && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {action}
        </div>
      )}
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
    <section
      className={classNames(
        "rounded-[13px] border border-[#dfe7e2] bg-white p-5 shadow-[0_2px_6px_rgba(20,45,32,0.025)]",
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-[15px] font-bold text-slate-900">{title}</h2>
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
      type={props.type ?? "button"}
      disabled={props.disabled || loading}
      className={classNames(
        "button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[9px] border px-4 py-2.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-700/15 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-[17px] [&_svg]:w-[17px]",
        buttonVariants[variant],
        className,
      )}
    >
      {loading ? <LoaderCircle size={17} className="animate-spin" /> : children}
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
    <label className={classNames("field", fieldClass)}>
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
    <label className={classNames("field", fieldClass)}>
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
    <label className={classNames("field", fieldClass)}>
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
    <label className="flex h-[42px] w-full min-w-0 items-center gap-2 rounded-[9px] border border-[#d9e2dd] bg-white px-3 text-slate-500 focus-within:border-brand-700 focus-within:ring-4 focus-within:ring-brand-700/10 md:w-[400px] md:max-w-full">
      <Search size={18} />
      <input
        className="min-w-0 flex-1 border-0 bg-transparent text-xs outline-none placeholder:text-slate-400"
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
  return (
    <span
      className={classNames(
        "inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[9px] font-extrabold capitalize",
        badgeVariants[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
  wide,
  className,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [onClose, open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-[rgba(5,24,16,0.58)] p-5 backdrop-blur-[3px] max-sm:items-end max-sm:p-0"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={classNames(
          "flex max-h-[min(90dvh,900px)] w-[min(480px,100%)] flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_25px_70px_rgba(0,0,0,0.25)] max-sm:max-h-[92dvh] max-sm:w-full max-sm:rounded-t-[18px] max-sm:rounded-b-none",
          wide && "w-[min(1120px,calc(100vw-72px))] max-sm:w-full",
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex flex-none items-center justify-between border-b border-[#dfe7e2] bg-white px-6 py-4 max-sm:px-4">
          <h2
            id={titleId}
            className="m-0 text-[17px] font-semibold text-slate-900"
          >
            {title}
          </h2>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg border-0 bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-700/15"
            onClick={onClose}
            aria-label="Tutup"
          >
            <X size={19} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-6 py-5 max-sm:px-4">
          {children}
        </div>
      </div>
    </div>
  );
}


export function MetricCard({
  label,
  value,
  description,
  icon,
  tone = "green",
}: {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  icon: ReactNode;
  tone?: "green" | "blue" | "amber" | "red";
}) {
  const toneClass = {
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  }[tone];

  return (
    <article className="flex min-w-0 gap-3 rounded-[13px] border border-[#dfe7e2] bg-white p-4 shadow-[0_2px_6px_rgba(20,45,32,0.025)]">
      <span
        className={classNames(
          "grid h-11 w-11 shrink-0 place-items-center rounded-xl [&_svg]:h-5 [&_svg]:w-5",
          toneClass,
        )}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <small className="text-[10px] font-semibold leading-4 text-slate-500">
          {label}
        </small>
        <strong className="my-1 truncate text-xl font-bold tracking-tight text-slate-950">
          {value}
        </strong>
        {description && (
          <div className="text-[10px] leading-4 text-slate-500">
            {description}
          </div>
        )}
      </div>
    </article>
  );
}

export function DataTableContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={classNames(
        "w-full overflow-x-auto rounded-xl border border-slate-200",
        className,
      )}
    >
      {children}
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
    <div className="flex flex-col items-center px-5 py-14 text-center text-slate-500">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-2xl text-brand-700">
        ◎
      </div>
      <strong className="mt-3 text-sm text-slate-700">{title}</strong>
      <p className="mt-1 text-xs">{description}</p>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 p-11 text-xs text-slate-500">
      <LoaderCircle className="animate-spin" /> Memuat data...
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
    <div className="flex items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 p-10 text-xs text-red-700">
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
  const { notify } = useFeedback();
  return {
    show: (message: string, error = false) =>
      notify(message, error ? "error" : "success"),
    node: null,
  };
}

export type PageMeta = {
  page: number;
  limit: number;
  has_more: boolean;
};

export function Pagination({
  meta,
  onPageChange,
  disabled = false,
}: {
  meta: PageMeta;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (meta.page <= 1 && !meta.has_more) return null;
  return (
    <nav
      className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Navigasi halaman"
    >
      <span className="text-xs text-slate-500">
        Halaman <strong className="text-slate-800">{meta.page}</strong> ·
        Maksimal {meta.limit} data per halaman
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          disabled={disabled || meta.page <= 1}
          onClick={() => onPageChange(Math.max(1, meta.page - 1))}
        >
          <ChevronLeft /> Sebelumnya
        </Button>
        <Button
          variant="secondary"
          disabled={disabled || !meta.has_more}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Berikutnya <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: Array<{
    value: string;
    label: string;
    icon?: ReactNode;
    badge?: ReactNode;
  }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="mb-5 grid w-full grid-cols-[repeat(auto-fit,minmax(128px,1fr))] gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_2px_8px_rgba(20,45,32,0.035)]"
      role="tablist"
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={classNames(
              "inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-center text-xs font-bold leading-4 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-700/15 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
              active
                ? "border-brand-700 bg-brand-700 text-white shadow-[0_4px_12px_rgba(11,107,71,0.2)]"
                : "border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-800",
            )}
            onClick={() => onChange(item.value)}
          >
            {item.icon}
            {item.label}
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}

export function ModalActions({
  children,
  sticky = false,
}: {
  children: ReactNode;
  sticky?: boolean;
}) {
  return (
    <div
      className={classNames(
        "mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full",
        sticky &&
          "sticky bottom-0 z-10 -mx-6 px-6 pb-4 shadow-[0_-8px_20px_rgba(16,45,31,0.06)] max-sm:-mx-4 max-sm:px-4",
      )}
    >
      {children}
    </div>
  );
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
