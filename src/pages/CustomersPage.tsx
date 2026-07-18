import {
  CreditCard,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useConfirm } from "../components/feedback";
import { api, apiPage, json, requireActiveShiftID } from "../lib/api";
import { dateOnly, rupiah } from "../lib/format";
import { useDebouncedValue } from "../lib/hooks";
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

export function CustomersPage() {
  const { can, user } = useAuth();
  const [tab, setTab] = useState<"customers" | "receivables">("customers");
  const [customers, setCustomers] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [customerPage, setCustomerPage] = useState(1);
  const [receivablePage, setReceivablePage] = useState(1);
  const [customerMeta, setCustomerMeta] = useState({ page: 1, limit: 50, has_more: false });
  const [receivableMeta, setReceivableMeta] = useState({ page: 1, limit: 50, has_more: false });
  const [overdue, setOverdue] = useState(false);
  const [modal, setModal] = useState<"customer" | "pay" | "reminder" | null>(
    null,
  );
  const [selected, setSelected] = useState<any>(null);
  const [customer, setCustomer] = useState({
    code: "",
    name: "",
    phone: "",
    address: "",
    credit_limit: 0,
    blocked: false,
    status: "active",
    version: 0,
  });
  const [payment, setPayment] = useState({
    amount: 0,
    method: "cash",
    reference: "",
  });
  const [reminder, setReminder] = useState<any>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { show, node } = useToast();
  const confirm = useConfirm();
  const load = useCallback(async () => {
    setError("");
    try {
      const [customerResult, receivableResult] = await Promise.all([
        apiPage<any>(
          `/customers?q=${encodeURIComponent(debouncedQuery)}&page=${customerPage}&limit=50`,
        ),
        apiPage<any>(
          `/receivables?overdue=${overdue}&page=${receivablePage}&limit=50`,
        ),
      ]);
      setCustomers(customerResult.items);
      setCustomerMeta(customerResult.meta);
      setReceivables(receivableResult.items);
      setReceivableMeta(receivableResult.meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat pelanggan");
    }
  }, [customerPage, debouncedQuery, overdue, receivablePage]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setCustomerPage(1);
  }, [debouncedQuery]);
  useEffect(() => {
    setReceivablePage(1);
  }, [overdue]);
  const openCreate = () => {
    setSelected(null);
    setCustomer({
      code: "",
      name: "",
      phone: "",
      address: "",
      credit_limit: 0,
      blocked: false,
      status: "active",
      version: 0,
    });
    setModal("customer");
  };
  const openEdit = (item: any) => {
    setSelected(item);
    setCustomer({
      code: item.code,
      name: item.name,
      phone: item.phone || "",
      address: item.address || "",
      credit_limit: item.credit_limit || 0,
      blocked: Boolean(item.blocked),
      status: item.status || "active",
      version: item.version,
    });
    setModal("customer");
  };
  const saveCustomer = async () => {
    setSaving(true);
    try {
      await api(
        selected ? `/customers/${selected.id}` : "/customers",
        json(selected ? "PUT" : "POST", customer),
      );
      show(`Pelanggan berhasil ${selected ? "diperbarui" : "ditambahkan"}.`);
      setModal(null);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal menyimpan pelanggan", true);
    } finally {
      setSaving(false);
    }
  };
  const deleteCustomer = async (item: any) => {
    if (
      !(await confirm({
        title: "Hapus pelanggan?",
        message: `Pelanggan ${item.name} akan dihapus. Pelanggan yang memiliki transaksi atau piutang tidak dapat dihapus.`,
        confirmLabel: "Hapus pelanggan",
        tone: "danger",
      }))
    )
      return;
    setSaving(true);
    try {
      await api(`/customers/${item.id}`, json("DELETE"));
      show("Pelanggan berhasil dihapus.");
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal menghapus pelanggan", true);
    } finally {
      setSaving(false);
    }
  };
  const pay = async () => {
    if (
      !(await confirm({
        title: "Catat pembayaran piutang?",
        message: `Pembayaran sebesar ${rupiah(payment.amount)} akan mengurangi saldo piutang pelanggan.`,
        confirmLabel: "Catat pembayaran",
      }))
    )
      return;
    setSaving(true);
    try {
      const shiftId =
        payment.method === "cash" ? await requireActiveShiftID() : null;
      if (payment.method === "cash" && !shiftId)
        throw new Error("Buka sif terlebih dahulu untuk pembayaran tunai.");
      await api(
        `/receivables/${selected.id}/payments`,
        json("POST", { ...payment, shift_id: shiftId }),
      );
      show("Pembayaran piutang berhasil.");
      setModal(null);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Pembayaran gagal", true);
    } finally {
      setSaving(false);
    }
  };
  const openReminder = async (item: any) => {
    try {
      setSelected(item);
      setReminder(await api(`/receivables/${item.id}/reminder`));
      setModal("reminder");
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal membuat pengingat", true);
    }
  };
  return (
    <>
      {node}
      <PageHeader
        title="Pelanggan & piutang"
        description="Kelola pelanggan, batas kredit, tagihan, dan pembayaran."
        action={
          tab === "customers" && can("customer.manage") ? (
            <Button onClick={openCreate}>
              <Plus /> Tambah pelanggan
            </Button>
          ) : undefined
        }
      />
      <Tabs
        value={tab}
        onChange={(value) => setTab(value as typeof tab)}
        items={[
          { value: "customers", label: "Pelanggan", icon: <Users /> },
          {
            value: "receivables",
            label: "Piutang",
            icon: <CreditCard />,
          },
        ]}
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          {tab === "customers" ? (
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Cari pelanggan..."
            />
          ) : (
            <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 [&_input]:h-4 [&_input]:w-4 [&_input]:accent-brand-700">
              <input
                type="checkbox"
                checked={overdue}
                onChange={(e) => setOverdue(e.target.checked)}
              />{" "}
              Hanya jatuh tempo
            </label>
          )}
          <Badge tone="info">
            {tab === "customers" ? customers.length : receivables.length} data di halaman ini
          </Badge>
        </div>
        {error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : (
          <div className="w-full overflow-auto rounded-xl">
            {tab === "customers" ? (
              <table className="w-full min-w-[760px] border-collapse text-[11px] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-[#dfe7e2] [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_td]:text-slate-700 [&_tbody_tr:hover]:bg-slate-50 [&_td>strong]:block [&_td>small]:mt-1 [&_td>small]:block [&_td>small]:text-[10px] [&_td>small]:text-slate-500 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-1 [&_code]:text-[9px]">
                <thead>
                  <tr>
                    <th>Pelanggan</th>
                    <th>Kontak</th>
                    <th>Batas kredit</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        <small>{item.code}</small>
                      </td>
                      <td>
                        {item.phone || "—"}
                        <small>{item.address || "Alamat belum diisi"}</small>
                      </td>
                      <td>{rupiah(item.credit_limit)}</td>
                      <td>
                        <Badge tone={item.blocked ? "danger" : "success"}>
                          {item.blocked ? "Kredit diblokir" : "Aktif"}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {can("customer.manage") && (
                            <Button variant="ghost" onClick={() => openEdit(item)}>
                              <Pencil /> Edit
                            </Button>
                          )}
                          {user?.role === "owner" && (
                            <Button
                              variant="danger"
                              loading={saving}
                              onClick={() => void deleteCustomer(item)}
                            >
                              <Trash2 /> Hapus
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[760px] border-collapse text-[11px] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-[#dfe7e2] [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_td]:text-slate-700 [&_tbody_tr:hover]:bg-slate-50 [&_td>strong]:block [&_td>small]:mt-1 [&_td>small]:block [&_td>small]:text-[10px] [&_td>small]:text-slate-500 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-1 [&_code]:text-[9px]">
                <thead>
                  <tr>
                    <th>Pelanggan</th>
                    <th>Transaksi</th>
                    <th>Jatuh tempo</th>
                    <th>Sisa</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {receivables.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.customer_name}</strong>
                      </td>
                      <td>{item.sale_number}</td>
                      <td>{dateOnly(item.due_date)}</td>
                      <td>
                        <strong>{rupiah(item.balance)}</strong>
                        <small>Dari {rupiah(item.original_amount)}</small>
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            onClick={() => void openReminder(item)}
                          >
                            <MessageCircle />
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={
                              item.status !== "open" || !can("debt.pay")
                            }
                            onClick={() => {
                              setSelected(item);
                              setPayment({ ...payment, amount: item.balance });
                              setModal("pay");
                            }}
                          >
                            Bayar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!(tab === "customers" ? customers : receivables).length && (
              <EmptyState
                title={
                  tab === "customers"
                    ? "Belum ada pelanggan"
                    : "Tidak ada piutang"
                }
              />
            )}
          </div>
        )}
        {!error && (
          <Pagination
            meta={tab === "customers" ? customerMeta : receivableMeta}
            onPageChange={
              tab === "customers" ? setCustomerPage : setReceivablePage
            }
          />
        )}
      </Card>
      <Modal
        open={modal === "customer"}
        title={selected ? "Edit pelanggan" : "Tambah pelanggan"}
        onClose={() => setModal(null)}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Kode"
            value={customer.code}
            onChange={(e) => setCustomer({ ...customer, code: e.target.value })}
          />
          <Input
            label="Nama"
            value={customer.name}
            onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
          />
          <Input
            label="Telepon"
            value={customer.phone}
            onChange={(e) =>
              setCustomer({ ...customer, phone: e.target.value })
            }
          />
          <Input
            label="Batas kredit"
            type="number"
            min="0"
            value={customer.credit_limit}
            onChange={(e) =>
              setCustomer({ ...customer, credit_limit: Number(e.target.value) })
            }
          />
        </div>
        <Textarea
          label="Alamat"
          value={customer.address}
          onChange={(e) =>
            setCustomer({ ...customer, address: e.target.value })
          }
        />
        <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 [&_input]:h-4 [&_input]:w-4 [&_input]:accent-brand-700">
          <input
            type="checkbox"
            checked={customer.blocked}
            onChange={(e) =>
              setCustomer({ ...customer, blocked: e.target.checked })
            }
          />
          <span>Blokir transaksi kredit pelanggan</span>
        </label>
        {selected && (
          <Select
            label="Status"
            value={customer.status}
            onChange={(e) =>
              setCustomer({ ...customer, status: e.target.value })
            }
          >
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </Select>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={!customer.code || !customer.name}
            onClick={() => void saveCustomer()}
          >
            {selected ? "Simpan perubahan" : "Simpan pelanggan"}
          </Button>
        </div>
      </Modal>
      <Modal
        open={modal === "pay"}
        title="Pembayaran piutang"
        onClose={() => setModal(null)}
      >
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-brand-50 p-4 [&_span]:text-xs [&_span]:text-slate-500 [&_strong]:text-2xl [&_strong]:text-brand-700">
          <span>Sisa piutang</span>
          <strong>{rupiah(selected?.balance)}</strong>
        </div>
        <Input
          label="Jumlah pembayaran"
          type="number"
          min="1"
          max={selected?.balance}
          value={payment.amount}
          onChange={(e) =>
            setPayment({ ...payment, amount: Number(e.target.value) })
          }
        />
        <Select
          label="Metode"
          value={payment.method}
          onChange={(e) => setPayment({ ...payment, method: e.target.value })}
        >
          <option value="cash">Tunai</option>
          <option value="transfer">Transfer</option>
          <option value="qris">QRIS</option>
          <option value="other">Lainnya</option>
        </Select>
        <Input
          label="Referensi"
          value={payment.reference}
          onChange={(e) =>
            setPayment({ ...payment, reference: e.target.value })
          }
        />
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={payment.amount < 1}
            onClick={() => void pay()}
          >
            Catat pembayaran
          </Button>
        </div>
      </Modal>
      <Modal
        open={modal === "reminder"}
        title="Pengingat piutang"
        onClose={() => setModal(null)}
      >
        <div className="flex gap-3 rounded-xl bg-brand-50 p-4 text-brand-900 [&_svg]:shrink-0 [&_svg]:text-brand-700 [&_p]:m-0 [&_p]:text-xs [&_p]:leading-6">
          <UserRoundCheck />
          <p>
            {reminder?.message ||
              reminder?.text ||
              `Halo ${selected?.customer_name}, terdapat sisa piutang ${rupiah(selected?.balance)}.`}
          </p>
        </div>
        <p className="text-slate-500">
          Pesan harus diperiksa dan dikirim manual oleh pengguna.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          <Button
            variant="secondary"
            onClick={() =>
              navigator.clipboard.writeText(
                reminder?.message || reminder?.text || "",
              )
            }
          >
            Salin pesan
          </Button>
          {reminder?.whatsapp_url && (
            <a
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[9px] border border-transparent bg-brand-700 px-4 py-2.5 text-xs font-bold text-white shadow-[0_5px_13px_rgba(11,107,71,0.18)] transition hover:bg-brand-800"
              href={reminder.whatsapp_url}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle /> Buka WhatsApp
            </a>
          )}
        </div>
      </Modal>
    </>
  );
}
