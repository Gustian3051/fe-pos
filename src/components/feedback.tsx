/* oxlint-disable react/only-export-components */
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { classNames } from "../lib/format";

type NoticeTone = "success" | "error" | "warning" | "info";

type Notice = {
  id: number;
  message: string;
  tone: NoticeTone;
};

export type AlertOptions = {
  title?: string;
  message: string;
  buttonLabel?: string;
  tone?: NoticeTone;
};

type PendingAlert = AlertOptions & {
  resolve: () => void;
};

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
};

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type FeedbackContextValue = {
  notify: (message: string, tone?: NoticeTone) => void;
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const noticeStyles: Record<NoticeTone, string> = {
  success: "border-emerald-200 bg-emerald-950 text-white",
  error: "border-red-200 bg-red-800 text-white",
  warning: "border-amber-200 bg-amber-600 text-white",
  info: "border-blue-200 bg-blue-700 text-white",
};

function NoticeIcon({ tone }: { tone: NoticeTone }) {
  if (tone === "success") return <CheckCircle2 className="h-5 w-5 shrink-0" />;
  if (tone === "error") return <XCircle className="h-5 w-5 shrink-0" />;
  if (tone === "warning") return <AlertTriangle className="h-5 w-5 shrink-0" />;
  return <Info className="h-5 w-5 shrink-0" />;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null,
  );
  const [pendingAlert, setPendingAlert] = useState<PendingAlert | null>(null);
  const noticeID = useRef(0);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const alertButtonRef = useRef<HTMLButtonElement>(null);

  const dismiss = useCallback((id: number) => {
    setNotices((items) => items.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: NoticeTone = "success") => {
      const id = ++noticeID.current;
      setNotices((items) => [...items.slice(-3), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 6500 : 4200);
    },
    [dismiss],
  );

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const normalized: ConfirmOptions =
      typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      setPendingConfirm({
        title: normalized.title || "Konfirmasi tindakan",
        confirmLabel: normalized.confirmLabel || "Lanjutkan",
        cancelLabel: normalized.cancelLabel || "Batal",
        tone: normalized.tone || "primary",
        message: normalized.message,
        resolve,
      });
    });
  }, []);

  const closeConfirm = useCallback((answer: boolean) => {
    setPendingConfirm((current) => {
      current?.resolve(answer);
      return null;
    });
  }, []);

  const alert = useCallback((options: AlertOptions | string) => {
    const normalized: AlertOptions =
      typeof options === "string" ? { message: options } : options;
    return new Promise<void>((resolve) => {
      setPendingAlert({
        title: normalized.title || "Pemberitahuan",
        buttonLabel: normalized.buttonLabel || "Mengerti",
        tone: normalized.tone || "info",
        message: normalized.message,
        resolve,
      });
    });
  }, []);

  const closeAlert = useCallback(() => {
    setPendingAlert((current) => {
      current?.resolve();
      return null;
    });
  }, []);

  useEffect(() => {
    if (!pendingConfirm && !pendingAlert) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => {
      if (pendingConfirm) confirmButtonRef.current?.focus();
      else alertButtonRef.current?.focus();
    }, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (pendingConfirm) closeConfirm(false);
        else closeAlert();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeAlert, closeConfirm, pendingAlert, pendingConfirm]);

  const value = useMemo(
    () => ({ notify, confirm, alert }),
    [alert, confirm, notify],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-3 top-3 z-[120] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:top-5 sm:w-[min(420px,calc(100vw-40px))]"
        aria-live="polite"
        aria-atomic="false"
      >
        {notices.map((notice) => (
          <div
            key={notice.id}
            role={notice.tone === "error" ? "alert" : "status"}
            className={classNames(
              "pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-2xl",
              noticeStyles[notice.tone],
            )}
          >
            <NoticeIcon tone={notice.tone} />
            <span className="min-w-0 flex-1 leading-5">{notice.message}</span>
            <button
              type="button"
              className="rounded-md p-0.5 text-white/80 hover:bg-white/10 hover:text-white"
              onClick={() => dismiss(notice.id)}
              aria-label="Tutup pemberitahuan"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {pendingConfirm && (
        <div
          className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeConfirm(false);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start gap-3 px-5 pb-4 pt-5">
              <span
                className={classNames(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                  pendingConfirm.tone === "danger"
                    ? "bg-red-50 text-red-700"
                    : "bg-brand-50 text-brand-700",
                )}
              >
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2
                  id="confirm-dialog-title"
                  className="text-base font-bold text-slate-950"
                >
                  {pendingConfirm.title}
                </h2>
                <p
                  id="confirm-dialog-message"
                  className="mt-1.5 text-sm leading-6 text-slate-600"
                >
                  {pendingConfirm.message}
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-100"
                onClick={() => closeConfirm(false)}
              >
                {pendingConfirm.cancelLabel}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                className={classNames(
                  "inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-sm font-bold text-white shadow-sm",
                  pendingConfirm.tone === "danger"
                    ? "bg-red-700 hover:bg-red-800"
                    : "bg-brand-700 hover:bg-brand-800",
                )}
                onClick={() => closeConfirm(true)}
              >
                {pendingConfirm.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}


      {pendingAlert && (
        <div
          className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAlert();
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-message"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start gap-3 px-5 pb-4 pt-5">
              <span
                className={classNames(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                  pendingAlert.tone === "error"
                    ? "bg-red-50 text-red-700"
                    : pendingAlert.tone === "warning"
                      ? "bg-amber-50 text-amber-700"
                      : pendingAlert.tone === "success"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-blue-50 text-blue-700",
                )}
              >
                <NoticeIcon tone={pendingAlert.tone || "info"} />
              </span>
              <div className="min-w-0 flex-1">
                <h2
                  id="alert-dialog-title"
                  className="text-base font-bold text-slate-950"
                >
                  {pendingAlert.title}
                </h2>
                <p
                  id="alert-dialog-message"
                  className="mt-1.5 text-sm leading-6 text-slate-600"
                >
                  {pendingAlert.message}
                </p>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
              <button
                ref={alertButtonRef}
                type="button"
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-brand-700 px-4 text-sm font-bold text-white shadow-sm hover:bg-brand-800"
                onClick={closeAlert}
              >
                {pendingAlert.buttonLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context)
    throw new Error("useFeedback harus digunakan di dalam FeedbackProvider");
  return context;
}

export function useConfirm() {
  return useFeedback().confirm;
}

export function useAlert() {
  return useFeedback().alert;
}
