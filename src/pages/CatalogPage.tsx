import { Barcode, Boxes, Layers3, Plus, Ruler, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { api, json } from "../lib/api";
import { asArray, displayLabel, quantity, rupiah } from "../lib/format";
import type { Product, ProductUnit } from "../types/api";
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
  useToast,
} from "../components/ui";

export function CatalogPage() {
  const { can, user } = useAuth();
  const [tab, setTab] = useState<"products" | "categories" | "units">(
    "products",
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [modal, setModal] = useState<
    "product" | "category" | "unit" | "productUnit" | null
  >(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [detail, setDetail] = useState<{
    product: Product;
    units: ProductUnit[];
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState({
    sku: "",
    barcode: "",
    name: "",
    brand: "",
    category_id: "",
    base_unit_id: "",
    minimum_stock: 0,
    track_batch: false,
  });
  const [simple, setSimple] = useState({
    code: "",
    name: "",
    allows_fraction: false,
  });
  const [unitForm, setUnitForm] = useState({
    unit_id: "",
    conversion: 1,
    sale_price: 0,
    purchase_price: 0,
    is_default_sale: true,
  });
  const { show, node } = useToast();
  const load = useCallback(async () => {
    setError("");
    try {
      const [p, c, u] = await Promise.all([
        api<Product[]>(`/products?q=${encodeURIComponent(query)}&limit=100`),
        api<any[]>("/categories"),
        api<any[]>("/units"),
      ]);
      setProducts(asArray(p));
      setCategories(asArray(c));
      setUnits(asArray(u));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat katalog");
    }
  }, [query]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const createProduct = async () => {
    setSaving(true);
    try {
      const created = await api<Product>(
        "/products",
        json("POST", {
          ...product,
          category_id: product.category_id || null,
          base_unit_id: product.base_unit_id,
          minimum_stock_milli: product.minimum_stock * 1000,
          primary_supplier_id: null,
        }),
      );
      show("Produk berhasil ditambahkan.");
      setModal(null);
      setSelected(created);
      setUnitForm({ ...unitForm, unit_id: created.base_unit_id });
      setModal("productUnit");
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal menambahkan produk", true);
    } finally {
      setSaving(false);
    }
  };
  const createSimple = async () => {
    setSaving(true);
    try {
      if (modal === "category")
        await api("/categories", json("POST", { name: simple.name }));
      else await api("/units", json("POST", simple));
      show(
        modal === "category" ? "Kategori ditambahkan." : "Satuan ditambahkan.",
      );
      setModal(null);
      setSimple({ code: "", name: "", allows_fraction: false });
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal menyimpan data", true);
    } finally {
      setSaving(false);
    }
  };
  const addUnit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api(
        `/products/${selected.id}/units`,
        json("POST", {
          unit_id: unitForm.unit_id,
          conversion_factor_milli: unitForm.conversion * 1000,
          sale_price: unitForm.sale_price,
          purchase_price: unitForm.purchase_price,
          is_default_sale: unitForm.is_default_sale,
        }),
      );
      show("Satuan dan harga produk ditambahkan.");
      setModal(null);
      await openDetail(selected);
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal menambahkan satuan", true);
    } finally {
      setSaving(false);
    }
  };
  const openDetail = async (item: Product) => {
    setSelected(item);
    try {
      setDetail(await api(`/products/${item.id}`));
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal memuat detail", true);
    }
  };
  const deleteProduct = async () => {
    if (
      !detail ||
      !window.confirm(
        `Hapus produk ${detail.product.name}? Produk yang sudah dipakai dalam transaksi tidak dapat dihapus.`,
      )
    )
      return;
    setSaving(true);
    try {
      await api(`/products/${detail.product.id}`, json("DELETE"));
      show("Produk berhasil dihapus.");
      setDetail(null);
      await load();
    } catch (reason) {
      show(
        reason instanceof Error ? reason.message : "Gagal menghapus produk",
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
        title="Katalog produk"
        description="Kelola produk sembako, kategori, satuan, konversi, dan harga."
        action={can("product.manage") ?
          <Button
            onClick={() =>
              setModal(
                tab === "products"
                  ? "product"
                  : tab === "categories"
                    ? "category"
                    : "unit",
              )
            }
          >
            <Plus /> Tambah{" "}
            {tab === "products"
              ? "produk"
              : tab === "categories"
                ? "kategori"
                : "satuan"}
          </Button>
        : undefined}
      />
      <div className="tabs">
        <button
          className={tab === "products" ? "active" : ""}
          onClick={() => setTab("products")}
        >
          <Boxes /> Produk
        </button>
        <button
          className={tab === "categories" ? "active" : ""}
          onClick={() => setTab("categories")}
        >
          <Layers3 /> Kategori
        </button>
        <button
          className={tab === "units" ? "active" : ""}
          onClick={() => setTab("units")}
        >
          <Ruler /> Satuan
        </button>
      </div>
      <Card>
        {error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : tab === "products" ? (
          <>
            <div className="table-toolbar">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Cari nama, SKU, atau barcode..."
              />
              <Badge tone="info">{products.length} produk</Badge>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>SKU / Barcode</th>
                    <th>Stok minimum</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        <small>{item.brand || "Tanpa merek"}</small>
                      </td>
                      <td>
                        {item.sku}
                        <small>{item.barcode || "—"}</small>
                      </td>
                      <td>{quantity(item.minimum_stock_milli)}</td>
                      <td>
                        <Badge
                          tone={
                            item.status === "active" ? "success" : "neutral"
                          }
                        >
                          {displayLabel(item.status)}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          onClick={() => void openDetail(item)}
                        >
                          Detail
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!products.length && <EmptyState title="Belum ada produk" />}
            </div>
          </>
        ) : (
          <div className="simple-grid">
            {(tab === "categories" ? categories : units).map((item) => (
              <article key={item.id}>
                <span className="simple-icon">
                  {tab === "categories" ? <Layers3 /> : <Ruler />}
                </span>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {tab === "categories"
                      ? displayLabel(item.status)
                      : `${item.code} · ${item.allows_fraction ? "Boleh pecahan" : "Bilangan utuh"}`}
                  </small>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
      <Modal
        open={modal === "product"}
        title="Tambah produk"
        onClose={() => setModal(null)}
        wide
      >
        <div className="form-grid">
          <Input
            label="SKU"
            value={product.sku}
            onChange={(e) => setProduct({ ...product, sku: e.target.value })}
            required
          />
          <Input
            label="Barcode"
            value={product.barcode}
            onChange={(e) =>
              setProduct({ ...product, barcode: e.target.value })
            }
          />
          <Input
            label="Nama produk"
            value={product.name}
            onChange={(e) => setProduct({ ...product, name: e.target.value })}
          />
          <Input
            label="Merek"
            value={product.brand}
            onChange={(e) => setProduct({ ...product, brand: e.target.value })}
          />
          <Select
            label="Kategori"
            value={product.category_id}
            onChange={(e) =>
              setProduct({ ...product, category_id: e.target.value })
            }
          >
            <option value="">Tanpa kategori</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            label="Satuan dasar"
            value={product.base_unit_id}
            onChange={(e) =>
              setProduct({ ...product, base_unit_id: e.target.value })
            }
          >
            <option value="">Pilih satuan</option>
            {units.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} — {item.name}
              </option>
            ))}
          </Select>
          <Input
            label="Stok minimum"
            type="number"
            min="0"
            value={product.minimum_stock}
            onChange={(e) =>
              setProduct({ ...product, minimum_stock: Number(e.target.value) })
            }
          />
          <label className="check-field">
            <input
              type="checkbox"
              checked={product.track_batch}
              onChange={(e) =>
                setProduct({ ...product, track_batch: e.target.checked })
              }
            />
            <span>Lacak batch & kedaluwarsa</span>
          </label>
        </div>
        {can("product.manage") && (
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setModal(null)}>
              Batal
            </Button>
            <Button
              loading={saving}
              disabled={!product.sku || !product.name || !product.base_unit_id}
              onClick={() => void createProduct()}
            >
              Simpan & atur harga
            </Button>
          </div>
        )}
      </Modal>
      <Modal
        open={modal === "category" || modal === "unit"}
        title={modal === "category" ? "Tambah kategori" : "Tambah satuan"}
        onClose={() => setModal(null)}
      >
        {modal === "unit" && (
          <Input
            label="Kode"
            value={simple.code}
            onChange={(e) =>
              setSimple({ ...simple, code: e.target.value.toUpperCase() })
            }
            placeholder="Contoh: PCS"
          />
        )}
        <Input
          label="Nama"
          value={simple.name}
          onChange={(e) => setSimple({ ...simple, name: e.target.value })}
        />
        {modal === "unit" && (
          <label className="check-field">
            <input
              type="checkbox"
              checked={simple.allows_fraction}
              onChange={(e) =>
                setSimple({ ...simple, allows_fraction: e.target.checked })
              }
            />
            <span>Dapat dijual dalam pecahan</span>
          </label>
        )}
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={!simple.name || (modal === "unit" && !simple.code)}
            onClick={() => void createSimple()}
          >
            Simpan
          </Button>
        </div>
      </Modal>
      <Modal
        open={modal === "productUnit"}
        title={`Atur harga ${selected?.name || ""}`}
        onClose={() => setModal(null)}
      >
        <Select
          label="Satuan jual"
          value={unitForm.unit_id}
          onChange={(e) =>
            setUnitForm({ ...unitForm, unit_id: e.target.value })
          }
        >
          <option value="">Pilih satuan</option>
          {units.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} — {item.name}
            </option>
          ))}
        </Select>
        <Input
          label="Isi terhadap satuan dasar"
          type="number"
          min="0.001"
          step="0.001"
          value={unitForm.conversion}
          onChange={(e) =>
            setUnitForm({ ...unitForm, conversion: Number(e.target.value) })
          }
          hint="Contoh: 1 untuk PCS, 40 untuk 1 dus isi 40"
        />
        <Input
          label="Harga jual"
          type="number"
          min="0"
          value={unitForm.sale_price}
          onChange={(e) =>
            setUnitForm({ ...unitForm, sale_price: Number(e.target.value) })
          }
        />
        <Input
          label="Harga beli"
          type="number"
          min="0"
          value={unitForm.purchase_price}
          onChange={(e) =>
            setUnitForm({ ...unitForm, purchase_price: Number(e.target.value) })
          }
        />
        <label className="check-field">
          <input
            type="checkbox"
            checked={unitForm.is_default_sale}
            onChange={(e) =>
              setUnitForm({ ...unitForm, is_default_sale: e.target.checked })
            }
          />
          <span>Jadikan satuan jual utama</span>
        </label>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Nanti
          </Button>
          <Button
            loading={saving}
            disabled={!unitForm.unit_id}
            onClick={() => void addUnit()}
          >
            Simpan harga
          </Button>
        </div>
      </Modal>
      <Modal
        open={Boolean(detail)}
        title={detail?.product.name || "Detail produk"}
        onClose={() => setDetail(null)}
      >
        <div className="product-detail-head">
          <span>{detail?.product.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <h3>{detail?.product.name}</h3>
            <p>
              <Barcode /> {detail?.product.barcode || detail?.product.sku}
            </p>
          </div>
        </div>
        <h3>Satuan & harga</h3>
        {detail?.units.map((item) => (
          <div className="unit-price-row" key={item.id}>
            <div>
              <strong>{item.unit_name}</strong>
              <small>Konversi {quantity(item.conversion_factor_milli)}</small>
            </div>
            <strong>{rupiah(item.sale_price)}</strong>
          </div>
        ))}
        {can("product.manage") && (
          <div className="modal-actions">
            {user?.role === "owner" && (
              <Button
                variant="danger"
                loading={saving}
                onClick={() => void deleteProduct()}
              >
                <Trash2 /> Hapus produk
              </Button>
            )}
            <Button
              onClick={() => {
                setSelected(detail!.product);
                setUnitForm({
                  ...unitForm,
                  unit_id: detail!.product.base_unit_id,
                });
                setDetail(null);
                setModal("productUnit");
              }}
            >
              <Plus /> Tambah satuan
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
