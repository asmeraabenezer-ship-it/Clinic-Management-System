const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const mockDb = require('../mockDb');

const generateRecordNumber = () => `REC-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;

// GET /api/medical-records  -- clinical staff only (doctor, nurse, admin)
router.get('/', authenticate, requirePermission('medical_records', 'read'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const { search = '', page = 1, limit = 20 } = req.query;
      let filtered = [...mockDb.medicalRecords];
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(r =>
          (r.diagnosis && r.diagnosis.toLowerCase().includes(q)) ||
          (r.symptoms && r.symptoms.toLowerCase().includes(q)) ||
          (r.patients?.first_name && r.patients.first_name.toLowerCase().includes(q))
        );
      }
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      const total = filtered.length;
      return res.json({
        data: filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum),
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) || 1 }
      });
    }

    const { patient_id, doctor_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('medical_records')
      .select(`
        *,
        patients(first_name, last_name, patient_number),
        doctors(specialization, profiles(full_name)),
        appointments(appointment_date, appointment_time, type)
      `, { count: 'exact' });

    if (patient_id) query = query.eq('patient_id', patient_id);
    if (doctor_id) query = query.eq('doctor_id', doctor_id);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ data, pagination: { page: parseInt(page), limit: parseInt(limit), total: count, pages: Math.ceil(count / parseInt(limit)) } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch medical records' });
  }
});

// GET /api/medical-records/:id  -- clinical staff only
router.get('/:id', authenticate, requirePermission('medical_records', 'read'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const rec = mockDb.medicalRecords.find(r => r.id === req.params.id) || mockDb.medicalRecords[0];
      return res.json(rec);
    }

    const { data, error } = await supabaseAdmin
      .from('medical_records')
      .select(`
        *,
        patients(*),
        doctors(*, profiles(full_name)),
        appointments(*),
        vital_signs(*),
        prescriptions(*, prescription_items(*)),
        lab_tests(*),
        medical_files(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Record not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch medical record' });
  }
});

// POST /api/medical-records
router.post('/', authenticate, authorize('admin', 'doctor', 'nurse'), requirePermission('medical_records', 'write'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const pat = mockDb.patients.find(p => p.id === req.body.patient_id) || mockDb.patients[0];
      const doc = mockDb.doctors.find(d => d.id === req.body.doctor_id) || mockDb.doctors[0];
      const newRec = {
        id: `mr-${Date.now()}`,
        record_number: generateRecordNumber(),
        ...req.body,
        visit_date: req.body.visit_date || new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        patients: { first_name: pat?.first_name || 'Patient', last_name: pat?.last_name || '', patient_number: pat?.patient_number || 'P-100' },
        doctors: { specialization: doc?.specialization || 'General', profiles: { full_name: doc?.full_name || 'Doctor' } }
      };
      mockDb.medicalRecords.unshift(newRec);
      return res.status(201).json(newRec);
    }

    let recordNumber;
    let attempts = 0;
    do {
      recordNumber = generateRecordNumber();
      const { data } = await supabaseAdmin.from('medical_records').select('id').eq('record_number', recordNumber).single();
      if (!data) break;
    } while (++attempts < 5);

    const { data, error } = await supabaseAdmin
      .from('medical_records')
      .insert({ ...req.body, record_number: recordNumber })
      .select(`
        *,
        patients(first_name, last_name),
        doctors(profiles(full_name))
      `)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create medical record' });
  }
});

// PUT /api/medical-records/:id
router.put('/:id', authenticate, authorize('admin', 'doctor'), requirePermission('medical_records', 'write'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const idx = mockDb.medicalRecords.findIndex(r => r.id === req.params.id);
      if (idx !== -1) {
        mockDb.medicalRecords[idx] = { ...mockDb.medicalRecords[idx], ...req.body };
        return res.json(mockDb.medicalRecords[idx]);
      }
      return res.json({ id: req.params.id, ...req.body });
    }

    const { record_number, created_at, ...updateData } = req.body;
    const { data, error } = await supabaseAdmin
      .from('medical_records')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update medical record' });
  }
});

module.exports = router;
