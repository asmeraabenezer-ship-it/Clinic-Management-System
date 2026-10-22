-- ============================================================
-- CLINIC MANAGEMENT SYSTEM - SUPABASE SQL SCHEMA
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- ============================================================
-- CLINIC MANAGEMENT SYSTEM - SUPABASE SQL SCHEMA
-- Corrected table creation order and repeatable triggers/policies
-- Run in Supabase SQL Editor.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','doctor','receptionist','nurse','pharmacist','laboratorist','cashier')),
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PATIENTS
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_number TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male','female','other')),
  blood_type TEXT CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  city TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relation TEXT,
  allergies TEXT,
  chronic_conditions TEXT,
  insurance_provider TEXT,
  insurance_number TEXT,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DOCTORS
CREATE TABLE IF NOT EXISTS doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_number TEXT UNIQUE NOT NULL,
  specialization TEXT NOT NULL,
  license_number TEXT UNIQUE NOT NULL,
  qualification TEXT,
  years_experience INTEGER DEFAULT 0,
  consultation_fee DECIMAL(10,2) DEFAULT 0,
  bio TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DOCTOR SCHEDULES
CREATE TABLE IF NOT EXISTS doctor_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration_minutes INTEGER DEFAULT 30,
  max_patients INTEGER DEFAULT 20,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (doctor_id, day_of_week)
);

-- APPOINTMENTS
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_number TEXT UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','in_progress','completed','cancelled','no_show')),
  type TEXT DEFAULT 'consultation' CHECK (type IN ('consultation','follow_up','emergency','procedure','checkup')),
  reason TEXT,
  notes TEXT,
  cancellation_reason TEXT,
  booked_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MEDICAL RECORDS (created before prescriptions, which reference this table)
CREATE TABLE IF NOT EXISTS medical_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_number TEXT UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id),
  appointment_id UUID REFERENCES appointments(id),
  chief_complaint TEXT,
  history_of_present_illness TEXT,
  past_medical_history TEXT,
  physical_examination TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  follow_up_date DATE,
  follow_up_notes TEXT,
  is_confidential BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VITAL SIGNS
CREATE TABLE IF NOT EXISTS vital_signs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  medical_record_id UUID REFERENCES medical_records(id),
  appointment_id UUID REFERENCES appointments(id),
  recorded_by UUID REFERENCES profiles(id),
  temperature DECIMAL(5,2),
  temperature_unit TEXT DEFAULT 'C' CHECK (temperature_unit IN ('C','F')),
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  heart_rate INTEGER,
  respiratory_rate INTEGER,
  oxygen_saturation DECIMAL(5,2),
  weight DECIMAL(8,2),
  weight_unit TEXT DEFAULT 'kg' CHECK (weight_unit IN ('kg','lbs')),
  height DECIMAL(8,2),
  height_unit TEXT DEFAULT 'cm' CHECK (height_unit IN ('cm','in')),
  bmi DECIMAL(5,2),
  pain_level INTEGER CHECK (pain_level BETWEEN 0 AND 10),
  notes TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MEDICINES
CREATE TABLE IF NOT EXISTS medicines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medicine_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  generic_name TEXT,
  category TEXT NOT NULL,
  dosage_form TEXT NOT NULL CHECK (dosage_form IN ('tablet','capsule','syrup','injection','cream','ointment','drops','inhaler','patch','suppository','other')),
  strength TEXT,
  manufacturer TEXT,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  minimum_stock_level INTEGER DEFAULT 10,
  maximum_stock_level INTEGER DEFAULT 1000,
  expiry_date DATE,
  batch_number TEXT,
  location TEXT,
  requires_prescription BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  side_effects TEXT,
  contraindications TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRESCRIPTIONS
CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_number TEXT UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id),
  medical_record_id UUID REFERENCES medical_records(id),
  appointment_id UUID REFERENCES appointments(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','dispensed','partially_dispensed','cancelled')),
  notes TEXT,
  dispensed_by UUID REFERENCES profiles(id),
  dispensed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRESCRIPTION ITEMS
CREATE TABLE IF NOT EXISTS prescription_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
  medicine_id UUID REFERENCES medicines(id),
  medicine_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  dispensed_quantity INTEGER DEFAULT 0,
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LAB TESTS
CREATE TABLE IF NOT EXISTS lab_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_number TEXT UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id),
  appointment_id UUID REFERENCES appointments(id),
  medical_record_id UUID REFERENCES medical_records(id),
  test_name TEXT NOT NULL,
  test_code TEXT,
  category TEXT NOT NULL,
  urgency TEXT DEFAULT 'routine' CHECK (urgency IN ('routine','urgent','stat')),
  status TEXT DEFAULT 'requested' CHECK (status IN ('requested','sample_collected','processing','completed','cancelled')),
  sample_type TEXT,
  sample_collected_at TIMESTAMPTZ,
  collected_by UUID REFERENCES profiles(id),
  results TEXT,
  result_file_url TEXT,
  normal_range TEXT,
  interpretation TEXT,
  processed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  price DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INVOICES (created before patient_visits, which references invoices)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id),
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  balance_amount DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid','cancelled','refunded')),
  due_date DATE,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PATIENT VISITS (now after prescriptions and invoices)
