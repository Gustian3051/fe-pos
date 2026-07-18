import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  History,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConfirm } from "../components/feedback";
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
  displayLabel,
  isUUID,
  quantity,
  rupiah,
} from "../lib/format";
import { useDebouncedValue } from "../lib/hooks";
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
  Pagination,
  SearchInput,
  Select,
  Textarea,
  useToast,
} from "../components/ui";

const twoDigits = (value: number) => String(value).padStart(2, "0");
const today = () => {
  const value = new Date();
  return `${value.getFullYear()}-${twoDigits(value.getMonth() + 1)}-${twoDigits(value.getDate())}`;
};
const currentPeriod = () => today().slice(0, 7);

const validRupiah = (value: number) =>
  Number.isSafeInteger(value) && value >= 0;

const validISODate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00`));

type SalaryType = "monthly" | "daily" | "hourly";

type AccountOption = {
  id: string;
  employee_id?: string | null;
  username: string;
  full_name: string;
  role: string;
  status: string;
};

const normalizePersonName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");

const monthEnd = (period: string) => {
  if (!/^\d{4}-\d{2}$/.test(period)) return "";
  const start = new Date(`${period}-01T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() + 1);
  start.setUTCDate(0);
  return `${start.getUTCFullYear()}-${twoDigits(start.getUTCMonth() + 1)}-${twoDigits(start.getUTCDate())}`;
};

const salaryTypeLabel = (value: SalaryType) => {
  if (value === "daily") return "Harian";
  if (value === "hourly") return "Per jam";
  return "Bulanan";
};

const salaryRateLabel = (value: SalaryType) => {
  if (value === "daily") return "Tarif per hari";
  if (value === "hourly") return "Tarif per jam";
  return "Gaji per bulan";
};

const blankEmployee = () => ({
  user_id: "",
  employee_code: "",
  full_name: "",
  position: "",
  phone: "",
  hire_date: today(),
  salary_type: "monthly" as SalaryType,
  salary_rate: 0,
  monthly_salary: 0,
  status: "active",
  version: 0,
});

const blankSalary = (employee?: Employee | null) => ({
  salary_type: (employee?.salary_type || "monthly") as SalaryType,
  period: currentPeriod(),
  period_start: today(),
  period_end: today(),
  unit_rate: employee?.salary_rate || employee?.monthly_salary || 0,
  work_quantity: 1,
  bonus: 0,
  deductions: 0,
  paid_on: today(),
  payment_method: "transfer",
  notes: "",
});

