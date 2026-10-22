const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const { requirePermission, filterPatientData, filterPatientList } = require('../middleware/rbac');
const { patientValidation } = require('../middleware/validate');
const mockDb = require('../mockDb');

const generatePatientNumber = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 90000) + 10000;
  return `PAT-${year}-${random}`;
};

// GET /api/patients
router.get('/', authenticate, requirePermission('patients', 'read_basic'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const { search = '', page = 1, limit = 20, gender } = req.query;
      let filtered = mockDb.patients.filter(p => p.is_active);
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(p =>
          p.first_name.toLowerCase().includes(q) ||
          p.last_name.toLowerCase().includes(q) ||
          (p.patient_number && p.patient_number.toLowerCase().includes(q)) ||
          (p.phone && p.phone.includes(q)) ||
          (p.email && p.email.toLowerCase().includes(q))
        );
      }
      if (gender) {
        filtered = filtered.filter(p => p.gender === gender);
      }
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      const total = filtered.length;
      const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);
      const filteredData = filterPatientList(paginated, req.user.role);
      return res.json({
        data: filteredData,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum) || 1
        }
      });
    }

    const { search, page = 1, limit = 20, is_active } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('patients')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,patient_number.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ error: error.message });

    res.json({
      data: filterPatientList(data || [], req.user.role),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// GET /api/patients/:id
router.get('/:id', authenticate, requirePermission('patients', 'read_basic'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const patient = mockDb.patients.find(p => p.id === req.params.id) || mockDb.patients[0];
      if (!patient) return res.status(404).json({ error: 'Patient not found' });
      return res.json(filterPatientData(patient, req.user.role));
    }

    const { data, error } = await supabaseAdmin
      .from('patients')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Patient not found' });
    res.json(filterPatientData(data, req.user.role));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

// POST /api/patients
router.post('/', authenticate, authorize('admin', 'receptionist', 'nurse'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const newPatient = {
        id: `pat-${Date.now()}`,
        patient_number: generatePatientNumber(),
        ...req.body,
        is_active: true,
        created_at: new Date().toISOString()
      };
      mockDb.patients.unshift(newPatient);
      return res.status(201).json(newPatient);
    }

    let patientNumber;
    let attempts = 0;
    do {
      patientNumber = generatePatientNumber();
      const { data } = await supabaseAdmin.from('patients').select('id').eq('patient_number', patientNumber).single();
      if (!data) break;
      attempts++;
    } while (attempts < 5);

    const patientPayload = { ...req.body };
    if (patientPayload.blood_group && !patientPayload.blood_type) {
      patientPayload.blood_type = patientPayload.blood_group;
    }
    delete patientPayload.blood_group;
    if (patientPayload.medical_history && !patientPayload.notes) {
      patientPayload.notes = patientPayload.medical_history;
    }
    delete patientPayload.medical_history;

    const { data, error } = await supabaseAdmin
      .from('patients')
      .insert({ ...patientPayload, patient_number: patientNumber, created_by: req.user.id })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

// PUT /api/patients/:id
router.put('/:id', authenticate, authorize('admin', 'receptionist', 'nurse', 'doctor'), requirePermission('patients', 'write'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const index = mockDb.patients.findIndex(p => p.id === req.params.id);
      if (index !== -1) {
        mockDb.patients[index] = { ...mockDb.patients[index], ...req.body };
        return res.json(mockDb.patients[index]);
      }
      return res.json({ id: req.params.id, ...req.body });
    }

    const { patient_number, created_by, created_at, ...updateData } = req.body;
    if (updateData.blood_group && !updateData.blood_type) {
      updateData.blood_type = updateData.blood_group;
    }
    delete updateData.blood_group;
    if (updateData.medical_history && !updateData.notes) {
      updateData.notes = updateData.medical_history;
    }
    delete updateData.medical_history;

    const { data, error } = await supabaseAdmin
      .from('patients')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

// DELETE /api/patients/:id (admin only - soft delete)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const p = mockDb.patients.find(p => p.id === req.params.id);
      if (p) p.is_active = false;
      return res.json({ message: 'Patient deactivated', data: p });
    }

    const { data, error } = await supabaseAdmin
      .from('patients')
      .update({ is_active: false })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Patient deactivated', data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate patient' });
  }
});

// GET /api/patients/:id/history  -- clinical roles only
router.get('/:id/history', authenticate, authorize('admin', 'doctor', 'nurse'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const pid = req.params.id;
      return res.json({
        appointments: mockDb.appointments.filter(a => a.patient_id === pid),
        medical_records: mockDb.medicalRecords.filter(m => m.patient_id === pid),
        vital_signs: mockDb.vitalSigns.filter(v => v.patient_id === pid),
        prescriptions: mockDb.prescriptions.filter(p => p.patient_id === pid),
        lab_tests: mockDb.labTests.filter(l => l.patient_id === pid),
        invoices: mockDb.invoices.filter(i => i.patient_id === pid)
      });
    }

    const [appointments, records, vitals, prescriptions, labs, invoices] = await Promise.all([
      supabaseAdmin.from('appointments').select('*, doctors(specialization, profiles(full_name))').eq('patient_id', req.params.id).order('appointment_date', { ascending: false }).limit(5),
      supabaseAdmin.from('medical_records').select('*, doctors(profiles(full_name))').eq('patient_id', req.params.id).order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('vital_signs').select('*').eq('patient_id', req.params.id).order('recorded_at', { ascending: false }).limit(10),
      supabaseAdmin.from('prescriptions').select('*, prescription_items(*), doctors(profiles(full_name))').eq('patient_id', req.params.id).order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('lab_tests').select('*').eq('patient_id', req.params.id).order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('invoices').select('*').eq('patient_id', req.params.id).order('created_at', { ascending: false }).limit(5)
    ]);

    res.json({
      appointments: appointments.data || [],
      medical_records: records.data || [],
      vital_signs: vitals.data || [],
      prescriptions: prescriptions.data || [],
      lab_tests: labs.data || [],
      invoices: invoices.data || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch patient history' });
  }
});

module.exports = router;
