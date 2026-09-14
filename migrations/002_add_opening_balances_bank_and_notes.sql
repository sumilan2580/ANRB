-- =============================================================================
-- TRIPAL ERP — Migration 002: Add Opening Balances, Bank Master & Debit/Credit Notes
-- =============================================================================
-- Safe, additive migration for:
-- 1. Financial Years system
-- 2. Bank Master (bank_accounts)
-- 3. Bank Transfers (bank_transfers)
-- 4. Opening Balances (opening_balances)
-- 5. Debit & Credit Notes (debit_credit_notes)
-- 6. Payment bank account reference
-- =============================================================================

-- 1. Financial Years
CREATE TABLE IF NOT EXISTS financial_years (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  start_date VARCHAR(20) NOT NULL,
  end_date VARCHAR(20) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO financial_years (name, start_date, end_date, is_active)
VALUES 
  ('FY 2025-26', '2025-04-01', '2026-03-31', false),
  ('FY 2026-27', '2026-04-01', '2027-03-31', true),
  ('FY 2027-28', '2027-04-01', '2028-03-31', false)
ON CONFLICT (name) DO NOTHING;

-- 2. Bank Master
CREATE TABLE IF NOT EXISTS bank_accounts (
  id SERIAL PRIMARY KEY,
  bank_name VARCHAR(150) NOT NULL,
  account_name VARCHAR(150) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  ifsc VARCHAR(50),
  branch VARCHAR(150),
  opening_balance NUMERIC(15,2) DEFAULT 0,
  opening_balance_type VARCHAR(10) DEFAULT 'Dr',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bank Transfers
CREATE TABLE IF NOT EXISTS bank_transfers (
  id SERIAL PRIMARY KEY,
  transfer_code VARCHAR(50) UNIQUE NOT NULL,
  date VARCHAR(20) NOT NULL,
  from_bank_id INTEGER REFERENCES bank_accounts(id),
  to_bank_id INTEGER REFERENCES bank_accounts(id),
  amount NUMERIC(15,2) NOT NULL,
  reference_no VARCHAR(100),
  remarks TEXT,
  created_by VARCHAR(100) DEFAULT 'Admin',
  is_voided INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Opening Balances
CREATE TABLE IF NOT EXISTS opening_balances (
  id SERIAL PRIMARY KEY,
  financial_year VARCHAR(50) NOT NULL,
  opening_date VARCHAR(20) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER DEFAULT 0,
  quantity NUMERIC(15,2) DEFAULT 0,
  unit VARCHAR(20),
  rate NUMERIC(15,2) DEFAULT 0,
  amount NUMERIC(15,2) DEFAULT 0,
  balance_type VARCHAR(10) DEFAULT 'Dr',
  gsm INTEGER,
  size VARCHAR(50),
  remarks TEXT,
  created_by VARCHAR(100) DEFAULT 'Admin',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_opening_entity UNIQUE (financial_year, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_opening_fy_type ON opening_balances (financial_year, entity_type);

-- 5. Debit & Credit Notes
CREATE TABLE IF NOT EXISTS debit_credit_notes (
  id SERIAL PRIMARY KEY,
  note_type VARCHAR(20) NOT NULL,
  note_code VARCHAR(50) UNIQUE NOT NULL,
  date VARCHAR(20) NOT NULL,
  party_type VARCHAR(20) NOT NULL,
  party_id INTEGER NOT NULL,
  reference_invoice VARCHAR(100),
  reason TEXT,
  taxable_amount NUMERIC(15,2) DEFAULT 0,
  gst_percent NUMERIC(5,2) DEFAULT 0,
  cgst_amount NUMERIC(15,2) DEFAULT 0,
  sgst_amount NUMERIC(15,2) DEFAULT 0,
  igst_amount NUMERIC(15,2) DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL,
  remarks TEXT,
  created_by VARCHAR(100) DEFAULT 'Admin',
  is_voided INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dcn_party ON debit_credit_notes (party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_dcn_type ON debit_credit_notes (note_type);

-- 6. Payment bank account reference
ALTER TABLE payments ADD COLUMN IF NOT EXISTS bank_account_id INTEGER REFERENCES bank_accounts(id);
