const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const { filterVisit } = require('../middleware/rbac');
const mockDb = require('../mockDb');

const generateVisitNumber = () => `VIS-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;
const generateInvoiceNumber = () => `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;
const generatePaymentNumber = () => `REC-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;
const generatePrescriptionNumber = () => `RX-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;
const generateLabNumber = () => `LAB-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;

// ============================================================
// 1. GET /api/visits - List Visits & Waiting Queues
// ============================================================
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, doctor_id, patient_id, active_only, search } = req.query;

    if (mockDb.isDemoMode()) {
      let list = [...mockDb.patientVisits];

      if (status) {
        list = list.filter(v => v.status === status);
      }
      if (active_only === 'true') {
        list = list.filter(v => v.status !== 'completed' && v.status !== 'cancelled');
      }
      if (doctor_id) {
        list = list.filter(v => v.doctor_id === doctor_id);
      }
      if (patient_id) {
        list = list.filter(v => v.patient_id === patient_id);
      }
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(v =>
          v.visit_number?.toLowerCase().includes(q) ||
          v.patients?.patient_number?.toLowerCase().includes(q) ||
          v.patients?.first_name?.toLowerCase().includes(q) ||
          v.patients?.last_name?.toLowerCase().includes(q) ||
          v.reason_for_visit?.toLowerCase().includes(q)
        );
      }

      // Sort by newest first
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const filtered = list.map(v => filterVisit(v, req.user.role));
      return res.json({ data: filtered, count: filtered.length });
    }

    // Supabase DB mode
    let query = supabaseAdmin
      .from('patient_visits')
      .select(`
        *,
        patients (id, patient_number, first_name, last_name, phone, gender, date_of_birth, blood_type),
        doctors (id, specialization, consultation_fee, profiles (full_name))
      `);

    if (status) query = query.eq('status', status);
    if (active_only === 'true') query = query.not('status', 'in', '("completed","cancelled")');
    if (doctor_id) query = query.eq('doctor_id', doctor_id);
    if (patient_id) query = query.eq('patient_id', patient_id);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });

    const filteredData = (data || []).map(v => {
      if (v.patients) {
        v.patients.blood_group = v.patients.blood_group || v.patients.blood_type;
        v.patients.blood_type = v.patients.blood_type || v.patients.blood_group;
      }
      return filterVisit(v, req.user.role);
    });
    res.json({ data: filteredData, count: filteredData.length });
  } catch (err) {
    console.error('Fetch visits error:', err);
    res.status(500).json({ error: 'Failed to fetch visits' });
  }
});

// ============================================================
// 2. GET /api/visits/:id - Single Visit Details
// ============================================================
router.get('/:id', authenticate, async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const visit = mockDb.patientVisits.find(v => v.id === req.params.id);
      if (!visit) return res.status(404).json({ error: 'Visit not found' });
      return res.json(filterVisit(visit, req.user.role));
    }

    const { data, error } = await supabaseAdmin
      .from('patient_visits')
      .select(`
        *,
        patients (*),
        doctors (*, profiles (full_name))
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Visit not found' });
    if (data.patients) {
      data.patients.blood_group = data.patients.blood_group || data.patients.blood_type;
      data.patients.blood_type = data.patients.blood_type || data.patients.blood_group;
    }
    res.json(filterVisit(data, req.user.role));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch visit detail' });
  }
});

