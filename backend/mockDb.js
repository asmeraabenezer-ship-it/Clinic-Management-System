// ============================================================
// MOCKDB.JS - In-Memory Demo Database for All Clinic Modules
// ============================================================

const isDemoMode = () => {
  return !process.env.SUPABASE_URL ||
    process.env.SUPABASE_URL.includes('your-project-id') ||
    process.env.SUPABASE_URL.includes('placeholder');
};

let users = [
  { id: 'usr-admin', email: 'admin@clinic.com', password: 'Admin@123456', full_name: 'System Administrator', role: 'admin', phone: '+1-555-0100', is_active: true, created_at: '2024-01-01T00:00:00.000Z' },
  { id: 'usr-doctor-1', email: 'dr.smith@clinic.com', password: 'Doctor@123456', full_name: 'Dr. Sarah Smith', role: 'doctor', phone: '+1-555-0101', is_active: true, created_at: '2024-01-02T00:00:00.000Z' },
  { id: 'usr-doctor-2', email: 'dr.johnson@clinic.com', password: 'Doctor@123456', full_name: 'Dr. Michael Johnson', role: 'doctor', phone: '+1-555-0105', is_active: true, created_at: '2024-01-03T00:00:00.000Z' },
  { id: 'usr-reception', email: 'receptionist@clinic.com', password: 'Recept@123456', full_name: 'Emily Johnson', role: 'receptionist', phone: '+1-555-0102', is_active: true, created_at: '2024-01-04T00:00:00.000Z' },
  { id: 'usr-nurse', email: 'nurse@clinic.com', password: 'Nurse@123456', full_name: 'Maria Garcia (RN)', role: 'nurse', phone: '+1-555-0103', is_active: true, created_at: '2024-01-05T00:00:00.000Z' },
  { id: 'usr-pharma', email: 'pharmacist@clinic.com', password: 'Pharma@123456', full_name: 'James Wilson (PharmD)', role: 'pharmacist', phone: '+1-555-0104', is_active: true, created_at: '2024-01-06T00:00:00.000Z' },
  { id: 'usr-lab', email: 'laboratorist@clinic.com', password: 'Lab@123456', full_name: 'David Chen (MLS)', role: 'laboratorist', phone: '+1-555-0106', is_active: true, created_at: '2024-01-07T00:00:00.000Z' },
  { id: 'usr-cashier', email: 'cashier@clinic.com', password: 'Cashier@123456', full_name: 'Grace Hopper (Cashier)', role: 'cashier', phone: '+1-555-0107', is_active: true, created_at: '2024-01-08T00:00:00.000Z' }
];

let doctors = [
  {
    id: 'doc-1',
    user_id: 'usr-doctor-1',
    doctor_number: 'DOC-1001',
    specialization: 'General Medicine & Cardiology',
    consultation_fee: 75.00,
    room_number: 'Suite 204',
    license_number: 'MED-994821',
    bio: 'Board-certified internist and cardiologist with 14 years of clinical experience in preventive cardiovascular health.',
    is_available: true,
    full_name: 'Dr. Sarah Smith',
    email: 'dr.smith@clinic.com',
    phone: '+1-555-0101',
    profiles: { full_name: 'Dr. Sarah Smith', email: 'dr.smith@clinic.com', phone: '+1-555-0101' },
    schedules: [
      { day_of_week: 1, start_time: '09:00', end_time: '17:00', max_patients: 15, is_available: true },
      { day_of_week: 2, start_time: '09:00', end_time: '17:00', max_patients: 15, is_available: true },
      { day_of_week: 3, start_time: '09:00', end_time: '17:00', max_patients: 15, is_available: true },
      { day_of_week: 4, start_time: '09:00', end_time: '17:00', max_patients: 15, is_available: true },
      { day_of_week: 5, start_time: '09:00', end_time: '14:00', max_patients: 10, is_available: true }
    ]
  },
  {
    id: 'doc-2',
    user_id: 'usr-doctor-2',
    doctor_number: 'DOC-1002',
    specialization: 'Pediatrics & Family Medicine',
    consultation_fee: 65.00,
    room_number: 'Suite 108',
    license_number: 'MED-883912',
    bio: 'Specialist in pediatric wellness, immunizations, and adolescent preventive medicine.',
    is_available: true,
    full_name: 'Dr. Michael Johnson',
    email: 'dr.johnson@clinic.com',
    phone: '+1-555-0105',
    profiles: { full_name: 'Dr. Michael Johnson', email: 'dr.johnson@clinic.com', phone: '+1-555-0105' },
    schedules: [
      { day_of_week: 1, start_time: '08:30', end_time: '16:30', max_patients: 16, is_available: true },
      { day_of_week: 2, start_time: '08:30', end_time: '16:30', max_patients: 16, is_available: true },
      { day_of_week: 3, start_time: '08:30', end_time: '16:30', max_patients: 16, is_available: true },
      { day_of_week: 4, start_time: '08:30', end_time: '16:30', max_patients: 16, is_available: true }
    ]
  }
];

