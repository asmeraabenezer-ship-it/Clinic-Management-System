-- ============================================================
-- CLINICCARE PRO - ADMIN FEATURES MIGRATION
-- Migration: 001_admin_features.sql
-- Safe, repeatable migration for Admin Dashboard, Audit Logs,
-- Clinic Settings, and Inventory Movements.
-- Run in Supabase SQL Editor.
-- ============================================================

-- 1. CLINIC SETTINGS TABLE
CREATE TABLE IF NOT EXISTS clinic_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_name TEXT NOT NULL DEFAULT 'ClinicCare Pro',
  clinic_address TEXT DEFAULT '100 Medical Center Blvd, Suite 400',
  clinic_phone TEXT DEFAULT '+1-555-0100',
  clinic_email TEXT DEFAULT 'contact@cliniccare.pro',
  clinic_logo TEXT DEFAULT '',
  default_consultation_fee DECIMAL(10,2) DEFAULT 75.00,
  appointment_slot_duration INTEGER DEFAULT 30,
  waiting_time_threshold_minutes INTEGER DEFAULT 30,
  notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "in_app": true, "low_stock_alerts": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial default clinic settings if empty
INSERT INTO clinic_settings (clinic_name, clinic_address, clinic_phone, clinic_email, default_consultation_fee, appointment_slot_duration, waiting_time_threshold_minutes)
SELECT 'ClinicCare Pro', '100 Medical Plaza, Suite 400', '+1-555-0100', 'admin@clinic.com', 75.00, 30, 30
WHERE NOT EXISTS (SELECT 1 FROM clinic_settings);

-- 2. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 3. INVENTORY MOVEMENTS TABLE
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medicine_id UUID REFERENCES medicines(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('addition', 'subtraction', 'adjustment', 'dispense', 'expired', 'return', 'initial')),
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_movements_medicine ON inventory_movements(medicine_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_created_at ON inventory_movements(created_at DESC);

-- 4. ENABLE ROW LEVEL SECURITY
ALTER TABLE clinic_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- 5. SERVICE ROLE POLICIES (Backend bypass)
DROP POLICY IF EXISTS service_role_all_clinic_settings ON clinic_settings;
CREATE POLICY service_role_all_clinic_settings ON clinic_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_audit_logs ON audit_logs;
CREATE POLICY service_role_all_audit_logs ON audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_inventory_movements ON inventory_movements;
CREATE POLICY service_role_all_inventory_movements ON inventory_movements FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. AUTHENTICATED USER POLICIES
-- Anyone authenticated can read clinic settings
DROP POLICY IF EXISTS auth_read_clinic_settings ON clinic_settings;
CREATE POLICY auth_read_clinic_settings ON clinic_settings FOR SELECT TO authenticated USING (true);

-- Only admins can directly read all audit logs via client if configured
DROP POLICY IF EXISTS auth_read_audit_logs ON audit_logs;
CREATE POLICY auth_read_audit_logs ON audit_logs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Staff can view inventory movements
DROP POLICY IF EXISTS auth_read_inventory_movements ON inventory_movements;
CREATE POLICY auth_read_inventory_movements ON inventory_movements FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'pharmacist'))
);
