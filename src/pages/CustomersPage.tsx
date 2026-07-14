import {
  CreditCard,
  MessageCircle,
  Plus,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { activeShiftID, api, json } from "../lib/api";
import { asArray, dateOnly, rupiah } from "../lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Textarea,
  useToast,
} from "../components/ui";

export function CustomersPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<"customers" | "receivables">("customers");
  const [customers, setCustomers] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<any[]>([]);
  const [query, setQuery] = useState("");
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
  const load = useCallback(async () => {
    setError("");
    try {
      const [c, r] = await Promise.all([
        api(`/customers?q=${encodeURIComponent(query)}&limit=100`),
        api(`/receivables?overdue=${overdue}&limit=100`),
      ]);
      setCustomers(asArray(c));
      setReceivables(asArray(r));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat pelanggan");
    }
  }, [query, overdue]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);
  const create = async () => {
    setSaving(true);
    try {
      await api(
        "/customers",
        json("POST", { ...customer, status: "active", version: 0 }),
      );
      show("Pelanggan berhasil ditambahkan.");
      setModal(null);
      setCustomer({
        code: "",
        name: "",
        phone: "",
        address: "",
        credit_limit: 0,
        blocked: false,
      });
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal menyimpan pelanggan", true);
    } finally {
      setSaving(false);
    }
  };
  const pay = async () => {
    setSaving(true);
    try {
      const shiftId = payment.method === "cash" ? await activeShiftID() : null;
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
            <Button onClick={() => setModal("customer")}>
              <Plus /> Tambah pelanggan
            </Button>
          ) : undefined
        }
      />
      <div className="tabs">
        <button
          className={tab === "customers" ? "active" : ""}
          onClick={() => setTab("customers")}
        >
          <Users /> Pelanggan
        </button>
        <button
          className={tab === "receivables" ? "active" : ""}
          onClick={() => setTab("receivables")}
        >
          <CreditCard /> Piutang{" "}
          <Badge tone="warning">
            {receivables.filter((item) => item.status === "open").length}
          </Badge>
        </button>
      </div>
      <Card>
        <div className="table-toolbar">
          {tab === "customers" ? (
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Cari pelanggan..."
            />
          ) : (
            <label className="check-filter">
              <input
                type="checkbox"
                checked={overdue}
                onChange={(e) => setOverdue(e.target.checked)}
              />{" "}
              Hanya jatuh tempo
            </label>
          )}
          <Badge tone="info">
            {tab === "customers" ? customers.length : receivables.length} data
          </Badge>
        </div>
        {error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : (
          <div className="data-table-wrap">
            {tab === "customers" ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pelanggan</th>
                    <th>Kontak</th>
                    <th>Batas kredit</th>
                    <th>Status</th>
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
                          {item.blocked ? "Diblokir" : "Aktif"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="data-table">
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
                        <div className="row-actions">
                          <Button
                            variant="ghost"
                            onClick={() => void openReminder(item)}
                          >
                            <MessageCircle />
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={item.status !== "open" || !can("debt.pay")}
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
      </Card>
      <Modal
        open={modal === "customer"}
        title="Tambah pelanggan"
        onClose={() => setModal(null)}
      >
        <div className="form-grid">
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
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={!customer.code || !customer.name}
            onClick={() => void create()}
          >
            Simpan pelanggan
          </Button>
        </div>
      </Modal>
      <Modal
        open={modal === "pay"}
        title="Pembayaran piutang"
        onClose={() => setModal(null)}
      >
        <div className="payment-total">
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
        <div className="modal-actions">
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
        <div className="reminder-box">
          <UserRoundCheck />
          <p>
            {reminder?.message ||
              reminder?.text ||
              `Halo ${selected?.customer_name}, terdapat sisa piutang ${rupiah(selected?.balance)}.`}
          </p>
        </div>
        <p className="muted">
          Pesan harus diperiksa dan dikirim manual oleh pengguna.
        </p>
        <div className="modal-actions">
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
              className="button button-primary"
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
