const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const { requirePermission, filterPrescription } = require('../middleware/rbac');
const mockDb = require('../mockDb');

const generateRxNumber = () => `RX-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;

// GET /api/prescriptions  -- doctor, pharmacist, admin only
router.get('/', authenticate, requirePermission('prescriptions', 'read'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const { status, page = 1, limit = 20 } = req.query;
      let filtered = [...mockDb.prescriptions];
      if (status) filtered = filtered.filter(p => p.status === status);
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      const total = filtered.length;
      return res.json({
        data: filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum).map(rx => filterPrescription(rx, req.user.role)),
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) || 1 }
      });
    }

    const { patient_id, status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('prescriptions')
      .select(`
        *,
        patients(first_name, last_name, patient_number),
        doctors(specialization, profiles(full_name)),
        prescription_items(*, medicines(name, dosage_form, strength))
      `, { count: 'exact' });

    if (patient_id) query = query.eq('patient_id', patient_id);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ data: (data||[]).map(rx => filterPrescription(rx, req.user.role)), pagination: { page: parseInt(page), limit: parseInt(limit), total: count, pages: Math.ceil(count / parseInt(limit)) } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
});

// GET /api/prescriptions/:id  -- doctor, pharmacist, admin only
router.get('/:id', authenticate, requirePermission('prescriptions', 'read'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const rx = mockDb.prescriptions.find(p => p.id === req.params.id) || mockDb.prescriptions[0];
      return res.json(filterPrescription(rx, req.user.role));
    }

    const { data, error } = await supabaseAdmin
      .from('prescriptions')
      .select(`
        *,
        patients(*),
        doctors(*, profiles(full_name, email)),
        prescription_items(*, medicines(*))
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Prescription not found' });
    res.json(filterPrescription(data, req.user.role));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prescription' });
  }
});

// POST /api/prescriptions
router.post('/', authenticate, authorize('admin', 'doctor'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const pat = mockDb.patients.find(p => p.id === req.body.patient_id) || mockDb.patients[0];
      const doc = mockDb.doctors.find(d => d.id === req.body.doctor_id) || mockDb.doctors[0];
      const newRx = {
        id: `rx-${Date.now()}`,
        prescription_number: generateRxNumber(),
        ...req.body,
        status: 'pending',
        created_at: new Date().toISOString(),
        patients: { first_name: pat?.first_name || 'Patient', last_name: pat?.last_name || '', patient_number: pat?.patient_number || 'P-100' },
        doctors: { profiles: { full_name: doc?.full_name || 'Doctor' } },
        prescription_items: req.body.items || []
      };
      mockDb.prescriptions.unshift(newRx);
      return res.status(201).json(newRx);
    }

    const { items, ...prescriptionData } = req.body;
    let rxNumber;
    let attempts = 0;
    do {
      rxNumber = generateRxNumber();
      const { data } = await supabaseAdmin.from('prescriptions').select('id').eq('prescription_number', rxNumber).single();
      if (!data) break;
    } while (++attempts < 5);

    const { data: rx, error: rxError } = await supabaseAdmin
      .from('prescriptions')
      .insert({ ...prescriptionData, prescription_number: rxNumber })
      .select()
      .single();

    if (rxError) return res.status(400).json({ error: rxError.message });

    if (items && items.length > 0) {
      const itemsToInsert = items.map(item => ({ ...item, prescription_id: rx.id }));
      await supabaseAdmin.from('prescription_items').insert(itemsToInsert);
    }

    res.status(201).json(rx);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create prescription' });
  }
});

// POST /api/prescriptions/:id/dispense
router.post('/:id/dispense', authenticate, authorize('pharmacist', 'admin'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const rx = mockDb.prescriptions.find(p => p.id === req.params.id);
      if (rx) rx.status = 'dispensed';
      return res.json({ message: 'Prescription marked as dispensed', data: rx });
    }

    const { data, error } = await supabaseAdmin
      .from('prescriptions')
      .update({ status: 'dispensed', dispensed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to dispense prescription' });
  }
});

module.exports = router;
