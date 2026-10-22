-- ============================================================
-- CLINICCARE PRO - SCHEMA COMPATIBILITY & OPTIMIZATIONS
-- Migration: 002_schema_compatibility.sql
-- Safe, idempotent script to ensure column aliases, performance indexes,
-- and table existence for Admin Management features.
-- Run in Supabase SQL Editor if required.
-- ============================================================

-- 1. Ensure blood_type column exists and add alias view compatibility if needed
DO $$ 
BEGIN
  -- If a legacy column blood_group exists without blood_type, sync it:
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='blood_group') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='blood_type') THEN
    ALTER TABLE patients RENAME COLUMN blood_group TO blood_type;
  END IF;

  -- If neither exists, add blood_type:
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='blood_type') THEN
    ALTER TABLE patients ADD COLUMN blood_type TEXT CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-'));
  END IF;
END $$;

-- 2. Performance indexes for Admin Dashboard and Staff Management
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_medicines_stock ON medicines(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_medicines_active ON medicines(is_active);
CREATE INDEX IF NOT EXISTS idx_invoices_status_balance ON invoices(status, balance_amount);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- 3. Verify RLS policies on profiles so authenticated users can view staff
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'authenticated_read_profiles') THEN
    CREATE POLICY authenticated_read_profiles ON profiles FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