let patients = [
  {
    id: 'pat-1',
    patient_number: 'P-100234',
    first_name: 'Alexander',
    last_name: 'Reynolds',
    date_of_birth: '1984-06-14',
    gender: 'male',
    phone: '+1-555-8392',
    email: 'alex.reynolds@example.com',
    address: '742 Evergreen Terrace, Springfield',
    blood_group: 'O+',
    blood_type: 'O+',
    allergies: 'Penicillin, Shellfish',
    medical_history: 'Mild hypertension diagnosed 2021; seasonal allergic rhinitis.',
    emergency_contact_name: 'Laura Reynolds (Spouse)',
    emergency_contact_phone: '+1-555-8399',
    is_active: true,
    created_at: '2024-01-10T10:30:00.000Z'
  },
  {
    id: 'pat-2',
    patient_number: 'P-100235',
    first_name: 'Sophia',
    last_name: 'Chen',
    date_of_birth: '1992-11-23',
    gender: 'female',
    phone: '+1-555-4819',
    email: 'sophia.chen@example.com',
    address: '128 Willow Creek Way, Austin',
    blood_group: 'A+',
    blood_type: 'A+',
    allergies: 'Sulfa Drugs',
    medical_history: 'Asthma (exercise-induced), controlled with Albuterol inhaler.',
    emergency_contact_name: 'David Chen (Brother)',
    emergency_contact_phone: '+1-555-4810',
    is_active: true,
    created_at: '2024-01-12T14:15:00.000Z'
  },
  {
    id: 'pat-3',
    patient_number: 'P-100236',
    first_name: 'Marcus',
    last_name: 'O\'Connor',
    date_of_birth: '1968-03-08',
    gender: 'male',
    phone: '+1-555-2940',
    email: 'marcus.oc@example.com',
    address: '54 High Street, Apt 3B, Boston',
    blood_group: 'B-',
    blood_type: 'B-',
    allergies: 'None known',
    medical_history: 'Type 2 Diabetes Mellitus under Metformin management; Hyperlipidemia.',
    emergency_contact_name: 'Claire O\'Connor (Daughter)',
    emergency_contact_phone: '+1-555-2941',
    is_active: true,
    created_at: '2024-01-15T09:00:00.000Z'
  },
  {
    id: 'pat-4',
    patient_number: 'P-100237',
    first_name: 'Olivia',
    last_name: 'Taylor',
    date_of_birth: '2001-08-30',
    gender: 'female',
    phone: '+1-555-7721',
    email: 'olivia.taylor@example.com',
    address: '890 Sunset Blvd, Los Angeles',
    blood_group: 'AB+',
    blood_type: 'AB+',
    allergies: 'Latex',
    medical_history: 'No chronic conditions reported.',
    emergency_contact_name: 'Gregory Taylor (Father)',
    emergency_contact_phone: '+1-555-7722',
    is_active: true,
    created_at: '2024-01-18T16:20:00.000Z'
  }
];

