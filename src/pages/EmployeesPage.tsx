import {
  Banknote,
  CalendarDays,
  History,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, json } from "../lib/api";
import { asArray, displayLabel, rupiah } from "../lib/format";
import type { Employee, SalaryPayment } from "../types/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
  useToast,
} from "../components/ui";

const today = () => new Date().toLocaleDateString("en-CA");
const currentPeriod = () => today().slice(0, 7);

const blankEmployee = () => ({
  user_id: "",
  employee_code: "",
  full_name: "",
  position: "",
  phone: "",
  hire_date: today(),
  monthly_salary: 0,
  status: "active",
  version: 0,
});

const blankSalary = (employee?: Employee | null) => ({
  period: currentPeriod(),
  base_salary: employee?.monthly_salary || 0,
  bonus: 0,
  deductions: 0,
  paid_on: today(),
  payment_method: "transfer",
  notes: "",
});

export function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<SalaryPayment[]>([]);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [employee, setEmployee] = useState(blankEmployee());
  const [salary, setSalary] = useState(blankSalary());
  const [modal, setModal] = useState<"employee" | "salary" | "history" | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { show, node } = useToast();

  const load = useCallback(async () => {
    setError("");
    try {
      const [employeeValues, userValues] = await Promise.all([
        api<Employee[]>("/employees"),
        api<any[]>("/admin/users"),
      ]);
      setEmployees(asArray(employeeValues));
      setUsers(asArray(userValues));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Gagal memuat karyawan",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setSelected(null);
    setEmployee(blankEmployee());
    setModal("employee");
  };

  const openEdit = (value: Employee) => {
    setSelected(value);
    setEmployee({
      user_id: value.user_id || "",
      employee_code: value.employee_code,
      full_name: value.full_name,
      position: value.position,
      phone: value.phone,
      hire_date: value.hire_date.slice(0, 10),
      monthly_salary: value.monthly_salary,
      status: value.status,
      version: value.version,
    });
    setModal("employee");
  };

  const deleteEmployee = async (value: Employee) => {
    if (!window.confirm(`Hapus karyawan ${value.full_name}? Karyawan yang sudah memiliki riwayat gaji hanya dapat dinonaktifkan.`)) return;
    setSaving(true);
    try {
      await api(`/employees/${value.id}`, json("DELETE"));
      show("Karyawan berhasil dihapus.");
      if (selected?.id === value.id) setModal(null);
      await load();
    } catch (reason) {
      show(reason instanceof Error ? reason.message : "Gagal menghapus karyawan", true);
    } finally {
      setSaving(false);
    }
  };

  const saveEmployee = async () => {
    setSaving(true);
    try {
      if (selected) {
        await api(`/employees/${selected.id}`, json("PUT", { ...employee, user_id: employee.user_id || null }));
        show("Data karyawan berhasil diperbarui.");
      } else {
        await api("/employees", json("POST", { ...employee, user_id: employee.user_id || null }));
        show("Karyawan berhasil ditambahkan.");
      }
      setModal(null);
      await load();
    } catch (reason) {
      show(
        reason instanceof Error ? reason.message : "Gagal menyimpan karyawan",
        true,
      );
    } finally {
      setSaving(false);
    }
  };

  const loadSalaries = async (value: Employee, target: "salary" | "history") => {
    setSelected(value);
    try {
      setSalaries(
        asArray(await api<SalaryPayment[]>(`/employees/${value.id}/salaries`)),
      );
      if (target === "salary") setSalary(blankSalary(value));
      setModal(target);
    } catch (reason) {
      show(
        reason instanceof Error
          ? reason.message
          : "Gagal memuat riwayat gaji",
        true,
      );
    }
  };

  const saveSalary = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api(
        `/employees/${selected.id}/salaries`,
        json("POST", salary),
      );
      show("Pembayaran gaji berhasil dicatat.");
      setModal(null);
      await load();
    } catch (reason) {
      show(
        reason instanceof Error ? reason.message : "Gagal mencatat gaji",
        true,
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteSalary = async (payment: SalaryPayment) => {
    if (!selected || !window.confirm("Hapus catatan pembayaran gaji ini?"))
      return;
    try {
      await api(
        `/employees/${selected.id}/salaries/${payment.id}`,
        json("DELETE"),
      );
      setSalaries((current) =>
        current.filter((item) => item.id !== payment.id),
      );
      show("Catatan pembayaran dihapus.");
    } catch (reason) {
      show(reason instanceof Error ? reason.message : "Gagal menghapus gaji", true);
    }
  };

  const netSalary = useMemo(
    () => salary.base_salary + salary.bonus - salary.deductions,
    [salary],
  );

  return (
    <>
      {node}
      <PageHeader
        title="Karyawan & gaji"
        description="Kelola data karyawan dan catat pembayaran gaji setiap bulan."
        action={
          <Button onClick={openCreate}>
            <Plus /> Tambah karyawan
          </Button>
        }
      />
      {error ? (
        <ErrorState message={error} retry={() => void load()} />
      ) : (
        <Card>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Karyawan</th>
                  <th>Jabatan</th>
                  <th>Mulai bekerja</th>
                  <th>Gaji bulanan</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.full_name}</strong>
                      <small>
                        {item.employee_code} · {item.phone || "Tanpa telepon"}
                      </small>
                    </td>
                    <td>{item.position}</td>
                    <td>{new Date(item.hire_date).toLocaleDateString("id-ID")}</td>
                    <td>{rupiah(item.monthly_salary)}</td>
                    <td>
                      <Badge tone={item.status === "active" ? "success" : "neutral"}>
                        {displayLabel(item.status)}
                      </Badge>
                    </td>
                    <td>
                      <div className="row-actions">
                        <Button variant="ghost" onClick={() => openEdit(item)}>
                          <Pencil /> Ubah
                        </Button>
                        <Button variant="ghost" onClick={() => void deleteEmployee(item)}>
                          <Trash2 /> Hapus
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => void loadSalaries(item, "salary")}
                        >
                          <Banknote /> Bayar gaji
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => void loadSalaries(item, "history")}
                        >
                          <History /> Riwayat
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!employees.length && (
              <EmptyState
                title="Belum ada karyawan"
                description="Tambahkan karyawan untuk mulai mengelola gaji."
              />
            )}
          </div>
        </Card>
      )}

      <Modal
        open={modal === "employee"}
        title={selected ? "Ubah karyawan" : "Tambah karyawan"}
        onClose={() => setModal(null)}
        wide
      >
        <div className="form-grid">
          <Select
            label="Akun aplikasi (opsional)"
            value={employee.user_id}
            onChange={(event) => setEmployee({ ...employee, user_id: event.target.value })}
          >
            <option value="">Tidak terhubung ke akun</option>
            {users
              .filter((item) => !item.employee_id || item.employee_id === selected?.id)
              .map((item) => (
                <option key={item.id} value={item.id}>{item.full_name} (@{item.username})</option>
              ))}
          </Select>
          <Input
            label="Kode karyawan"
            value={employee.employee_code}
            onChange={(event) =>
              setEmployee({
                ...employee,
                employee_code: event.target.value.toUpperCase(),
              })
            }
            placeholder="Contoh: KRY-001"
          />
          <Input
            label="Nama lengkap"
            value={employee.full_name}
            onChange={(event) =>
              setEmployee({ ...employee, full_name: event.target.value })
            }
          />
          <Input
            label="Jabatan"
            value={employee.position}
            onChange={(event) =>
              setEmployee({ ...employee, position: event.target.value })
            }
            placeholder="Contoh: Kasir"
          />
          <Input
            label="Nomor telepon"
            value={employee.phone}
            onChange={(event) =>
              setEmployee({ ...employee, phone: event.target.value })
            }
          />
          <Input
            label="Tanggal mulai bekerja"
            type="date"
            value={employee.hire_date}
            onChange={(event) =>
              setEmployee({ ...employee, hire_date: event.target.value })
            }
          />
          <Input
            label="Gaji bulanan"
            type="number"
            min="0"
            value={employee.monthly_salary}
            onChange={(event) =>
              setEmployee({
                ...employee,
                monthly_salary: Number(event.target.value),
              })
            }
          />
          {selected && (
            <Select
              label="Status"
              value={employee.status}
              onChange={(event) =>
                setEmployee({ ...employee, status: event.target.value })
              }
            >
              <option value="active">Aktif</option>
              <option value="inactive">Tidak aktif</option>
            </Select>
          )}
        </div>
        <div className="modal-actions">
          {selected && (
            <Button variant="danger" loading={saving} onClick={() => void deleteEmployee(selected)}>
              <Trash2 /> Hapus karyawan
            </Button>
          )}
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={
              !employee.employee_code ||
              !employee.full_name ||
              !employee.position ||
              !employee.hire_date
            }
            onClick={() => void saveEmployee()}
          >
            Simpan karyawan
          </Button>
        </div>
      </Modal>

      <Modal
        open={modal === "salary"}
        title={`Bayar gaji ${selected?.full_name || ""}`}
        onClose={() => setModal(null)}
        wide
      >
        <div className="form-grid">
          <Input
            label="Periode gaji"
            type="month"
            value={salary.period}
            onChange={(event) => setSalary({ ...salary, period: event.target.value })}
          />
          <Input
            label="Tanggal pembayaran"
            type="date"
            value={salary.paid_on}
            onChange={(event) => setSalary({ ...salary, paid_on: event.target.value })}
          />
          <Input
            label="Gaji pokok"
            type="number"
            min="0"
            value={salary.base_salary}
            onChange={(event) =>
              setSalary({ ...salary, base_salary: Number(event.target.value) })
            }
          />
          <Input
            label="Bonus"
            type="number"
            min="0"
            value={salary.bonus}
            onChange={(event) =>
              setSalary({ ...salary, bonus: Number(event.target.value) })
            }
          />
          <Input
            label="Potongan"
            type="number"
            min="0"
            value={salary.deductions}
            onChange={(event) =>
              setSalary({ ...salary, deductions: Number(event.target.value) })
            }
          />
          <Select
            label="Metode pembayaran"
            value={salary.payment_method}
            onChange={(event) =>
              setSalary({ ...salary, payment_method: event.target.value })
            }
          >
            <option value="transfer">Transfer</option>
            <option value="cash">Tunai</option>
            <option value="other">Lainnya</option>
          </Select>
        </div>
        <Textarea
          label="Catatan"
          value={salary.notes}
          onChange={(event) => setSalary({ ...salary, notes: event.target.value })}
        />
        <div className="salary-total">
          <span>Total gaji bersih</span>
          <strong>{rupiah(Math.max(0, netSalary))}</strong>
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={!salary.period || !salary.paid_on || netSalary < 0}
            onClick={() => void saveSalary()}
          >
            Catat pembayaran
          </Button>
        </div>
      </Modal>

      <Modal
        open={modal === "history"}
        title={`Riwayat gaji ${selected?.full_name || ""}`}
        onClose={() => setModal(null)}
        wide
      >
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Periode</th>
                <th>Gaji pokok</th>
                <th>Bonus</th>
                <th>Potongan</th>
                <th>Bersih</th>
                <th>Dibayar</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {salaries.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>
                      {new Intl.DateTimeFormat("id-ID", {
                        month: "long",
                        year: "numeric",
                        timeZone: "UTC",
                      }).format(new Date(item.period))}
                    </strong>
                    <small>{displayLabel(item.payment_method)}</small>
                  </td>
                  <td>{rupiah(item.base_salary)}</td>
                  <td>{rupiah(item.bonus)}</td>
                  <td>{rupiah(item.deductions)}</td>
                  <td>
                    <strong>{rupiah(item.net_salary)}</strong>
                  </td>
                  <td>
                    <CalendarDays />{" "}
                    {new Date(item.paid_on).toLocaleDateString("id-ID")}
                  </td>
                  <td>
                    <Button variant="ghost" onClick={() => void deleteSalary(item)}>
                      <Trash2 /> Hapus
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!salaries.length && (
            <EmptyState title="Belum ada pembayaran gaji" />
          )}
        </div>
      </Modal>
    </>
  );
}
