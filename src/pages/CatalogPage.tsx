import {
  Barcode,
  Boxes,
  Calculator,
  FileText,
  Layers3,
  Pencil,
  Plus,
  Ruler,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useAlert, useConfirm } from "../components/feedback";
import { api, apiPage, json } from "../lib/api";
import { asArray, displayLabel, quantity, rupiah } from "../lib/format";
import { useDebouncedValue } from "../lib/hooks";
import { printTable } from "../lib/print";
import type { Product, ProductRecipe, ProductUnit } from "../types/api";
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
  useToast,
} from "../components/ui";
const defaultProductKind = (type: string) =>
  type === "pharmacy"
    ? "medicine"
    : type === "building_materials"
      ? "material"
      : "stock";
const productKindOptions = (type: string) => {
  const composable = [
    ["stock", "Produk siap jual — tanpa bahan"],
    ["menu", "Produk racikan — wajib memiliki bahan"],
    ["ingredient", "Bahan baku — untuk produk racikan"],
    ["service", "Jasa — tanpa stok dan bahan"],
  ];
  if (type === "pharmacy") {
    return [
      ["medicine", "Obat jadi — tanpa komposisi produksi"],
      ...composable,
    ];
  }
  if (type === "building_materials") {
    return [
      ["material", "Material jadi — tanpa komposisi produksi"],
      ...composable,
    ];
  }
  return composable;
};
const blankProduct = (type: string) => ({
  sku: "",
  barcode: "",
  name: "",
  brand: "",
  category_id: "",
  primary_supplier_id: "",
  base_unit_id: "",
  minimum_stock: 0,
  track_batch: false,
  status: "active",
  version: 0,
  product_kind: defaultProductKind(type),
  metadata: {
    registration_number: "",
    dosage: "",
    requires_prescription: false,
    specification: "",
    dimensions: "",
  },
});
const blankRecipe = () => ({
  yield_quantity: 1,
  items: [{ ingredient_product_id: "", quantity: 1 }],
});
const blankUnitForm = () => ({
  unit_id: "",
  barcode: "",
  conversion: 1,
  sale_price: 0,
  sale_price_general: 0,
  sale_price_reseller: 0,
  sale_price_agent: 0,
  purchase_price: 0,
  is_default_sale: true,
});
type UnitFormState = ReturnType<typeof blankUnitForm>;
const stockTrackedProductKinds = [
  "stock",
  "ingredient",
  "medicine",
  "material",
];
const blankCreateUnitRow = (unitID = "", barcode = ""): UnitFormState => ({
  ...blankUnitForm(),
  unit_id: unitID,
  barcode,
});
const validMoney = (value: number) => Number.isSafeInteger(value) && value >= 0;
const toMilli = (value: number) => Math.round(value * 1000);
interface RecipeCandidate {
  id: string;
  name: string;
  product_kind: string;
  hpp_per_base_milli: number;
}