let appointments = [
  {
    id: 'apt-1',
    appointment_number: 'APT-2024-001',
    patient_id: 'pat-1',
    doctor_id: 'doc-1',
    appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: '10:00',
    reason: 'Follow-up for Blood Pressure & Routine Checkup',
    status: 'scheduled',
    notes: 'Patient reports mild morning headaches.',
    created_at: new Date().toISOString(),
    patients: { first_name: 'Alexander', last_name: 'Reynolds', patient_number: 'P-100234', phone: '+1-555-8392' },
    doctors: { specialization: 'General Medicine & Cardiology', room_number: 'Suite 204', profiles: { full_name: 'Dr. Sarah Smith' } }
  },
  {
    id: 'apt-2',
    appointment_number: 'APT-2024-002',
    patient_id: 'pat-2',
    doctor_id: 'doc-2',
    appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: '11:30',
    reason: 'Annual Pediatric / General Wellness Evaluation',
    status: 'confirmed',
    notes: 'Prescription renewal requested.',
    created_at: new Date().toISOString(),
    patients: { first_name: 'Sophia', last_name: 'Chen', patient_number: 'P-100235', phone: '+1-555-4819' },
    doctors: { specialization: 'Pediatrics & Family Medicine', room_number: 'Suite 108', profiles: { full_name: 'Dr. Michael Johnson' } }
  },
  {
    id: 'apt-3',
    appointment_number: 'APT-2024-003',
    patient_id: 'pat-3',
    doctor_id: 'doc-1',
    appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: '14:00',
    reason: 'HbA1c & Fasting Glucose Review',
    status: 'completed',
    notes: 'Lab values stable. Continues Metformin 500mg BID.',
    created_at: new Date().toISOString(),
    patients: { first_name: 'Marcus', last_name: 'O\'Connor', patient_number: 'P-100236', phone: '+1-555-2940' },
    doctors: { specialization: 'General Medicine & Cardiology', room_number: 'Suite 204', profiles: { full_name: 'Dr. Sarah Smith' } }
  }
];

let medicalRecords = [
  {
    id: 'mr-1',
    patient_id: 'pat-1',
    doctor_id: 'doc-1',
    appointment_id: 'apt-1',
    visit_date: new Date().toISOString().split('T')[0],
    symptoms: 'Occasional occipital headaches upon waking, slight palpitations after exercise.',
    diagnosis: 'Essential Hypertension (Stage 1), well-compensated.',
    treatment_plan: 'Continue Lisinopril 10mg PO QD. Sodium restriction (<2g/day). Follow up in 30 days.',
    notes: 'Advised patient to maintain daily home BP monitoring log.',
    created_at: new Date().toISOString(),
    patients: { first_name: 'Alexander', last_name: 'Reynolds', patient_number: 'P-100234' },
    doctors: { specialization: 'General Medicine & Cardiology', profiles: { full_name: 'Dr. Sarah Smith' } }
  },
  {
    id: 'mr-2',
    patient_id: 'pat-3',
    doctor_id: 'doc-1',
    appointment_id: 'apt-3',
    visit_date: new Date().toISOString().split('T')[0],
    symptoms: 'Mild postprandial fatigue. No polyuria or polydipsia.',
    diagnosis: 'Type 2 Diabetes Mellitus with adequate glycemic control.',
    treatment_plan: 'Continue Metformin 500mg BID with meals. Re-check lipid panel in 3 months.',
    notes: 'Discussed carbohydrate intake and 30-minute daily walking regimen.',
    created_at: new Date().toISOString(),
    patients: { first_name: 'Marcus', last_name: 'O\'Connor', patient_number: 'P-100236' },
    doctors: { specialization: 'General Medicine & Cardiology', profiles: { full_name: 'Dr. Sarah Smith' } }
  }
];

let vitalSigns = [
  {
    id: 'vs-1',
    patient_id: 'pat-1',
    recorded_by: 'usr-nurse',
    blood_pressure_systolic: 128,
    blood_pressure_diastolic: 82,
    heart_rate: 74,
    temperature: 36.8,
    respiratory_rate: 16,
    oxygen_saturation: 99,
    height_cm: 180,
    weight_kg: 82,
    bmi: 25.3,
    notes: 'Normal sinus rhythm, patient rested 5 mins prior to reading.',
    recorded_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    patients: { first_name: 'Alexander', last_name: 'Reynolds', patient_number: 'P-100234' }
  },
  {
    id: 'vs-2',
    patient_id: 'pat-2',
    recorded_by: 'usr-nurse',
    blood_pressure_systolic: 112,
    blood_pressure_diastolic: 70,
    heart_rate: 68,
    temperature: 36.6,
    respiratory_rate: 15,
    oxygen_saturation: 100,
    height_cm: 165,
    weight_kg: 58,
    bmi: 21.3,
    notes: 'Healthy baseline vitals.',
    recorded_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    patients: { first_name: 'Sophia', last_name: 'Chen', patient_number: 'P-100235' }
  }
];

