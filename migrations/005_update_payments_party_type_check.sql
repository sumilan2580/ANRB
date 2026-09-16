-- =============================================================================
-- TRIPAL ERP — Migration 005: Update payments party_type check constraint
-- =============================================================================
-- Allows recording EXPENSE and INCOME in payments table alongside CUSTOMER and SUPPLIER
-- =============================================================================

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_party_type_check;
ALTER TABLE payments ADD CONSTRAINT payments_party_type_check CHECK (party_type IN ('CUSTOMER', 'SUPPLIER', 'EXPENSE', 'INCOME'));
