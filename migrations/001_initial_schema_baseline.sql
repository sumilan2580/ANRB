-- =============================================================================
-- TRIPAL ERP — Migration 001: Initial Production Schema Baseline
-- =============================================================================
-- Description: Baseline schema definition for all 24 production tables.
-- Verified 24/24 tables and production indexes in Layerbase PostgreSQL.
-- Note: This baseline is idempotent (CREATE TABLE IF NOT EXISTS).
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  session_token VARCHAR(255),
  manager_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS managers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  device_id VARCHAR(100),
  phone VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  manager_token VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS raw_materials (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) UNIQUE NOT NULL,
  category VARCHAR(100) NOT NULL,
  unit VARCHAR(20) DEFAULT 'KG',
  min_stock_alert NUMERIC(15,2) DEFAULT 1000,
  status VARCHAR(20) DEFAULT 'active',
  hsn_code VARCHAR(50) DEFAULT '3901',
  gst_percent NUMERIC(5,2) DEFAULT 18,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  gst_number VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  state VARCHAR(100) DEFAULT 'Gujarat',
  city VARCHAR(100) DEFAULT 'Ahmedabad',
  pincode VARCHAR(20) DEFAULT '382445',
  state_code VARCHAR(10) DEFAULT '24',
  supplier_code VARCHAR(50),
  supplier_type VARCHAR(50) DEFAULT 'GST Registered',
  email VARCHAR(100),
  opening_balance NUMERIC(15,2) DEFAULT 0,
  opening_balance_type VARCHAR(20) DEFAULT 'Credit',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  gst_number VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  remarks TEXT,
  state VARCHAR(100) DEFAULT 'Gujarat',
  city VARCHAR(100) DEFAULT 'Ahmedabad',
  pincode VARCHAR(20) DEFAULT '382445',
  state_code VARCHAR(10) DEFAULT '24',
  customer_code VARCHAR(50),
  customer_type VARCHAR(50) DEFAULT 'GST Registered',
  billing_address TEXT,
  shipping_address TEXT,
  email VARCHAR(100),
  opening_balance NUMERIC(15,2) DEFAULT 0,
  opening_balance_type VARCHAR(20) DEFAULT 'Debit',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS machines (
  id SERIAL PRIMARY KEY,
  machine_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  capacity_kg_per_day NUMERIC(15,2) DEFAULT 5000,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  start_time VARCHAR(20),
  end_time VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finished_products (
  id SERIAL PRIMARY KEY,
  product_code VARCHAR(50) UNIQUE NOT NULL,
  product_name VARCHAR(150) DEFAULT 'Tripal',
  gsm INTEGER NOT NULL,
  width_size VARCHAR(50) NOT NULL,
  length_val VARCHAR(50),
  colour VARCHAR(50) NOT NULL,
  grade VARCHAR(50) DEFAULT 'Grade A',
  unit VARCHAR(20) DEFAULT 'KG',
  min_stock_alert NUMERIC(15,2) DEFAULT 500,
  status VARCHAR(20) DEFAULT 'active',
  hsn_code VARCHAR(50) DEFAULT '3926',
  gst_percent NUMERIC(5,2) DEFAULT 18,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS raw_material_purchases (
  id SERIAL PRIMARY KEY,
  purchase_code VARCHAR(50) UNIQUE NOT NULL,
  date VARCHAR(20) NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id),
  raw_material_id INTEGER REFERENCES raw_materials(id),
  quantity_kg NUMERIC(15,2) NOT NULL,
  rate_per_kg NUMERIC(15,2) NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL,
  invoice_number VARCHAR(100),
  remarks TEXT,
  manager_id INTEGER,
  manager_name VARCHAR(100) NOT NULL,
  device_id VARCHAR(100),
  taxable_amount NUMERIC(15,2) DEFAULT 0,
  gst_percent NUMERIC(5,2) DEFAULT 18,
  cgst_amount NUMERIC(15,2) DEFAULT 0,
  sgst_amount NUMERIC(15,2) DEFAULT 0,
  igst_amount NUMERIC(15,2) DEFAULT 0,
  purchase_type VARCHAR(50) DEFAULT 'GST',
  discount_amount NUMERIC(15,2) DEFAULT 0,
  other_charges NUMERIC(15,2) DEFAULT 0,
  round_off NUMERIC(15,2) DEFAULT 0,
  payment_mode VARCHAR(50) DEFAULT 'Credit',
  is_voided INTEGER DEFAULT 0,
  voided_at TIMESTAMPTZ,
  voided_by VARCHAR(100),
  void_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id SERIAL PRIMARY KEY,
  purchase_id INTEGER REFERENCES raw_material_purchases(id) ON DELETE CASCADE,
  raw_material_id INTEGER REFERENCES raw_materials(id),
  quantity NUMERIC(15,2) NOT NULL,
  unit VARCHAR(20) DEFAULT 'KG',
  rate NUMERIC(15,2) NOT NULL,
  discount NUMERIC(15,2) DEFAULT 0,
  hsn_code VARCHAR(50),
  gst_percent NUMERIC(5,2) DEFAULT 0,
  taxable_amount NUMERIC(15,2) NOT NULL,
  gst_amount NUMERIC(15,2) DEFAULT 0,
  cgst_amount NUMERIC(15,2) DEFAULT 0,
  sgst_amount NUMERIC(15,2) DEFAULT 0,
  igst_amount NUMERIC(15,2) DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS raw_material_movements (
  id SERIAL PRIMARY KEY,
  movement_type VARCHAR(50) NOT NULL,
  reference_type VARCHAR(50) NOT NULL,
  reference_id VARCHAR(100) NOT NULL,
  raw_material_id INTEGER REFERENCES raw_materials(id),
  quantity_change NUMERIC(15,2) NOT NULL,
  balance_after NUMERIC(15,2) NOT NULL,
  manager_name VARCHAR(100),
  remarks TEXT,
  unit VARCHAR(20) DEFAULT 'KG',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS production_orders (
  id SERIAL PRIMARY KEY,
  order_no VARCHAR(50) UNIQUE NOT NULL,
  order_date VARCHAR(20) NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  customer_order_no VARCHAR(100),
  finished_product_id INTEGER REFERENCES finished_products(id),
  gsm INTEGER,
  size VARCHAR(50),
  required_quantity NUMERIC(15,2) NOT NULL,
  unit VARCHAR(20) DEFAULT 'KG',
  delivery_date VARCHAR(20),
  remarks TEXT,
  status VARCHAR(50) DEFAULT 'Pending',
  created_by VARCHAR(100) DEFAULT 'Admin',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS consumption_batches (
  id SERIAL PRIMARY KEY,
  batch_no VARCHAR(50) UNIQUE NOT NULL,
  date VARCHAR(20) NOT NULL,
  production_order_id INTEGER REFERENCES production_orders(id),
  machine_id INTEGER REFERENCES machines(id),
  shift_id INTEGER REFERENCES shifts(id),
  manager_id INTEGER,
  manager_name VARCHAR(100) NOT NULL,
  device_id VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Issued',
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS consumption_batch_items (
  id SERIAL PRIMARY KEY,
  consumption_batch_id INTEGER REFERENCES consumption_batches(id) ON DELETE CASCADE,
  raw_material_id INTEGER REFERENCES raw_materials(id),
  quantity NUMERIC(15,2) NOT NULL,
  unit VARCHAR(20) DEFAULT 'KG',
  batch_lot VARCHAR(100),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS production_batches (
  id SERIAL PRIMARY KEY,
  batch_code VARCHAR(50) UNIQUE NOT NULL,
  date VARCHAR(20) NOT NULL,
  machine_id INTEGER REFERENCES machines(id),
  shift_id INTEGER REFERENCES shifts(id),
  raw_material_id INTEGER REFERENCES raw_materials(id),
  raw_material_used_kg NUMERIC(15,2) DEFAULT 0,
  total_finished_kg NUMERIC(15,2) DEFAULT 0,
  total_wastage_kg NUMERIC(15,2) DEFAULT 0,
  wastage_reason TEXT,
  wastage_unit VARCHAR(20) DEFAULT 'KG',
  remarks TEXT,
  manager_id INTEGER,
  manager_name VARCHAR(100) NOT NULL,
  device_id VARCHAR(100),
  production_order_id INTEGER REFERENCES production_orders(id),
  consumption_batch_id INTEGER REFERENCES consumption_batches(id),
  is_voided INTEGER DEFAULT 0,
  voided_at TIMESTAMPTZ,
  voided_by VARCHAR(100),
  void_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS production_outputs (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER REFERENCES production_batches(id) ON DELETE CASCADE,
  finished_product_id INTEGER REFERENCES finished_products(id),
  gsm INTEGER,
  width_size VARCHAR(50),
  length_val VARCHAR(50),
  colour VARCHAR(50),
  grade VARCHAR(50),
  quantity_kg NUMERIC(15,2) NOT NULL,
  unit VARCHAR(20) DEFAULT 'KG',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finished_goods_movements (
  id SERIAL PRIMARY KEY,
  movement_type VARCHAR(50) NOT NULL,
  reference_type VARCHAR(50) NOT NULL,
  reference_id VARCHAR(100) NOT NULL,
  finished_product_id INTEGER REFERENCES finished_products(id),
  quantity_change NUMERIC(15,2) NOT NULL,
  balance_after NUMERIC(15,2) NOT NULL,
  manager_name VARCHAR(100),
  remarks TEXT,
  unit VARCHAR(20) DEFAULT 'KG',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  sale_code VARCHAR(50) UNIQUE NOT NULL,
  date VARCHAR(20) NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  finished_product_id INTEGER REFERENCES finished_products(id),
  quantity_kg NUMERIC(15,2) NOT NULL,
  rate_per_kg NUMERIC(15,2) NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL,
  payment_type VARCHAR(50) DEFAULT 'Cash',
  remarks TEXT,
  manager_id INTEGER,
  manager_name VARCHAR(100) NOT NULL,
  device_id VARCHAR(100),
  invoice_number VARCHAR(100),
  taxable_amount NUMERIC(15,2) DEFAULT 0,
  gst_percent NUMERIC(5,2) DEFAULT 18,
  cgst_amount NUMERIC(15,2) DEFAULT 0,
  sgst_amount NUMERIC(15,2) DEFAULT 0,
  igst_amount NUMERIC(15,2) DEFAULT 0,
  sales_type VARCHAR(50) DEFAULT 'GST',
  customer_gstin VARCHAR(50),
  billing_address TEXT,
  shipping_address TEXT,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  other_charges NUMERIC(15,2) DEFAULT 0,
  round_off NUMERIC(15,2) DEFAULT 0,
  is_voided INTEGER DEFAULT 0,
  voided_at TIMESTAMPTZ,
  voided_by VARCHAR(100),
  void_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  finished_product_id INTEGER REFERENCES finished_products(id),
  gsm INTEGER,
  size VARCHAR(50),
  hsn_code VARCHAR(50),
  quantity NUMERIC(15,2) NOT NULL,
  unit VARCHAR(20) DEFAULT 'KG',
  rate NUMERIC(15,2) NOT NULL,
  discount NUMERIC(15,2) DEFAULT 0,
  gst_percent NUMERIC(5,2) DEFAULT 0,
  taxable_amount NUMERIC(15,2) NOT NULL,
  gst_amount NUMERIC(15,2) DEFAULT 0,
  cgst_amount NUMERIC(15,2) DEFAULT 0,
  sgst_amount NUMERIC(15,2) DEFAULT 0,
  igst_amount NUMERIC(15,2) DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wastage_records (
  id SERIAL PRIMARY KEY,
  date VARCHAR(20) NOT NULL,
  production_id INTEGER,
  production_no VARCHAR(50) NOT NULL,
  production_order_id INTEGER REFERENCES production_orders(id),
  product_id INTEGER REFERENCES finished_products(id),
  quantity NUMERIC(15,2) NOT NULL,
  unit VARCHAR(20) DEFAULT 'KG',
  reason TEXT,
  manager_name VARCHAR(100),
  machine_id INTEGER REFERENCES machines(id),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  payment_code VARCHAR(50) UNIQUE NOT NULL,
  date VARCHAR(20) NOT NULL,
  party_type VARCHAR(50) NOT NULL,
  party_id INTEGER NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  payment_mode VARCHAR(50) DEFAULT 'Bank',
  reference_no VARCHAR(100),
  remarks TEXT,
  created_by VARCHAR(100) DEFAULT 'Admin',
  is_voided INTEGER DEFAULT 0,
  voided_at TIMESTAMPTZ,
  voided_by VARCHAR(100),
  void_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id SERIAL PRIMARY KEY,
  adjustment_code VARCHAR(50) UNIQUE NOT NULL,
  date VARCHAR(20) NOT NULL,
  item_type VARCHAR(50) NOT NULL,
  item_id INTEGER NOT NULL,
  system_quantity_kg NUMERIC(15,2) NOT NULL,
  physical_quantity_kg NUMERIC(15,2) NOT NULL,
  difference_kg NUMERIC(15,2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  reason TEXT,
  adjusted_by VARCHAR(100) NOT NULL,
  device_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  original_values TEXT,
  new_values TEXT,
  performed_by VARCHAR(100),
  device_id VARCHAR(100),
  timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
