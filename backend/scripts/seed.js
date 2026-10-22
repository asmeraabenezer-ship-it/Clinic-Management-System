require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function seed() {
  console.log('🌱 Seeding database...\n');

  // Create admin user
  console.log('Creating admin user...');
  const { data: adminAuth, error: adminAuthError } = await supabaseAdmin.auth.admin.createUser({
    email: 'admin@clinic.com',
    password: 'Admin@123456',
    email_confirm: true
  });

  if (adminAuthError && !adminAuthError.message.includes('already registered')) {
    console.error('Admin creation error:', adminAuthError.message);
  } else if (adminAuth?.user) {
    await supabaseAdmin.from('profiles').upsert({
      id: adminAuth.user.id,
      email: 'admin@clinic.com',
      full_name: 'System Administrator',
      role: 'admin',
      phone: '+1-555-0100'
    });
    console.log('✅ Admin user created: admin@clinic.com / Admin@123456');
  }

  // Create doctor user
  console.log('Creating doctor user...');
  const { data: drAuth } = await supabaseAdmin.auth.admin.createUser({
    email: 'dr.smith@clinic.com',
    password: 'Doctor@123456',
    email_confirm: true
  });

  let doctorProfileId = null;
  if (drAuth?.user) {
    const { data: drProfile } = await supabaseAdmin.from('profiles').upsert({
      id: drAuth.user.id,
      email: 'dr.smith@clinic.com',
      full_name: 'Dr. Sarah Smith',
      role: 'doctor',
      phone: '+1-555-0101'
    }).select().single();
    doctorProfileId = drProfile?.id;

    // Create doctor record
    const { data: doctor } = await supabaseAdmin.from('doctors').upsert({
      profile_id: drAuth.user.id,
      doctor_number: 'DR-2024-0001',
      specialization: 'General Medicine',
      license_number: 'LIC-2024-001',
      qualification: 'MD, MBBS',
      years_experience: 10,
      consultation_fee: 150.00,
      bio: 'Experienced general practitioner with 10 years of practice.'
    }, { onConflict: 'doctor_number' }).select().single();

    if (doctor) {
      // Add schedule
      const days = [1, 2, 3, 4, 5]; // Mon-Fri
      for (const day of days) {
        await supabaseAdmin.from('doctor_schedules').upsert({
          doctor_id: doctor.id,
          day_of_week: day,
          start_time: '09:00',
          end_time: '17:00',
          slot_duration_minutes: 30,
          max_patients: 16
        }, { onConflict: 'doctor_id,day_of_week' });
      }
    }
    console.log('✅ Doctor user created: dr.smith@clinic.com / Doctor@123456');
  }

  // Create receptionist
  const { data: recAuth } = await supabaseAdmin.auth.admin.createUser({
    email: 'receptionist@clinic.com',
    password: 'Recept@123456',
    email_confirm: true
  });

  if (recAuth?.user) {
    await supabaseAdmin.from('profiles').upsert({
      id: recAuth.user.id,
      email: 'receptionist@clinic.com',
      full_name: 'Jane Receptionist',
      role: 'receptionist',
      phone: '+1-555-0102'
    });
    console.log('✅ Receptionist user created: receptionist@clinic.com / Recept@123456');
  }

  // Create nurse
  const { data: nurseAuth } = await supabaseAdmin.auth.admin.createUser({
    email: 'nurse@clinic.com',
    password: 'Nurse@123456',
    email_confirm: true
  });

  if (nurseAuth?.user) {
    await supabaseAdmin.from('profiles').upsert({
      id: nurseAuth.user.id,
      email: 'nurse@clinic.com',
      full_name: 'Mary Nurse',
      role: 'nurse',
      phone: '+1-555-0103'
    });
    console.log('✅ Nurse user created: nurse@clinic.com / Nurse@123456');
  }

  // Create pharmacist
  const { data: pharmaAuth } = await supabaseAdmin.auth.admin.createUser({
    email: 'pharmacist@clinic.com',
    password: 'Pharma@123456',
    email_confirm: true
  });

  if (pharmaAuth?.user) {
    await supabaseAdmin.from('profiles').upsert({
      id: pharmaAuth.user.id,
      email: 'pharmacist@clinic.com',
      full_name: 'Bob Pharmacist',
      role: 'pharmacist',
      phone: '+1-555-0104'
    });
    console.log('✅ Pharmacist user created: pharmacist@clinic.com / Pharma@123456');
  }

  // Create sample laboratorist
  const { data: labAuth, error: labAuthError } = await supabaseAdmin.auth.admin.createUser({
    email: 'laboratorist@clinic.com',
    password: 'Lab@123456',
    email_confirm: true
  });

  let labUserId = labAuth?.user?.id;
  if (!labUserId && labAuthError?.message?.includes('already registered')) {
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
    labUserId = listData?.users?.find(u => u.email.toLowerCase() === 'laboratorist@clinic.com')?.id;
  }

  if (labUserId) {
    await supabaseAdmin.from('profiles').upsert({
      id: labUserId,
      email: 'laboratorist@clinic.com',
      full_name: 'David Chen (MLS)',
      role: 'laboratorist',
      phone: '+1-555-0106',
      is_active: true
    });
    console.log('✅ Laboratorist user created: laboratorist@clinic.com / Lab@123456');
  }

  // Create sample cashier
  const { data: cashierAuth, error: cashierAuthError } = await supabaseAdmin.auth.admin.createUser({
    email: 'cashier@clinic.com',
    password: 'Cashier@123456',
    email_confirm: true
  });

  let cashierUserId = cashierAuth?.user?.id;
  if (!cashierUserId && cashierAuthError?.message?.includes('already registered')) {
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
    cashierUserId = listData?.users?.find(u => u.email.toLowerCase() === 'cashier@clinic.com')?.id;
  }

  if (cashierUserId) {
    await supabaseAdmin.from('profiles').upsert({
      id: cashierUserId,
      email: 'cashier@clinic.com',
      full_name: 'Grace Hopper (Cashier)',
      role: 'cashier',
      phone: '+1-555-0107',
      is_active: true
    });
    console.log('✅ Cashier user created: cashier@clinic.com / Cashier@123456');
  }

  // Create sample patients
  console.log('\nCreating sample patients...');
  const patients = [
    { patient_number: 'PAT-2024-10001', first_name: 'John', last_name: 'Doe', date_of_birth: '1985-03-15', gender: 'male', phone: '+1-555-1001', email: 'john.doe@email.com', blood_type: 'O+', address: '123 Main St', city: 'New York', emergency_contact_name: 'Jane Doe', emergency_contact_phone: '+1-555-1002', emergency_contact_relation: 'Spouse' },
    { patient_number: 'PAT-2024-10002', first_name: 'Mary', last_name: 'Johnson', date_of_birth: '1990-07-22', gender: 'female', phone: '+1-555-1003', email: 'mary.j@email.com', blood_type: 'A+', address: '456 Oak Ave', city: 'Los Angeles', allergies: 'Penicillin', chronic_conditions: 'Hypertension' },
    { patient_number: 'PAT-2024-10003', first_name: 'Robert', last_name: 'Wilson', date_of_birth: '1978-11-30', gender: 'male', phone: '+1-555-1004', blood_type: 'B-', address: '789 Pine Rd', city: 'Chicago', chronic_conditions: 'Diabetes Type 2, Hypertension' },
    { patient_number: 'PAT-2024-10004', first_name: 'Emily', last_name: 'Davis', date_of_birth: '2001-04-18', gender: 'female', phone: '+1-555-1005', email: 'emily.d@email.com', blood_type: 'AB+', address: '321 Elm St', city: 'Houston' },
    { patient_number: 'PAT-2024-10005', first_name: 'Michael', last_name: 'Brown', date_of_birth: '1965-09-05', gender: 'male', phone: '+1-555-1006', blood_type: 'O-', address: '654 Maple Dr', city: 'Phoenix', allergies: 'Sulfa drugs', chronic_conditions: 'Asthma' }
  ];

  for (const p of patients) {
    await supabaseAdmin.from('patients').upsert(p, { onConflict: 'patient_number' });
  }
  console.log(`✅ Created ${patients.length} sample patients`);

  console.log('\n🎉 Database seeding completed!\n');
  console.log('Test Accounts:');
  console.log('  Admin:        admin@clinic.com / Admin@123456');
  console.log('  Doctor:       dr.smith@clinic.com / Doctor@123456');
  console.log('  Receptionist: receptionist@clinic.com / Recept@123456');
  console.log('  Nurse:        nurse@clinic.com / Nurse@123456');
  console.log('  Pharmacist:   pharmacist@clinic.com / Pharma@123456');
  console.log('  Laboratorist: laboratorist@clinic.com / Lab@123456');
  console.log('  Cashier:      cashier@clinic.com / Cashier@123456');
}

seed().catch(console.error).finally(() => process.exit());