// ============================================================
// 3. STAGE 1: RECEPTION CHECK-IN
// ============================================================
router.post('/check-in', authenticate, authorize('receptionist', 'admin'), async (req, res) => {
  try {
    const { patient_id, doctor_id, reason_for_visit, new_patient } = req.body;

    if (!reason_for_visit) {
      return res.status(400).json({ error: 'Reason for visit is required' });
    }

    let targetPatientId = patient_id;

    if (mockDb.isDemoMode()) {
      // If new patient registered at reception
      if (new_patient) {
        const nextId = `pat-${Date.now()}`;
        const patientNumber = `P-${Math.floor(100000 + Math.random() * 900000)}`;
        const createdPatient = {
          id: nextId,
          patient_number: patientNumber,
          first_name: new_patient.first_name,
          last_name: new_patient.last_name,
          phone: new_patient.phone || '',
          gender: new_patient.gender || 'unspecified',
          date_of_birth: new_patient.date_of_birth || '2000-01-01',
          blood_group: new_patient.blood_group || 'Unknown',
          address: new_patient.address || '',
          is_active: true,
          created_at: new Date().toISOString()
        };
        mockDb.patients.unshift(createdPatient);
        targetPatientId = nextId;
      }

      const pat = mockDb.patients.find(p => p.id === targetPatientId) || mockDb.patients[0];
      const targetDoctorId = doctor_id || mockDb.doctors[0]?.id;
      const doc = mockDb.doctors.find(d => d.id === targetDoctorId) || mockDb.doctors[0];

      const queueNum = mockDb.patientVisits.filter(v => v.status !== 'completed' && v.status !== 'cancelled').length + 1;

      const newVisit = {
        id: `vis-${Date.now()}`,
        visit_number: generateVisitNumber(),
        patient_id: pat.id,
        doctor_id: doc.id,
        queue_number: queueNum,
        reason_for_visit,
        status: 'waiting_doctor_initial',
        symptoms: '',
        examination_findings: '',
        initial_assessment: '',
        requires_lab: false,
        lab_notes: '',
        final_diagnosis: '',
        treatment_plan: '',
        requires_pharmacy: false,
        consultation_fee: doc.consultation_fee || 75.00,
        lab_fee: 0.00,
        pharmacy_fee: 0.00,
        total_fee: doc.consultation_fee || 75.00,
        payment_status: 'unpaid',
        created_at: new Date().toISOString(),
        patients: {
          id: pat.id,
          patient_number: pat.patient_number,
          first_name: pat.first_name,
          last_name: pat.last_name,
          phone: pat.phone,
          gender: pat.gender,
          date_of_birth: pat.date_of_birth,
          blood_group: pat.blood_group || pat.blood_type || 'O+'
        },
        doctors: {
          id: doc.id,
          specialization: doc.specialization,
          consultation_fee: doc.consultation_fee || 75.00,
          profiles: { full_name: doc.profiles?.full_name || doc.full_name || 'Dr. Sarah Smith' }
        }
      };

      mockDb.patientVisits.unshift(newVisit);

      // Notification for doctor
      mockDb.notifications.unshift({
        id: `notif-${Date.now()}`,
        user_id: doc.user_id || 'usr-doctor-1',
        type: 'visit_queue',
        title: 'New Patient Waiting',
        message: `${pat.first_name} ${pat.last_name} (${pat.patient_number}) queued for consultation.`,
        link: 'dashboard',
        is_read: false,
        created_at: new Date().toISOString()
      });

      return res.status(201).json(newVisit);
    }

    // Database mode
    if (new_patient && !targetPatientId) {
      const patientNumber = `P-${Math.floor(100000 + Math.random() * 900000)}`;
      const { data: createdPat, error: patErr } = await supabaseAdmin
        .from('patients')
        .insert({
          patient_number: patientNumber,
          first_name: new_patient.first_name,
          last_name: new_patient.last_name,
          phone: new_patient.phone || 'N/A',
          gender: new_patient.gender || 'other',
          date_of_birth: new_patient.date_of_birth || '2000-01-01',
          blood_type: new_patient.blood_type || new_patient.blood_group || null,
          address: new_patient.address || null,
          is_active: true,
          created_by: req.user?.id || null
        })
        .select()
        .single();

      if (patErr || !createdPat) {
        return res.status(400).json({ error: patErr ? patErr.message : 'Failed to register new patient' });
      }
      targetPatientId = createdPat.id;
    }

    const { data: docData } = await supabaseAdmin.from('doctors').select('*, profiles(full_name)').eq('id', doctor_id).single();
    const fee = docData?.consultation_fee || 50.00;

    const { data: createdVisit, error } = await supabaseAdmin
      .from('patient_visits')
      .insert({
        visit_number: generateVisitNumber(),
        patient_id: targetPatientId,
        doctor_id,
        reason_for_visit,
        status: 'waiting_doctor_initial',
        consultation_fee: fee,
        total_fee: fee
      })
      .select('*, patients(*), doctors(*, profiles(full_name))')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(createdVisit);
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ error: 'Failed to complete reception check-in' });
  }
});

