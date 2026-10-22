const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const mockDb = require('../mockDb');

const generateAppointmentNumber = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 90000) + 10000;
  return `APT-${year}-${random}`;
};

// GET /api/appointments
router.get('/', authenticate, async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const { search, status, doctor_id, date, page = 1, limit = 20 } = req.query;
      let filtered = [...mockDb.appointments];
      if (status) filtered = filtered.filter(a => a.status === status);
      if (doctor_id) filtered = filtered.filter(a => a.doctor_id === doctor_id);
      if (date) filtered = filtered.filter(a => a.appointment_date === date);
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(a =>
          a.patients?.first_name?.toLowerCase().includes(q) ||
          a.patients?.last_name?.toLowerCase().includes(q) ||
          a.patients?.patient_number?.toLowerCase().includes(q) ||
          a.appointment_number?.toLowerCase().includes(q)
        );
      }
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      const total = filtered.length;
      const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);
      return res.json({
        data: paginated,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) || 1 }
      });
    }

    const { search, status, doctor_id, patient_id, date, date_from, date_to, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('appointments')
      .select(`
        *,
        patients(id, first_name, last_name, patient_number, phone),
        doctors(id, specialization, profiles(full_name))
      `, { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (doctor_id) query = query.eq('doctor_id', doctor_id);
    if (patient_id) query = query.eq('patient_id', patient_id);
    if (date) query = query.eq('appointment_date', date);
    if (date_from) query = query.gte('appointment_date', date_from);
    if (date_to) query = query.lte('appointment_date', date_to);

    if (req.user.role === 'doctor') {
      const { data: doctorData } = await supabaseAdmin
        .from('doctors')
        .select('id')
        .eq('profile_id', req.user.id)
        .single();
      if (doctorData) query = query.eq('doctor_id', doctorData.id);
    }

    query = query
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: true })
      .range(offset, offset + parseInt(limit) - 1);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ error: error.message });

    let filtered = data || [];
    if (search) {
      filtered = filtered.filter(a =>
        a.patients?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
        a.patients?.last_name?.toLowerCase().includes(search.toLowerCase()) ||
        a.patients?.patient_number?.toLowerCase().includes(search.toLowerCase()) ||
        a.appointment_number?.toLowerCase().includes(search.toLowerCase())
      );
    }

    res.json({
      data: filtered,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: count, pages: Math.ceil(count / parseInt(limit)) }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// GET /api/appointments/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const apt = mockDb.appointments.find(a => a.id === req.params.id) || mockDb.appointments[0];
      return res.json(apt);
    }

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .select(`
        *,
        patients(*),
        doctors(*, profiles(full_name, email, phone))
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Appointment not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// POST /api/appointments
router.post('/', authenticate, authorize('admin', 'receptionist', 'doctor', 'nurse'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const pat = mockDb.patients.find(p => p.id === req.body.patient_id) || mockDb.patients[0];
      const doc = mockDb.doctors.find(d => d.id === req.body.doctor_id) || mockDb.doctors[0];
      const newApt = {
        id: `apt-${Date.now()}`,
        appointment_number: generateAppointmentNumber(),
        ...req.body,
        status: req.body.status || 'scheduled',
        created_at: new Date().toISOString(),
        patients: { first_name: pat?.first_name || 'Patient', last_name: pat?.last_name || '', patient_number: pat?.patient_number || 'P-100' },
        doctors: { specialization: doc?.specialization || 'General', room_number: doc?.room_number || '101', profiles: { full_name: doc?.full_name || 'Doctor' } }
      };
      mockDb.appointments.unshift(newApt);
      return res.status(201).json(newApt);
    }

    const { doctor_id, appointment_date, appointment_time } = req.body;

    // Check scheduling conflicts for the doctor at this exact date & time
    if (doctor_id && appointment_date && appointment_time) {
      const { data: conflict } = await supabaseAdmin
        .from('appointments')
        .select('id, appointment_time, appointment_number')
        .eq('doctor_id', doctor_id)
        .eq('appointment_date', appointment_date)
        .eq('appointment_time', appointment_time)
        .not('status', 'in', '("cancelled")')
        .maybeSingle();

      if (conflict) {
        return res.status(400).json({
          error: `Scheduling Conflict: Doctor already has an active appointment (${conflict.appointment_number}) booked at ${appointment_time} on ${appointment_date}.`
        });
      }
    }

    let appointmentNumber;
    let attempts = 0;
    do {
      appointmentNumber = generateAppointmentNumber();
      const { data } = await supabaseAdmin.from('appointments').select('id').eq('appointment_number', appointmentNumber).single();
      if (!data) break;
    } while (++attempts < 5);

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .insert({ ...req.body, appointment_number: appointmentNumber, booked_by: req.user.id })
      .select(`
        *,
        patients(first_name, last_name, patient_number),
        doctors(specialization, profiles(full_name))
      `)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    const { logAudit } = require('../middleware/audit');
    await logAudit(req, 'appointment_create', 'appointment', data.id, { appointment_number: data.appointment_number, date: data.appointment_date, time: data.appointment_time });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// PUT /api/appointments/:id
router.put('/:id', authenticate, authorize('admin', 'receptionist', 'doctor', 'nurse'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const idx = mockDb.appointments.findIndex(a => a.id === req.params.id);
      if (idx !== -1) {
        mockDb.appointments[idx] = { ...mockDb.appointments[idx], ...req.body };
        return res.json(mockDb.appointments[idx]);
      }
      return res.json({ id: req.params.id, ...req.body });
    }

    const { appointment_number, created_at, booked_by, ...updateData } = req.body;
    const { data, error } = await supabaseAdmin
      .from('appointments')
      .update(updateData)
      .eq('id', req.params.id)
      .select(`
        *,
        patients(first_name, last_name, patient_number),
        doctors(specialization, profiles(full_name))
      `)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// POST /api/appointments/:id/cancel
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const apt = mockDb.appointments.find(a => a.id === req.params.id);
      if (apt) apt.status = 'cancelled';
      return res.json({ message: 'Appointment cancelled', data: apt });
    }

    const { reason } = req.body;
    const { data, error } = await supabaseAdmin
      .from('appointments')
      .update({ status: 'cancelled', cancellation_reason: reason })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
});

// GET /api/appointments/today/list
router.get('/today/list', authenticate, async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      return res.json(mockDb.appointments);
    }

    const today = new Date().toISOString().split('T')[0];
    let query = supabaseAdmin
      .from('appointments')
      .select(`
        *,
        patients(first_name, last_name, patient_number, phone),
        doctors(specialization, profiles(full_name))
      `)
      .eq('appointment_date', today)
      .order('appointment_time', { ascending: true });

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch today appointments' });
  }
});

module.exports = router;
