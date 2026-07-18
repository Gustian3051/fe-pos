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
    fund_source: "cashier",
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
            <div className="flex flex-wrap items-center gap-2">
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
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_.75fr]">
          <Card className="flex min-h-[290px] flex-col border-0 bg-gradient-to-br from-brand-900 to-brand-700 text-white">
            <div className="flex justify-between [&>span]:flex [&>span]:items-center [&>span]:gap-2 [&>span]:text-[9px] [&>span]:font-extrabold [&>span]:tracking-widest">
              <span>
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_0_5px_rgba(114,224,169,0.14)]" /> SIF AKTIF
              </span>
              <Badge tone="success">Aktif</Badge>
            </div>
            <h2>{dateTime(shift.opened_at)}</h2>
            <p>Sif kasir sedang berjalan dan siap mencatat transaksi tunai.</p>
            <div className="mt-auto flex flex-col [&_small]:text-[10px] [&_small]:text-emerald-100/75 [&_strong]:text-3xl">
              <small>Modal awal</small>
              <strong>{rupiah(shift.opening_amount)}</strong>
            </div>
            <div className="mt-5 flex flex-wrap gap-6 border-t border-white/10 pt-3 [&_span]:flex [&_span]:flex-col [&_span]:text-[9px] [&_span]:text-emerald-100/70 [&_b]:mt-1 [&_b]:text-white">
              <span>
                Dibuka pada <b>{dateTime(shift.opened_at)}</b>
              </span>
              <span>
                Kondisi <b>Siap digunakan</b>
              </span>
            </div>
          </Card>
          {can("cash.manage") && <div className="grid gap-3 [&_button]:flex [&_button]:items-center [&_button]:gap-3 [&_button]:rounded-xl [&_button]:border [&_button]:border-[#dfe7e2] [&_button]:bg-white [&_button]:p-5 [&_button]:text-left [&_button>svg]:h-8 [&_button>svg]:w-8 [&_button>svg]:text-brand-700 [&_span]:flex [&_span]:flex-col [&_strong]:text-xs [&_small]:mt-1 [&_small]:text-[10px] [&_small]:text-slate-500">
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
        <Card className="px-5 py-16 text-center [&>span]:mx-auto [&>span]:grid [&>span]:h-16 [&>span]:w-16 [&>span]:place-items-center [&>span]:rounded-full [&>span]:bg-brand-50 [&>span]:text-brand-700 [&_h2]:text-lg [&_p]:text-xs [&_p]:text-slate-500">
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
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
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
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-brand-50 p-4 [&_span]:text-xs [&_span]:text-slate-500 [&_strong]:text-2xl [&_strong]:text-brand-700">
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
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            label="Sumber dana"
            value={movement.fund_source}
            onChange={(e) =>
              setMovement({ ...movement, fund_source: e.target.value })
            }
          >
            <option value="cashier">Uang kasir</option>
            <option value="owner">Uang owner</option>
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
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
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
