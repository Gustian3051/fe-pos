export type JsonRecord = Record<string, any>;

export interface ApiErrorBody {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export interface User {
  id: string;
  store_id: string;
  role_id: string;
  role: string;
  username: string;
  full_name: string;
  status: string;
  permissions: string[];
}

export interface Session {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: string;
  user: User;
}

export interface Product {
  id: string;
  category_id?: string | null;
  primary_supplier_id?: string | null;
  base_unit_id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  brand: string;
  product_kind: "stock" | "ingredient" | "menu" | "medicine" | "material" | "service";
  metadata: Record<string, any>;
  minimum_stock_milli: number;
  track_batch: boolean;
  hpp_per_base_milli: number;
  hpp_method: "weighted_average" | "recipe";
  status: string;
  version: number;
}

export interface ProductRecipeItem {
  id?: string;
  ingredient_product_id: string;
  ingredient_name?: string;
  quantity_milli: number;
  ingredient_hpp_per_base_milli?: number;
  cost_total?: number;
}

export interface ProductRecipe {
  product_id: string;
  yield_quantity_milli: number;
  hpp_per_base_milli: number;
  version: number;
  items: ProductRecipeItem[];
}

export interface ProductUnit {
  id: string;
  product_id: string;
  unit_id: string;
  unit_code: string;
  unit_name: string;
  conversion_factor_milli: number;
  sale_price: number;
  purchase_price: number;
  is_default_sale: boolean;
  version: number;
}

export interface Employee {
  id: string;
  store_id: string;
  user_id?: string | null;
  employee_code: string;
  full_name: string;
  position: string;
  phone: string;
  hire_date: string;
  monthly_salary: number;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface SalaryPayment {
  id: string;
  employee_id: string;
  employee_name: string;
  period: string;
  base_salary: number;
  bonus: number;
  deductions: number;
  net_salary: number;
  paid_on: string;
  payment_method: string;
  notes: string;
  created_by: string;
  created_at: string;
}