let medicines = [
  {
    id: 'med-1',
    name: 'Amoxicillin Trihydrate',
    generic_name: 'Amoxicillin',
    category: 'Antibiotic',
    dosage_form: 'Capsule',
    strength: '500mg',
    stock_quantity: 240,
    minimum_stock_level: 50,
    unit_price: 14.50,
    expiry_date: '2027-05-15',
    batch_number: 'AMX-2024-81',
    manufacturer: 'Pfizer Inc.',
    is_active: true
  },
  {
    id: 'med-2',
    name: 'Lisinopril Tablets',
    generic_name: 'Lisinopril',
    category: 'Antihypertensive',
    dosage_form: 'Tablet',
    strength: '10mg',
    stock_quantity: 18,
    minimum_stock_level: 30,
    unit_price: 9.75,
    expiry_date: '2026-11-20',
    batch_number: 'LIS-2023-49',
    manufacturer: 'Novartis',
    is_active: true
  },
  {
    id: 'med-3',
    name: 'Metformin Hydrochloride',
    generic_name: 'Metformin',
    category: 'Antidiabetic',
    dosage_form: 'Tablet',
    strength: '500mg',
    stock_quantity: 320,
    minimum_stock_level: 60,
    unit_price: 8.20,
    expiry_date: '2027-09-30',
    batch_number: 'MET-2024-11',
    manufacturer: 'Merck & Co.',
    is_active: true
  },
  {
    id: 'med-4',
    name: 'Paracetamol Extra',
    generic_name: 'Acetaminophen',
    category: 'Analgesic',
    dosage_form: 'Tablet',
    strength: '500mg',
    stock_quantity: 500,
    minimum_stock_level: 100,
    unit_price: 4.50,
    expiry_date: '2028-01-10',
    batch_number: 'PAR-2025-02',
    manufacturer: 'GSK Consumer Health',
    is_active: true
  }
];

let prescriptions = [
  {
    id: 'rx-1',
    prescription_number: 'RX-2024-00108',
    patient_id: 'pat-1',
    doctor_id: 'doc-1',
    status: 'pending',
    instructions: 'Take 1 tablet daily with a large glass of water in the morning.',
    created_at: new Date().toISOString(),
    patients: { first_name: 'Alexander', last_name: 'Reynolds', patient_number: 'P-100234' },
    doctors: { profiles: { full_name: 'Dr. Sarah Smith' } },
    prescription_items: [
      { id: 'rxi-1', medicine_id: 'med-2', medicine_name: 'Lisinopril Tablets 10mg', dosage: '10mg', frequency: 'Once daily (AM)', duration: '30 days', quantity: 30, instructions: 'Morning dose' }
    ]
  },
  {
    id: 'rx-2',
    prescription_number: 'RX-2024-00109',
    patient_id: 'pat-3',
    doctor_id: 'doc-1',
    status: 'dispensed',
    instructions: 'Take 1 tablet twice daily with meals.',
    created_at: new Date().toISOString(),
    patients: { first_name: 'Marcus', last_name: 'O\'Connor', patient_number: 'P-100236' },
    doctors: { profiles: { full_name: 'Dr. Sarah Smith' } },
    prescription_items: [
      { id: 'rxi-2', medicine_id: 'med-3', medicine_name: 'Metformin Hydrochloride 500mg', dosage: '500mg', frequency: 'Twice daily', duration: '60 days', quantity: 120, instructions: 'With breakfast and dinner' }
    ]
  }
];

