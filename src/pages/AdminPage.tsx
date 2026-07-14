import {
  FileClock,
  KeyRound,
  Plus,
  Settings,
  ShieldCheck,
  Store,
  Users,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, json } from "../lib/api";
import { activityLabel, asArray, dateTime, displayLabel } from "../lib/format";
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

export function AdminPage() {
  const [tab, setTab] = useState<"users" | "store" | "devices" | "audit">(
    "users",
  );
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
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
    employee_id: "",
  });
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const { show, node } = useToast();
  const load = useCallback(async () => {
    setError("");
    try {
      const results = await Promise.allSettled([
        api("/admin/users"),
        api("/admin/roles"),
        api("/admin/store"),
        api("/sync/devices"),
        api("/admin/audit-logs?limit=100"),
        api("/employees"),
      ]);
      if (results[0].status === "fulfilled")
        setUsers(asArray(results[0].value));
      if (results[1].status === "fulfilled")
        setRoles(asArray(results[1].value));
      if (results[2].status === "fulfilled") setStore(results[2].value);
      if (results[3].status === "fulfilled")
        setDevices(asArray(results[3].value));
      if (results[4].status === "fulfilled")
        setAudit(asArray(results[4].value));
      if (results[5].status === "fulfilled")
        setEmployees(asArray(results[5].value));
      const rejected = results.find((item) => item.status === "rejected");
      if (rejected?.status === "rejected")
        setError(
          rejected.reason instanceof Error
            ? rejected.reason.message
            : "Sebagian data tidak dapat diakses",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat administrasi");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const createUser = async () => {
    setSaving(true);
    try {
      await api("/admin/users", json("POST", { ...user, employee_id: user.employee_id || null }));
      show("Pengguna berhasil dibuat.");
      setModal(null);
      setUser({ role_id: "", username: "", full_name: "", password: "", employee_id: "" });
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal membuat pengguna", true);
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
  return (
    <>
      {node}
      <PageHeader
        title="Administrasi"
        description="Kelola pengguna, hak akses, pengaturan toko, komputer kasir, dan riwayat aktivitas."
        action={
          tab === "users" ? (
            <Button onClick={() => setModal("user")}>
              <Plus /> Tambah pengguna
            </Button>
          ) : undefined
        }
      />
      <div className="tabs admin-tabs">
        <button
          className={tab === "users" ? "active" : ""}
          onClick={() => setTab("users")}
        >
          <Users /> Pengguna
        </button>
        <button
          className={tab === "store" ? "active" : ""}
          onClick={() => setTab("store")}
        >
          <Store /> Toko
        </button>
        <button
          className={tab === "devices" ? "active" : ""}
          onClick={() => setTab("devices")}
        >
          <ShieldCheck /> Komputer Kasir
        </button>
        <button
          className={tab === "audit" ? "active" : ""}
          onClick={() => setTab("audit")}
        >
          <FileClock /> Riwayat
        </button>
      </div>
      {error && <ErrorState message={error} retry={() => void load()} />}
      {tab === "users" && (
        <Card>
          <div className="data-table-wrap">
            <table className="data-table">
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
                    </td>
                    <td>
                      <Badge tone="info">{displayLabel(item.role)}</Badge>
                    </td>
                    <td>
                      {item.employee_id ? (
                        <><strong>{item.employee_code}</strong><small>{item.position}</small></>
                      ) : "—"}
                    </td>
                    <td>{dateTime(item.last_login_at)}</td>
                    <td>
                      <Badge
                        tone={item.status === "active" ? "success" : "danger"}
                      >
                        {displayLabel(item.status)}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSelected(item);
                          setModal("reset");
                        }}
                      >
                        <KeyRound /> Ganti kata sandi
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!users.length && (
              <EmptyState title="Data pengguna tidak tersedia" />
            )}
          </div>
        </Card>
      )}
      {tab === "store" && (
        <Card title="Profil & pengaturan toko">
          {store ? (
            <div className="store-form">
              <div className="form-grid">
                <Select
                  label="Jenis usaha"
                  value={store.business_type || "grocery"}
                  onChange={(e) => setStore({ ...store, business_type: e.target.value })}
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
              <div className="settings-checks">
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
          <div className="device-list">
            {devices.map((item) => (
              <article key={item.id}>
                <span
                  className={
                    item.status === "active"
                      ? "device-online"
                      : "device-offline"
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
          <div className="data-table-wrap">
            <table className="data-table">
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
        </Card>
      )}
      <Modal
        open={modal === "user"}
        title="Tambah pengguna"
        onClose={() => setModal(null)}
      >
        <Select
          label="Hak akses"
          value={user.role_id}
          onChange={(e) => setUser({ ...user, role_id: e.target.value })}
        >
          <option value="">Pilih hak akses</option>
          {roles.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select
          label="Hubungkan dengan karyawan (opsional)"
          value={user.employee_id}
          onChange={(e) => {
            const employee = employees.find((item) => item.id === e.target.value);
            setUser({ ...user, employee_id: e.target.value, full_name: employee?.full_name || user.full_name });
          }}
        >
          <option value="">Tanpa data karyawan</option>
          {employees.filter((item) => !item.user_id).map((item) => (
            <option key={item.id} value={item.id}>{item.employee_code} — {item.full_name}</option>
          ))}
        </Select>
        <Input
          label="Nama lengkap"
          value={user.full_name}
          onChange={(e) => setUser({ ...user, full_name: e.target.value })}
        />
        <Input
          label="Nama pengguna"
          value={user.username}
          onChange={(e) => setUser({ ...user, username: e.target.value })}
        />
        <Input
          label="Kata sandi awal"
          type="password"
          minLength={12}
          value={user.password}
          onChange={(e) => setUser({ ...user, password: e.target.value })}
          hint="Minimal 12 karakter"
        />
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={
              !user.role_id ||
              !user.full_name ||
              !user.username ||
              user.password.length < 12
            }
            onClick={() => void createUser()}
          >
            Buat pengguna
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
        <div className="modal-actions">
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
        <div className="confirm-panel">
          <WifiOff />
          <h3>{selected?.name}</h3>
          <p>
            Akses pada komputer kasir ini akan dihentikan. Pengguna harus masuk
            kembali jika komputer akan digunakan lagi.
          </p>
        </div>
        <div className="modal-actions">
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
