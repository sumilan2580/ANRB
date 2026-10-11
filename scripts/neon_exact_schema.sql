-- =====================================================================
-- ANRB / TRIPAL ERP — EXACT REPLICATED PRODUCTION SCHEMA FOR NEON
-- Generated from Layerbase PostgreSQL: 2026-10-07T12:03:33.395Z
-- =====================================================================

-- ---------------------------------------------------------------------
-- Table: audit_logs
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" SERIAL NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(100) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "original_values" TEXT,
    "new_values" TEXT,
    "performed_by" VARCHAR(200),
    "device_id" VARCHAR(200),
    "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------
-- Table: bank_accounts
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "bank_accounts" (
    "id" SERIAL NOT NULL,
    "bank_name" VARCHAR(150) NOT NULL,
    "account_name" VARCHAR(150) NOT NULL,
    "account_number" VARCHAR(100) NOT NULL,
    "ifsc" VARCHAR(50),
    "branch" VARCHAR(150),
    "opening_balance" NUMERIC(15,2) DEFAULT 0,
    "opening_balance_type" VARCHAR(10) DEFAULT 'Dr'::character varying,
    "status" VARCHAR(20) DEFAULT 'active'::character varying,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Table: bank_transfers
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "bank_transfers" (
    "id" SERIAL NOT NULL,
    "transfer_code" VARCHAR(50) NOT NULL,
    "date" VARCHAR(20) NOT NULL,
    "from_bank_id" INTEGER,
    "to_bank_id" INTEGER,
    "amount" NUMERIC(15,2) NOT NULL,
    "reference_no" VARCHAR(100),
    "remarks" TEXT,
    "created_by" VARCHAR(100) DEFAULT 'Admin'::character varying,
    "is_voided" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Table: consumption_batch_items
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "consumption_batch_items" (
    "id" SERIAL NOT NULL,
    "consumption_batch_id" INTEGER NOT NULL,
    "raw_material_id" INTEGER NOT NULL,
    "quantity" NUMERIC(18,3) NOT NULL,
    "unit" VARCHAR(20) DEFAULT 'KG'::character varying NOT NULL,
    "batch_lot" VARCHAR(100),
    "remarks" VARCHAR(500),
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------
-- Table: consumption_batches
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "consumption_batches" (
    "id" SERIAL NOT NULL,
    "batch_no" VARCHAR(50) NOT NULL,
    "date" VARCHAR(20) NOT NULL,
    "production_order_id" INTEGER,
    "machine_id" INTEGER,
    "shift_id" INTEGER,
    "manager_id" INTEGER,
    "manager_name" VARCHAR(200) NOT NULL,
    "device_id" VARCHAR(200),
    "status" VARCHAR(20) DEFAULT 'Issued'::character varying,
    "remarks" VARCHAR(500),
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------
-- Table: customers
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "customers" (
    "id" SERIAL NOT NULL,
    "customer_code" VARCHAR(50),
    "name" VARCHAR(300) NOT NULL,
    "phone" VARCHAR(30),
    "email" VARCHAR(200),
    "address" VARCHAR(500),
    "billing_address" VARCHAR(500),
    "shipping_address" VARCHAR(500),
    "city" VARCHAR(100) DEFAULT 'Ahmedabad'::character varying,
    "state" VARCHAR(100) DEFAULT 'Gujarat'::character varying,
    "pincode" VARCHAR(20) DEFAULT '382445'::character varying,
    "state_code" VARCHAR(10) DEFAULT '24'::character varying,
    "gst_number" VARCHAR(20),
    "customer_type" VARCHAR(50) DEFAULT 'GST Registered'::character varying,
    "opening_balance" NUMERIC(18,2) DEFAULT 0,
    "opening_balance_type" VARCHAR(20) DEFAULT 'Debit'::character varying,
    "remarks" VARCHAR(500),
    "status" VARCHAR(20) DEFAULT 'active'::character varying NOT NULL,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------
-- Table: debit_credit_notes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "debit_credit_notes" (
    "id" SERIAL NOT NULL,
    "note_type" VARCHAR(20) NOT NULL,
    "note_code" VARCHAR(50) NOT NULL,
    "date" VARCHAR(20) NOT NULL,
    "party_type" VARCHAR(20) NOT NULL,
    "party_id" INTEGER NOT NULL,
    "reference_invoice" VARCHAR(100),
    "reason" TEXT,
    "taxable_amount" NUMERIC(15,2) DEFAULT 0,
    "gst_percent" NUMERIC(5,2) DEFAULT 0,
    "cgst_amount" NUMERIC(15,2) DEFAULT 0,
    "sgst_amount" NUMERIC(15,2) DEFAULT 0,
    "igst_amount" NUMERIC(15,2) DEFAULT 0,
    "total_amount" NUMERIC(15,2) NOT NULL,
    "remarks" TEXT,
    "created_by" VARCHAR(100) DEFAULT 'Admin'::character varying,
    "is_voided" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Table: expense_heads
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "expense_heads" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" VARCHAR(20) DEFAULT 'EXPENSE'::character varying NOT NULL,
    "category" VARCHAR(100) DEFAULT 'Direct Expense'::character varying,
    "status" VARCHAR(20) DEFAULT 'active'::character varying,
    "description" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Table: financial_years
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "financial_years" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "start_date" VARCHAR(20) NOT NULL,
    "end_date" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Table: finished_goods_movements
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "finished_goods_movements" (
    "id" SERIAL NOT NULL,
    "movement_type" VARCHAR(50) NOT NULL,
    "reference_type" VARCHAR(50) NOT NULL,
    "reference_id" VARCHAR(100) NOT NULL,
    "finished_product_id" INTEGER NOT NULL,
    "quantity_change" NUMERIC(18,3) NOT NULL,
    "unit" VARCHAR(20) DEFAULT 'KG'::character varying,
    "balance_after" NUMERIC(18,3) NOT NULL,
    "manager_name" VARCHAR(200),
    "remarks" VARCHAR(500),
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------
-- Table: finished_products
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "finished_products" (
    "id" SERIAL NOT NULL,
    "product_code" VARCHAR(50) NOT NULL,
    "product_name" VARCHAR(200) DEFAULT 'Tripal'::character varying,
    "gsm" INTEGER NOT NULL,
    "width_size" VARCHAR(50) NOT NULL,
    "length_val" VARCHAR(50),
    "colour" VARCHAR(50) NOT NULL,
    "grade" VARCHAR(50) DEFAULT 'Grade A'::character varying,
    "unit" VARCHAR(20) DEFAULT 'KG'::character varying,
    "min_stock_alert" NUMERIC(18,3) DEFAULT 500,
    "hsn_code" VARCHAR(20) DEFAULT '3926'::character varying,
    "gst_percent" NUMERIC(8,4) DEFAULT 18,
    "status" VARCHAR(20) DEFAULT 'active'::character varying NOT NULL,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------
-- Table: machines
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "machines" (
    "id" SERIAL NOT NULL,
    "machine_code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "capacity_kg_per_day" NUMERIC(18,3) DEFAULT 5000,
    "status" VARCHAR(20) DEFAULT 'active'::character varying NOT NULL,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------
-- Table: managers
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "managers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "device_id" VARCHAR(200),
    "phone" VARCHAR(30),
    "status" VARCHAR(20) DEFAULT 'active'::character varying NOT NULL,
    "manager_token" VARCHAR(200),
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "permissions" TEXT
);

-- ---------------------------------------------------------------------
-- Table: opening_balances
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "opening_balances" (
    "id" SERIAL NOT NULL,
    "financial_year" VARCHAR(50) NOT NULL,
    "opening_date" VARCHAR(20) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" INTEGER DEFAULT 0,
    "quantity" NUMERIC(15,2) DEFAULT 0,
    "unit" VARCHAR(20),
    "rate" NUMERIC(15,2) DEFAULT 0,
    "amount" NUMERIC(15,2) DEFAULT 0,
    "balance_type" VARCHAR(10) DEFAULT 'Dr'::character varying,
    "gsm" INTEGER,
    "size" VARCHAR(50),
    "remarks" TEXT,
    "created_by" VARCHAR(100) DEFAULT 'Admin'::character varying,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Table: payments
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "payments" (
    "id" SERIAL NOT NULL,
    "payment_code" VARCHAR(50) NOT NULL,
    "date" VARCHAR(20) NOT NULL,
    "party_type" VARCHAR(20) NOT NULL,
    "party_id" INTEGER NOT NULL,
    "amount" NUMERIC(18,2) NOT NULL,
    "payment_mode" VARCHAR(30) DEFAULT 'Bank'::character varying,
    "reference_no" VARCHAR(200),
    "remarks" VARCHAR(500),
    "against_type" VARCHAR(30) DEFAULT 'ON_ACCOUNT'::character varying,
    "invoice_id" INTEGER,
    "created_by" VARCHAR(200) DEFAULT 'Admin'::character varying,
    "manager_id" INTEGER,
    "manager_name" VARCHAR(200),
    "device_id" VARCHAR(200),
    "is_voided" SMALLINT DEFAULT 0 NOT NULL,
    "voided_at" TIMESTAMP,
    "voided_by" VARCHAR(200),
    "void_reason" VARCHAR(500),
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "bank_account_id" INTEGER
);

-- ---------------------------------------------------------------------
-- Table: production_batches
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "production_batches" (
    "id" SERIAL NOT NULL,
    "batch_code" VARCHAR(50) NOT NULL,
    "date" VARCHAR(20) NOT NULL,
    "machine_id" INTEGER,
    "shift_id" INTEGER,
    "raw_material_id" INTEGER,
    "raw_material_used_kg" NUMERIC(18,3) DEFAULT 0,
    "total_finished_kg" NUMERIC(18,3) DEFAULT 0 NOT NULL,
    "total_wastage_kg" NUMERIC(18,3) DEFAULT 0 NOT NULL,
    "wastage_unit" VARCHAR(20) DEFAULT 'KG'::character varying,
    "wastage_reason" VARCHAR(200),
    "remarks" VARCHAR(500),
    "manager_id" INTEGER,
    "manager_name" VARCHAR(200) DEFAULT 'Admin'::character varying NOT NULL,
    "device_id" VARCHAR(200),
    "production_order_id" INTEGER,
    "consumption_batch_id" INTEGER,
    "is_voided" SMALLINT DEFAULT 0 NOT NULL,
    "voided_at" TIMESTAMP,
    "voided_by" VARCHAR(200),
    "void_reason" VARCHAR(500),
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------
-- Table: production_orders
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "production_orders" (
    "id" SERIAL NOT NULL,
    "order_no" VARCHAR(50) NOT NULL,
    "order_date" VARCHAR(20) NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "customer_order_no" VARCHAR(100),
    "finished_product_id" INTEGER NOT NULL,
    "gsm" INTEGER,
    "size" VARCHAR(50),
    "required_quantity" NUMERIC(18,3) NOT NULL,
    "unit" VARCHAR(20) DEFAULT 'KG'::character varying,
    "delivery_date" VARCHAR(20),
    "remarks" VARCHAR(500),
    "status" VARCHAR(30) DEFAULT 'Pending'::character varying,
    "created_by" VARCHAR(200) DEFAULT 'Admin'::character varying,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------
-- Table: production_outputs
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "production_outputs" (
    "id" SERIAL NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "finished_product_id" INTEGER NOT NULL,
    "gsm" INTEGER,
    "width_size" VARCHAR(50),
    "length_val" VARCHAR(50),
    "colour" VARCHAR(50),
    "grade" VARCHAR(50),
    "quantity_kg" NUMERIC(18,3) NOT NULL,
    "unit" VARCHAR(20) DEFAULT 'KG'::character varying,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------
-- Table: purchase_items
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "purchase_items" (
    "id" SERIAL NOT NULL,
    "purchase_id" INTEGER NOT NULL,
    "raw_material_id" INTEGER NOT NULL,
    "quantity" NUMERIC(18,3) NOT NULL,
    "unit" VARCHAR(20) DEFAULT 'KG'::character varying NOT NULL,
    "rate" NUMERIC(18,4) NOT NULL,
    "discount" NUMERIC(18,2) DEFAULT 0,
    "hsn_code" VARCHAR(20),
    "gst_percent" NUMERIC(8,4) DEFAULT 0,
    "taxable_amount" NUMERIC(18,2) NOT NULL,
    "gst_amount" NUMERIC(18,2) DEFAULT 0,
    "cgst_amount" NUMERIC(18,2) DEFAULT 0,
    "sgst_amount" NUMERIC(18,2) DEFAULT 0,
    "igst_amount" NUMERIC(18,2) DEFAULT 0,
    "total_amount" NUMERIC(18,2) NOT NULL,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------
-- Table: raw_material_movements
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "raw_material_movements" (
    "id" SERIAL NOT NULL,
    "movement_type" VARCHAR(50) NOT NULL,
    "reference_type" VARCHAR(50) NOT NULL,
    "reference_id" VARCHAR(100) NOT NULL,
    "raw_material_id" INTEGER NOT NULL,
    "quantity_change" NUMERIC(18,3) NOT NULL,
    "unit" VARCHAR(20) DEFAULT 'KG'::character varying,
    "balance_after" NUMERIC(18,3) NOT NULL,
    "manager_name" VARCHAR(200),
    "remarks" VARCHAR(500),
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------
-- Table: raw_material_purchases
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "raw_material_purchases" (
    "id" SERIAL NOT NULL,
    "purchase_code" VARCHAR(50) NOT NULL,
    "date" VARCHAR(20) NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "raw_material_id" INTEGER,
    "quantity_kg" NUMERIC(18,3) DEFAULT 0,
    "rate_per_kg" NUMERIC(18,4) DEFAULT 0,
    "taxable_amount" NUMERIC(18,2) DEFAULT 0,
    "gst_percent" NUMERIC(8,4) DEFAULT 18,
    "cgst_amount" NUMERIC(18,2) DEFAULT 0,
    "sgst_amount" NUMERIC(18,2) DEFAULT 0,
    "igst_amount" NUMERIC(18,2) DEFAULT 0,
    "total_amount" NUMERIC(18,2) DEFAULT 0,
    "purchase_type" VARCHAR(20) DEFAULT 'GST'::character varying,
    "discount_amount" NUMERIC(18,2) DEFAULT 0,
    "other_charges" NUMERIC(18,2) DEFAULT 0,
    "round_off" NUMERIC(18,2) DEFAULT 0,
    "payment_mode" VARCHAR(30) DEFAULT 'Credit'::character varying,
    "invoice_number" VARCHAR(100),
    "remarks" VARCHAR(500),
    "manager_id" INTEGER,
    "manager_name" VARCHAR(200) NOT NULL,
    "device_id" VARCHAR(200),
    "is_voided" SMALLINT DEFAULT 0 NOT NULL,
    "voided_at" TIMESTAMP,
    "voided_by" VARCHAR(200),
    "void_reason" VARCHAR(500),
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "el_charges" TEXT DEFAULT '[]'::text
);

-- ---------------------------------------------------------------------
-- Table: raw_materials
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "raw_materials" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "unit" VARCHAR(20) DEFAULT 'KG'::character varying NOT NULL,
    "min_stock_alert" NUMERIC(18,3) DEFAULT 1000,
    "hsn_code" VARCHAR(20) DEFAULT '3901'::character varying,
    "gst_percent" NUMERIC(8,4) DEFAULT 18,
    "status" VARCHAR(20) DEFAULT 'active'::character varying NOT NULL,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------
-- Table: sales
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "sales" (
    "id" SERIAL NOT NULL,
    "sale_code" VARCHAR(50) NOT NULL,
    "invoice_number" VARCHAR(100),
    "date" VARCHAR(20) NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "finished_product_id" INTEGER,
    "quantity_kg" NUMERIC(18,3) DEFAULT 0,
    "rate_per_kg" NUMERIC(18,4) DEFAULT 0,
    "taxable_amount" NUMERIC(18,2) DEFAULT 0,
    "gst_percent" NUMERIC(8,4) DEFAULT 18,
    "cgst_amount" NUMERIC(18,2) DEFAULT 0,
    "sgst_amount" NUMERIC(18,2) DEFAULT 0,
    "igst_amount" NUMERIC(18,2) DEFAULT 0,
    "total_amount" NUMERIC(18,2) DEFAULT 0,
    "sales_type" VARCHAR(20) DEFAULT 'GST'::character varying,
    "payment_type" VARCHAR(30) DEFAULT 'Cash'::character varying,
    "customer_gstin" VARCHAR(20),
    "billing_address" VARCHAR(500),
    "shipping_address" VARCHAR(500),
    "discount_amount" NUMERIC(18,2) DEFAULT 0,
    "other_charges" NUMERIC(18,2) DEFAULT 0,
    "round_off" NUMERIC(18,2) DEFAULT 0,
    "remarks" VARCHAR(500),
    "manager_id" INTEGER,
    "manager_name" VARCHAR(200) NOT NULL,
    "device_id" VARCHAR(200),
    "is_voided" SMALLINT DEFAULT 0 NOT NULL,
    "voided_at" TIMESTAMP,
    "voided_by" VARCHAR(200),
    "void_reason" VARCHAR(500),
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "state_code" VARCHAR(10),
    "reverse_charge" VARCHAR(10) DEFAULT 'No'::character varying,
    "shipping_name" VARCHAR(200),
    "terms_conditions" TEXT
);

-- ---------------------------------------------------------------------
-- Table: sales_items
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "sales_items" (
    "id" SERIAL NOT NULL,
    "sale_id" INTEGER NOT NULL,
    "finished_product_id" INTEGER NOT NULL,
    "gsm" INTEGER,
    "size" VARCHAR(50),
    "hsn_code" VARCHAR(20),
    "quantity" NUMERIC(18,3) NOT NULL,
    "unit" VARCHAR(20) DEFAULT 'KG'::character varying NOT NULL,
    "rate" NUMERIC(18,4) NOT NULL,
    "discount" NUMERIC(18,2) DEFAULT 0,
    "gst_percent" NUMERIC(8,4) DEFAULT 0,
    "taxable_amount" NUMERIC(18,2) NOT NULL,
    "gst_amount" NUMERIC(18,2) DEFAULT 0,
    "cgst_amount" NUMERIC(18,2) DEFAULT 0,
    "sgst_amount" NUMERIC(18,2) DEFAULT 0,
    "igst_amount" NUMERIC(18,2) DEFAULT 0,
    "total_amount" NUMERIC(18,2) NOT NULL,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------
-- Table: schema_migrations
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "schema_migrations" (
    "id" SERIAL NOT NULL,
    "version" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "applied_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "execution_time_ms" INTEGER DEFAULT 0,
    "checksum" VARCHAR(64) NOT NULL
);

-- ---------------------------------------------------------------------
-- Table: settings
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT,
    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------
-- Table: shifts
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "shifts" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "start_time" VARCHAR(20),
    "end_time" VARCHAR(20),
    "status" VARCHAR(20) DEFAULT 'active'::character varying NOT NULL,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------
-- Table: staff
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "staff" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(50),
    "designation" VARCHAR(100) DEFAULT 'Worker'::character varying,
    "department" VARCHAR(100),
    "wage_type" VARCHAR(50) DEFAULT 'Daily'::character varying,
    "wage_amount" NUMERIC(15,2) DEFAULT 0,
    "joining_date" VARCHAR(20),
    "status" VARCHAR(20) DEFAULT 'active'::character varying,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Table: staff_attendance
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "staff_attendance" (
    "id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "date" VARCHAR(20) NOT NULL,
    "status" VARCHAR(50) DEFAULT 'Full Day'::character varying NOT NULL,
    "overtime_hours" NUMERIC(10,2) DEFAULT 0,
    "remarks" TEXT,
    "marked_by" VARCHAR(100) DEFAULT 'Admin'::character varying,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Table: stock_adjustments
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "stock_adjustments" (
    "id" SERIAL NOT NULL,
    "adjustment_code" VARCHAR(50) NOT NULL,
    "date" VARCHAR(20) NOT NULL,
    "item_type" VARCHAR(30) NOT NULL,
    "item_id" INTEGER NOT NULL,
    "system_quantity_kg" NUMERIC(18,3) NOT NULL,
    "physical_quantity_kg" NUMERIC(18,3) NOT NULL,
    "difference_kg" NUMERIC(18,3) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "reason" VARCHAR(500),
    "adjusted_by" VARCHAR(200) NOT NULL,
    "device_id" VARCHAR(200),
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------
-- Table: suppliers
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "suppliers" (
    "id" SERIAL NOT NULL,
    "supplier_code" VARCHAR(50),
    "name" VARCHAR(300) NOT NULL,
    "phone" VARCHAR(30),
    "email" VARCHAR(200),
    "address" VARCHAR(500),
    "city" VARCHAR(100) DEFAULT 'Ahmedabad'::character varying,
    "state" VARCHAR(100) DEFAULT 'Gujarat'::character varying,
    "pincode" VARCHAR(20) DEFAULT '382445'::character varying,
    "state_code" VARCHAR(10) DEFAULT '24'::character varying,
    "gst_number" VARCHAR(20),
    "supplier_type" VARCHAR(50) DEFAULT 'GST Registered'::character varying,
    "opening_balance" NUMERIC(18,2) DEFAULT 0,
    "opening_balance_type" VARCHAR(20) DEFAULT 'Credit'::character varying,
    "status" VARCHAR(20) DEFAULT 'active'::character varying NOT NULL,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------
-- Table: users
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) DEFAULT 'admin'::character varying NOT NULL,
    "name" VARCHAR(200),
    "session_token" VARCHAR(200),
    "manager_id" INTEGER,
    "status" VARCHAR(20) DEFAULT 'active'::character varying NOT NULL,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "permissions" TEXT
);

-- ---------------------------------------------------------------------
-- Table: wastage_records
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "wastage_records" (
    "id" SERIAL NOT NULL,
    "date" VARCHAR(20) NOT NULL,
    "production_id" INTEGER,
    "production_no" VARCHAR(50) NOT NULL,
    "production_order_id" INTEGER,
    "product_id" INTEGER,
    "quantity" NUMERIC(18,3) NOT NULL,
    "unit" VARCHAR(20) DEFAULT 'KG'::character varying,
    "reason" VARCHAR(200),
    "manager_name" VARCHAR(200),
    "machine_id" INTEGER,
    "remarks" VARCHAR(500),
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =====================================================================
-- PRIMARY KEYS
-- =====================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_pkey') THEN
    ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bank_accounts_pkey') THEN
    ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bank_transfers_pkey') THEN
    ALTER TABLE "bank_transfers" ADD CONSTRAINT "bank_transfers_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consumption_batch_items_pkey') THEN
    ALTER TABLE "consumption_batch_items" ADD CONSTRAINT "consumption_batch_items_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consumption_batches_pkey') THEN
    ALTER TABLE "consumption_batches" ADD CONSTRAINT "consumption_batches_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_pkey') THEN
    ALTER TABLE "customers" ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debit_credit_notes_pkey') THEN
    ALTER TABLE "debit_credit_notes" ADD CONSTRAINT "debit_credit_notes_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expense_heads_pkey') THEN
    ALTER TABLE "expense_heads" ADD CONSTRAINT "expense_heads_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_years_pkey') THEN
    ALTER TABLE "financial_years" ADD CONSTRAINT "financial_years_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finished_goods_movements_pkey') THEN
    ALTER TABLE "finished_goods_movements" ADD CONSTRAINT "finished_goods_movements_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finished_products_pkey') THEN
    ALTER TABLE "finished_products" ADD CONSTRAINT "finished_products_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machines_pkey') THEN
    ALTER TABLE "machines" ADD CONSTRAINT "machines_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'managers_pkey') THEN
    ALTER TABLE "managers" ADD CONSTRAINT "managers_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opening_balances_pkey') THEN
    ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_pkey') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_batches_pkey') THEN
    ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_orders_pkey') THEN
    ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_outputs_pkey') THEN
    ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_items_pkey') THEN
    ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_material_movements_pkey') THEN
    ALTER TABLE "raw_material_movements" ADD CONSTRAINT "raw_material_movements_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_material_purchases_pkey') THEN
    ALTER TABLE "raw_material_purchases" ADD CONSTRAINT "raw_material_purchases_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_materials_pkey') THEN
    ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_pkey') THEN
    ALTER TABLE "sales" ADD CONSTRAINT "sales_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_items_pkey') THEN
    ALTER TABLE "sales_items" ADD CONSTRAINT "sales_items_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schema_migrations_pkey') THEN
    ALTER TABLE "schema_migrations" ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_pkey') THEN
    ALTER TABLE "settings" ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("key");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shifts_pkey') THEN
    ALTER TABLE "shifts" ADD CONSTRAINT "shifts_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_pkey') THEN
    ALTER TABLE "staff" ADD CONSTRAINT "staff_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_attendance_pkey') THEN
    ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_adjustments_pkey') THEN
    ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_pkey') THEN
    ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_pkey') THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wastage_records_pkey') THEN
    ALTER TABLE "wastage_records" ADD CONSTRAINT "wastage_records_pkey" PRIMARY KEY ("id");
  END IF;
END $$;

-- =====================================================================
-- UNIQUE CONSTRAINTS
-- =====================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bank_transfers_transfer_code_key') THEN
    ALTER TABLE "bank_transfers" ADD CONSTRAINT "bank_transfers_transfer_code_key" UNIQUE (transfer_code);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consumption_batches_batch_no_key') THEN
    ALTER TABLE "consumption_batches" ADD CONSTRAINT "consumption_batches_batch_no_key" UNIQUE (batch_no);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_name_key') THEN
    ALTER TABLE "customers" ADD CONSTRAINT "customers_name_key" UNIQUE (name);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debit_credit_notes_note_code_key') THEN
    ALTER TABLE "debit_credit_notes" ADD CONSTRAINT "debit_credit_notes_note_code_key" UNIQUE (note_code);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expense_heads_code_key') THEN
    ALTER TABLE "expense_heads" ADD CONSTRAINT "expense_heads_code_key" UNIQUE (code);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_years_name_key') THEN
    ALTER TABLE "financial_years" ADD CONSTRAINT "financial_years_name_key" UNIQUE (name);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finished_products_product_code_key') THEN
    ALTER TABLE "finished_products" ADD CONSTRAINT "finished_products_product_code_key" UNIQUE (product_code);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machines_machine_code_key') THEN
    ALTER TABLE "machines" ADD CONSTRAINT "machines_machine_code_key" UNIQUE (machine_code);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'managers_manager_token_key') THEN
    ALTER TABLE "managers" ADD CONSTRAINT "managers_manager_token_key" UNIQUE (manager_token);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'managers_name_key') THEN
    ALTER TABLE "managers" ADD CONSTRAINT "managers_name_key" UNIQUE (name);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_opening_entity') THEN
    ALTER TABLE "opening_balances" ADD CONSTRAINT "uq_opening_entity" UNIQUE (financial_year, entity_type, entity_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_payment_code_key') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_code_key" UNIQUE (payment_code);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_batches_batch_code_key') THEN
    ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_batch_code_key" UNIQUE (batch_code);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_orders_order_no_key') THEN
    ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_order_no_key" UNIQUE (order_no);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_material_purchases_purchase_code_key') THEN
    ALTER TABLE "raw_material_purchases" ADD CONSTRAINT "raw_material_purchases_purchase_code_key" UNIQUE (purchase_code);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_materials_code_key') THEN
    ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_code_key" UNIQUE (code);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_materials_name_key') THEN
    ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_name_key" UNIQUE (name);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_sale_code_key') THEN
    ALTER TABLE "sales" ADD CONSTRAINT "sales_sale_code_key" UNIQUE (sale_code);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schema_migrations_version_key') THEN
    ALTER TABLE "schema_migrations" ADD CONSTRAINT "schema_migrations_version_key" UNIQUE (version);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shifts_name_key') THEN
    ALTER TABLE "shifts" ADD CONSTRAINT "shifts_name_key" UNIQUE (name);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_staff_attendance') THEN
    ALTER TABLE "staff_attendance" ADD CONSTRAINT "uq_staff_attendance" UNIQUE (staff_id, date);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_adjustments_adjustment_code_key') THEN
    ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_adjustment_code_key" UNIQUE (adjustment_code);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_name_key') THEN
    ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_name_key" UNIQUE (name);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key') THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_username_key" UNIQUE (username);
  END IF;
END $$;

-- =====================================================================
-- CHECK CONSTRAINTS
-- =====================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consumption_batch_items_quantity_check') THEN
    ALTER TABLE "consumption_batch_items" ADD CONSTRAINT "consumption_batch_items_quantity_check" CHECK ((quantity > (0)::numeric));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consumption_batches_status_check') THEN
    ALTER TABLE "consumption_batches" ADD CONSTRAINT "consumption_batches_status_check" CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Issued'::character varying, 'Completed'::character varying, 'Cancelled'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_opening_balance_type_check') THEN
    ALTER TABLE "customers" ADD CONSTRAINT "customers_opening_balance_type_check" CHECK (((opening_balance_type)::text = ANY ((ARRAY['Debit'::character varying, 'Credit'::character varying, 'DEBIT'::character varying, 'CREDIT'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_status_check') THEN
    ALTER TABLE "customers" ADD CONSTRAINT "customers_status_check" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finished_products_status_check') THEN
    ALTER TABLE "finished_products" ADD CONSTRAINT "finished_products_status_check" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machines_status_check') THEN
    ALTER TABLE "machines" ADD CONSTRAINT "machines_status_check" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'managers_status_check') THEN
    ALTER TABLE "managers" ADD CONSTRAINT "managers_status_check" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_party_type_check') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_party_type_check" CHECK (((party_type)::text = ANY ((ARRAY['CUSTOMER'::character varying, 'SUPPLIER'::character varying, 'EXPENSE'::character varying, 'INCOME'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_amount_check') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check" CHECK ((amount > (0)::numeric));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_is_voided_check') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_is_voided_check" CHECK ((is_voided = ANY (ARRAY[0, 1])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_batches_is_voided_check') THEN
    ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_is_voided_check" CHECK ((is_voided = ANY (ARRAY[0, 1])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_orders_status_check') THEN
    ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_status_check" CHECK (((status)::text = ANY ((ARRAY['Pending'::character varying, 'In Production'::character varying, 'Completed'::character varying, 'Cancelled'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_outputs_quantity_kg_check') THEN
    ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_quantity_kg_check" CHECK ((quantity_kg > (0)::numeric));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_items_quantity_check') THEN
    ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_quantity_check" CHECK ((quantity > (0)::numeric));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_material_purchases_purchase_type_check') THEN
    ALTER TABLE "raw_material_purchases" ADD CONSTRAINT "raw_material_purchases_purchase_type_check" CHECK (((purchase_type)::text = ANY ((ARRAY['GST'::character varying, 'NON_GST'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_material_purchases_is_voided_check') THEN
    ALTER TABLE "raw_material_purchases" ADD CONSTRAINT "raw_material_purchases_is_voided_check" CHECK ((is_voided = ANY (ARRAY[0, 1])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_materials_unit_check') THEN
    ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_unit_check" CHECK (((unit)::text = ANY ((ARRAY['KG'::character varying, 'PCS'::character varying, 'MTR'::character varying, 'LTR'::character varying, 'NOS'::character varying, 'SET'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_materials_status_check') THEN
    ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_status_check" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_sales_type_check') THEN
    ALTER TABLE "sales" ADD CONSTRAINT "sales_sales_type_check" CHECK (((sales_type)::text = ANY ((ARRAY['GST'::character varying, 'NON_GST'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_is_voided_check') THEN
    ALTER TABLE "sales" ADD CONSTRAINT "sales_is_voided_check" CHECK ((is_voided = ANY (ARRAY[0, 1])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_items_quantity_check') THEN
    ALTER TABLE "sales_items" ADD CONSTRAINT "sales_items_quantity_check" CHECK ((quantity > (0)::numeric));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shifts_status_check') THEN
    ALTER TABLE "shifts" ADD CONSTRAINT "shifts_status_check" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_adjustments_status_check') THEN
    ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_status_check" CHECK (((status)::text = ANY ((ARRAY['MATCHED'::character varying, 'SHORT'::character varying, 'EXCESS'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_adjustments_item_type_check') THEN
    ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_item_type_check" CHECK (((item_type)::text = ANY ((ARRAY['RAW_MATERIAL'::character varying, 'FINISHED_GOOD'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_status_check') THEN
    ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_status_check" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_opening_balance_type_check') THEN
    ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_opening_balance_type_check" CHECK (((opening_balance_type)::text = ANY ((ARRAY['Debit'::character varying, 'Credit'::character varying, 'DEBIT'::character varying, 'CREDIT'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check') THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_status_check" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[])));
  END IF;
END $$;

-- =====================================================================
-- INDEXES
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_logs USING btree (action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs USING btree (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.audit_logs USING btree ("timestamp");
CREATE UNIQUE INDEX IF NOT EXISTS bank_transfers_transfer_code_key ON public.bank_transfers USING btree (transfer_code);
CREATE INDEX IF NOT EXISTS idx_cbi_batch ON public.consumption_batch_items USING btree (consumption_batch_id);
CREATE INDEX IF NOT EXISTS idx_cbi_raw_material ON public.consumption_batch_items USING btree (raw_material_id);
CREATE UNIQUE INDEX IF NOT EXISTS consumption_batches_batch_no_key ON public.consumption_batches USING btree (batch_no);
CREATE INDEX IF NOT EXISTS idx_cb_date ON public.consumption_batches USING btree (date);
CREATE INDEX IF NOT EXISTS idx_cb_machine ON public.consumption_batches USING btree (machine_id);
CREATE INDEX IF NOT EXISTS idx_cb_manager ON public.consumption_batches USING btree (manager_name);
CREATE INDEX IF NOT EXISTS idx_cb_status ON public.consumption_batches USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS customers_name_key ON public.customers USING btree (name);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS debit_credit_notes_note_code_key ON public.debit_credit_notes USING btree (note_code);
CREATE INDEX IF NOT EXISTS idx_dcn_party ON public.debit_credit_notes USING btree (party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_dcn_type ON public.debit_credit_notes USING btree (note_type);
CREATE UNIQUE INDEX IF NOT EXISTS expense_heads_code_key ON public.expense_heads USING btree (code);
CREATE UNIQUE INDEX IF NOT EXISTS financial_years_name_key ON public.financial_years USING btree (name);
CREATE INDEX IF NOT EXISTS idx_fgm_created_at ON public.finished_goods_movements USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_fgm_finished_product ON public.finished_goods_movements USING btree (finished_product_id);
CREATE INDEX IF NOT EXISTS idx_fgm_reference ON public.finished_goods_movements USING btree (reference_id);
CREATE UNIQUE INDEX IF NOT EXISTS finished_products_product_code_key ON public.finished_products USING btree (product_code);
CREATE INDEX IF NOT EXISTS idx_finished_products_status ON public.finished_products USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS machines_machine_code_key ON public.machines USING btree (machine_code);
CREATE UNIQUE INDEX IF NOT EXISTS managers_manager_token_key ON public.managers USING btree (manager_token);
CREATE UNIQUE INDEX IF NOT EXISTS managers_name_key ON public.managers USING btree (name);
CREATE INDEX IF NOT EXISTS idx_opening_fy_type ON public.opening_balances USING btree (financial_year, entity_type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_opening_entity ON public.opening_balances USING btree (financial_year, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments USING btree (date);
CREATE INDEX IF NOT EXISTS idx_payments_party ON public.payments USING btree (party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_payments_voided ON public.payments USING btree (is_voided);
CREATE UNIQUE INDEX IF NOT EXISTS payments_payment_code_key ON public.payments USING btree (payment_code);
CREATE INDEX IF NOT EXISTS idx_pb_consumption ON public.production_batches USING btree (consumption_batch_id);
CREATE INDEX IF NOT EXISTS idx_pb_date ON public.production_batches USING btree (date);
CREATE INDEX IF NOT EXISTS idx_pb_machine ON public.production_batches USING btree (machine_id);
CREATE INDEX IF NOT EXISTS idx_pb_manager ON public.production_batches USING btree (manager_name);
CREATE INDEX IF NOT EXISTS idx_pb_voided ON public.production_batches USING btree (is_voided);
CREATE UNIQUE INDEX IF NOT EXISTS production_batches_batch_code_key ON public.production_batches USING btree (batch_code);
CREATE INDEX IF NOT EXISTS idx_production_orders_customer ON public.production_orders USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_date ON public.production_orders USING btree (order_date);
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON public.production_orders USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS production_orders_order_no_key ON public.production_orders USING btree (order_no);
CREATE INDEX IF NOT EXISTS idx_po_batch ON public.production_outputs USING btree (batch_id);
CREATE INDEX IF NOT EXISTS idx_po_finished_product ON public.production_outputs USING btree (finished_product_id);
CREATE INDEX IF NOT EXISTS idx_pi_purchase ON public.purchase_items USING btree (purchase_id);
CREATE INDEX IF NOT EXISTS idx_pi_raw_material ON public.purchase_items USING btree (raw_material_id);
CREATE INDEX IF NOT EXISTS idx_rmm_created_at ON public.raw_material_movements USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_rmm_raw_material ON public.raw_material_movements USING btree (raw_material_id);
CREATE INDEX IF NOT EXISTS idx_rmm_reference ON public.raw_material_movements USING btree (reference_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON public.raw_material_purchases USING btree (date);
CREATE INDEX IF NOT EXISTS idx_purchases_manager ON public.raw_material_purchases USING btree (manager_name);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON public.raw_material_purchases USING btree (supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_voided ON public.raw_material_purchases USING btree (is_voided);
CREATE UNIQUE INDEX IF NOT EXISTS raw_material_purchases_purchase_code_key ON public.raw_material_purchases USING btree (purchase_code);
CREATE INDEX IF NOT EXISTS idx_raw_materials_status ON public.raw_materials USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS raw_materials_code_key ON public.raw_materials USING btree (code);
CREATE UNIQUE INDEX IF NOT EXISTS raw_materials_name_key ON public.raw_materials USING btree (name);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales USING btree (date);
CREATE INDEX IF NOT EXISTS idx_sales_manager ON public.sales USING btree (manager_name);
CREATE INDEX IF NOT EXISTS idx_sales_voided ON public.sales USING btree (is_voided);
CREATE UNIQUE INDEX IF NOT EXISTS sales_sale_code_key ON public.sales USING btree (sale_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_invoice_number ON public.sales USING btree (invoice_number) WHERE ((is_voided = 0) AND (invoice_number IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_si_finished_product ON public.sales_items USING btree (finished_product_id);
CREATE INDEX IF NOT EXISTS idx_si_sale ON public.sales_items USING btree (sale_id);
CREATE UNIQUE INDEX IF NOT EXISTS schema_migrations_version_key ON public.schema_migrations USING btree (version);
CREATE UNIQUE INDEX IF NOT EXISTS shifts_name_key ON public.shifts USING btree (name);
CREATE INDEX IF NOT EXISTS idx_staff_status ON public.staff USING btree (status);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON public.staff_attendance USING btree (date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_id ON public.staff_attendance USING btree (staff_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_attendance ON public.staff_attendance USING btree (staff_id, date);
CREATE INDEX IF NOT EXISTS idx_adj_date ON public.stock_adjustments USING btree (date);
CREATE INDEX IF NOT EXISTS idx_adj_item ON public.stock_adjustments USING btree (item_type, item_id);
CREATE UNIQUE INDEX IF NOT EXISTS stock_adjustments_adjustment_code_key ON public.stock_adjustments USING btree (adjustment_code);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON public.suppliers USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_name_key ON public.suppliers USING btree (name);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users USING btree (role);
CREATE INDEX IF NOT EXISTS idx_users_session_token ON public.users USING btree (session_token);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON public.users USING btree (username);
CREATE INDEX IF NOT EXISTS idx_wastage_date ON public.wastage_records USING btree (date);
CREATE INDEX IF NOT EXISTS idx_wastage_production ON public.wastage_records USING btree (production_id);

-- =====================================================================
-- FOREIGN KEYS
-- =====================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bank_transfers_from_bank_id_fkey') THEN
    ALTER TABLE "bank_transfers" ADD CONSTRAINT "bank_transfers_from_bank_id_fkey" FOREIGN KEY (from_bank_id) REFERENCES bank_accounts(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bank_transfers_to_bank_id_fkey') THEN
    ALTER TABLE "bank_transfers" ADD CONSTRAINT "bank_transfers_to_bank_id_fkey" FOREIGN KEY (to_bank_id) REFERENCES bank_accounts(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consumption_batch_items_consumption_batch_id_fkey') THEN
    ALTER TABLE "consumption_batch_items" ADD CONSTRAINT "consumption_batch_items_consumption_batch_id_fkey" FOREIGN KEY (consumption_batch_id) REFERENCES consumption_batches(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consumption_batch_items_raw_material_id_fkey') THEN
    ALTER TABLE "consumption_batch_items" ADD CONSTRAINT "consumption_batch_items_raw_material_id_fkey" FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consumption_batches_shift_id_fkey') THEN
    ALTER TABLE "consumption_batches" ADD CONSTRAINT "consumption_batches_shift_id_fkey" FOREIGN KEY (shift_id) REFERENCES shifts(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consumption_batches_production_order_id_fkey') THEN
    ALTER TABLE "consumption_batches" ADD CONSTRAINT "consumption_batches_production_order_id_fkey" FOREIGN KEY (production_order_id) REFERENCES production_orders(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consumption_batches_machine_id_fkey') THEN
    ALTER TABLE "consumption_batches" ADD CONSTRAINT "consumption_batches_machine_id_fkey" FOREIGN KEY (machine_id) REFERENCES machines(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finished_goods_movements_finished_product_id_fkey') THEN
    ALTER TABLE "finished_goods_movements" ADD CONSTRAINT "finished_goods_movements_finished_product_id_fkey" FOREIGN KEY (finished_product_id) REFERENCES finished_products(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_bank_account_id_fkey') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_bank_account_id_fkey" FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_batches_shift_id_fkey') THEN
    ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_shift_id_fkey" FOREIGN KEY (shift_id) REFERENCES shifts(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_batches_production_order_id_fkey') THEN
    ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_production_order_id_fkey" FOREIGN KEY (production_order_id) REFERENCES production_orders(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_batches_consumption_batch_id_fkey') THEN
    ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_consumption_batch_id_fkey" FOREIGN KEY (consumption_batch_id) REFERENCES consumption_batches(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_batches_machine_id_fkey') THEN
    ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_machine_id_fkey" FOREIGN KEY (machine_id) REFERENCES machines(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_batches_raw_material_id_fkey') THEN
    ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_raw_material_id_fkey" FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_orders_customer_id_fkey') THEN
    ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_orders_finished_product_id_fkey') THEN
    ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_finished_product_id_fkey" FOREIGN KEY (finished_product_id) REFERENCES finished_products(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_outputs_batch_id_fkey') THEN
    ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES production_batches(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_outputs_finished_product_id_fkey') THEN
    ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_finished_product_id_fkey" FOREIGN KEY (finished_product_id) REFERENCES finished_products(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_items_raw_material_id_fkey') THEN
    ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_raw_material_id_fkey" FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_items_purchase_id_fkey') THEN
    ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_fkey" FOREIGN KEY (purchase_id) REFERENCES raw_material_purchases(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_material_movements_raw_material_id_fkey') THEN
    ALTER TABLE "raw_material_movements" ADD CONSTRAINT "raw_material_movements_raw_material_id_fkey" FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_material_purchases_raw_material_id_fkey') THEN
    ALTER TABLE "raw_material_purchases" ADD CONSTRAINT "raw_material_purchases_raw_material_id_fkey" FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_material_purchases_supplier_id_fkey') THEN
    ALTER TABLE "raw_material_purchases" ADD CONSTRAINT "raw_material_purchases_supplier_id_fkey" FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_finished_product_id_fkey') THEN
    ALTER TABLE "sales" ADD CONSTRAINT "sales_finished_product_id_fkey" FOREIGN KEY (finished_product_id) REFERENCES finished_products(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_customer_id_fkey') THEN
    ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_items_sale_id_fkey') THEN
    ALTER TABLE "sales_items" ADD CONSTRAINT "sales_items_sale_id_fkey" FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_items_finished_product_id_fkey') THEN
    ALTER TABLE "sales_items" ADD CONSTRAINT "sales_items_finished_product_id_fkey" FOREIGN KEY (finished_product_id) REFERENCES finished_products(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_attendance_staff_id_fkey') THEN
    ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
  END IF;
END $$;