// ============================================================
// 4. STAGE 2: DOCTOR FIRST CONSULTATION
// ============================================================
router.post('/:id/first-consultation', authenticate, authorize('doctor', 'admin'), async (req, res) => {
  try {
    const { symptoms, examination_findings, initial_assessment, requires_lab, lab_tests } = req.body;

    if (!symptoms || !examination_findings) {
      return res.status(400).json({ error: 'Symptoms and examination findings are required' });
    }

    if (mockDb.isDemoMode()) {
      const visit = mockDb.patientVisits.find(v => v.id === req.params.id);
      if (!visit) return res.status(404).json({ error: 'Visit not found' });

      visit.symptoms = symptoms;
      visit.examination_findings = examination_findings;
      visit.initial_assessment = initial_assessment || '';
      visit.requires_lab = !!requires_lab;
      visit.first_consultation_at = new Date().toISOString();

      if (requires_lab && lab_tests && lab_tests.length > 0) {
        // Create lab requests
        let labFeeTotal = 0;
        const createdLabIds = [];

        lab_tests.forEach(test => {
          const testPrice = parseFloat(test.price) || 45.00;
          labFeeTotal += testPrice;
          const labId = `lab-${Date.now()}-${Math.floor(Math.random()*1000)}`;
          createdLabIds.push(labId);

          mockDb.labTests.unshift({
            id: labId,
            test_number: generateLabNumber(),
            patient_id: visit.patient_id,
            doctor_id: visit.doctor_id,
            test_name: test.test_name,
            category: test.category || 'Diagnostics',
            urgency: test.urgency || 'routine',
            status: 'requested',
            priority: test.urgency || 'normal',
            sample_type: test.sample_type || 'Venous Blood',
            notes: test.notes || `Ordered during initial consultation for ${visit.visit_number}`,
            price: testPrice,
            results: '',
            created_at: new Date().toISOString(),
            patients: visit.patients,
            doctors: visit.doctors
          });
        });

        visit.lab_test_ids = createdLabIds;
        visit.lab_notes = lab_tests.map(t => t.test_name).join(', ');
        visit.lab_fee = labFeeTotal;
        visit.total_fee = (parseFloat(visit.consultation_fee) || 75.00) + labFeeTotal;
        visit.status = 'waiting_laboratory'; // Sent to Laboratory!
      } else {
        // No lab tests required -> proceed directly to final doctor consultation
        visit.requires_lab = false;
        visit.status = 'waiting_doctor_final'; // Skips lab, ready for final consultation / prescription!
      }

      return res.json(visit);
    }

    // Database mode
    const updates = {
      symptoms,
      examination_findings,
      initial_assessment,
      requires_lab: !!requires_lab,
      first_consultation_at: new Date().toISOString(),
      status: requires_lab ? 'waiting_laboratory' : 'waiting_doctor_final'
    };

    const { data, error } = await supabaseAdmin
      .from('patient_visits')
      .update(updates)
      .eq('id', req.params.id)
      .select('*, patients(*), doctors(*, profiles(full_name))')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    console.error('First consultation error:', err);
    res.status(500).json({ error: 'Failed to record first consultation' });
  }
});

// ============================================================
// 5. STAGE 3: LABORATORY RESULTS ENTRY
// ============================================================
router.post('/:id/lab-complete', authenticate, authorize('laboratorist', 'nurse', 'doctor', 'admin'), async (req, res) => {
  try {
    const { results, lab_notes } = req.body;

    if (!results) {
      return res.status(400).json({ error: 'Laboratory results are required' });
    }

    if (mockDb.isDemoMode()) {
      const visit = mockDb.patientVisits.find(v => v.id === req.params.id);
      if (!visit) return res.status(404).json({ error: 'Visit not found' });

      visit.lab_results = results;
      visit.lab_notes = lab_notes || visit.lab_notes || '';
      visit.lab_completed_at = new Date().toISOString();
      visit.status = 'waiting_doctor_final'; // Returned to Doctor for Final Consultation!

      // Mark linked mock lab tests as completed
      if (visit.lab_test_ids && visit.lab_test_ids.length > 0) {
        mockDb.labTests.forEach(lt => {
          if (visit.lab_test_ids.includes(lt.id)) {
            lt.status = 'completed';
            lt.results = results;
            lt.completed_at = new Date().toISOString();
          }
        });
      }

      // Notification for doctor that lab results are ready
      mockDb.notifications.unshift({
        id: `notif-${Date.now()}`,
        user_id: 'usr-doctor-1',
        type: 'lab_complete',
        title: 'Laboratory Results Ready',
        message: `Diagnostic results ready for ${visit.patients?.first_name} ${visit.patients?.last_name}. Waiting for final consultation.`,
        link: 'dashboard',
        is_read: false,
        created_at: new Date().toISOString()
      });

      return res.json(visit);
    }

    // Database mode
    const { data, error } = await supabaseAdmin
      .from('patient_visits')
      .update({
        lab_notes: results,
        lab_completed_at: new Date().toISOString(),
        status: 'waiting_doctor_final'
      })
      .eq('id', req.params.id)
      .select('*, patients(*), doctors(*, profiles(full_name))')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    console.error('Lab completion error:', err);
    res.status(500).json({ error: 'Failed to record laboratory findings' });
  }
});

