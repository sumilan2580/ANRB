-- =============================================================================
-- TRIPAL ERP — Migration 004: Add EL Charges to Raw Material Purchases
-- =============================================================================
-- Safe, additive migration for:
-- 1. Adding el_charges column to raw_material_purchases table for multi-charge tracking
-- =============================================================================

ALTER TABLE raw_material_purchases ADD COLUMN IF NOT EXISTS el_charges TEXT DEFAULT '[]';
