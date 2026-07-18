import {
  Banknote,
  CreditCard,
  History,
  Plus,
  ReceiptText,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "../components/feedback";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Tabs,
  Textarea,
  useToast,
} from "../components/ui";
import {
  api,
  apiPage,
  fetchAllPages,
  json,
  requireActiveShiftID,
} from "../lib/api";
import {
  asArray,
  dateOnly,
  dateTime,
  displayLabel,
  rupiah,
} from "../lib/format";
import { useDebouncedValue } from "../lib/hooks";
import type {
  Supplier,
  SupplierDebtPayment,
  SupplierDebtSummary,
  SupplierPayable,
  SupplierReceivable,
} from "../types/api";

type DebtTab = "payables" | "receivables";
type DebtItem = SupplierPayable | SupplierReceivable;

const blankDebt = () => ({
  supplier_id: "",
  amount: 0,
  due_date: "",
  reference_number: "",
  description: "",
});

const blankPayment = () => ({
  amount: 0,
  method: "transfer",
  reference: "",
});

const blankSummary: SupplierDebtSummary = {
  payable_open: 0,
  payable_overdue: 0,
  receivable_open: 0,
  receivable_overdue: 0,
};

export function DebtsPage() {
  const [tab, setTab] = useState<DebtTab>("payables");
  const [payables, setPayables] = useState<SupplierPayable[]>([]);
  const [receivables, setReceivables] = useState<SupplierReceivable[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [summary, setSummary] = useState<SupplierDebtSummary>(blankSummary);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [status, setStatus] = useState("open");
  const [overdue, setOverdue] = useState(false);
  const [payablePage, setPayablePage] = useState(1);
  const [receivablePage, setReceivablePage] = useState(1);
  const [payableMeta, setPayableMeta] = useState({
    page: 1,
    limit: 50,
    has_more: false,
  });
  const [receivableMeta, setReceivableMeta] = useState({
    page: 1,
    limit: 50,
    has_more: false,
  });
  const [modal, setModal] = useState<"debt" | "payment" | "history" | null>(
    null,
  );
  const [selected, setSelected] = useState<DebtItem | null>(null);
  const [selectedDirection, setSelectedDirection] =
    useState<DebtTab>("payables");
  const [paymentHistory, setPaymentHistory] = useState<SupplierDebtPayment[]>(
    [],
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const [debt, setDebt] = useState(blankDebt());
  const [payment, setPayment] = useState(blankPayment());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { show, node } = useToast();
  const confirm = useConfirm();

  const load = useCallback(async () => {
    setError("");
    const statusQuery = status === "all" ? "" : status;
    const common = `status=${encodeURIComponent(statusQuery)}&overdue=${overdue}&q=${encodeURIComponent(debouncedQuery)}&limit=50`;
    try {
      const [payableResult, receivableResult, supplierValues, summaryValue] =
        await Promise.all([
          apiPage<SupplierPayable>(`/payables?${common}&page=${payablePage}`),
          apiPage<SupplierReceivable>(
            `/supplier-receivables?${common}&page=${receivablePage}`,
          ),
          fetchAllPages<Supplier>("/suppliers?q=", {
            pageSize: 100,
            maxItems: 10_000,
          }),
          api<SupplierDebtSummary>("/supplier-debts/summary"),
        ]);
      setPayables(payableResult.items);
      setPayableMeta(payableResult.meta);
      setReceivables(receivableResult.items);
      setReceivableMeta(receivableResult.meta);
      setSuppliers(supplierValues.filter((item) => item.status === "active"));
      setSummary(summaryValue);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Gagal memuat hutang dan piutang pemasok",
      );
    }
  }, [debouncedQuery, overdue, payablePage, receivablePage, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPayablePage(1);
    setReceivablePage(1);
  }, [debouncedQuery, overdue, status]);

  const openCreate = () => {
    setSelected(null);
    setDebt(blankDebt());
    setModal("debt");
  };

  const openPayment = (item: DebtItem) => {
    setSelectedDirection(tab);
    setSelected(item);
    setPayment({ ...blankPayment(), amount: item.balance });
    setModal("payment");
  };

  const openHistory = async (item: DebtItem) => {
    const direction = tab;
    setSelectedDirection(direction);
    setSelected(item);
    setPaymentHistory([]);
    setHistoryLoading(true);
    setModal("history");
    try {
      const endpoint =
        direction === "payables"
          ? `/payables/${item.id}/payments`
          : `/supplier-receivables/${item.id}/payments`;
      setPaymentHistory(asArray(await api<SupplierDebtPayment[]>(endpoint)));
    } catch (reason) {
      show(
        reason instanceof Error
          ? reason.message
          : "Gagal memuat riwayat cicilan",
        true,
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const saveDebt = async () => {
    const directionLabel = tab === "payables" ? "hutang" : "piutang";
    if (!debt.supplier_id) {
      show("Pilih pemasok terlebih dahulu.", true);
      return;
    }
    if (!Number.isSafeInteger(debt.amount) || debt.amount <= 0) {
      show("Nominal harus berupa Rupiah bulat dan lebih dari nol.", true);
      return;
    }
    if (debt.description.trim().length < 3) {
      show("Keterangan minimal 3 karakter.", true);
      return;
    }
    if (
      !(await confirm({
        title: `Catat ${directionLabel} manual?`,
        message: `${directionLabel === "hutang" ? "Kewajiban toko kepada pemasok" : "Tagihan toko kepada pemasok"} sebesar ${rupiah(debt.amount)} akan masuk ke buku saldo pemasok.`,
        confirmLabel: `Catat ${directionLabel}`,
      }))
    )
      return;

    setSaving(true);
    try {
      await api(
        tab === "payables" ? "/payables" : "/supplier-receivables",
        json("POST", {
          ...debt,
          due_date: debt.due_date,
          reference_number: debt.reference_number.trim(),
          description: debt.description.trim(),
        }),
      );
      show(
        `${directionLabel[0].toUpperCase()}${directionLabel.slice(1)} manual berhasil dicatat.`,
      );
      setModal(null);
      await load();
    } catch (reason) {
      show(
        reason instanceof Error
          ? reason.message
          : `Gagal mencatat ${directionLabel}`,
        true,
      );
    } finally {
      setSaving(false);
    }
  };

  const savePayment = async () => {
    if (!selected) return;
    const isPayable = selectedDirection === "payables";
    const actionLabel = isPayable ? "pembayaran cicilan" : "penerimaan cicilan";
    if (
      !Number.isSafeInteger(payment.amount) ||
      payment.amount <= 0 ||
      payment.amount > selected.balance
    ) {
      show(
        "Jumlah cicilan harus lebih dari nol dan tidak melebihi saldo.",
        true,
      );
      return;
    }
    if (
      !(await confirm({
        title: `${isPayable ? "Bayar" : "Terima"} cicilan?`,
        message: `${actionLabel[0].toUpperCase()}${actionLabel.slice(1)} sebesar ${rupiah(payment.amount)} akan mengurangi saldo ${isPayable ? "hutang" : "piutang"}.`,
        confirmLabel: isPayable ? "Catat pembayaran" : "Catat penerimaan",
      }))
    )
      return;

    setSaving(true);
    try {
      const shiftId =
        payment.method === "cash" ? await requireActiveShiftID() : null;
      const endpoint = isPayable
        ? `/payables/${selected.id}/payments`
        : `/supplier-receivables/${selected.id}/payments`;
      await api(
        endpoint,
        json("POST", {
          ...payment,
          reference: payment.reference.trim(),
          shift_id: shiftId,
        }),
      );
      show(
        isPayable
          ? "Pembayaran cicilan berhasil dicatat."
          : "Penerimaan cicilan berhasil dicatat.",
      );
      setModal(null);
      await load();
    } catch (reason) {
      show(
        reason instanceof Error ? reason.message : "Gagal mencatat cicilan",
        true,
      );
    } finally {
      setSaving(false);
    }
  };

  const items: DebtItem[] = tab === "payables" ? payables : receivables;
  const meta = tab === "payables" ? payableMeta : receivableMeta;

  return (
    <>
      {node}
      <PageHeader
        title="Hutang & piutang pemasok"
        description="Pantau saldo pembelian, catat saldo manual, dan kelola pembayaran secara cicilan."
        action={
          <Button onClick={openCreate}>
            <Plus /> Catat {tab === "payables" ? "hutang" : "piutang"} manual
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <small className="text-slate-500">Hutang belum lunas</small>
          <strong className="mt-2 block text-xl text-slate-900">
            {rupiah(summary.payable_open)}
          </strong>
        </Card>
        <Card>
          <small className="text-slate-500">Hutang lewat jatuh tempo</small>
          <strong className="mt-2 block text-xl text-red-700">
            {rupiah(summary.payable_overdue)}
          </strong>
        </Card>
        <Card>
          <small className="text-slate-500">Piutang belum diterima</small>
          <strong className="mt-2 block text-xl text-slate-900">
            {rupiah(summary.receivable_open)}
          </strong>
        </Card>
        <Card>
          <small className="text-slate-500">Piutang lewat jatuh tempo</small>
          <strong className="mt-2 block text-xl text-red-700">
            {rupiah(summary.receivable_overdue)}
          </strong>
        </Card>
      </div>

      <Tabs
        value={tab}
        onChange={(value) => setTab(value as DebtTab)}
        items={[
          {
            value: "payables",
            label: "Hutang pemasok",
            icon: <Truck />,
          },
          {
            value: "receivables",
            label: "Piutang pemasok",
            icon: <CreditCard />,
          },
        ]}
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Cari pemasok, referensi, atau keterangan..."
            />
          </div>
          <div className="w-full sm:w-44">
            <Select
              label="Status saldo"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="open">Belum lunas</option>
              <option value="paid">Lunas</option>
              <option value="all">Semua status</option>
            </Select>
          </div>
          <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700 [&_input]:h-4 [&_input]:w-4 [&_input]:accent-brand-700">
            <input
              type="checkbox"
              checked={overdue}
              onChange={(event) => setOverdue(event.target.checked)}
            />
            Hanya lewat jatuh tempo
          </label>
        </div>

        {error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : (
          <div className="w-full overflow-auto rounded-xl">
            <table className="w-full min-w-[900px] border-collapse text-[11px] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-[#dfe7e2] [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_td]:text-slate-700 [&_tbody_tr:hover]:bg-slate-50 [&_td>strong]:block [&_td>small]:mt-1 [&_td>small]:block [&_td>small]:text-[10px] [&_td>small]:text-slate-500">
              <thead>
                <tr>
                  <th>Pemasok</th>
                  <th>Sumber / referensi</th>
                  <th>Keterangan</th>
                  <th>Jatuh tempo</th>
                  <th>Saldo</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const payable = item as SupplierPayable;
                  const isPurchase =
                    tab === "payables" && payable.source === "purchase";
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.supplier_name}</strong>
                        <small>
                          {tab === "payables" ? "Dicicil" : "Diterima"}{" "}
                          {rupiah(item.paid_amount)}
                        </small>
                      </td>
                      <td>
                        <Badge tone={isPurchase ? "info" : "neutral"}>
                          {isPurchase ? "Pembelian" : "Manual"}
                        </Badge>
                        <small>
                          {isPurchase
                            ? payable.purchase_number
                            : item.reference_number || "Tanpa referensi"}
                        </small>
                      </td>
                      <td>
                        {item.description || "—"}
                        {isPurchase && item.reference_number && (
                          <small>Faktur: {item.reference_number}</small>
                        )}
                      </td>
                      <td>{dateOnly(item.due_date)}</td>
                      <td>
                        <strong>{rupiah(item.balance)}</strong>
                        <small>Saldo awal {rupiah(item.original_amount)}</small>
                      </td>
                      <td>
                        <Badge
                          tone={item.status === "open" ? "warning" : "success"}
                        >
                          {displayLabel(item.status)}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            onClick={() => void openHistory(item)}
                          >
                            <History /> Riwayat
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={
                              item.status !== "open" || item.balance <= 0
                            }
                            onClick={() => openPayment(item)}
                          >
                            <Banknote />
                            {tab === "payables"
                              ? "Bayar cicilan"
                              : "Terima cicilan"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!items.length && (
              <EmptyState
                title={
                  tab === "payables"
                    ? "Tidak ada hutang pemasok"
                    : "Tidak ada piutang pemasok"
                }
                description="Ubah filter atau catat saldo manual baru."
              />
            )}
          </div>
        )}
        {!error && (
          <Pagination
            meta={meta}
            onPageChange={
              tab === "payables" ? setPayablePage : setReceivablePage
            }
          />
        )}
      </Card>

      <Modal
        open={modal === "debt"}
        title={`Catat ${tab === "payables" ? "hutang" : "piutang"} pemasok`}
        onClose={() => setModal(null)}
        wide
      >
        <div className="mb-4 flex gap-3 rounded-xl bg-brand-50 p-4 text-xs leading-6 text-brand-900">
          {tab === "payables" ? <Truck /> : <ReceiptText />}
          <p className="m-0">
            {tab === "payables"
              ? "Gunakan untuk saldo awal atau kewajiban kepada pemasok yang tidak berasal dari transaksi pembelian di aplikasi."
              : "Gunakan ketika pemasok memiliki kewajiban membayar toko, misalnya pengembalian dana atau kelebihan pembayaran."}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="Pemasok"
            value={debt.supplier_id}
            onChange={(event) =>
              setDebt({ ...debt, supplier_id: event.target.value })
            }
          >
            <option value="">Pilih pemasok</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name} · {supplier.code}
              </option>
            ))}
          </Select>
          <Input
            label="Nominal"
            type="number"
            min="1"
            step="1"
            value={debt.amount}
            onChange={(event) =>
              setDebt({ ...debt, amount: Number(event.target.value) })
            }
          />
          <Input
            label="Jatuh tempo (opsional)"
            type="date"
            value={debt.due_date}
            onChange={(event) =>
              setDebt({ ...debt, due_date: event.target.value })
            }
          />
          <Input
            label="Nomor referensi (opsional)"
            value={debt.reference_number}
            maxLength={128}
            onChange={(event) =>
              setDebt({ ...debt, reference_number: event.target.value })
            }
            placeholder="Contoh: SALDO-AWAL-001"
          />
        </div>
        <Textarea
          label="Keterangan"
          value={debt.description}
          maxLength={500}
          onChange={(event) =>
            setDebt({ ...debt, description: event.target.value })
          }
          placeholder="Jelaskan asal saldo agar mudah diperiksa kembali."
        />
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={
              !debt.supplier_id ||
              debt.amount <= 0 ||
              debt.description.trim().length < 3
            }
            onClick={() => void saveDebt()}
          >
            Simpan saldo
          </Button>
        </div>
      </Modal>

      <Modal
        open={modal === "payment"}
        title={
          selectedDirection === "payables"
            ? "Bayar cicilan hutang"
            : "Terima cicilan piutang"
        }
        onClose={() => setModal(null)}
      >
        <div className="mb-4 rounded-xl bg-brand-50 p-4">
          <small className="text-slate-500">
            Sisa saldo {selected?.supplier_name}
          </small>
          <strong className="mt-1 block text-2xl text-brand-800">
            {rupiah(selected?.balance)}
          </strong>
        </div>
        <Input
          label="Jumlah cicilan"
          type="number"
          min="1"
          max={selected?.balance}
          step="1"
          value={payment.amount}
          onChange={(event) =>
            setPayment({ ...payment, amount: Number(event.target.value) })
          }
        />
        <Select
          label="Metode"
          value={payment.method}
          onChange={(event) =>
            setPayment({ ...payment, method: event.target.value })
          }
        >
          <option value="transfer">Transfer</option>
          <option value="cash">Tunai</option>
          <option value="qris">QRIS</option>
          <option value="other">Lainnya</option>
        </Select>
        <Input
          label="Referensi pembayaran (opsional)"
          value={payment.reference}
          onChange={(event) =>
            setPayment({ ...payment, reference: event.target.value })
          }
        />
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={
              payment.amount <= 0 ||
              payment.amount > Number(selected?.balance || 0)
            }
            onClick={() => void savePayment()}
          >
            {selectedDirection === "payables"
              ? "Catat pembayaran"
              : "Catat penerimaan"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={modal === "history"}
        title={`Riwayat cicilan ${selected?.supplier_name || ""}`}
        onClose={() => setModal(null)}
        wide
      >
        <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl bg-brand-50 p-4 text-xs sm:grid-cols-3">
          <div>
            <small className="text-slate-500">Saldo awal</small>
            <strong className="mt-1 block text-base text-brand-900">
              {rupiah(selected?.original_amount)}
            </strong>
          </div>
          <div>
            <small className="text-slate-500">Sudah dicicil</small>
            <strong className="mt-1 block text-base text-brand-900">
              {rupiah(selected?.paid_amount)}
            </strong>
          </div>
          <div>
            <small className="text-slate-500">Sisa saldo</small>
            <strong className="mt-1 block text-base text-brand-900">
              {rupiah(selected?.balance)}
            </strong>
          </div>
        </div>
        {historyLoading ? (
          <p className="py-8 text-center text-xs text-slate-500">
            Memuat riwayat cicilan...
          </p>
        ) : paymentHistory.length ? (
          <div className="w-full overflow-auto rounded-xl">
            <table className="w-full min-w-[620px] border-collapse text-[11px] [&_th]:border-b [&_th]:border-[#dfe7e2] [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_td]:text-slate-700">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Metode</th>
                  <th>Referensi</th>
                  <th>Nominal</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map((item) => (
                  <tr key={item.id}>
                    <td>{dateTime(item.paid_at)}</td>
                    <td>{displayLabel(item.method)}</td>
                    <td>{item.reference || "—"}</td>
                    <td>
                      <strong>{rupiah(item.amount)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Belum ada cicilan"
            description={
              selectedDirection === "payables"
                ? "Pembayaran awal pada transaksi pembelian tidak dihitung sebagai cicilan saldo ini."
                : "Belum ada penerimaan pembayaran dari pemasok."
            }
          />
        )}
        <div className="mt-5 flex justify-end border-t border-[#dfe7e2] pt-4">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Tutup
          </Button>
        </div>
      </Modal>
    </>
  );
}