// ============================================================
// 6. STAGE 4: DOCTOR FINAL CONSULTATION & PRESCRIPTION
// ============================================================
router.post('/:id/final-consultation', authenticate, authorize('doctor', 'admin'), async (req, res) => {
  try {
    const { final_diagnosis, treatment_plan, requires_pharmacy, medicines } = req.body;

    if (!final_diagnosis) {
      return res.status(400).json({ error: 'Final diagnosis is required' });
    }

    if (mockDb.isDemoMode()) {
      const visit = mockDb.patientVisits.find(v => v.id === req.params.id);
      if (!visit) return res.status(404).json({ error: 'Visit not found' });

      visit.final_diagnosis = final_diagnosis;
      visit.treatment_plan = treatment_plan || '';
      visit.final_consultation_at = new Date().toISOString();
      visit.requires_pharmacy = !!requires_pharmacy;

      if (requires_pharmacy && medicines && medicines.length > 0) {
        // Create Prescription
        const rxId = `rx-${Date.now()}`;
        const rxNumber = generatePrescriptionNumber();
        let calculatedPharmaFee = 0;

        const prescriptionItems = medicines.map((m, idx) => {
          const medStock = mockDb.medicines.find(item => item.id === m.medicine_id);
          const price = medStock ? parseFloat(medStock.unit_price) : 5.00;
          calculatedPharmaFee += price * (parseInt(m.quantity) || 1);

          return {
            id: `rxi-${Date.now()}-${idx}`,
            medicine_id: m.medicine_id,
            medicine_name: m.medicine_name || medStock?.name || 'Prescribed Medicine',
            dosage: m.dosage || '10mg',
            frequency: m.frequency || 'Once daily',
            duration: m.duration || '7 days',
            quantity: parseInt(m.quantity) || 10,
            instructions: m.instructions || 'As directed by physician'
          };
        });

        const newRx = {
          id: rxId,
          prescription_number: rxNumber,
          patient_id: visit.patient_id,
          doctor_id: visit.doctor_id,
          status: 'pending',
          instructions: treatment_plan,
          created_at: new Date().toISOString(),
          patients: visit.patients,
          doctors: visit.doctors,
          prescription_items: prescriptionItems
        };

        mockDb.prescriptions.unshift(newRx);

        visit.prescription_id = rxId;
        visit.prescription_data = newRx;
        visit.pharmacy_fee = calculatedPharmaFee;
        visit.total_fee = (parseFloat(visit.consultation_fee) || 75.00) + (parseFloat(visit.lab_fee) || 0) + calculatedPharmaFee;
        visit.status = 'waiting_pharmacy'; // Sent to Pharmacy!

        // Pharmacy Notification
        mockDb.notifications.unshift({
          id: `notif-${Date.now()}`,
          user_id: 'usr-pharma',
          type: 'rx_queue',
          title: 'Prescription Ready for Dispensation',
          message: `${rxNumber} issued for ${visit.patients?.first_name} ${visit.patients?.last_name}.`,
          link: 'prescriptions',
          is_read: false,
          created_at: new Date().toISOString()
        });
      } else {
        // No medications prescribed -> Skip Pharmacy and go directly to Payment / Cashier!
        visit.requires_pharmacy = false;
        visit.pharmacy_fee = 0.00;
        visit.total_fee = (parseFloat(visit.consultation_fee) || 75.00) + (parseFloat(visit.lab_fee) || 0);

        // Auto-generate invoice for cashier
        const invId = `inv-${Date.now()}`;
        const invNum = generateInvoiceNumber();
        const items = [
          { id: `ii-${Date.now()}-1`, description: `Consultation (${visit.doctors?.specialization || 'General'})`, unit_price: visit.consultation_fee, quantity: 1, total_price: visit.consultation_fee }
        ];
        if (visit.lab_fee > 0) {
          items.push({ id: `ii-${Date.now()}-2`, description: `Diagnostic Laboratory Tests (${visit.lab_notes || 'Panel'})`, unit_price: visit.lab_fee, quantity: 1, total_price: visit.lab_fee });
        }

        const newInv = {
          id: invId,
          invoice_number: invNum,
          patient_id: visit.patient_id,
          total_amount: visit.total_fee,
          paid_amount: 0.00,
          balance_amount: visit.total_fee,
          status: 'unpaid',
          due_date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
          patients: visit.patients,
          invoice_items: items
        };

        mockDb.invoices.unshift(newInv);
        visit.invoice_id = invId;
        visit.invoice_number = invNum;
        visit.status = 'waiting_payment'; // Sent directly to Cashier!
      }

      return res.json(visit);
    }

    // Database mode
    const updates = {
      final_diagnosis,
      treatment_plan,
      requires_pharmacy: !!requires_pharmacy,
      final_consultation_at: new Date().toISOString(),
      status: requires_pharmacy ? 'waiting_pharmacy' : 'waiting_payment'
    };

    const { data, error } = await supabaseAdmin
      .from('patient_visits')
      .update(updates)
      .eq('id', req.params.id)
      .select('*, patients(*), doctors(*, profiles(full_name))')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    console.error('Final consultation error:', err);
    res.status(500).json({ error: 'Failed to record final consultation' });
  }
});

