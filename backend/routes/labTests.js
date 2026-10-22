const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const mockDb = require('../mockDb');

const generateTestNumber = () => `LAB-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;

// GET /api/lab-tests  -- clinical staff and laboratorist only
router.get('/', authenticate, requirePermission('lab_tests', 'read'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const { status, page = 1, limit = 20 } = req.query;
      let filtered = [...mockDb.labTests];
      if (status) filtered = filtered.filter(l => l.status === status);
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      const total = filtered.length;
      return res.json({
        data: filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum),
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) || 1 }
      });
    }

    const { patient_id, status, urgency, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('lab_tests')
      .select(`
        *,
        patients(first_name, last_name, patient_number),
        doctors(specialization, profiles(full_name))
      `, { count: 'exact' });

    if (patient_id) query = query.eq('patient_id', patient_id);
    if (status) query = query.eq('status', status);
    if (urgency) query = query.eq('urgency', urgency);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ data, pagination: { page: parseInt(page), limit: parseInt(limit), total: count, pages: Math.ceil(count / parseInt(limit)) } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lab tests' });
  }
});

// GET /api/lab-tests/:id  -- clinical staff and laboratorist only
router.get('/:id', authenticate, requirePermission('lab_tests', 'read'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const lab = mockDb.labTests.find(l => l.id === req.params.id) || mockDb.labTests[0];
      return res.json(lab);
    }

    const { data, error } = await supabaseAdmin
      .from('lab_tests')
      .select('*, patients(*), doctors(*, profiles(full_name))')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Lab test not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lab test' });
  }
});

// POST /api/lab-tests  -- doctor or admin orders tests; laboratorist can create via visits workflow
router.post('/', authenticate, authorize('admin', 'doctor', 'nurse', 'laboratorist'), requirePermission('lab_tests', 'write'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const pat = mockDb.patients.find(p => p.id === req.body.patient_id) || mockDb.patients[0];
      const doc = mockDb.doctors.find(d => d.id === req.body.doctor_id) || mockDb.doctors[0];
      const newLab = {
        id: `lab-${Date.now()}`,
        test_number: generateTestNumber(),
        ...req.body,
        status: req.body.status || 'requested',
        priority: req.body.priority || req.body.urgency || 'normal',
        created_at: new Date().toISOString(),
        patients: { first_name: pat?.first_name || 'Patient', last_name: pat?.last_name || '', patient_number: pat?.patient_number || 'P-100' },
        doctors: { profiles: { full_name: doc?.full_name || 'Doctor' } }
      };
      mockDb.labTests.unshift(newLab);
      return res.status(201).json(newLab);
    }

    let testNumber;
    let attempts = 0;
    do {
      testNumber = generateTestNumber();
      const { data } = await supabaseAdmin.from('lab_tests').select('id').eq('test_number', testNumber).single();
      if (!data) break;
    } while (++attempts < 5);

    const { data, error } = await supabaseAdmin
      .from('lab_tests')
      .insert({ ...req.body, test_number: testNumber })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create lab test' });
  }
});

// PUT /api/lab-tests/:id  -- laboratorist enters results; doctor/admin can also update
router.put('/:id', authenticate, authorize('admin', 'doctor', 'nurse', 'laboratorist'), requirePermission('lab_tests', 'write'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const idx = mockDb.labTests.findIndex(l => l.id === req.params.id);
      if (idx !== -1) {
        mockDb.labTests[idx] = { ...mockDb.labTests[idx], ...req.body };
        return res.json(mockDb.labTests[idx]);
      }
      return res.json({ id: req.params.id, ...req.body });
    }

    const { data, error } = await supabaseAdmin
      .from('lab_tests')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lab test' });
  }
});

module.exports = router;
