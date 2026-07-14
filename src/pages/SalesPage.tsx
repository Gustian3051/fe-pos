import { Eye, RotateCcw, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { activeShiftID, api, json } from "../lib/api";
import {
  asArray,
  dateTime,
  displayLabel,
  quantity,
  rupiah,
} from "../lib/format";
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

export function SalesPage() {
  const { can } = useAuth();
  const [query, setQuery] = useState("");
  const [sales, setSales] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"void" | "return" | null>(null);
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState("cash");
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const { show, node } = useToast();
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSales(
        asArray(await api(`/sales?q=${encodeURIComponent(query)}&limit=50`)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat penjualan");
    } finally {
      setLoading(false);
    }
  }, [query]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);
  const openDetail = async (id: string) => {
    try {
      setDetail(await api(`/sales/${id}`));
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal memuat detail", true);
    }
  };
  const submitAction = async () => {
    if (!detail || !action) return;
    setSaving(true);
    try {
      if (action === "void")
        await api(`/sales/${detail.sale.id}/void`, json("POST", { reason }));
      else
        {
          const shiftId = refund === "cash" ? await activeShiftID() : null;
          if (refund === "cash" && !shiftId)
            throw new Error(
              "Buka sif terlebih dahulu untuk pengembalian tunai.",
            );
        await api(
          `/sales/${detail.sale.id}/returns`,
          json("POST", {
            reason,
            refund_method: refund,
            shift_id: shiftId,
            items: detail.items
              .filter((item: any) => returnQty[item.id] > 0)
              .map((item: any) => ({
                sale_item_id: item.id,
                quantity_milli: returnQty[item.id],
              })),
          }),
        );
        }
      show(
        action === "void"
          ? "Transaksi berhasil dibatalkan."
          : "Retur berhasil disimpan.",
      );
      setAction(null);
      setDetail(null);
      setReason("");
      setReturnQty({});
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Operasi gagal", true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      {node}
      <PageHeader
        title="Penjualan"
        description="Riwayat transaksi, rincian pembayaran, retur, dan pembatalan."
      />
      <Card>
        <div className="table-toolbar">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Cari nomor transaksi..."
          />
          <Badge tone="info">{sales.length} transaksi</Badge>
        </div>
        {error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nomor</th>
                  <th>Waktu</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <strong>{sale.number}</strong>
                    </td>
                    <td>{dateTime(sale.business_at)}</td>
                    <td>
                      <Badge
                        tone={
                          sale.status === "completed"
                            ? "success"
                            : sale.status === "voided"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {displayLabel(sale.status)}
                      </Badge>
                    </td>
                    <td>
                      <strong>{rupiah(sale.total)}</strong>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        onClick={() => void openDetail(sale.id)}
                      >
                        <Eye size={17} /> Detail
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !sales.length && (
              <EmptyState title="Belum ada transaksi" />
            )}
          </div>
        )}
      </Card>
      <Modal
        open={Boolean(detail) && !action}
        title={`Detail ${detail?.sale?.number || ""}`}
        onClose={() => setDetail(null)}
        wide
      >
        {detail && (
          <div className="sale-detail">
            <div className="detail-summary">
              <div>
                <small>Status</small>
                <Badge tone="success">{displayLabel(detail.sale.status)}</Badge>
              </div>
              <div>
                <small>Waktu</small>
                <strong>{dateTime(detail.sale.business_at)}</strong>
              </div>
              <div>
                <small>Total</small>
                <strong>{rupiah(detail.sale.total)}</strong>
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Qty</th>
                  <th>Harga</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item: any) => (
                  <tr key={item.id}>
                    <td>
                      {item.product_name}
                      <small>{item.unit_name}</small>
                    </td>
                    <td>{quantity(item.quantity_milli)}</td>
                    <td>{rupiah(item.unit_price)}</td>
                    <td>{rupiah(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="detail-payments">
              <h3>Pembayaran</h3>
              {detail.payments.map((item: any) => (
                <div key={item.id}>
                  <span>{displayLabel(item.method)}</span>
                  <strong>{rupiah(item.amount)}</strong>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => setAction("return")}
                disabled={
                  !["completed", "returned"].includes(detail.sale.status) ||
                  !can("sale.return")
                }
              >
                <RotateCcw /> Retur
              </Button>
              <Button
                variant="danger"
                onClick={() => setAction("void")}
                disabled={
                  detail.sale.status !== "completed" || !can("sale.return")
                }
              >
                <XCircle /> Batalkan
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={Boolean(action)}
        title={action === "void" ? "Batalkan transaksi" : "Retur penjualan"}
        onClose={() => setAction(null)}
      >
        {action === "return" &&
          detail?.items.map((item: any) => (
            <div className="return-row" key={item.id}>
              <span>
                {item.product_name}
                <small>Maks. {quantity(item.quantity_milli)}</small>
              </span>
              <Input
                type="number"
                min="0"
                max={item.quantity_milli / 1000}
                step="0.001"
                value={(returnQty[item.id] || 0) / 1000}
                onChange={(e) =>
                  setReturnQty({
                    ...returnQty,
                    [item.id]: Number(e.target.value) * 1000,
                  })
                }
              />
            </div>
          ))}
        {action === "return" && (
          <Select
            label="Metode pengembalian"
            value={refund}
            onChange={(e) => setRefund(e.target.value)}
          >
            <option value="cash">Tunai</option>
            <option value="transfer">Transfer</option>
            <option value="qris">QRIS</option>
            <option value="debt">Koreksi utang</option>
          </Select>
        )}
        <Textarea
          label="Alasan"
          minLength={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Jelaskan alasan tindakan..."
        />
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setAction(null)}>
            Batal
          </Button>
          <Button
            variant={action === "void" ? "danger" : "primary"}
            loading={saving}
            disabled={
              reason.length < 3 ||
              (action === "return" &&
                !Object.values(returnQty).some((value) => value > 0))
            }
            onClick={() => void submitAction()}
          >
            {action === "void" ? "Konfirmasi pembatalan" : "Simpan retur"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