export function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [page, setPage] = useState(1);
  const [pageMeta, setPageMeta] = useState({
    page: 1,
    limit: 50,
    has_more: false,
  });
  const [users, setUsers] = useState<AccountOption[]>([]);
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
  const confirm = useConfirm();

  const load = useCallback(async () => {
    setError("");
    try {
      const [employeeResult, userValues] = await Promise.all([
        apiPage<Employee>(
          `/employees?q=${encodeURIComponent(debouncedQuery)}&page=${page}&limit=50`,
        ),
        fetchAllPages<AccountOption>("/admin/users", {
          pageSize: 100,
          maxItems: 5_000,
        }),
      ]);
      setEmployees(employeeResult.items);
      setPageMeta(employeeResult.meta);
      setUsers(userValues);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Gagal memuat karyawan",
      );
    }
  }, [debouncedQuery, page]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  const openCreate = () => {
    const hasAvailableAccount = users.some(
      (item) =>
        item.role !== "owner" &&
        item.status === "active" &&
        !item.employee_id,
    );
    if (!hasAvailableAccount) {
      show(
        "Belum ada akun karyawan yang tersedia. Buat akun terlebih dahulu pada menu Administrasi, lalu kembali ke Karyawan & Gaji.",
        true,
      );
      return;
    }
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
      salary_type: value.salary_type || "monthly",
      salary_rate: value.salary_rate ?? value.monthly_salary ?? 0,
      monthly_salary: value.monthly_salary,
      status: value.status,
      version: value.version,
    });
    setModal("employee");
  };

  const deleteEmployee = async (value: Employee) => {
    if (
      !(await confirm({
        title: "Hapus karyawan?",
        message: `Karyawan ${value.full_name} akan dihapus. Akun aplikasi yang terhubung tidak ikut dihapus dan akan menjadi tidak terhubung. Jika sudah memiliki riwayat gaji, nonaktifkan karyawan agar catatan keuangan tetap utuh.`,
        confirmLabel: "Hapus karyawan",
        tone: "danger",
      }))
    )
      return;
    setSaving(true);
    try {
      await api(`/employees/${value.id}`, json("DELETE"));
      show("Karyawan berhasil dihapus.");
      if (selected?.id === value.id) setModal(null);
      await load();
    } catch (reason) {
      show(
        reason instanceof Error ? reason.message : "Gagal menghapus karyawan",
        true,
      );
    } finally {
      setSaving(false);
    }
  };

  const saveEmployee = async () => {
    const payload = {
      user_id: employee.user_id.trim() || null,
      position: employee.position.trim(),
      phone: employee.phone.trim(),
      hire_date: employee.hire_date,
      salary_type: employee.salary_type,
      salary_rate: employee.salary_rate,
      monthly_salary:
        employee.salary_type === "monthly" ? employee.salary_rate : 0,
      status: employee.status || "active",
      version: employee.version,
    };
    const validationMessage =
      (!payload.user_id &&
        "Akun karyawan wajib dipilih. Buat akun terlebih dahulu pada menu Administrasi.") ||
      (!payload.position && "Jabatan wajib diisi.") ||
      (payload.position.length > 100 && "Jabatan maksimal 100 karakter.") ||
      (payload.phone.length > 32 && "Nomor telepon maksimal 32 karakter.") ||
      (!validISODate(payload.hire_date) &&
        "Tanggal mulai bekerja tidak valid.") ||
      (payload.user_id &&
        !isUUID(payload.user_id) &&
        "Akun aplikasi yang dipilih tidak valid. Muat ulang halaman lalu pilih kembali akun.") ||
      (!validRupiah(payload.salary_rate) &&
        "Tarif gaji harus berupa Rupiah bulat, tidak negatif, dan tidak terlalu besar.") ||
      (selected &&
        payload.version < 1 &&
        "Versi data tidak valid. Muat ulang halaman lalu coba lagi.");
    if (validationMessage) {
      show(validationMessage, true);
      return;
    }

    setSaving(true);
    try {
      if (selected) {
        await api(`/employees/${selected.id}`, json("PUT", payload));
        show("Data karyawan berhasil diperbarui.");
      } else {
        await api("/employees", json("POST", payload));
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

  const loadSalaries = async (
    value: Employee,
    target: "salary" | "history",
  ) => {
    if (target === "salary" && value.status !== "active") {
      show(
        "Gaji hanya dapat dibayarkan kepada karyawan yang masih aktif.",
        true,
      );
      return;
    }
    setSelected(value);
    try {
      setSalaries(
        asArray(await api<SalaryPayment[]>(`/employees/${value.id}/salaries`)),
      );
      if (target === "salary") setSalary(blankSalary(value));
      setModal(target);
    } catch (reason) {
      show(
        reason instanceof Error ? reason.message : "Gagal memuat riwayat gaji",
        true,
      );
    }
  };

  const saveSalary = async () => {
    if (!selected) return;
    const workQuantity =
      salary.salary_type === "monthly" ? 1 : salary.work_quantity;
    const workQuantityMilli = Math.round(workQuantity * 1000);
    if (
      !validRupiah(salary.unit_rate) ||
      !Number.isSafeInteger(workQuantityMilli) ||
      workQuantityMilli <= 0 ||
      !validRupiah(salary.bonus) ||
      !validRupiah(salary.deductions) ||
      !Number.isSafeInteger(baseSalary) ||
      !Number.isSafeInteger(netSalary) ||
      netSalary < 0
    ) {
      show(
        "Periksa tarif, jumlah hari/jam, bonus, dan potongan sebelum menyimpan.",
        true,
      );
      return;
    }
    if (
      salary.salary_type !== "monthly" &&
      (!validISODate(salary.period_start) ||
        !validISODate(salary.period_end) ||
        salary.period_end < salary.period_start)
    ) {
      show("Rentang tanggal kerja tidak valid.", true);
      return;
    }
    if (
      salary.salary_type !== "monthly" &&
      salary.work_quantity > maximumWorkQuantity
    ) {
      show(
        `${salary.salary_type === "daily" ? "Jumlah hari" : "Jumlah jam"} melebihi rentang tanggal kerja.`,
        true,
      );
      return;
    }
    if (salaryPeriodConflict) {
      show(
        "Periode ini bertumpuk dengan pembayaran gaji yang sudah dicatat.",
        true,
      );
      return;
    }
    if (
      !(await confirm({
        title: "Catat pembayaran gaji?",
        message: `Pembayaran gaji ${selected.full_name} sebesar ${rupiah(netSalary)} akan disimpan ke riwayat kas dan gaji.`,
        confirmLabel: "Catat pembayaran",
      }))
    )
      return;
    setSaving(true);
    try {
      const shiftId =
        salary.payment_method === "cash" ? await requireActiveShiftID() : null;
      await api(
        `/employees/${selected.id}/salaries`,
        json("POST", {
          salary_type: salary.salary_type,
          period: salary.period,
          period_start:
            salary.salary_type === "monthly" ? undefined : salary.period_start,
          period_end:
            salary.salary_type === "monthly" ? undefined : salary.period_end,
          unit_rate: salary.unit_rate,
          work_quantity_milli: workQuantityMilli,
          bonus: salary.bonus,
          deductions: salary.deductions,
          paid_on: salary.paid_on,
          payment_method: salary.payment_method,
          notes: salary.notes,
          shift_id: shiftId,
        }),
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

  const baseSalary = useMemo(() => {
    const quantityValue =
      salary.salary_type === "monthly" ? 1 : salary.work_quantity;
    const value = salary.unit_rate * quantityValue;
    return Number.isFinite(value) && value >= 0
      ? Math.floor(value)
      : Number.NaN;
  }, [salary.salary_type, salary.unit_rate, salary.work_quantity]);

  const netSalary = useMemo(
    () => baseSalary + salary.bonus - salary.deductions,
    [baseSalary, salary.bonus, salary.deductions],
  );

  const maximumWorkQuantity = useMemo(() => {
    if (
      salary.salary_type === "monthly" ||
      !validISODate(salary.period_start) ||
      !validISODate(salary.period_end) ||
      salary.period_end < salary.period_start
    )
      return 1;
    const start = new Date(`${salary.period_start}T00:00:00Z`);
    const end = new Date(`${salary.period_end}T00:00:00Z`);
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    return salary.salary_type === "hourly" ? days * 24 : days;
  }, [salary.period_end, salary.period_start, salary.salary_type]);

  const salaryPeriodConflict = useMemo(() => {
    const desiredStart =
      salary.salary_type === "monthly"
        ? salary.period
          ? `${salary.period}-01`
          : ""
        : salary.period_start;
    const desiredEnd =
      salary.salary_type === "monthly"
        ? monthEnd(salary.period)
        : salary.period_end;
    if (!desiredStart || !desiredEnd || desiredEnd < desiredStart) return false;

    return salaries.some((item) => {
      const existingStart = (item.period_start || item.period).slice(0, 10);
      const existingEnd = (item.period_end || item.period_start || item.period).slice(
        0,
        10,
      );
      return !(existingEnd < desiredStart || existingStart > desiredEnd);
    });
  }, [
    salaries,
    salary.period,
    salary.period_end,
    salary.period_start,
    salary.salary_type,
  ]);

  const invalidRelationCount = useMemo(
    () =>
      employees.filter(
        (item) => !item.user_id || item.user_role === "owner",
      ).length,
    [employees],
  );

  const selectedAccount = users.find((item) => item.id === employee.user_id);
  const selectedAccountInvalid = Boolean(
    employee.user_id &&
      (!selectedAccount ||
        selectedAccount.role === "owner" ||
        (selectedAccount.status !== "active" &&
          selectedAccount.id !== selected?.user_id)),
  );
  const availableAccountCount = users.filter(
    (item) =>
      item.role !== "owner" &&
      item.status === "active" &&
      (!item.employee_id || item.employee_id === selected?.id),
  ).length;


  return (
    <>
      {node}
      <PageHeader
        title="Karyawan & gaji"
        description="Hubungkan akun karyawan yang sudah dibuat di Administrasi, lalu atur jabatan dan gaji bulanan, harian, atau per jam."
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Cari nama, kode, atau jabatan karyawan..."
            />
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">
                {employees.length} karyawan di halaman ini
              </Badge>
              <Badge tone={availableAccountCount > 0 ? "success" : "warning"}>
                {availableAccountCount} akun siap dihubungkan
              </Badge>
            </div>
          </div>
          <div className="mb-4 flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
            <Link2 />
            <span>
              Alur yang benar: buat akun pada <strong>Administrasi</strong>, kemudian
              pilih akun tersebut saat menambahkan karyawan. Nama karyawan mengikuti
              nama akun, sedangkan kode karyawan dibuat otomatis oleh sistem dengan
              format <strong>KK0001</strong>, <strong>KK0002</strong>, dan seterusnya.
            </span>
          </div>
          {invalidRelationCount > 0 && (
            <div className="mb-4 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">
              <AlertTriangle />
              <span>
                Ditemukan <strong>{invalidRelationCount} data lama yang belum mengikuti alur baru</strong>.
                Buka <strong>Ubah</strong>, lalu pilih akun karyawan yang benar. Akun pemilik
                toko tidak dapat dipakai sebagai akun karyawan.
              </span>
            </div>
          )}
          <div className="w-full overflow-auto rounded-xl">
            <table className="w-full min-w-[980px] border-collapse text-[11px] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-[#dfe7e2] [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_td]:text-slate-700 [&_tbody_tr:hover]:bg-slate-50 [&_td>strong]:block [&_td>small]:mt-1 [&_td>small]:block [&_td>small]:text-[10px] [&_td>small]:text-slate-500 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-1 [&_code]:text-[9px]">
              <thead>
                <tr>
                  <th>Karyawan</th>
                  <th>Akun aplikasi</th>
                  <th>Jabatan</th>
                  <th>Mulai bekerja</th>
                  <th>Sistem gaji</th>
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
                    <td>
                      {item.user_id ? (
                        <>
                          <strong>@{item.user_username || "akun"}</strong>
                          <small>
                            {displayLabel(item.user_role || "pengguna")} ·{" "}
                            {displayLabel(item.user_status || "active")}
                          </small>
                          {item.user_full_name &&
                            normalizePersonName(item.user_full_name) !==
                              normalizePersonName(item.full_name) && (
                              <small className="font-semibold text-red-700">
                                Nama akun tidak sesuai
                              </small>
                            )}
                        </>
                      ) : (
                        <span className="text-slate-400">Belum terhubung</span>
                      )}
                    </td>
                    <td>{item.position}</td>
                    <td>{dateOnly(item.hire_date)}</td>
                    <td>
                      <strong>
                        {rupiah(item.salary_rate ?? item.monthly_salary)}
                      </strong>
                      <small>
                        {salaryTypeLabel(item.salary_type || "monthly")}
                      </small>
                    </td>
                    <td>
                      <Badge
                        tone={item.status === "active" ? "success" : "neutral"}
                      >
                        {displayLabel(item.status)}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button variant="ghost" onClick={() => openEdit(item)}>
                          <Pencil /> Ubah
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => void deleteEmployee(item)}
                        >
                          <Trash2 /> Hapus
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={item.status !== "active"}
                          title={
                            item.status === "active"
                              ? "Catat pembayaran gaji"
                              : "Aktifkan karyawan sebelum membayar gaji"
                          }
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
                description="Buat akun karyawan di Administrasi terlebih dahulu, kemudian tambahkan data jabatan dan gajinya di halaman ini."
              />
            )}
          </div>
          <Pagination meta={pageMeta} onPageChange={setPage} />
        </Card>
      )}

      <Modal
        open={modal === "employee"}
        title={selected ? "Ubah karyawan" : "Tambah karyawan"}
        onClose={() => setModal(null)}
        wide
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="Akun karyawan"
            value={employee.user_id}
            onChange={(event) => {
              const account = users.find(
                (item) => item.id === event.target.value,
              );
              setEmployee({
                ...employee,
                user_id: event.target.value,
                full_name: account?.full_name || "",
              });
            }}
          >
            <option value="">Pilih akun karyawan</option>
            {users
              .filter(
                (item) =>
                  item.role !== "owner" &&
                  (!item.employee_id ||
                    item.employee_id === selected?.id ||
                    item.id === employee.user_id),
              )
              .map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                  disabled={
                    item.status !== "active" && item.id !== employee.user_id
                  }
                >
                  {item.full_name} (@{item.username}) · {displayLabel(item.role)}
                  {item.status !== "active"
                    ? ` · ${displayLabel(item.status)}`
                    : ""}
                </option>
              ))}
          </Select>
          <Input
            label="Kode karyawan"
            value={selected ? employee.employee_code : "Dibuat otomatis setelah disimpan"}
            disabled
            hint={
              selected
                ? "Kode dibuat otomatis oleh sistem dan tidak dapat diubah."
                : "Format otomatis: KK0001, KK0002, dan seterusnya."
            }
          />
          <Input
            label="Nama lengkap"
            value={employee.full_name}
            disabled
            placeholder="Mengikuti akun yang dipilih"
            hint="Ubah nama akun melalui menu Administrasi bila diperlukan."
          />
          <Input
            label="Jabatan"
            value={employee.position}
            maxLength={100}
            onChange={(event) =>
              setEmployee({ ...employee, position: event.target.value })
            }
            placeholder="Contoh: Kasir"
          />
          <Input
            label="Nomor telepon"
            value={employee.phone}
            maxLength={32}
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
          <Select
            label="Sistem gaji"
            value={employee.salary_type}
            onChange={(event) =>
              setEmployee({
                ...employee,
                salary_type: event.target.value as SalaryType,
              })
            }
          >
            <option value="monthly">Bulanan</option>
            <option value="daily">Harian</option>
            <option value="hourly">Per jam</option>
          </Select>
          <Input
            label={salaryRateLabel(employee.salary_type)}
            type="number"
            min="0"
            step="1"
            value={employee.salary_rate}
            onChange={(event) =>
              setEmployee({
                ...employee,
                salary_rate: Number(event.target.value),
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
        {selectedAccount && (
          <div
            className={`mt-4 flex gap-3 rounded-xl border p-3 text-xs leading-5 ${
              selectedAccountInvalid
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {selectedAccountInvalid ? <AlertTriangle /> : <Link2 />}
            <div>
              <strong className="block">
                Akun @{selectedAccount.username} terdaftar pada toko ini.
              </strong>
              <span>
                {selectedAccount.role === "owner"
                  ? "Akun pemilik tidak dapat digunakan sebagai akun karyawan. Pilih akun lain yang dibuat melalui Administrasi."
                  : selectedAccount.status !== "active" &&
                      selectedAccount.id !== selected?.user_id
                    ? "Akun ini tidak aktif. Aktifkan akun melalui Administrasi terlebih dahulu."
                    : `Nama karyawan akan menggunakan nama akun “${selectedAccount.full_name}”.`}
              </span>
            </div>
          </div>
        )}
        {employee.status === "inactive" && employee.user_id && (
          <div className="mt-3 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            <AlertTriangle />
            <span>
              Menonaktifkan karyawan tidak otomatis menonaktifkan akun
              aplikasinya. Atur akses akun pada menu Administrasi bila akun juga
              harus dihentikan.
            </span>
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          {selected && (
            <Button
              variant="danger"
              loading={saving}
              onClick={() => void deleteEmployee(selected)}
            >
              <Trash2 /> Hapus karyawan
            </Button>
          )}
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={
              !employee.user_id ||
              !employee.full_name.trim() ||
              !employee.position.trim() ||
              !validISODate(employee.hire_date) ||
              !validRupiah(employee.salary_rate) ||
              selectedAccountInvalid
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="Sistem perhitungan"
            value={salary.salary_type}
            disabled
          >
            <option value="monthly">Bulanan</option>
            <option value="daily">Harian</option>
            <option value="hourly">Per jam</option>
          </Select>
          {salary.salary_type === "monthly" ? (
            <Input
              label="Periode gaji"
              type="month"
              value={salary.period}
              onChange={(event) =>
                setSalary({ ...salary, period: event.target.value })
              }
            />
          ) : (
            <>
              <Input
                label="Tanggal awal kerja"
                type="date"
                value={salary.period_start}
                onChange={(event) =>
                  setSalary({ ...salary, period_start: event.target.value })
                }
              />
              <Input
                label="Tanggal akhir kerja"
                type="date"
                value={salary.period_end}
                onChange={(event) =>
                  setSalary({ ...salary, period_end: event.target.value })
                }
              />
            </>
          )}
          <Input
            label={salaryRateLabel(salary.salary_type)}
            type="number"
            min="0"
            step="1"
            value={salary.unit_rate}
            disabled
            hint="Tarif mengikuti data karyawan. Ubah data karyawan bila tarif berubah."
          />
          {salary.salary_type !== "monthly" && (
            <Input
              label={
                salary.salary_type === "daily" ? "Jumlah hari" : "Jumlah jam"
              }
              type="number"
              min="0.001"
              max={maximumWorkQuantity}
              step="0.001"
              value={salary.work_quantity}
              hint={`Maksimal ${maximumWorkQuantity} ${
                salary.salary_type === "daily" ? "hari" : "jam"
              } untuk rentang yang dipilih.`}
              onChange={(event) =>
                setSalary({
                  ...salary,
                  work_quantity: Number(event.target.value),
                })
              }
            />
          )}
          <Input
            label="Tanggal pembayaran"
            type="date"
            value={salary.paid_on}
            onChange={(event) =>
              setSalary({ ...salary, paid_on: event.target.value })
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
          onChange={(event) =>
            setSalary({ ...salary, notes: event.target.value })
          }
        />
        {salaryPeriodConflict && (
          <div className="mt-4 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">
            <AlertTriangle />
            <span>
              Periode ini bertumpuk dengan pembayaran yang sudah tercatat. Pilih
              periode lain agar gaji tidak dibayar dua kali.
            </span>
          </div>
        )}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#dfe7e2] bg-white p-4">
            <small className="text-slate-500">Gaji pokok terhitung</small>
            <strong className="mt-1 block text-lg text-slate-900">
              {rupiah(baseSalary)}
            </strong>
          </div>
          <div className="rounded-2xl border border-[#dfe7e2] bg-brand-50 p-4">
            <small className="text-slate-500">Total gaji bersih</small>
            <strong className="mt-1 block text-xl text-brand-900">
              {rupiah(Math.max(0, netSalary))}
            </strong>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={
              !salary.paid_on ||
              netSalary < 0 ||
              salaryPeriodConflict ||
              (salary.salary_type !== "monthly" &&
                salary.work_quantity > maximumWorkQuantity) ||
              (salary.salary_type === "monthly"
                ? !salary.period
                : !salary.period_start ||
                  !salary.period_end ||
                  salary.work_quantity <= 0)
            }
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
        <div className="w-full overflow-auto rounded-xl">
          <table className="w-full min-w-[760px] border-collapse text-[11px] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-[#dfe7e2] [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_td]:text-slate-700 [&_tbody_tr:hover]:bg-slate-50 [&_td>strong]:block [&_td>small]:mt-1 [&_td>small]:block [&_td>small]:text-[10px] [&_td>small]:text-slate-500 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-1 [&_code]:text-[9px]">
            <thead>
              <tr>
                <th>Periode</th>
                <th>Perhitungan</th>
                <th>Gaji pokok</th>
                <th>Bonus</th>
                <th>Potongan</th>
                <th>Bersih</th>
                <th>Dibayar</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {salaries.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>
                      {item.salary_type === "monthly"
                        ? new Intl.DateTimeFormat("id-ID", {
                            month: "long",
                            year: "numeric",
                            timeZone: "UTC",
                          }).format(new Date(item.period))
                        : `${dateOnly(item.period_start)} – ${dateOnly(item.period_end)}`}
                    </strong>
                    <small>{displayLabel(item.payment_method)}</small>
                  </td>
                  <td>
                    <strong>{salaryTypeLabel(item.salary_type)}</strong>
                    <small>
                      {rupiah(item.unit_rate)} ×{" "}
                      {quantity(item.work_quantity_milli)}
                      {item.salary_type === "daily"
                        ? " hari"
                        : item.salary_type === "hourly"
                          ? " jam"
                          : " bulan"}
                    </small>
                  </td>
                  <td>{rupiah(item.base_salary)}</td>
                  <td>{rupiah(item.bonus)}</td>
                  <td>{rupiah(item.deductions)}</td>
                  <td>
                    <strong>{rupiah(item.net_salary)}</strong>
                  </td>
                  <td>
                    <CalendarDays /> {dateOnly(item.paid_on)}
                  </td>
                  <td>{item.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!salaries.length && <EmptyState title="Belum ada pembayaran gaji" />}
        </div>
      </Modal>
    </>
  );
}