export function CatalogPage() {
  const { can, user } = useAuth();
  const [tab, setTab] = useState<"products" | "categories" | "units">(
    "products",
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [store, setStore] = useState<any>({ business_type: "grocery" });
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [productPage, setProductPage] = useState(1);
  const [productPageMeta, setProductPageMeta] = useState({
    page: 1,
    limit: 50,
    has_more: false,
  });
  const [priceTier, setPriceTier] = useState("all");
  const [error, setError] = useState("");
  const [modal, setModal] = useState<
    "product" | "category" | "unit" | "productUnit" | "recipe" | null
  >(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [selectedProductUnit, setSelectedProductUnit] =
    useState<ProductUnit | null>(null);
  const [detail, setDetail] = useState<{
    product: Product;
    units: ProductUnit[];
    recipe?: ProductRecipe | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState(() => blankProduct("grocery"));
  const [recipe, setRecipe] = useState(blankRecipe);
  const [recipeCandidates, setRecipeCandidates] = useState<RecipeCandidate[]>(
    [],
  );
  const [recipeQuery, setRecipeQuery] = useState("");
  const [simple, setSimple] = useState({
    id: "",
    code: "",
    name: "",
    allows_fraction: false,
    status: "active",
    version: 0,
  });
  const [unitForm, setUnitForm] = useState(blankUnitForm);
  const [createUnitRows, setCreateUnitRows] = useState<UnitFormState[]>([
    blankCreateUnitRow(),
  ]);
  const { show, node } = useToast();
  const confirm = useConfirm();
  const alert = useAlert();
  const loadRecipeCandidates = useCallback(
    async (search: string, selectedItems: RecipeCandidate[] = []) => {
      const response = await apiPage<Product>(
        `/products?q=${encodeURIComponent(search)}&status=active&page=1&limit=50`,
      );
      const fetched = response.items
        .filter(
          (item) =>
            item.product_kind !== "menu" && item.product_kind !== "service",
        )
        .map((item) => ({
          id: item.id,
          name: item.name,
          product_kind: item.product_kind,
          hpp_per_base_milli: item.hpp_per_base_milli || 0,
        }));
      setRecipeCandidates((current) =>
        Array.from(
          new Map(
            [
              ...current.filter((item) =>
                recipe.items.some(
                  (value) => value.ingredient_product_id === item.id,
                ),
              ),
              ...selectedItems,
              ...fetched,
            ].map((item) => [item.id, item]),
          ).values(),
        ),
      );
    },
    [recipe.items],
  );
  const load = useCallback(async () => {
    setError("");
    try {
      const [productResult, categoryResult, unitResult, storeResult] =
        await Promise.all([
          apiPage<Product>(
            `/products?q=${encodeURIComponent(debouncedQuery)}&page=${productPage}&limit=50`,
          ),
          api<any[]>("/categories"),
          api<any[]>("/units"),
          api<any>("/admin/store"),
        ]);
      setProducts(productResult.items);
      setProductPageMeta(productResult.meta);
      setCategories(asArray(categoryResult));
      setUnits(asArray(unitResult));
      setStore(storeResult);
      setProduct((current) => {
        const allowed = productKindOptions(storeResult.business_type).map(
          ([value]) => value,
        );
        return allowed.includes(current.product_kind)
          ? current
          : { ...current, product_kind: allowed[0] };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat katalog");
    }
  }, [debouncedQuery, productPage]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setProductPage(1);
  }, [debouncedQuery]);

  const openCreateProduct = () => {
    setSelected(null);
    setProduct(blankProduct(store.business_type));
    setRecipe(blankRecipe());
    setRecipeCandidates([]);
    setRecipeQuery("");
    setUnitForm(blankUnitForm());
    setCreateUnitRows([blankCreateUnitRow()]);
    setModal("product");
  };
  const updateCreateUnitRow = (
    index: number,
    changes: Partial<UnitFormState>,
  ) => {
    setCreateUnitRows((rows) =>
      rows.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const next = { ...row, ...changes };
        return {
          ...next,
          sale_price: next.sale_price_general,
          is_default_sale: index === 0 ? true : next.is_default_sale,
        };
      }),
    );
  };

  const addCreateUnitRow = () => {
    setCreateUnitRows((rows) => [
      ...rows,
      {
        ...blankCreateUnitRow(),
        is_default_sale: false,
        sale_price_general: rows[0]?.sale_price_general || 0,
        sale_price_reseller:
          rows[0]?.sale_price_reseller || rows[0]?.sale_price_general || 0,
        sale_price_agent:
          rows[0]?.sale_price_agent ||
          rows[0]?.sale_price_reseller ||
          rows[0]?.sale_price_general ||
          0,
      },
    ]);
  };

  const removeCreateUnitRow = (index: number) => {
    if (index === 0) return;
    setCreateUnitRows((rows) =>
      rows.filter((_, rowIndex) => rowIndex !== index),
    );
  };

  const openEditProduct = () => {
    if (!detail) return;
    const item = detail.product;
    setSelected(item);
    setProduct({
      sku: item.sku,
      barcode: item.barcode || "",
      name: item.name,
      brand: item.brand || "",
      category_id: item.category_id || "",
      primary_supplier_id: item.primary_supplier_id || "",
      base_unit_id: item.base_unit_id,
      minimum_stock: item.minimum_stock_milli / 1000,
      track_batch: item.track_batch,
      product_kind: item.product_kind,
      metadata: {
        ...blankProduct(store.business_type).metadata,
        ...(item.metadata || {}),
      },
      status: item.status,
      version: item.version,
    });
    setDetail(null);
    setModal("product");
  };
  const updateProduct = async () => {
    if (!selected) return;
    const minimumStockMilli = toMilli(product.minimum_stock);
    if (
      !product.sku.trim() ||
      !product.name.trim() ||
      !product.base_unit_id ||
      minimumStockMilli < 0
    ) {
      show("Lengkapi data produk dengan nilai yang valid.", true);
      return;
    }
    setSaving(true);
    try {
      const saved = await api<Product>(
        `/products/${selected.id}`,
        json("PUT", {
          sku: product.sku.trim().toUpperCase(),
          barcode: product.barcode.trim() || null,
          name: product.name.trim(),
          brand: product.brand.trim(),
          category_id: product.category_id || null,
          primary_supplier_id: product.primary_supplier_id || null,
          base_unit_id: product.base_unit_id,
          minimum_stock_milli: minimumStockMilli,
          product_kind: product.product_kind,
          metadata: product.metadata,
          track_batch: product.track_batch,
          status: product.status,
          version: product.version,
        }),
      );
      show("Produk berhasil diperbarui.");
      setModal(null);
      await load();
      await openDetail(saved);
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal memperbarui produk", true);
    } finally {
      setSaving(false);
    }
  };
  const createProduct = async () => {
    const sku = product.sku.trim().toUpperCase();
    const name = product.name.trim();
    const minimumStockMilli = toMilli(product.minimum_stock);
    const managesStock = stockTrackedProductKinds.includes(
      product.product_kind,
    );
    const productUnitPayload = createUnitRows.map((row, index) => ({
      unit_id: index === 0 ? product.base_unit_id : row.unit_id,
      barcode: row.barcode.trim() || null,
      conversion_factor_milli: toMilli(index === 0 ? 1 : row.conversion),
      sale_price: row.sale_price_general,
      sale_price_general: row.sale_price_general,
      sale_price_reseller: row.sale_price_reseller,
      sale_price_agent: row.sale_price_agent,
      purchase_price: managesStock ? row.purchase_price : 0,
      is_default_sale: index === 0,
    }));
    const duplicateUnitIDs =
      new Set(productUnitPayload.map((item) => item.unit_id).filter(Boolean))
        .size !== productUnitPayload.filter((item) => item.unit_id).length;
    const duplicateUnitBarcodes =
      new Set(
        productUnitPayload
          .map((item) => item.barcode?.toLowerCase().trim())
          .filter(Boolean),
      ).size !==
      productUnitPayload.filter((item) => item.barcode?.trim()).length;
    const invalidProductUnits =
      productUnitPayload.length === 0 ||
      !productUnitPayload.some(
        (item) =>
          item.unit_id === product.base_unit_id &&
          item.conversion_factor_milli === 1000,
      ) ||
      duplicateUnitIDs ||
      duplicateUnitBarcodes ||
      productUnitPayload.some(
        (item) =>
          !item.unit_id ||
          item.conversion_factor_milli <= 0 ||
          !validMoney(item.sale_price_general) ||
          !validMoney(item.sale_price_reseller) ||
          !validMoney(item.sale_price_agent) ||
          !validMoney(item.purchase_price),
      );
    const recipePayload =
      product.product_kind === "menu"
        ? {
            yield_quantity_milli: toMilli(recipe.yield_quantity),
            items: recipe.items.map((item) => ({
              ingredient_product_id: item.ingredient_product_id,
              quantity_milli: toMilli(item.quantity),
            })),
          }
        : null;
    const invalidRecipe =
      product.product_kind === "menu" &&
      (!recipePayload ||
        recipePayload.yield_quantity_milli <= 0 ||
        recipePayload.items.some(
          (item) => !item.ingredient_product_id || item.quantity_milli <= 0,
        ) ||
        new Set(recipePayload.items.map((item) => item.ingredient_product_id))
          .size !== recipePayload.items.length);
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(sku)) {
      show(
        "SKU wajib 1–64 karakter dan hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.",
        true,
      );
      return;
    }
    if (!name || name.length > 180) {
      show("Nama produk wajib diisi dan maksimal 180 karakter.", true);
      return;
    }
    if (!product.base_unit_id) {
      show("Pilih satuan terkecil untuk produk.", true);
      return;
    }
    if (!Number.isSafeInteger(minimumStockMilli) || minimumStockMilli < 0) {
      show("Stok minimum tidak valid.", true);
      return;
    }
    if (invalidProductUnits) {
      show(
        duplicateUnitIDs
          ? "Satuan produk tidak boleh duplikat."
          : duplicateUnitBarcodes
            ? "Barcode antar satuan produk tidak boleh sama."
            : "Lengkapi satuan produk, konversi, harga jual, dan harga beli dengan nilai valid.",
        true,
      );
      return;
    }
    if (invalidRecipe) {
      show(
        "Menu wajib memiliki hasil resep dan bahan yang valid serta tidak duplikat.",
        true,
      );
      return;
    }
    setSaving(true);
    try {
      const created = await api<Product>(
        "/products",
        json("POST", {
          sku,
          barcode: product.barcode.trim() || null,
          name,
          brand: product.brand.trim(),
          category_id: product.category_id || null,
          base_unit_id: product.base_unit_id,
          minimum_stock_milli: minimumStockMilli,
          primary_supplier_id: null,
          product_kind: product.product_kind,
          metadata: product.metadata,
          track_batch: product.track_batch,
          units: productUnitPayload,
          recipe: recipePayload,
        }),
      );
      show(
        product.product_kind === "menu"
          ? "Produk racikan, harga, komposisi bahan, dan harga pokok berhasil disimpan."
          : "Produk dan harga berhasil ditambahkan.",
      );
      setModal(null);
      setProduct(blankProduct(store.business_type));
      setRecipe(blankRecipe());
      setUnitForm(blankUnitForm());
      setCreateUnitRows([blankCreateUnitRow()]);
      await load();
      await openDetail(created);
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal menambahkan produk", true);
    } finally {
      setSaving(false);
    }
  };
  const openRecipe = async () => {
    if (!detail) return;
    const current = detail;
    setSelected(current.product);
    setRecipe(
      current.recipe
        ? {
            yield_quantity: current.recipe.yield_quantity_milli / 1000,
            items: current.recipe.items.map((item) => ({
              ingredient_product_id: item.ingredient_product_id,
              quantity: item.quantity_milli / 1000,
            })),
          }
        : {
            yield_quantity: 1,
            items: [{ ingredient_product_id: "", quantity: 1 }],
          },
    );
    setRecipeQuery("");
    try {
      await loadRecipeCandidates(
        "",
        current.recipe?.items.map((item) => ({
          id: item.ingredient_product_id,
          name: item.ingredient_name || item.ingredient_product_id,
          product_kind: "ingredient",
          hpp_per_base_milli: item.ingredient_hpp_per_base_milli || 0,
        })) || [],
      );
    } catch (reason) {
      show(
        reason instanceof Error ? reason.message : "Gagal memuat bahan",
        true,
      );
    }
    setDetail(null);
    setModal("recipe");
  };
  useEffect(() => {
    const recipeOpen =
      modal === "recipe" ||
      (modal === "product" && product.product_kind === "menu");
    if (!recipeOpen) return;
    const timer = setTimeout(() => {
      void loadRecipeCandidates(recipeQuery).catch((reason) =>
        show(
          reason instanceof Error ? reason.message : "Gagal mencari bahan",
          true,
        ),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [loadRecipeCandidates, modal, product.product_kind, recipeQuery, show]);
  const saveRecipe = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api(
        `/products/${selected.id}/recipe`,
        json("PUT", {
          yield_quantity_milli: Math.round(recipe.yield_quantity * 1000),
          items: recipe.items.map((item) => ({
            ingredient_product_id: item.ingredient_product_id,
            quantity_milli: Math.round(item.quantity * 1000),
          })),
        }),
      );
      show("Komposisi bahan berhasil disimpan dan harga pokok produk telah dihitung ulang.");
      setModal(null);
      await load();
      await openDetail(selected);
    } catch (reason) {
      show(
        reason instanceof Error ? reason.message : "Gagal menyimpan resep",
        true,
      );
    } finally {
      setSaving(false);
    }
  };

  const productKinds = productKindOptions(store.business_type);
  const duplicateRecipeIngredients = recipe.items.some(
    (item, index) =>
      item.ingredient_product_id &&
      recipe.items.findIndex(
        (value) => value.ingredient_product_id === item.ingredient_product_id,
      ) !== index,
  );
  const productUsesPurchasePrice = stockTrackedProductKinds.includes(
    product.product_kind,
  );
  const baseUnit = units.find((item) => item.id === product.base_unit_id);
  const baseUnitLabel = baseUnit
    ? `${baseUnit.code} — ${baseUnit.name}`
    : "Pilih satuan terkecil terlebih dahulu";
  const createUnitDuplicateIDs =
    new Set(
      createUnitRows
        .map((row, index) => (index === 0 ? product.base_unit_id : row.unit_id))
        .filter(Boolean),
    ).size !==
    createUnitRows.filter((row, index) =>
      index === 0 ? product.base_unit_id : row.unit_id,
    ).length;
  const createUnitDuplicateBarcodes =
    new Set(
      createUnitRows
        .map((row) => row.barcode.trim().toLowerCase())
        .filter(Boolean),
    ).size !== createUnitRows.filter((row) => row.barcode.trim()).length;
  const createUnitRowsInvalid =
    !selected &&
    (createUnitRows.length === 0 ||
      createUnitDuplicateIDs ||
      createUnitDuplicateBarcodes ||
      createUnitRows.some((row, index) => {
        const unitID = index === 0 ? product.base_unit_id : row.unit_id;
        const conversion = index === 0 ? 1 : row.conversion;
        return (
          !unitID ||
          conversion <= 0 ||
          !validMoney(row.sale_price_general) ||
          !validMoney(row.sale_price_reseller) ||
          !validMoney(row.sale_price_agent) ||
          (productUsesPurchasePrice && !validMoney(row.purchase_price))
        );
      }));
  const openSimpleCreate = (type: "category" | "unit") => {
    setSimple({
      id: "",
      code: "",
      name: "",
      allows_fraction: false,
      status: "active",
      version: 0,
    });
    setModal(type);
  };
  const openSimpleEdit = (item: any) => {
    setSimple({
      id: item.id,
      code: item.code || "",
      name: item.name,
      allows_fraction: Boolean(item.allows_fraction),
      status: item.status || "active",
      version: item.version || 0,
    });
    setModal(tab === "categories" ? "category" : "unit");
  };
  const saveSimple = async () => {
    setSaving(true);
    try {
      if (modal === "category")
        await api(
          simple.id ? `/categories/${simple.id}` : "/categories",
          json(simple.id ? "PUT" : "POST", {
            name: simple.name.trim(),
            ...(simple.id
              ? { status: simple.status, version: simple.version }
              : {}),
          }),
        );
      else
        await api(
          simple.id ? `/units/${simple.id}` : "/units",
          json(simple.id ? "PUT" : "POST", {
            code: simple.code.trim().toUpperCase(),
            name: simple.name.trim(),
            allows_fraction: simple.allows_fraction,
          }),
        );
      show(
        `${modal === "category" ? "Kategori" : "Satuan"} berhasil ${simple.id ? "diperbarui" : "ditambahkan"}.`,
      );
      setModal(null);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Gagal menyimpan data", true);
    } finally {
      setSaving(false);
    }
  };
  const deleteSimple = async (item: any) => {
    const type = tab === "categories" ? "kategori" : "satuan";
    if (
      !(await confirm({
        title: `Hapus ${type}?`,
        message: `${item.name} akan dihapus. Data yang masih digunakan oleh produk tidak dapat dihapus.`,
        confirmLabel: `Hapus ${type}`,
        tone: "danger",
      }))
    )
      return;
    setSaving(true);
    try {
      await api(
        `/${tab === "categories" ? "categories" : "units"}/${item.id}`,
        json("DELETE"),
      );
      show(`${type[0].toUpperCase()}${type.slice(1)} berhasil dihapus.`);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : `Gagal menghapus ${type}`, true);
    } finally {
      setSaving(false);
    }
  };
  const saveProductUnit = async () => {
    if (!selected) return;
    const conversionChanged = Boolean(
      selectedProductUnit &&
        Math.round(unitForm.conversion * 1000) !==
          selectedProductUnit.conversion_factor_milli,
    );
    if (conversionChanged && selectedProductUnit) {
      const baseUnit = units.find(
        (item) => item.id === selected.base_unit_id,
      );
      const accepted = await confirm({
        title: `Ubah isi ${selectedProductUnit.unit_name}?`,
        message: `Isi ${selectedProductUnit.unit_name} akan diubah dari ${quantity(selectedProductUnit.conversion_factor_milli)} menjadi ${unitForm.conversion} ${baseUnit?.name || "satuan terkecil"}. Penyesuaian stok yang sebelumnya dicatat menggunakan ${selectedProductUnit.unit_name} akan dikoreksi otomatis. Stok yang sudah dikunci melalui stok opname tetap dipertahankan.`,
        confirmLabel: "Ubah dan sesuaikan stok",
      });
      if (!accepted) return;
    }
    const payload = {
      unit_id: unitForm.unit_id,
      barcode: unitForm.barcode.trim() || null,
      conversion_factor_milli: Math.round(unitForm.conversion * 1000),
      sale_price: unitForm.sale_price_general,
      sale_price_general: unitForm.sale_price_general,
      sale_price_reseller: unitForm.sale_price_reseller,
      sale_price_agent: unitForm.sale_price_agent,
      purchase_price: unitForm.purchase_price,
      is_default_sale: unitForm.is_default_sale,
      ...(selectedProductUnit ? { version: selectedProductUnit.version } : {}),
    };
    setSaving(true);
    try {
      await api(
        selectedProductUnit
          ? `/product-units/${selectedProductUnit.id}`
          : `/products/${selected.id}/units`,
        json(selectedProductUnit ? "PUT" : "POST", payload),
      );
      show(
        conversionChanged && selectedProductUnit
          ? `Isi ${selectedProductUnit.unit_name} berhasil diperbarui dan stok terkait sudah disesuaikan.`
          : `Satuan produk berhasil ${selectedProductUnit ? "diperbarui" : "ditambahkan"}.`,
      );
      setModal(null);
      setSelectedProductUnit(null);
      await openDetail(selected);
    } catch (e) {
      show(
        e instanceof Error ? e.message : "Gagal menyimpan satuan produk",
        true,
      );
    } finally {
      setSaving(false);
    }
  };
  const editProductUnit = (item: ProductUnit) => {
    setSelectedProductUnit(item);
    setSelected(detail!.product);
    setUnitForm({
      unit_id: item.unit_id,
      barcode: item.barcode || "",
      conversion: item.conversion_factor_milli / 1000,
      sale_price: item.sale_price_general || item.sale_price,
      sale_price_general: item.sale_price_general || item.sale_price,
      sale_price_reseller:
        item.sale_price_reseller || item.sale_price_general || item.sale_price,
      sale_price_agent:
        item.sale_price_agent ||
        item.sale_price_reseller ||
        item.sale_price_general ||
        item.sale_price,
      purchase_price: item.purchase_price,
      is_default_sale: item.is_default_sale,
    });
    setDetail(null);
    setModal("productUnit");
  };
  const deleteProductUnit = async (item: ProductUnit) => {
    if (
      !selected ||
      !(await confirm({
        title: "Hapus satuan produk?",
        message: `Satuan ${item.unit_name} akan dihapus. Satuan yang sudah pernah dipakai dalam transaksi tidak dapat dihapus.`,
        confirmLabel: "Hapus satuan",
        tone: "danger",
      }))
    )
      return;
    setSaving(true);
    try {
      await api(`/product-units/${item.id}`, json("DELETE"));
      show("Satuan produk berhasil dihapus.");
      await openDetail(selected);
    } catch (e) {
      show(
        e instanceof Error ? e.message : "Gagal menghapus satuan produk",
        true,
      );
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
      !(await confirm({
        title: "Hapus produk?",
        message: `Produk ${detail.product.name} akan dihapus. Produk yang sudah pernah digunakan dalam transaksi tidak dapat dihapus dan sebaiknya dinonaktifkan.`,
        confirmLabel: "Hapus produk",
        tone: "danger",
      }))
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
  const printPrices = async () => {
    try {
      const prices = asArray<any>(
        await api(`/reports/prices?tier=${priceTier}`),
      );
      if (priceTier === "all") {
        printTable(
          "Daftar Harga Produk - Semua Tipe Harga",
          [
            "SKU",
            "Barcode satuan",
            "Nama",
            "Satuan",
            "Harga umum",
            "Harga reseller",
            "Harga agen",
          ],
          prices.map((item) => [
            item.sku,
            item.barcode || "—",
            item.name,
            item.unit,
            rupiah(item.sale_price_general),
            rupiah(item.sale_price_reseller),
            rupiah(item.sale_price_agent),
          ]),
        );
        return;
      }
      const label =
        priceTier === "reseller"
          ? "Reseller"
          : priceTier === "agent"
            ? "Agen"
            : "Umum";
      printTable(
        `Daftar Harga Produk - ${label}`,
        ["SKU", "Barcode satuan", "Nama", "Satuan", `Harga ${label}`],
        prices.map((item) => [
          item.sku,
          item.barcode || "—",
          item.name,
          item.unit,
          rupiah(item.sale_price),
        ]),
      );
    } catch (reason) {
      await alert({
        title: "Daftar harga belum dapat dicetak",
        message:
          reason instanceof Error
            ? reason.message
            : "Daftar harga belum dapat disiapkan. Coba kembali beberapa saat lagi.",
        tone: "error",
      });
    }
  };
  return (
    <>
      {node}
      <PageHeader
        title="Katalog produk"
        description="Kelola daftar barang, satuan penjualan, harga, komposisi produk, dan harga pokok."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            {tab === "products" && (
              <div className="flex w-full flex-col gap-2 sm:w-auto lg:flex-row lg:items-end">
                <label className="flex w-full min-w-0 flex-col gap-1.5 text-xs font-bold text-slate-800 sm:w-[260px]">
                  <span>Harga produk yang dicetak</span>
                  <select
                    className="h-10 w-full rounded-[9px] border border-[#d6e0da] bg-white px-3 text-xs font-medium text-slate-900 outline-none transition focus:border-brand-700 focus:ring-4 focus:ring-brand-700/10"
                    value={priceTier}
                    onChange={(e) => setPriceTier(e.target.value)}
                  >
                    <option value="all">Semua harga</option>
                    <option value="general">Umum</option>
                    <option value="reseller">Reseller</option>
                    <option value="agent">Agen</option>
                  </select>
                </label>
                <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2 lg:flex lg:items-center">
                  <Button
                    className="w-full sm:w-auto"
                    variant="secondary"
                    onClick={() => void printPrices()}
                  >
                    <FileText /> Cetak PDF harga
                  </Button>
                  {can("product.manage") && (
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() =>
                        tab === "products"
                          ? openCreateProduct()
                          : openSimpleCreate(
                              tab === "categories" ? "category" : "unit",
                            )
                      }
                    >
                      <Plus /> Tambah produk
                    </Button>
                  )}
                </div>
              </div>
            )}
            {tab !== "products" && can("product.manage") && (
              <Button
                className="w-full sm:w-auto"
                onClick={() =>
                  openSimpleCreate(tab === "categories" ? "category" : "unit")
                }
              >
                <Plus /> Tambah {tab === "categories" ? "kategori" : "satuan"}
              </Button>
            )}
          </div>
        }
      />
      <Tabs
        value={tab}
        onChange={(value) => setTab(value as typeof tab)}
        items={[
          { value: "products", label: "Produk", icon: <Boxes /> },
          { value: "categories", label: "Kategori", icon: <Layers3 /> },
          { value: "units", label: "Satuan", icon: <Ruler /> },
        ]}
      />
      <Card>
        {error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : tab === "products" ? (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Cari nama, SKU, atau barcode..."
              />
              <Badge tone="info">{products.length} produk di halaman ini</Badge>
            </div>
            <div className="w-full overflow-auto rounded-xl">
              <table className="w-full min-w-[760px] border-collapse text-[11px] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-[#dfe7e2] [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-slate-500 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_td]:text-slate-700 [&_tbody_tr:hover]:bg-slate-50 [&_td>strong]:block [&_td>small]:mt-1 [&_td>small]:block [&_td>small]:text-[10px] [&_td>small]:text-slate-500 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-1 [&_code]:text-[9px]">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>SKU / Barcode</th>
                    <th>Jenis</th>
                    <th>Harga pokok</th>
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
                      <td>
                        <Badge tone="info">
                          {displayLabel(item.product_kind)}
                        </Badge>
                      </td>
                      <td>
                        <strong>{rupiah(item.hpp_per_base_milli || 0)}</strong>
                        <small>
                          {item.hpp_method === "recipe"
                            ? "Dihitung dari bahan resep"
                            : "Rata-rata harga pembelian"}
                        </small>
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
            <Pagination
              meta={productPageMeta}
              onPageChange={setProductPage}
            />
          </>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 [&_article]:flex [&_article]:items-center [&_article]:gap-3 [&_article]:rounded-xl [&_article]:border [&_article]:border-[#dfe7e2] [&_article]:p-3">
            {(tab === "categories" ? categories : units).map((item) => (
              <article key={item.id}>
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 [&_svg]:h-4 [&_svg]:w-4">
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
                {can("product.manage") && (
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      onClick={() => openSimpleEdit(item)}
                    >
                      <Pencil /> Edit
                    </Button>
                    {user?.role === "owner" && (
                      <Button
                        variant="ghost"
                        loading={saving}
                        onClick={() => void deleteSimple(item)}
                      >
                        <Trash2 /> Hapus
                      </Button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </Card>
      <Modal
        open={modal === "product"}
        title={selected ? "Edit produk" : "Tambah produk"}
        onClose={() => setModal(null)}
        wide
        className="md:w-[min(1120px,calc(100vw-72px))] md:max-h-[calc(100dvh-48px)] md:rounded-[18px]"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Kode produk (SKU)"
            value={product.sku}
            maxLength={64}
            onChange={(e) =>
              setProduct({ ...product, sku: e.target.value.toUpperCase() })
            }
            required
            hint="Gunakan kode singkat tanpa spasi, misalnya SURYA-12 atau NASI-GORENG."
          />
          <Input
            label="Barcode produk / satuan terkecil"
            value={product.barcode}
            maxLength={128}
            onChange={(e) => {
              const value = e.target.value;
              setProduct({ ...product, barcode: value });
              if (!selected) {
                setUnitForm({ ...unitForm, barcode: value });
                setCreateUnitRows((rows) =>
                  rows.map((row, index) =>
                    index === 0 ? { ...row, barcode: value } : row,
                  ),
                );
              }
            }}
            hint="Untuk produk dengan banyak satuan, barcode bisa diatur lagi per satuan pada tombol Tambah satuan."
          />
          <Input
            label="Nama produk"
            value={product.name}
            maxLength={180}
            onChange={(e) => setProduct({ ...product, name: e.target.value })}
          />
          <Input
            label="Merek"
            value={product.brand}
            maxLength={100}
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
          {!selected ? (
            <Input
              label="Stok minimum"
              type="number"
              min="0"
              step="0.001"
              value={product.minimum_stock}
              onChange={(e) =>
                setProduct({
                  ...product,
                  minimum_stock: Number(e.target.value),
                })
              }
              hint="Batas stok dihitung dalam satuan terkecil. Contoh: nilai 24 berarti stok minimum 24 batang."
            />
          ) : (
            <Select
              label="Status"
              value={product.status}
              onChange={(e) =>
                setProduct({ ...product, status: e.target.value })
              }
            >
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </Select>
          )}
          <div className="flex min-w-0 flex-col gap-2.5 self-stretch">
            <Select
              label="Cara produk disediakan"
              value={product.product_kind}
              disabled={Boolean(selected)}
              onChange={(e) => {
                setProduct({ ...product, product_kind: e.target.value });
                setRecipe(blankRecipe());
                setRecipeCandidates([]);
                setRecipeQuery("");
              }}
            >
              {productKinds.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            {["menu", "stock", "ingredient"].includes(product.product_kind) && (
              <div className="flex min-h-[68px] flex-col justify-center gap-1 rounded-xl border border-[#dfe7e2] bg-brand-50 p-4 text-sm text-slate-600 [&_strong]:text-base [&_strong]:font-extrabold [&_strong]:text-slate-900 [&_span]:text-slate-500 [&_span]:leading-6 min-h-[112px] h-full justify-start">
                {product.product_kind === "menu" ? (
                  <>
                    <strong>Produk racikan</strong>
                    <span>
                      Contoh Red Velvet. Wajib memiliki satu atau lebih bahan;
                      stok setiap bahan akan berkurang saat produk dijual.
                    </span>
                  </>
                ) : product.product_kind === "stock" ? (
                  <>
                    <strong>Produk siap jual</strong>
                    <span>
                      Contoh air mineral. Tidak memerlukan bahan; stok air
                      mineral sendiri akan berkurang saat dijual.
                    </span>
                  </>
                ) : product.product_kind === "ingredient" ? (
                  <>
                    <strong>Bahan baku</strong>
                    <span>
                      Buat bahan seperti susu, bubuk Red Velvet, gula, dan es
                      lebih dahulu agar dapat dipilih pada produk racikan.
                    </span>
                  </>
                ) : null}
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-2.5 self-stretch">
            <Select
              label="Satuan terkecil"
              value={product.base_unit_id}
              disabled={Boolean(selected)}
              onChange={(e) => {
                const value = e.target.value;
                setProduct({ ...product, base_unit_id: value });
                setCreateUnitRows((rows) => {
                  const next = rows.length ? [...rows] : [blankCreateUnitRow()];
                  next[0] = {
                    ...next[0],
                    unit_id: value,
                    barcode: product.barcode || next[0].barcode,
                    conversion: 1,
                    is_default_sale: true,
                  };
                  return next;
                });
              }}
            >
              <option value="">Pilih satuan</option>
              {units.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} — {item.name}
                </option>
              ))}
            </Select>
            <div className="flex min-h-[68px] flex-col justify-center gap-1 rounded-xl border border-[#dfe7e2] bg-brand-50 p-4 text-sm text-slate-600 [&_strong]:text-base [&_strong]:font-extrabold [&_strong]:text-slate-900 [&_span]:text-slate-500 [&_span]:leading-6 min-h-[112px] h-full justify-start">
              <strong>Alur satuan produk</strong>
              <span>
                Mulai dari satuan terkecil. Contoh rokok: pilih batang,
                lalu tambahkan bungkus dan slop dengan isi, barcode, harga jual,
                serta harga beli masing-masing.
              </span>
            </div>
          </div>
          {!selected && (
            <div className="col-span-full grid gap-3 rounded-2xl border border-[#dfe7e2] bg-[#fbfefc] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 [&_h3]:m-0 [&_p]:m-0 [&_p]:mt-1 [&_p]:text-sm [&_p]:leading-6 [&_p]:text-slate-500">
                <div>
                  <h3>Satuan, harga jual, dan harga beli</h3>
                  <p>
                    Input semua satuan yang dijual kasir. Untuk Rokok Surya:
                    batang Rp2.500, bungkus Rp27.000, slop Rp260.000, dan harga
                    beli slop Rp250.000.
                  </p>
                </div>
                <Badge tone={createUnitRowsInvalid ? "warning" : "success"}>
                  {createUnitRowsInvalid ? "Lengkapi satuan" : "Siap disimpan"}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-50 p-3 text-xs text-brand-900 [&_span]:rounded-full [&_span]:border [&_span]:border-[#dfe7e2] [&_span]:bg-white [&_span]:px-2 [&_span]:py-1 [&_strong]:mr-1">
                <strong>Contoh rokok</strong>
                <span>Batang = isi 1</span>
                <span>Bungkus = isi 12 batang</span>
                <span>Slop = isi 120 batang</span>
              </div>
              {createUnitRows.map((row, index) => {
                const currentUnit =
                  index === 0
                    ? baseUnit
                    : units.find((item) => item.id === row.unit_id);
                const unitLabel = currentUnit
                  ? currentUnit.name.toLowerCase()
                  : index === 0
                    ? "satuan terkecil"
                    : "satuan ini";
                const hppPreview =
                  productUsesPurchasePrice && row.purchase_price > 0
                    ? Math.floor(
                        row.purchase_price /
                          (index === 0 ? 1 : row.conversion || 1),
                      )
                    : 0;
                return (
                  <div
                    className={`grid gap-3 rounded-2xl border bg-white p-4 ${index === 0 ? "border-brand-700/30 bg-brand-50/60" : "border-[#dfe7e2]"}`}
                    key={index}
                  >
                    <div className="flex items-start justify-between gap-3 [&>div]:grid [&>div]:gap-1 [&_small]:text-[11px] [&_small]:text-slate-500">
                      <div>
                        <strong>
                          {index === 0
                            ? "Satuan dasar / eceran"
                            : `Satuan tambahan ${index}`}
                        </strong>
                        <small>
                          {index === 0
                            ? "Dipakai sebagai stok terkecil dan harga default kasir."
                            : "Dipakai saat kasir menjual dalam kemasan lebih besar."}
                        </small>
                      </div>
                      {index > 0 && (
                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() => removeCreateUnitRow(index)}
                        >
                          <Trash2 /> Hapus
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {index === 0 ? (
                        <Input
                          label="Satuan jual"
                          value={baseUnitLabel}
                          disabled
                          hint="Satuan terkecil mengikuti pilihan produk di atas."
                        />
                      ) : (
                        <Select
                          label="Satuan jual"
                          value={row.unit_id}
                          onChange={(e) =>
                            updateCreateUnitRow(index, {
                              unit_id: e.target.value,
                            })
                          }
                        >
                          <option value="">Pilih satuan</option>
                          {units.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.code} — {item.name}
                            </option>
                          ))}
                        </Select>
                      )}
                      <Input
                        label={`Barcode ${unitLabel}`}
                        value={row.barcode}
                        maxLength={128}
                        onChange={(e) =>
                          updateCreateUnitRow(index, {
                            barcode: e.target.value,
                          })
                        }
                        placeholder={
                          index === 0
                            ? "Barcode batang / eceran"
                            : "Barcode bungkus, slop, atau bal"
                        }
                      />
                      <Input
                        label="Isi dalam satuan terkecil"
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={index === 0 ? 1 : row.conversion}
                        disabled={index === 0}
                        onChange={(e) =>
                          updateCreateUnitRow(index, {
                            conversion: Number(e.target.value),
                          })
                        }
                        hint={
                          index === 0
                            ? "Satuan dasar selalu bernilai 1."
                            : "Contoh: bungkus 12 batang, slop 120 batang."
                        }
                      />
                      <Input
                        label={`Harga jual umum per ${unitLabel}`}
                        type="number"
                        min="0"
                        step="1"
                        value={row.sale_price_general}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          updateCreateUnitRow(index, {
                            sale_price: value,
                            sale_price_general: value,
                            sale_price_reseller:
                              row.sale_price_reseller || value,
                            sale_price_agent: row.sale_price_agent || value,
                          });
                        }}
                      />
                      <Input
                        label={`Harga reseller per ${unitLabel}`}
                        type="number"
                        min="0"
                        step="1"
                        value={row.sale_price_reseller}
                        onChange={(e) =>
                          updateCreateUnitRow(index, {
                            sale_price_reseller: Number(e.target.value),
                          })
                        }
                      />
                      <Input
                        label={`Harga agen per ${unitLabel}`}
                        type="number"
                        min="0"
                        step="1"
                        value={row.sale_price_agent}
                        onChange={(e) =>
                          updateCreateUnitRow(index, {
                            sale_price_agent: Number(e.target.value),
                          })
                        }
                      />
                      {productUsesPurchasePrice && (
                        <Input
                          label={`Harga beli per ${unitLabel}`}
                          type="number"
                          min="0"
                          step="1"
                          value={row.purchase_price}
                          onChange={(e) =>
                            updateCreateUnitRow(index, {
                              purchase_price: Number(e.target.value),
                            })
                          }
                          hint={
                            index === 0
                              ? "Kosongkan jika modal beli mengikuti satuan besar."
                              : "Contoh: harga beli satu slop Rp250.000 akan dihitung menjadi harga pokok per batang."
                          }
                        />
                      )}
                    </div>
                    {productUsesPurchasePrice && hppPreview > 0 && (
                      <small className="inline-flex w-fit rounded-lg bg-brand-50 px-2.5 py-1.5 text-[11px] font-bold text-brand-900">
                        Perkiraan harga pokok per satuan terkecil:{" "}
                        {rupiah(hppPreview)}
                      </small>
                    )}
                  </div>
                );
              })}
              <Button
                variant="secondary"
                type="button"
                onClick={addCreateUnitRow}
              >
                <Plus /> Tambah satuan jual
              </Button>
              {(createUnitDuplicateIDs || createUnitDuplicateBarcodes) && (
                <p className="m-0 text-xs font-bold text-amber-700">
                  {createUnitDuplicateIDs
                    ? "Satuan jual tidak boleh dipilih lebih dari satu kali."
                    : "Barcode antar satuan tidak boleh sama."}
                </p>
              )}
            </div>
          )}
          {store.business_type === "pharmacy" &&
            product.product_kind === "medicine" && (
              <>
                <Input
                  label="Nomor izin edar"
                  value={product.metadata.registration_number}
                  onChange={(e) =>
                    setProduct({
                      ...product,
                      metadata: {
                        ...product.metadata,
                        registration_number: e.target.value,
                      },
                    })
                  }
                />
                <Input
                  label="Dosis / kekuatan"
                  value={product.metadata.dosage}
                  onChange={(e) =>
                    setProduct({
                      ...product,
                      metadata: { ...product.metadata, dosage: e.target.value },
                    })
                  }
                />
                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 [&_input]:h-4 [&_input]:w-4 [&_input]:accent-brand-700">
                  <input
                    type="checkbox"
                    checked={Boolean(product.metadata.requires_prescription)}
                    onChange={(e) =>
                      setProduct({
                        ...product,
                        metadata: {
                          ...product.metadata,
                          requires_prescription: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>Memerlukan resep dokter</span>
                </label>
              </>
            )}
          {store.business_type === "building_materials" &&
            product.product_kind === "material" && (
              <>
                <Input
                  label="Spesifikasi material"
                  value={product.metadata.specification}
                  onChange={(e) =>
                    setProduct({
                      ...product,
                      metadata: {
                        ...product.metadata,
                        specification: e.target.value,
                      },
                    })
                  }
                />
                <Input
                  label="Ukuran / dimensi"
                  value={product.metadata.dimensions}
                  onChange={(e) =>
                    setProduct({
                      ...product,
                      metadata: {
                        ...product.metadata,
                        dimensions: e.target.value,
                      },
                    })
                  }
                />
              </>
            )}
          <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 [&_input]:h-4 [&_input]:w-4 [&_input]:accent-brand-700">
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
        {!selected && product.product_kind === "menu" && (
          <section className="col-span-full mt-4 grid gap-3 border-t border-[#dfe7e2] pt-4 [&_h3]:m-0 [&_p]:m-0">
            <h3>Komposisi bahan dan harga pokok</h3>
            <p className="text-slate-500">
              Tambahkan satu atau banyak bahan. Red Velvet dapat memakai susu,
              bubuk Red Velvet, gula, es, dan bahan lain sesuai resep.
            </p>
            <Input
              label="Hasil resep"
              type="number"
              min="0.001"
              step="0.001"
              value={recipe.yield_quantity}
              onChange={(e) =>
                setRecipe({ ...recipe, yield_quantity: Number(e.target.value) })
              }
              hint="Contoh: 1 untuk satu porsi nasi goreng."
            />
            <SearchInput
              value={recipeQuery}
              onChange={setRecipeQuery}
              placeholder="Cari bahan baku..."
            />
            {!recipeCandidates.length && (
              <p className="text-slate-500">
                Belum ada bahan. Buat produk dengan jenis “Bahan baku” terlebih
                dahulu, misalnya susu, bubuk Red Velvet, gula, atau es.
              </p>
            )}
            {recipe.items.map((item, index) => (
              <div
                className="grid grid-cols-1 gap-4 md:grid-cols-2"
                key={index}
              >
                <Select
                  label={`Bahan ${index + 1}`}
                  value={item.ingredient_product_id}
                  onChange={(e) =>
                    setRecipe({
                      ...recipe,
                      items: recipe.items.map((value, itemIndex) =>
                        itemIndex === index
                          ? { ...value, ingredient_product_id: e.target.value }
                          : value,
                      ),
                    })
                  }
                >
                  <option value="">Pilih bahan</option>
                  {recipeCandidates.map((value) => (
                    <option key={value.id} value={value.id}>
                      {value.name} — harga pokok {rupiah(value.hpp_per_base_milli || 0)}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Jumlah bahan"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={item.quantity}
                  onChange={(e) =>
                    setRecipe({
                      ...recipe,
                      items: recipe.items.map((value, itemIndex) =>
                        itemIndex === index
                          ? { ...value, quantity: Number(e.target.value) }
                          : value,
                      ),
                    })
                  }
                />
                {recipe.items.length > 1 && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setRecipe({
                        ...recipe,
                        items: recipe.items.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      })
                    }
                  >
                    <Trash2 /> Hapus bahan
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="secondary"
              onClick={() =>
                setRecipe({
                  ...recipe,
                  items: [
                    ...recipe.items,
                    { ingredient_product_id: "", quantity: 1 },
                  ],
                })
              }
            >
              <Plus /> Tambah bahan
            </Button>
          </section>
        )}
        {can("product.manage") && (
          <div className="sticky bottom-0 z-10 col-span-full -mx-6 mt-2 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white px-6 py-4 shadow-[0_-8px_20px_rgba(16,45,31,0.06)] max-sm:-mx-4 max-sm:flex-col-reverse max-sm:px-4 [&_button]:max-sm:w-full">
            <Button variant="secondary" onClick={() => setModal(null)}>
              Batal
            </Button>
            <Button
              loading={saving}
              disabled={
                !product.sku.trim() ||
                !product.name.trim() ||
                !product.base_unit_id ||
                createUnitRowsInvalid ||
                (!selected &&
                  product.product_kind === "menu" &&
                  (duplicateRecipeIngredients ||
                    recipe.yield_quantity <= 0 ||
                    recipe.items.some(
                      (item) =>
                        !item.ingredient_product_id || item.quantity <= 0,
                    )))
              }
              onClick={() =>
                void (selected ? updateProduct() : createProduct())
              }
            >
              {selected
                ? "Simpan perubahan"
                : product.product_kind === "menu"
                  ? "Simpan produk racikan & bahan"
                  : "Simpan produk & harga"}
            </Button>
          </div>
        )}
      </Modal>
      <Modal
        open={modal === "category" || modal === "unit"}
        title={`${simple.id ? "Edit" : "Tambah"} ${modal === "category" ? "kategori" : "satuan"}`}
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
        {modal === "category" && simple.id && (
          <Select
            label="Status"
            value={simple.status}
            onChange={(e) => setSimple({ ...simple, status: e.target.value })}
          >
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </Select>
        )}
        <Input
          label="Nama"
          value={simple.name}
          onChange={(e) => setSimple({ ...simple, name: e.target.value })}
        />
        {modal === "unit" && (
          <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 [&_input]:h-4 [&_input]:w-4 [&_input]:accent-brand-700">
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
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={!simple.name || (modal === "unit" && !simple.code)}
            onClick={() => void saveSimple()}
          >
            Simpan
          </Button>
        </div>
      </Modal>
      <Modal
        open={modal === "productUnit"}
        title={`${selectedProductUnit ? "Edit" : "Tambah"} satuan ${selected?.name || ""}`}
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
          label="Barcode satuan ini"
          value={unitForm.barcode}
          maxLength={128}
          onChange={(e) =>
            setUnitForm({ ...unitForm, barcode: e.target.value })
          }
          placeholder="Contoh barcode bungkus/slop/bal"
        />
        <Input
          label="Isi dalam satuan terkecil"
          type="number"
          min="0.001"
          step="0.001"
          value={unitForm.conversion}
          onChange={(e) =>
            setUnitForm({ ...unitForm, conversion: Number(e.target.value) })
          }
          hint="Contoh: BOTOL = 1 dan DUS berisi 24 BOTOL, maka isi DUS adalah 24."
        />
        {selectedProductUnit &&
          Math.round(unitForm.conversion * 1000) !==
            selectedProductUnit.conversion_factor_milli && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
              Perubahan isi satuan akan menyesuaikan kembali stok yang pernah
              dimasukkan melalui satuan ini. Riwayat penjualan dan pembelian
              tetap dilindungi agar laporan tidak berubah.
            </div>
          )}
        <Input
          label="Harga jual umum"
          type="number"
          min="0"
          value={unitForm.sale_price_general}
          onChange={(e) => {
            const value = Number(e.target.value);
            setUnitForm({
              ...unitForm,
              sale_price: value,
              sale_price_general: value,
              sale_price_reseller: unitForm.sale_price_reseller || value,
              sale_price_agent: unitForm.sale_price_agent || value,
            });
          }}
        />
        <Input
          label="Harga jual reseller"
          type="number"
          min="0"
          value={unitForm.sale_price_reseller}
          onChange={(e) =>
            setUnitForm({
              ...unitForm,
              sale_price_reseller: Number(e.target.value),
            })
          }
        />
        <Input
          label="Harga jual agen"
          type="number"
          min="0"
          value={unitForm.sale_price_agent}
          onChange={(e) =>
            setUnitForm({
              ...unitForm,
              sale_price_agent: Number(e.target.value),
            })
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
        <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 [&_input]:h-4 [&_input]:w-4 [&_input]:accent-brand-700">
          <input
            type="checkbox"
            checked={unitForm.is_default_sale}
            onChange={(e) =>
              setUnitForm({ ...unitForm, is_default_sale: e.target.checked })
            }
          />
          <span>Jadikan satuan jual utama</span>
        </label>
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Nanti
          </Button>
          <Button
            loading={saving}
            disabled={
              !unitForm.unit_id ||
              unitForm.conversion <= 0 ||
              unitForm.sale_price_general < 0 ||
              unitForm.sale_price_reseller < 0 ||
              unitForm.sale_price_agent < 0 ||
              unitForm.purchase_price < 0
            }
            onClick={() => void saveProductUnit()}
          >
            {selectedProductUnit ? "Simpan perubahan" : "Simpan harga"}
          </Button>
        </div>
      </Modal>
      <Modal
        open={Boolean(detail)}
        title={detail?.product.name || "Detail produk"}
        onClose={() => setDetail(null)}
      >
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-brand-50 p-3 [&>span]:grid [&>span]:h-12 [&>span]:w-12 [&>span]:place-items-center [&>span]:rounded-lg [&>span]:bg-brand-100 [&>span]:font-extrabold [&>span]:text-brand-700 [&_h3]:m-0 [&_h3]:text-sm [&_p]:mt-1 [&_p]:flex [&_p]:items-center [&_p]:gap-1 [&_p]:text-[10px] [&_p]:text-slate-500 [&_svg]:h-3.5 [&_svg]:w-3.5">
          <span>{detail?.product.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <h3>{detail?.product.name}</h3>
            <p>
              <Barcode /> {detail?.product.barcode || detail?.product.sku}
            </p>
          </div>
        </div>
        <h3 className="text-sm font-bold text-slate-900">Satuan dan harga jual</h3>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dfe7e2] bg-brand-50 p-4 [&_strong]:text-xl [&_strong]:text-brand-900">
          <span>
            Harga pokok otomatis
            <small>
              {detail?.product.hpp_method === "recipe"
                ? "Berdasarkan resep"
                : "Rata-rata harga barang yang diterima dari pemasok"}
            </small>
          </span>
          <strong>{rupiah(detail?.product.hpp_per_base_milli || 0)}</strong>
        </div>
        {detail?.units.map((item) => (
          <div
            className="flex items-start justify-between gap-3 border-b border-[#dfe7e2] py-2.5 text-xs max-sm:flex-col"
            key={item.id}
          >
            <div>
              <strong>{item.unit_name}</strong>
              <small>
                Isi {quantity(item.conversion_factor_milli)} satuan terkecil{item.barcode ? ` · Barcode ${item.barcode}` : ""}
              </small>
            </div>
            <div className="flex flex-col items-end text-right max-sm:items-start max-sm:text-left">
              <strong>
                {rupiah(item.sale_price_general || item.sale_price)}
              </strong>
              <small>
                Reseller{" "}
                {rupiah(
                  item.sale_price_reseller ||
                    item.sale_price_general ||
                    item.sale_price,
                )}{" "}
                · Agen{" "}
                {rupiah(
                  item.sale_price_agent ||
                    item.sale_price_reseller ||
                    item.sale_price_general ||
                    item.sale_price,
                )}
              </small>
            </div>
            {can("product.manage") && (
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <Button variant="ghost" onClick={() => editProductUnit(item)}>
                  <Pencil /> Edit
                </Button>
                {user?.role === "owner" && (
                  <Button
                    variant="ghost"
                    onClick={() => void deleteProductUnit(item)}
                  >
                    <Trash2 /> Hapus
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
        {can("product.manage") && (
          <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
            {user?.role === "owner" && (
              <Button
                variant="danger"
                loading={saving}
                onClick={() => void deleteProduct()}
              >
                <Trash2 /> Hapus produk
              </Button>
            )}
            {detail?.product.product_kind === "menu" && (
              <Button variant="secondary" onClick={() => void openRecipe()}>
                <Calculator /> Atur komposisi dan harga pokok
              </Button>
            )}
            <Button variant="secondary" onClick={openEditProduct}>
              <Pencil /> Edit produk
            </Button>
            <Button
              onClick={() => {
                setSelected(detail!.product);
                setSelectedProductUnit(null);
                setUnitForm(blankUnitForm());
                setDetail(null);
                setModal("productUnit");
              }}
            >
              <Plus /> Tambah satuan
            </Button>
          </div>
        )}
      </Modal>
      <Modal
        open={modal === "recipe"}
        title={`Komposisi dan harga pokok ${selected?.name || "produk racikan"}`}
        onClose={() => setModal(null)}
        wide
      >
        <Input
          label="Hasil resep"
          type="number"
          min="0.001"
          step="0.001"
          value={recipe.yield_quantity}
          onChange={(e) =>
            setRecipe({ ...recipe, yield_quantity: Number(e.target.value) })
          }
          hint="Jumlah porsi atau produk yang dihasilkan dari satu kali pembuatan."
        />
        <h3 className="text-sm font-bold text-slate-900">Komposisi bahan</h3>
        <SearchInput
          value={recipeQuery}
          onChange={setRecipeQuery}
          placeholder="Cari bahan berdasarkan nama, SKU, atau barcode..."
        />
        {recipe.items.map((item, index) => (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2" key={index}>
            <Select
              label={`Bahan ${index + 1}`}
              value={item.ingredient_product_id}
              onChange={(e) =>
                setRecipe({
                  ...recipe,
                  items: recipe.items.map((value, itemIndex) =>
                    itemIndex === index
                      ? { ...value, ingredient_product_id: e.target.value }
                      : value,
                  ),
                })
              }
            >
              <option value="">Pilih bahan</option>
              {recipeCandidates
                .filter((value) => value.id !== selected?.id)
                .map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.name} — harga pokok {rupiah(value.hpp_per_base_milli || 0)}
                  </option>
                ))}
            </Select>
            <Input
              label="Jumlah bahan"
              type="number"
              min="0.001"
              step="0.001"
              value={item.quantity}
              onChange={(e) =>
                setRecipe({
                  ...recipe,
                  items: recipe.items.map((value, itemIndex) =>
                    itemIndex === index
                      ? { ...value, quantity: Number(e.target.value) }
                      : value,
                  ),
                })
              }
            />
            {recipe.items.length > 1 && (
              <Button
                variant="ghost"
                onClick={() =>
                  setRecipe({
                    ...recipe,
                    items: recipe.items.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  })
                }
              >
                <Trash2 /> Hapus bahan
              </Button>
            )}
          </div>
        ))}
        <Button
          variant="secondary"
          onClick={() =>
            setRecipe({
              ...recipe,
              items: [
                ...recipe.items,
                { ingredient_product_id: "", quantity: 1 },
              ],
            })
          }
        >
          <Plus /> Tambah bahan
        </Button>
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dfe7e2] bg-white pt-4 max-sm:flex-col-reverse [&_button]:max-sm:w-full">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Batal
          </Button>
          <Button
            loading={saving}
            disabled={
              duplicateRecipeIngredients ||
              recipe.yield_quantity <= 0 ||
              recipe.items.some(
                (item) => !item.ingredient_product_id || item.quantity <= 0,
              )
            }
            onClick={() => void saveRecipe()}
          >
            <Calculator /> Simpan dan hitung harga pokok
          </Button>
        </div>
      </Modal>
    </>
  );
}
