import {
  FileClock,
  KeyRound,
  Pencil,
  Plus,
  Settings,
  ShieldCheck,
  Store,
  Users,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useConfirm } from "../components/feedback";
import { api, apiPage, json } from "../lib/api";
import {
  activityLabel,
  asArray,
  dateTime,
  displayLabel,
  isUUID,
} from "../lib/format";
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

type AdminRole = {
  id: string;
  code: string;
  name: string;
  permissions: string[];
};

type AdminUser = {
  id: string;
  role_id: string;
  role: string;
  role_name: string;
  username: string;
  full_name: string;
  status: string;
  version: number;
  last_login_at?: string | null;
  employee_id?: string | null;
  employee_code?: string | null;
  employee_name?: string | null;
  employee_position?: string | null;
  employee_status?: string | null;
};

export function AdminPage() {
  const { user: sessionUser } = useAuth();
  const [tab, setTab] = useState<"users" | "store" | "devices" | "audit">(
    "users",
  );
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const debouncedUserQuery = useDebouncedValue(userQuery, 300);
  const [userPage, setUserPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [userMeta, setUserMeta] = useState({
    page: 1,
    limit: 50,
    has_more: false,
  });
  const [auditMeta, setAuditMeta] = useState({
    page: 1,
    limit: 50,
    has_more: false,
  });
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [store, setStore] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"user" | "reset" | "revoke" | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [user, setUser] = useState({
    role_id: "",
    username: "",
    full_name: "",
    password: "",
    status: "active",
    version: 0,
  });
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const { show, node } = useToast();
  const confirm = useConfirm();
  const load = useCallback(async () => {
    setError("");
    try {
      const results = await Promise.allSettled([
        apiPage<AdminUser>(
          `/admin/users?q=${encodeURIComponent(debouncedUserQuery)}&page=${userPage}&limit=50`,
        ),
        api("/admin/roles"),
        api("/admin/store"),
        api("/sync/devices"),
        apiPage<any>(`/admin/audit-logs?page=${auditPage}&limit=50`),
      ]);
      if (results[0].status === "fulfilled") {
        setUsers(results[0].value.items);
        setUserMeta(results[0].value.meta);
      }
      if (results[1].status === "fulfilled")
        setRoles(asArray(results[1].value));
      if (results[2].status === "fulfilled") setStore(results[2].value);
      if (results[3].status === "fulfilled")
        setDevices(asArray(results[3].value));
      if (results[4].status === "fulfilled") {
        setAudit(results[4].value.items);
        setAuditMeta(results[4].value.meta);
      }
      const rejected = results.find((item) => item.status === "rejected");
      if (rejected?.status === "rejected")
        setError(
          rejected.reason instanceof Error
            ? rejected.reason.message
            : "Sebagian data administrasi belum dapat dimuat.",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat administrasi");
    }
  }, [auditPage, debouncedUserQuery, userPage]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setUserPage(1);
  }, [debouncedUserQuery]);
  const openCreateUser = () => {
    const defaultEmployeeRole =
      roles.find((item) => item.code === "cashier") ||
      roles.find((item) => item.code !== "owner");
    setSelected(null);
    setUser({
      role_id: defaultEmployeeRole?.id || "",
      username: "",
      full_name: "",
      password: "",
      status: "active",
      version: 0,
    });
    setModal("user");
  };
  const openEditUser = (item: AdminUser) => {
    setSelected(item);
    setUser({
      role_id: item.role_id,
      username: item.username,
      full_name: item.full_name,
      password: "",
      status: item.status,
      version: item.version,
    });
    setModal("user");
  };
  const saveUser = async () => {
    const payload = {
      ...user,
      role_id: user.role_id.trim(),
      username: user.username.trim(),
      full_name: user.full_name.trim(),
    };
    if (!isUUID(payload.role_id)) {
      show(
        "Hak akses yang dipilih tidak valid. Muat ulang halaman lalu pilih kembali hak akses.",
        true,
      );
      return;
    }
    if (!payload.full_name) {
      show("Nama lengkap wajib diisi.", true);
      return;
    }
    if (!selected && !/^[a-zA-Z0-9._-]{3,80}$/.test(payload.username)) {
      show(
        "Nama pengguna harus 3–80 karakter dan hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.",
        true,
      );
      return;
    }

    setSaving(true);
    try {
      await api(
        selected ? `/admin/users/${selected.id}` : "/admin/users",
        json(selected ? "PUT" : "POST", payload),
      );
      show(`Akun berhasil ${selected ? "diperbarui" : "dibuat"}.`);
      setModal(null);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal menyimpan akun", true);
    } finally {
      setSaving(false);
    }
  };
  const resetPassword = async () => {
    setSaving(true);
    try {
      await api(
        `/admin/users/${selected.id}/reset-password`,
        json("POST", { password }),
      );
      show("Kata sandi berhasil diganti.");
      setModal(null);
      setPassword("");
    } catch (e) {
      show(e instanceof Error ? e.message : "Ganti kata sandi gagal", true);
    } finally {
      setSaving(false);
    }
  };
  const saveStore = async () => {
    if (
      !(await confirm({
        title: "Simpan pengaturan toko?",
        message:
          "Perubahan ini akan berlaku untuk transaksi dan operasional toko berikutnya.",
        confirmLabel: "Simpan pengaturan",
      }))
    )
      return;
    setSaving(true);
    try {
      setStore(await api("/admin/store", json("PUT", store)));
      show("Pengaturan toko diperbarui.");
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal menyimpan toko", true);
    } finally {
      setSaving(false);
    }
  };
  const revoke = async () => {
    setSaving(true);
    try {
      await api(`/admin/devices/${selected.id}/revoke`, json("POST"));
      show("Akses komputer dihentikan.");
      setModal(null);
      await load();
    } catch (e) {
      show(
        e instanceof Error ? e.message : "Gagal menghentikan akses komputer",
        true,
      );
    } finally {
      setSaving(false);
    }
  };

  const editingSelf = Boolean(selected && selected.id === sessionUser?.id);

  return (
    <>
      {node}
      <PageHeader
        title="Administrasi"
        description="Buat akun karyawan terlebih dahulu, lalu lengkapi jabatan dan gajinya melalui menu Karyawan & Gaji."
        action={
          tab === "users" ? (
            <Button onClick={openCreateUser}>
              <Plus /> Tambah akun karyawan
            </Button>
          ) : undefined
        }
      />
      <Tabs
        value={tab}
        onChange={(value) => setTab(value as typeof tab)}
        items={[
          { value: "users", label: "Pengguna", icon: <Users /> },
          { value: "store", label: "Toko", icon: <Store /> },
          { value: "devices", label: "Komputer kasir", icon: <ShieldCheck /> },
          { value: "audit", label: "Riwayat aktivitas", icon: <FileClock /> },
        ]}
      />
      {error && <ErrorState message={error} retry={() => void load()} />}
      {tab === "users" && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SearchInput
              value={userQuery}
              onChange={setUserQuery}
              placeholder="Cari nama atau nama pengguna..."
            />
            <Badge tone="info">{users.length} pengguna di halaman ini</Badge>
          </div>
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
            <strong className="block">Urutan pembuatan akun karyawan</strong>
            <span>
              Buat akun karyawan pada halaman ini terlebih dahulu. Akun otomatis
              tercatat pada toko milik pemilik yang sedang masuk. Setelah akun
              berhasil dibuat, buka menu <strong>Karyawan & Gaji</strong> untuk
              melengkapi jabatan, sistem gaji, dan menghubungkan akun tersebut.
              Relasi karyawan tidak dapat diubah dari Administrasi agar tidak
              salah terhubung.
            </span>
          </div>
          <div className="w-full overflow-auto rounded-xl">
            <table className="w-full min-w-[940px] border-collapse text-[11px] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-[#dfe7e2] [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_td]:text-slate-700 [&_tbody_tr:hover]:bg-slate-50 [&_td>strong]:block [&_td>small]:mt-1 [&_td>small]:block [&_td>small]:text-[10px] [&_td>small]:text-slate-500 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-1 [&_code]:text-[9px]">
              <thead>
                <tr>
                  <th>Pengguna</th>
                  <th>Hak akses</th>
                  <th>Karyawan terhubung</th>
                  <th>Terakhir masuk</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.full_name}</strong>
                      <small>@{item.username}</small>
                      {item.id === sessionUser?.id && (
                        <Badge tone="success">Akun Anda</Badge>
                      )}
                    </td>
                    <td>
                      <Badge tone="info">{displayLabel(item.role)}</Badge>
                    </td>
                    <td>
                      {item.employee_id ? (
                        <>
                          <strong>
                            {item.employee_name || item.employee_code}
                          </strong>
                          <small>
                            {item.employee_code} · {item.employee_position}
                          </small>
                        </>
                      ) : (
                        <span className="text-slate-400">Belum terhubung</span>
                      )}
                    </td>
                    <td>{dateTime(item.last_login_at)}</td>
                    <td>
                      <Badge
                        tone={
                          item.status === "active"
                            ? "success"
                            : item.status === "locked"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {displayLabel(item.status)}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          onClick={() => openEditUser(item)}
                        >
                          <Pencil /> Ubah
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setSelected(item);
                            setModal("reset");
                          }}
                        >
                          <KeyRound /> Ganti kata sandi
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!users.length && (
              <EmptyState title="Belum ada akun tambahan" description="Buat akun karyawan sebelum menambahkan data Karyawan & Gaji." />
            )}
          </div>
          <Pagination meta={userMeta} onPageChange={setUserPage} />
        </Card>
      )}
      {tab === "store" && (
        <Card title="Profil & pengaturan toko">
          {store ? (
            <div className="">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Select
                  label="Jenis usaha"
                  value={store.business_type || "grocery"}
                  onChange={(e) =>
                    setStore({ ...store, business_type: e.target.value })
                  }
                >
                  <option value="grocery">Toko sembako</option>
                  <option value="cafe_restaurant">Kafe & restoran</option>
                  <option value="pharmacy">Apotek</option>
                  <option value="building_materials">Toko bangunan</option>
                </Select>
                <Input
                  label="Nama toko"
                  value={store.name || ""}
                  onChange={(e) => setStore({ ...store, name: e.target.value })}
                />
                <Input
                  label="Telepon"
                  value={store.phone || ""}
                  onChange={(e) =>
                    setStore({ ...store, phone: e.target.value })
                  }
                />
                <Input
                  label="Zona waktu"
                  value={store.timezone || ""}
                  onChange={(e) =>
                    setStore({ ...store, timezone: e.target.value })
                  }
                />
                <Input
                  label="Batas diskon yang perlu persetujuan (%)"
                  type="number"
                  min="0"
                  max="10000"
                  value={(store.discount_approval_threshold_bps || 0) / 100}
                  onChange={(e) =>
                    setStore({
                      ...store,
                      discount_approval_threshold_bps:
                        Number(e.target.value) * 100,
                    })
                  }
                />
                <Input
                  label="Batas persetujuan utang"
                  type="number"
                  min="0"
                  value={store.debt_approval_threshold || 0}
                  onChange={(e) =>
                    setStore({
                      ...store,
                      debt_approval_threshold: Number(e.target.value),
                    })
                  }
                />
              </div>
              <Textarea
                label="Alamat"
                value={store.address || ""}
                onChange={(e) =>
                  setStore({ ...store, address: e.target.value })
                }
              />
              <Textarea
                label="Pesan di bagian bawah struk"
                value={store.receipt_footer || ""}
                onChange={(e) =>
                  setStore({ ...store, receipt_footer: e.target.value })
                }
              />
              <div className="my-4 grid grid-cols-1 gap-3 md:grid-cols-2 [&_label]:flex [&_label]:gap-3 [&_label]:rounded-xl [&_label]:border [&_label]:border-[#dfe7e2] [&_label]:p-3 [&_input]:accent-brand-700 [&_span]:flex [&_span]:flex-col [&_strong]:text-[10px] [&_small]:mt-1 [&_small]:text-[8px] [&_small]:text-slate-500">
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(store.allow_negative_stock)}
                    onChange={(e) =>
                      setStore({
                        ...store,
                        allow_negative_stock: e.target.checked,
                      })
                    }
                  />
                  <span>
                    <strong>Izinkan stok negatif</strong>
                    <small>
                      Penjualan dapat dilakukan saat stok tidak cukup.
                    </small>
                  </span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(store.require_debt_approval)}
                    onChange={(e) =>
                      setStore({
                        ...store,
                        require_debt_approval: e.target.checked,
                      })
                    }
                  />
                  <span>
                    <strong>Persetujuan transaksi utang</strong>
                    <small>Utang tertentu membutuhkan persetujuan.</small>
                  </span>
                </label>
              </div>
              <Button loading={saving} onClick={() => void saveStore()}>
                <Settings /> Simpan pengaturan
              </Button>
            </div>
          ) : (
            <EmptyState title="Pengaturan toko tidak tersedia" />
          )}
        </Card>
      )}
      {tab === "devices" && (
        <Card>
          <div className="[&_article]:flex [&_article]:items-center [&_article]:gap-3 [&_article]:border-b [&_article]:border-[#dfe7e2] [&_article]:py-3 [&_strong]:text-xs [&_small]:text-[10px] [&_small]:text-slate-500">
            {devices.map((item) => (
              <article key={item.id}>
                <span
                  className={
                    item.status === "active"
                      ? "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"
                      : "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700"
                  }
                >
                  <ShieldCheck />
                </span>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    Terakhir digunakan {dateTime(item.last_sync_at)}
                  </small>
                </div>
                <div>
                  <Badge tone={item.status === "active" ? "success" : "danger"}>
                    {displayLabel(item.status)}
                  </Badge>
                  <Button
                    variant="ghost"
                    disabled={item.status === "revoked"}
                    onClick={() => {
                      setSelected(item);
                      setModal("revoke");
                    }}
                  >
                    <WifiOff /> Cabut
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </Card>
      )}
      {tab === "audit" && (
        <Card>
          <div className="w-full overflow-auto rounded-xl">
            <table className="w-full min-w-[760px] border-collapse text-[11px] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-[#dfe7e2] [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_td]:text-slate-700 [&_tbody_tr:hover]:bg-slate-50 [&_td>strong]:block [&_td>small]:mt-1 [&_td>small]:block [&_td>small]:text-[10px] [&_td>small]:text-slate-500 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-1 [&_code]:text-[9px]">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Aktivitas</th>
                  <th>Bagian</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((item) => (
                  <tr key={item.id}>
                    <td>{dateTime(item.occurred_at)}</td>
                    <td>
                      <strong>{activityLabel(item.action)}</strong>
                    </td>
                    <td>{displayLabel(item.object_type)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!audit.length && (
              <EmptyState title="Belum ada riwayat aktivitas" />
            )}
          </div>
          <Pagination meta={auditMeta} onPageChange={setAuditPage} />
        </Card>
      )}
      <Modal
        open={modal === "user"}
        title={selected ? "Ubah akun" : "Tambah akun karyawan"}
        onClose={() => setModal(null)}
        wide
      >
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
          Akun baru otomatis terikat ke toko Anda. Setelah akun tersimpan, buka
          <strong> Karyawan & Gaji</strong> untuk melengkapi data kerja. Hubungan akun
          dengan karyawan tidak dilakukan dari halaman Administrasi.
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="Hak akses"
            value={user.role_id}
            onChange={(e) => setUser({ ...user, role_id: e.target.value })}
          >
            <option value="">Pilih hak akses</option>
            {roles
              .filter((item) => selected || item.code !== "owner")
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </Select>
          <Input
            label="Nama lengkap"
            value={user.full_name}
            maxLength={150}
            onChange={(e) => setUser({ ...user, full_name: e.target.value })}
          />
          {!selected && (
            <>
              <Input
                label="Nama pengguna"
                value={user.username}
                maxLength={80}
                autoComplete="username"
                onChange={(e) =>
                  setUser({
                    ...user,
                    username: e.target.value.toLocaleLowerCase("id-ID"),
                  })
                }
                hint="Gunakan huruf, angka, titik, garis bawah, atau tanda hubung."
              />
              <Input
                label="Kata sandi awal"
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                value={user.password}
                onChange={(e) => setUser({ ...user, password: e.target.value })}
                hint="Minimal 12 karakter"
              />
            </>
          )}
          {selected && (
            <Select
              label="Status akses"
              value={user.status}
              disabled={editingSelf}
              onChange={(e) => setUser({ ...user, status: e.target.value })}
            >
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
              <option value="locked">Terkunci</option>
            </Select>
          )}
        </div>
        {editingSelf && (
          <div className="mt-3 flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
            <ShieldCheck />
            <span>
              Status akun yang sedang digunakan tidak dapat dinonaktifkan atau
              dikunci.
            </span>
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={
              !user.role_id ||
              !user.full_name.trim() ||
              (!selected &&
                (!/^[a-zA-Z0-9._-]{3,80}$/.test(user.username) ||
                  user.password.length < 12))
            }
            onClick={() => void saveUser()}
          >
            {selected ? "Simpan perubahan" : "Buat akun"}
          </Button>
        </div>
      </Modal>
      <Modal
        open={modal === "reset"}
        title={`Ganti kata sandi ${selected?.full_name || ""}`}
        onClose={() => setModal(null)}
      >
        <Input
          label="Kata sandi baru"
          type="password"
          minLength={12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="Minimal 12 karakter. Gunakan kombinasi yang sulit ditebak."
        />
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={password.length < 12}
            onClick={() => void resetPassword()}
          >
            Ganti kata sandi
          </Button>
        </div>
      </Modal>
      <Modal
        open={modal === "revoke"}
        title="Hentikan akses komputer"
        onClose={() => setModal(null)}
      >
        <div className="p-3 text-center [&>svg]:mx-auto [&>svg]:h-11 [&>svg]:w-11 [&>svg]:rounded-full [&>svg]:bg-brand-50 [&>svg]:p-2.5 [&>svg]:text-brand-700 [&_p]:text-xs [&_p]:leading-6 [&_p]:text-slate-500">
          <WifiOff />
          <h3>{selected?.name}</h3>
          <p>
            Akses pada komputer kasir ini akan dihentikan. Pengguna harus masuk
            kembali jika komputer akan digunakan lagi.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            variant="danger"
            loading={saving}
            onClick={() => void revoke()}
          >
            Hentikan akses
          </Button>
        </div>
      </Modal>
    </>
  );
}
