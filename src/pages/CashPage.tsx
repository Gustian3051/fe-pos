import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  LockKeyhole,
  PlayCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { api, json } from "../lib/api";
import { dateTime, rupiah } from "../lib/format";
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
  useToast,
} from "../components/ui";

export function CashPage() {
  const { can } = useAuth();
  const [shift, setShift] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [modal, setModal] = useState<"open" | "close" | "movement" | null>(
    null,
  );
  const [opening, setOpening] = useState(0);
  const [closing, setClosing] = useState({ actual_amount: 0, notes: "" });
  const [movement, setMovement] = useState({
    movement_type: "expense",
    direction: "out",
    amount: 0,
    category: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const { show, node } = useToast();
  const load = useCallback(async () => {
    try {
      setShift(await api("/shifts/current"));
      setNotFound(false);
    } catch (e: any) {
      if (e?.status === 404) {
        setShift(null);
        setNotFound(true);
      } else show(e instanceof Error ? e.message : "Gagal memuat sif", true);
    }
  }, [show]);
  useEffect(() => {
    void load();
  }, [load]);
  const openShift = async () => {
    setSaving(true);
    try {
      setShift(await api("/shifts", json("POST", { opening_amount: opening })));
      setModal(null);
      show("Sif berhasil dibuka.");
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal membuka sif", true);
    } finally {
      setSaving(false);
    }
  };
  const closeShift = async () => {
    setSaving(true);
    try {
      const result: any = await api(
        `/shifts/${shift.id}/close`,
        json("POST", closing),
      );
      show(`Sif ditutup. Selisih ${rupiah(result.difference_amount)}.`);
      setShift(null);
      setModal(null);
      setNotFound(true);
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal menutup sif", true);
    } finally {
      setSaving(false);
    }
  };
  const addMovement = async () => {
    setSaving(true);
    try {
      await api(
        "/cash-movements",
        json("POST", { ...movement, shift_id: shift?.id || null }),
      );
      show("Pergerakan kas berhasil dicatat.");
      setModal(null);
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal mencatat kas", true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      {node}
      <PageHeader
        title="Sif & kas"
        description="Buka dan tutup sif, rekonsiliasi uang tunai, serta catat pergerakan kas."
        action={
          shift ? (
            <div className="button-row">
              {can("cash.manage") && <Button variant="secondary" onClick={() => setModal("movement")}>
                <Banknote /> Pergerakan kas
              </Button>}
              <Button variant="danger" onClick={() => setModal("close")}>
                <LockKeyhole /> Tutup sif
              </Button>
            </div>
          ) : (
            <Button onClick={() => setModal("open")}>
              <PlayCircle /> Buka sif
            </Button>
          )
        }
      />
      {shift ? (
        <div className="cash-layout">
          <Card className="shift-hero">
            <div className="shift-status">
              <span>
                <span className="pulse" /> SIF AKTIF
              </span>
              <Badge tone="success">Aktif</Badge>
            </div>
            <h2>{dateTime(shift.opened_at)}</h2>
            <p>Sif kasir sedang berjalan dan siap mencatat transaksi tunai.</p>
            <div className="shift-money">
              <small>Modal awal</small>
              <strong>{rupiah(shift.opening_amount)}</strong>
            </div>
            <div className="shift-meta">
              <span>
                Dibuka pada <b>{dateTime(shift.opened_at)}</b>
              </span>
              <span>
                Kondisi <b>Siap digunakan</b>
              </span>
            </div>
          </Card>
          {can("cash.manage") && <div className="cash-action-grid">
            <button
              onClick={() => {
                setMovement({
                  ...movement,
                  movement_type: "income",
                  direction: "in",
                });
                setModal("movement");
              }}
            >
              <ArrowDownCircle />
              <span>
                <strong>Kas masuk</strong>
                <small>Modal atau pendapatan lain</small>
              </span>
            </button>
            <button
              onClick={() => {
                setMovement({
                  ...movement,
                  movement_type: "expense",
                  direction: "out",
                });
                setModal("movement");
              }}
            >
              <ArrowUpCircle />
              <span>
                <strong>Kas keluar</strong>
                <small>Biaya dan pengeluaran toko</small>
              </span>
            </button>
          </div>}
        </div>
      ) : (
        <Card className="no-shift">
          <span>
            <Banknote />
          </span>
          <h2>Belum ada sif aktif</h2>
          <p>
            {notFound
              ? "Buka sif sebelum memulai transaksi tunai agar pencatatan kas tetap sesuai."
              : "Memeriksa sif kasir..."}
          </p>
          <Button onClick={() => setModal("open")}>
            <PlayCircle /> Buka sif sekarang
          </Button>
        </Card>
      )}
      <Modal
        open={modal === "open"}
        title="Buka sif"
        onClose={() => setModal(null)}
      >
        <Input
          label="Modal awal"
          type="number"
          min="0"
          value={opening}
          onChange={(e) => setOpening(Number(e.target.value))}
        />
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button loading={saving} onClick={() => void openShift()}>
            Buka sif
          </Button>
        </div>
      </Modal>
      <Modal
        open={modal === "close"}
        title="Tutup & rekonsiliasi sif"
        onClose={() => setModal(null)}
      >
        <div className="payment-total">
          <span>Modal awal</span>
          <strong>{rupiah(shift?.opening_amount)}</strong>
        </div>
        <Input
          label="Uang tunai aktual"
          type="number"
          min="0"
          value={closing.actual_amount}
          onChange={(e) =>
            setClosing({ ...closing, actual_amount: Number(e.target.value) })
          }
        />
        <Textarea
          label="Catatan"
          value={closing.notes}
          onChange={(e) => setClosing({ ...closing, notes: e.target.value })}
        />
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            variant="danger"
            loading={saving}
            onClick={() => void closeShift()}
          >
            Tutup sif
          </Button>
        </div>
      </Modal>
      <Modal
        open={modal === "movement"}
        title="Catat pergerakan kas"
        onClose={() => setModal(null)}
      >
        <div className="form-grid">
          <Select
            label="Jenis"
            value={movement.movement_type}
            onChange={(e) =>
              setMovement({ ...movement, movement_type: e.target.value })
            }
          >
            <option value="income">Pendapatan</option>
            <option value="expense">Pengeluaran</option>
            <option value="capital">Modal</option>
            <option value="owner_draw">Pengambilan pemilik</option>
            <option value="correction">Koreksi</option>
          </Select>
          <Select
            label="Arah"
            value={movement.direction}
            onChange={(e) =>
              setMovement({ ...movement, direction: e.target.value })
            }
          >
            <option value="in">Masuk</option>
            <option value="out">Keluar</option>
          </Select>
          <Input
            label="Jumlah"
            type="number"
            min="1"
            value={movement.amount}
            onChange={(e) =>
              setMovement({ ...movement, amount: Number(e.target.value) })
            }
          />
          <Input
            label="Kategori"
            value={movement.category}
            onChange={(e) =>
              setMovement({ ...movement, category: e.target.value })
            }
          />
        </div>
        <Textarea
          label="Catatan"
          value={movement.notes}
          onChange={(e) => setMovement({ ...movement, notes: e.target.value })}
        />
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={
              movement.amount < 1 ||
              !movement.category ||
              movement.notes.length < 3
            }
            onClick={() => void addMovement()}
          >
            Simpan
          </Button>
        </div>
      </Modal>
    </>
  );
}