CREATE TABLE IF NOT EXISTS patient_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_number TEXT UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id),
  queue_number INTEGER DEFAULT 1,
  reason_for_visit TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting_doctor_initial' CHECK (status IN ('waiting_doctor_initial','in_consultation_initial','waiting_laboratory','waiting_doctor_final','in_consultation_final','waiting_pharmacy','waiting_payment','completed','cancelled')),
  symptoms TEXT,
  examination_findings TEXT,
  initial_assessment TEXT,
  requires_lab BOOLEAN DEFAULT FALSE,
  first_consultation_at TIMESTAMPTZ,
  lab_notes TEXT,
  lab_completed_at TIMESTAMPTZ,
  final_diagnosis TEXT,
  treatment_plan TEXT,
  requires_pharmacy BOOLEAN DEFAULT FALSE,
  final_consultation_at TIMESTAMPTZ,
  prescription_id UUID REFERENCES prescriptions(id),
  pharmacy_dispensed_at TIMESTAMPTZ,
  invoice_id UUID REFERENCES invoices(id),
  consultation_fee DECIMAL(10,2) DEFAULT 50.00,
  lab_fee DECIMAL(10,2) DEFAULT 0.00,
  pharmacy_fee DECIMAL(10,2) DEFAULT 0.00,
  total_fee DECIMAL(10,2) DEFAULT 50.00,
  payment_method TEXT,
  payment_reference TEXT,
  payment_received_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INVOICE ITEMS
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('consultation','medicine','lab_test','procedure','other')),
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_number TEXT UNIQUE NOT NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id),
  amount DECIMAL(12,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','card','insurance','bank_transfer','mobile_money','other')),
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  reference_number TEXT,
  notes TEXT,
  received_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info','success','warning','error','appointment','payment','lab','prescription','stock')),
  is_read BOOLEAN DEFAULT FALSE,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MEDICAL FILES
CREATE TABLE IF NOT EXISTS medical_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  medical_record_id UUID REFERENCES medical_records(id),
  uploaded_by UUID REFERENCES profiles(id),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  file_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_patients_number ON patients(patient_number);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(first_name,last_name);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_vital_signs_patient ON vital_signs(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_tests_patient ON lab_tests(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_medicines_stock ON medicines(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_medicines_expiry ON medicines(expiry_date);
CREATE INDEX IF NOT EXISTS idx_patient_visits_patient ON patient_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_status ON patient_visits(status);

-- UPDATED_AT FUNCTION AND REPEATABLE TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_patients_updated_at ON patients;
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_doctors_updated_at ON doctors;
CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON doctors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_medical_records_updated_at ON medical_records;
CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON medical_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_medicines_updated_at ON medicines;
CREATE TRIGGER update_medicines_updated_at BEFORE UPDATE ON medicines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_prescriptions_updated_at ON prescriptions;
CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_lab_tests_updated_at ON lab_tests;
CREATE TRIGGER update_lab_tests_updated_at BEFORE UPDATE ON lab_tests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_patient_visits_updated_at ON patient_visits;
CREATE TRIGGER update_patient_visits_updated_at BEFORE UPDATE ON patient_visits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ROW LEVEL SECURITY
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE vital_signs ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_files ENABLE ROW LEVEL SECURITY;

-- Policies for backend service role. The service_role key must remain server-side.
DROP POLICY IF EXISTS service_role_all_profiles ON profiles;
CREATE POLICY service_role_all_profiles ON profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_patients ON patients;
CREATE POLICY service_role_all_patients ON patients FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_doctors ON doctors;
CREATE POLICY service_role_all_doctors ON doctors FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_doctor_schedules ON doctor_schedules;
CREATE POLICY service_role_all_doctor_schedules ON doctor_schedules FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_appointments ON appointments;
CREATE POLICY service_role_all_appointments ON appointments FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_patient_visits ON patient_visits;
CREATE POLICY service_role_all_patient_visits ON patient_visits FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_medical_records ON medical_records;
CREATE POLICY service_role_all_medical_records ON medical_records FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_vital_signs ON vital_signs;
CREATE POLICY service_role_all_vital_signs ON vital_signs FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_medicines ON medicines;
CREATE POLICY service_role_all_medicines ON medicines FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_prescriptions ON prescriptions;
CREATE POLICY service_role_all_prescriptions ON prescriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_prescription_items ON prescription_items;
CREATE POLICY service_role_all_prescription_items ON prescription_items FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_lab_tests ON lab_tests;
CREATE POLICY service_role_all_lab_tests ON lab_tests FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_invoices ON invoices;
CREATE POLICY service_role_all_invoices ON invoices FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_invoice_items ON invoice_items;
CREATE POLICY service_role_all_invoice_items ON invoice_items FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_payments ON payments;
CREATE POLICY service_role_all_payments ON payments FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_notifications ON notifications;
CREATE POLICY service_role_all_notifications ON notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_medical_files ON medical_files;
CREATE POLICY service_role_all_medical_files ON medical_files FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Basic user self-service policies. Add role-specific staff policies before production use.
DROP POLICY IF EXISTS users_view_own_profile ON profiles;
CREATE POLICY users_view_own_profile ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS users_update_own_profile ON profiles;
CREATE POLICY users_update_own_profile ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS users_view_own_notifications ON notifications;
CREATE POLICY users_view_own_notifications ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS users_update_own_notifications ON notifications;
CREATE POLICY users_update_own_notifications ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- STORAGE BUCKET (optional; run if it does not already exist)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('clinic-files', 'clinic-files', false)
-- ON CONFLICT (id) DO NOTHING;

-- SAMPLE MEDICINE DATA (fictional demo inventory; not clinical advice)
INSERT INTO medicines (medicine_code,name,generic_name,category,dosage_form,strength,manufacturer,unit_price,stock_quantity,minimum_stock_level,expiry_date,batch_number,requires_prescription) VALUES
('MED001','Amoxicillin','Amoxicillin','Antibiotic','capsule','500mg','Generic Pharma',2.50,500,50,'2027-06-30','BATCH2024A',true),
('MED002','Paracetamol','Acetaminophen','Analgesic','tablet','500mg','Local Pharma',0.50,1000,100,'2027-12-31','BATCH2024B',false),
('MED003','Ibuprofen','Ibuprofen','NSAID','tablet','400mg','Generic Pharma',1.00,800,80,'2027-09-30','BATCH2024C',false),
('MED004','Metformin','Metformin HCl','Antidiabetic','tablet','500mg','Diabetes Care',3.00,300,30,'2026-12-31','BATCH2024D',true),
('MED005','Amlodipine','Amlodipine besylate','Antihypertensive','tablet','5mg','Cardio Pharma',4.50,400,40,'2027-03-31','BATCH2024E',true),
('MED006','Omeprazole','Omeprazole','Proton Pump Inhibitor','capsule','20mg','GI Pharma',2.00,600,60,'2027-06-30','BATCH2024F',true),
('MED007','Cetirizine','Cetirizine HCl','Antihistamine','tablet','10mg','Allergy Care',1.50,200,20,'2027-12-31','BATCH2024G',false),
('MED008','Atorvastatin','Atorvastatin calcium','Statin','tablet','20mg','Cardio Pharma',8.00,150,15,'2027-09-30','BATCH2024H',true),
('MED009','Vitamin C','Ascorbic Acid','Vitamin','tablet','500mg','Vitamin World',0.75,2000,200,'2028-12-31','BATCH2024I',false),
('MED010','Salbutamol','Albuterol','Bronchodilator','inhaler','100mcg/dose','Respiratory Care',15.00,8,10,'2026-08-31','BATCH2024J',true)
ON CONFLICT (medicine_code) DO NOTHING;

-- SECURITY REMINDER:
-- service_role bypasses RLS. Never put SUPABASE_SERVICE_ROLE_KEY in frontend code.
-- Before using real patient information, create and test role-based access policies
-- for every staff role and verify backend authorization.