// ============================================================
// 7. STAGE 5: PHARMACY DISPENSATION
// ============================================================
router.post('/:id/pharmacy-dispense', authenticate, authorize('pharmacist', 'admin'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const visit = mockDb.patientVisits.find(v => v.id === req.params.id);
      if (!visit) return res.status(404).json({ error: 'Visit not found' });

      // Mark prescription dispensed & deduct inventory stock
      if (visit.prescription_id) {
        const rx = mockDb.prescriptions.find(p => p.id === visit.prescription_id);
        if (rx) {
          rx.status = 'dispensed';
          if (rx.prescription_items) {
            rx.prescription_items.forEach(item => {
              const med = mockDb.medicines.find(m => m.id === item.medicine_id);
              if (med) {
                med.stock_quantity = Math.max(0, (med.stock_quantity || 100) - (parseInt(item.quantity) || 1));
              }
            });
          }
        }
      }

      visit.pharmacy_dispensed_at = new Date().toISOString();

      // Generate comprehensive invoice for cashier
      const invId = `inv-${Date.now()}`;
      const invNum = generateInvoiceNumber();

      const items = [
        { id: `ii-${Date.now()}-1`, description: `Doctor Consultation (${visit.doctors?.specialization || 'Clinical'})`, unit_price: visit.consultation_fee, quantity: 1, total_price: visit.consultation_fee }
      ];

      if (visit.lab_fee > 0) {
        items.push({ id: `ii-${Date.now()}-2`, description: `Laboratory Diagnostics (${visit.lab_notes || 'Lab Panel'})`, unit_price: visit.lab_fee, quantity: 1, total_price: visit.lab_fee });
      }

      if (visit.pharmacy_fee > 0) {
        items.push({ id: `ii-${Date.now()}-3`, description: `Dispensed Pharmaceuticals & Medications`, unit_price: visit.pharmacy_fee, quantity: 1, total_price: visit.pharmacy_fee });
      }

      const totalBill = visit.consultation_fee + visit.lab_fee + visit.pharmacy_fee;
      visit.total_fee = totalBill;

      const newInv = {
        id: invId,
        invoice_number: invNum,
        patient_id: visit.patient_id,
        total_amount: totalBill,
        paid_amount: 0.00,
        balance_amount: totalBill,
        status: 'unpaid',
        due_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        patients: visit.patients,
        invoice_items: items
      };

      mockDb.invoices.unshift(newInv);
      visit.invoice_id = invId;
      visit.invoice_number = invNum;
      visit.status = 'waiting_payment'; // Sent to Payment / Cashier!

      // Cashier notification
      mockDb.notifications.unshift({
        id: `notif-${Date.now()}`,
        user_id: 'usr-reception',
        type: 'payment_due',
        title: 'Patient Ready for Payment',
        message: `${visit.patients?.first_name} ${visit.patients?.last_name} prescription dispensed. Total due: $${totalBill.toFixed(2)}.`,
        link: 'invoices',
        is_read: false,
        created_at: new Date().toISOString()
      });

      return res.json(visit);
    }

    // Database mode
    const { data, error } = await supabaseAdmin
      .from('patient_visits')
      .update({
        pharmacy_dispensed_at: new Date().toISOString(),
        status: 'waiting_payment'
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    console.error('Pharmacy dispense error:', err);
    res.status(500).json({ error: 'Failed to dispense medication' });
  }
});