let labTests = [
  {
    id: 'lab-1',
    test_number: 'LAB-2024-0045',
    patient_id: 'pat-3',
    doctor_id: 'doc-1',
    test_name: 'Comprehensive Metabolic Panel & HbA1c',
    category: 'Biochemistry',
    status: 'completed',
    priority: 'normal',
    sample_type: 'Venous Blood',
    results: 'HbA1c: 6.4% (Good control). Fasting Glucose: 114 mg/dL. Creatinine: 0.9 mg/dL. eGFR: >90.',
    notes: 'Routine 6-month diabetic monitoring.',
    created_at: new Date().toISOString(),
    patients: { first_name: 'Marcus', last_name: 'O\'Connor', patient_number: 'P-100236' },
    doctors: { profiles: { full_name: 'Dr. Sarah Smith' } }
  },
  {
    id: 'lab-2',
    test_number: 'LAB-2024-0046',
    patient_id: 'pat-1',
    doctor_id: 'doc-1',
    test_name: 'Lipid Profile & Serum Electrolytes',
    category: 'Hematology',
    status: 'sample_collected',
    priority: 'urgent',
    sample_type: 'Venous Blood',
    results: '',
    notes: 'Stat lab requested prior to medication adjustment.',
    created_at: new Date().toISOString(),
    patients: { first_name: 'Alexander', last_name: 'Reynolds', patient_number: 'P-100234' },
    doctors: { profiles: { full_name: 'Dr. Sarah Smith' } }
  }
];

let invoices = [
  {
    id: 'inv-1',
    invoice_number: 'INV-2024-0089',
    patient_id: 'pat-1',
    appointment_id: 'apt-1',
    total_amount: 125.00,
    paid_amount: 125.00,
    balance_amount: 0.00,
    status: 'paid',
    due_date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    patients: { first_name: 'Alexander', last_name: 'Reynolds', patient_number: 'P-100234', phone: '+1-555-8392' },
    invoice_items: [
      { id: 'ii-1', description: 'Specialist Consultation (Cardiology)', unit_price: 75.00, quantity: 1, total_price: 75.00 },
      { id: 'ii-2', description: 'Resting Electrocardiogram (ECG)', unit_price: 50.00, quantity: 1, total_price: 50.00 }
    ]
  },
  {
    id: 'inv-2',
    invoice_number: 'INV-2024-0090',
    patient_id: 'pat-2',
    appointment_id: 'apt-2',
    total_amount: 65.00,
    paid_amount: 0.00,
    balance_amount: 65.00,
    status: 'unpaid',
    due_date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    patients: { first_name: 'Sophia', last_name: 'Chen', patient_number: 'P-100235', phone: '+1-555-4819' },
    invoice_items: [
      { id: 'ii-3', description: 'General Pediatric Consultation', unit_price: 65.00, quantity: 1, total_price: 65.00 }
    ]
  }
];

let payments = [
  {
    id: 'pay-1',
    payment_number: 'REC-2024-0104',
    invoice_id: 'inv-1',
    amount: 125.00,
    payment_method: 'credit_card',
    payment_date: new Date().toISOString().split('T')[0],
    notes: 'Visa ending in 4242. Authorization code: #892110',
    created_at: new Date().toISOString(),
    invoices: {
      invoice_number: 'INV-2024-0089',
      patients: { first_name: 'Alexander', last_name: 'Reynolds', patient_number: 'P-100234' }
    }
  }
];

let notifications = [
  {
    id: 'notif-1',
    user_id: 'usr-admin',
    type: 'stock',
    title: 'Low Stock Alert',
    message: 'Lisinopril Tablets 10mg is below threshold (18 remaining). Restock needed.',
    link: 'medicines',
    is_read: false,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString()
  },
  {
    id: 'notif-2',
    user_id: 'usr-admin',
    type: 'appointment',
    title: 'New Appointment Booked',
    message: 'Sophia Chen scheduled with Dr. Michael Johnson for 11:30 AM today.',
    link: 'appointments',
    is_read: false,
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString()
  },
  {
    id: 'notif-3',
    user_id: 'usr-admin',
    type: 'lab',
    title: 'Lab Sample Ready',
    message: 'Sample collected for Alexander Reynolds (Lipid Profile & Serum Electrolytes).',
    link: 'lab-tests',
    is_read: true,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  }
];

