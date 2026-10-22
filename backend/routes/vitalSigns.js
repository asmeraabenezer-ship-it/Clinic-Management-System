const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const mockDb = require('../mockDb');

// GET /api/vital-signs
router.get('/', authenticate, async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const { search = '', page = 1, limit = 20 } = req.query;
      let filtered = [...mockDb.vitalSigns];
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(v =>
          v.patients?.first_name?.toLowerCase().includes(q) ||
          v.patients?.last_name?.toLowerCase().includes(q)
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

    const { patient_id, appointment_id, limit = 20 } = req.query;
    let query = supabaseAdmin
      .from('vital_signs')
      .select('*, patients(first_name, last_name), profiles(full_name)');

    if (patient_id) query = query.eq('patient_id', patient_id);
    if (appointment_id) query = query.eq('appointment_id', appointment_id);

    const { data, error } = await query
      .order('recorded_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) return res.status(400).json({ error: error.message });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vital signs' });
  }
});

// POST /api/vital-signs
router.post('/', authenticate, authorize('admin', 'doctor', 'nurse'), async (req, res) => {
  try {
    // Auto-calculate BMI
    let bmi = null;
    const weight = req.body.weight_kg || req.body.weight;
    const height = req.body.height_cm || req.body.height;
    if (weight && height) {
      const heightM = height / 100;
      bmi = parseFloat((weight / (heightM * heightM)).toFixed(1));
    }

    if (mockDb.isDemoMode()) {
      const pat = mockDb.patients.find(p => p.id === req.body.patient_id) || mockDb.patients[0];
      const newVitals = {
        id: `vs-${Date.now()}`,
        ...req.body,
        bmi: bmi || 22.5,
        recorded_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        patients: { first_name: pat?.first_name || 'Patient', last_name: pat?.last_name || '', patient_number: pat?.patient_number || 'P-100' }
      };
      mockDb.vitalSigns.unshift(newVitals);
      return res.status(201).json(newVitals);
    }

    const { data, error } = await supabaseAdmin
      .from('vital_signs')
      .insert({ ...req.body, bmi, recorded_by: req.user.id })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to record vital signs' });
  }
});

// PUT /api/vital-signs/:id
router.put('/:id', authenticate, authorize('admin', 'doctor', 'nurse'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const idx = mockDb.vitalSigns.findIndex(v => v.id === req.params.id);
      if (idx !== -1) {
        mockDb.vitalSigns[idx] = { ...mockDb.vitalSigns[idx], ...req.body };
        return res.json(mockDb.vitalSigns[idx]);
      }
      return res.json({ id: req.params.id, ...req.body });
    }

    const { data, error } = await supabaseAdmin
      .from('vital_signs')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update vital signs' });
  }
});

module.exports = router;