// ============================================================
// 8. STAGE 6 & 7: PAYMENT / CASHIER & PATIENT EXIT
// ============================================================
router.post('/:id/process-payment', authenticate, authorize('cashier', 'receptionist', 'admin'), async (req, res) => {
  try {
    const { payment_method = 'cash', amount_paid, payment_reference } = req.body;

    if (mockDb.isDemoMode()) {
      const visit = mockDb.patientVisits.find(v => v.id === req.params.id);
      if (!visit) return res.status(404).json({ error: 'Visit not found' });

      const paidAmount = parseFloat(amount_paid) || parseFloat(visit.total_fee) || 75.00;
      const recNumber = generatePaymentNumber();

      // Update invoice to paid
      if (visit.invoice_id) {
        const inv = mockDb.invoices.find(i => i.id === visit.invoice_id);
        if (inv) {
          inv.paid_amount = paidAmount;
          inv.balance_amount = 0.00;
          inv.status = 'paid';
        }
      }

      // Record payment
      const newPay = {
        id: `pay-${Date.now()}`,
        payment_number: recNumber,
        invoice_id: visit.invoice_id || `inv-${Date.now()}`,
        amount: paidAmount,
        payment_method,
        payment_date: new Date().toISOString().split('T')[0],
        notes: payment_reference ? `Reference: ${payment_reference}` : 'Full settlement at cashier checkout',
        created_at: new Date().toISOString(),
        invoices: {
          invoice_number: visit.invoice_number || 'INV-2026-0001',
          patients: visit.patients
        }
      };
      mockDb.payments.unshift(newPay);

      // Advance visit to COMPLETED (Stage 7: Patient Exit!)
      visit.payment_status = 'paid';
      visit.payment_method = payment_method;
      visit.payment_reference = payment_reference || '';
      visit.payment_received_at = new Date().toISOString();
      visit.status = 'completed'; // Visit Completed! Removed from active queues!
      visit.completed_at = new Date().toISOString();

      return res.json({
        success: true,
        visit,
        receipt: {
          receipt_number: recNumber,
          visit_number: visit.visit_number,
          patient_name: `${visit.patients?.first_name} ${visit.patients?.last_name}`,
          patient_number: visit.patients?.patient_number,
          doctor_name: visit.doctors?.profiles?.full_name || 'Dr. Sarah Smith',
          consultation_fee: visit.consultation_fee,
          lab_fee: visit.lab_fee,
          pharmacy_fee: visit.pharmacy_fee,
          total_fee: visit.total_fee,
          amount_paid: paidAmount,
          payment_method: payment_method.toUpperCase(),
          payment_date: new Date().toLocaleString(),
          cashier_name: req.user?.full_name || 'Clinic Cashier',
          status: 'COMPLETED & PAID'
        }
      });
    }

    // Database mode
    const { data, error } = await supabaseAdmin
      .from('patient_visits')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        payment_method,
        payment_reference: payment_reference || null,
        payment_received_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select('*, patients(*), doctors(*, profiles(full_name))')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, visit: data });
  } catch (err) {
    console.error('Payment processing error:', err);
    res.status(500).json({ error: 'Failed to process payment and complete visit' });
  }
});

module.exports = router;