let patientVisits = [
  {
    id: 'vis-1',
    visit_number: 'VIS-2026-0001',
    patient_id: 'pat-1',
    doctor_id: 'doc-1',
    queue_number: 1,
    reason_for_visit: 'Persistent morning headaches and elevated blood pressure readings at home.',
    status: 'waiting_doctor_initial',
    symptoms: '',
    examination_findings: '',
    initial_assessment: '',
    requires_lab: false,
    lab_notes: '',
    final_diagnosis: '',
    treatment_plan: '',
    requires_pharmacy: false,
    consultation_fee: 75.00,
    lab_fee: 0.00,
    pharmacy_fee: 0.00,
    total_fee: 75.00,
    payment_status: 'unpaid',
    created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    patients: {
      id: 'pat-1',
      patient_number: 'P-100234',
      first_name: 'Alexander',
      last_name: 'Reynolds',
      phone: '+1-555-8392',
      gender: 'male',
      date_of_birth: '1984-06-14',
      blood_group: 'O+'
    },
    doctors: {
      id: 'doc-1',
      specialization: 'General Medicine & Cardiology',
      consultation_fee: 75.00,
      profiles: { full_name: 'Dr. Sarah Smith' }
    }
  },
  {
    id: 'vis-2',
    visit_number: 'VIS-2026-0002',
    patient_id: 'pat-2',
    doctor_id: 'doc-1',
    queue_number: 2,
    reason_for_visit: 'Fatigue, recurrent chest tightness during routine stair climb.',
    status: 'waiting_laboratory',
    symptoms: 'Mild shortness of breath on exertion, lightheadedness.',
    examination_findings: 'BP 138/88 mmHg, HR 82 bpm, S1/S2 distinct, clear breath sounds bilaterally.',
    initial_assessment: 'Possible exertion-related angina / hyperlipidemia screening required.',
    requires_lab: true,
    lab_test_ids: ['lab-2'],
    lab_notes: 'Urgent Lipid Profile & Serum Electrolytes',
    final_diagnosis: '',
    treatment_plan: '',
    requires_pharmacy: false,
    consultation_fee: 75.00,
    lab_fee: 45.00,
    pharmacy_fee: 0.00,
    total_fee: 120.00,
    payment_status: 'unpaid',
    first_consultation_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    patients: {
      id: 'pat-2',
      patient_number: 'P-100235',
      first_name: 'Sophia',
      last_name: 'Chen',
      phone: '+1-555-4819',
      gender: 'female',
      date_of_birth: '1992-11-23',
      blood_group: 'A+'
    },
    doctors: {
      id: 'doc-1',
      specialization: 'General Medicine & Cardiology',
      consultation_fee: 75.00,
      profiles: { full_name: 'Dr. Sarah Smith' }
    }
  },
  {
    id: 'vis-3',
    visit_number: 'VIS-2026-0003',
    patient_id: 'pat-3',
    doctor_id: 'doc-1',
    queue_number: 3,
    reason_for_visit: 'Routine 6-month diabetic follow-up and metabolic review.',
    status: 'waiting_doctor_final',
    symptoms: 'Reports slight dietary indiscretions over holidays. No acute complaints.',
    examination_findings: 'BP 124/78, HR 72, BMI 27.1. Peripheral pulses intact, sensation intact.',
    initial_assessment: 'Type 2 Diabetes Mellitus under maintenance.',
    requires_lab: true,
    lab_test_ids: ['lab-1'],
    lab_results: 'HbA1c: 6.4% (Good control). Fasting Glucose: 114 mg/dL. Creatinine: 0.9 mg/dL. eGFR: >90.',
    lab_completed_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    final_diagnosis: '',
    treatment_plan: '',
    requires_pharmacy: false,
    consultation_fee: 75.00,
    lab_fee: 55.00,
    pharmacy_fee: 0.00,
    total_fee: 130.00,
    payment_status: 'unpaid',
    created_at: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    patients: {
      id: 'pat-3',
      patient_number: 'P-100236',
      first_name: 'Marcus',
      last_name: 'O\'Connor',
      phone: '+1-555-2940',
      gender: 'male',
      date_of_birth: '1976-03-29',
      blood_group: 'B+'
    },
    doctors: {
      id: 'doc-1',
      specialization: 'General Medicine & Cardiology',
      consultation_fee: 75.00,
      profiles: { full_name: 'Dr. Sarah Smith' }
    }
  },
  {
    id: 'vis-4',
    visit_number: 'VIS-2026-0004',
    patient_id: 'pat-4',
    doctor_id: 'doc-1',
    queue_number: 4,
    reason_for_visit: 'Moderate fever, sore throat, and productive cough for 3 days.',
    status: 'waiting_pharmacy',
    symptoms: 'Temperature 38.2°C, pharyngeal erythema, dry cough.',
    examination_findings: 'Erythematous posterior pharynx without tonsillar exudate. Lungs clear to auscultation.',
    initial_assessment: 'Acute upper respiratory tract infection (viral vs mild bacterial).',
    requires_lab: false,
    final_diagnosis: 'Acute Pharyngitis & Upper Respiratory Infection',
    treatment_plan: 'Amoxicillin 500mg PO TID for 7 days + Paracetamol Extra for fever. Rest and hydration.',
    requires_pharmacy: true,
    prescription_id: 'rx-3',
    prescription_data: {
      prescription_number: 'RX-2026-00120',
      items: [
        { medicine_id: 'med-1', medicine_name: 'Amoxicillin Trihydrate 500mg', dosage: '500mg', frequency: 'Three times daily', duration: '7 days', quantity: 21, unit_price: 12.50 },
        { medicine_id: 'med-4', medicine_name: 'Paracetamol Extra', dosage: '500mg', frequency: 'Every 6 hours as needed', duration: '5 days', quantity: 20, unit_price: 4.50 }
      ]
    },
    consultation_fee: 75.00,
    lab_fee: 0.00,
    pharmacy_fee: 17.00,
    total_fee: 92.00,
    payment_status: 'unpaid',
    final_consultation_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    patients: {
      id: 'pat-4',
      patient_number: 'P-100237',
      first_name: 'Elena',
      last_name: 'Rostova',
      phone: '+1-555-9182',
      gender: 'female',
      date_of_birth: '1995-08-04',
      blood_group: 'AB+'
    },
    doctors: {
      id: 'doc-1',
      specialization: 'General Medicine & Cardiology',
      consultation_fee: 75.00,
      profiles: { full_name: 'Dr. Sarah Smith' }
    }
  },
  {
    id: 'vis-5',
    visit_number: 'VIS-2026-0005',
    patient_id: 'pat-5',
    doctor_id: 'doc-2',
    queue_number: 5,
    reason_for_visit: 'Seasonal allergy flare-up and skin rash on both forearms.',
    status: 'waiting_payment',
    symptoms: 'Pruritic erythematous rash, sneezing, watery eyes.',
    examination_findings: 'Maculopapular rash localized to bilateral forearms. Nasal mucosa mildly edematous.',
    initial_assessment: 'Allergic Contact Dermatitis & Allergic Rhinitis.',
    requires_lab: false,
    final_diagnosis: 'Contact Dermatitis with Allergic Rhinitis',
    treatment_plan: 'Antihistamines dispensed, topical emollient, avoid scented soaps.',
    requires_pharmacy: true,
    pharmacy_dispensed_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    invoice_number: 'INV-2026-00105',
    consultation_fee: 65.00,
    lab_fee: 0.00,
    pharmacy_fee: 24.50,
    total_fee: 89.50,
    payment_status: 'unpaid',
    created_at: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
    patients: {
      id: 'pat-5',
      patient_number: 'P-100238',
      first_name: 'David',
      last_name: 'Kim',
      phone: '+1-555-3829',
      gender: 'male',
      date_of_birth: '1988-12-17',
      blood_group: 'O-'
    },
    doctors: {
      id: 'doc-2',
      specialization: 'Pediatrics & Family Medicine',
      consultation_fee: 65.00,
      profiles: { full_name: 'Dr. Michael Johnson' }
    }
  }
];

module.exports = {
  isDemoMode,
  users,
  doctors,
  patients,
  appointments,
  medicalRecords,
  vitalSigns,
  medicines,
  prescriptions,
  labTests,
  invoices,
  payments,
  notifications,
  patientVisits
};
