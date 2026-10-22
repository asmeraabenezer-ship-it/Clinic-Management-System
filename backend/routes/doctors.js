const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const mockDb = require('../mockDb');

// Demo mode helper – returns true when Supabase is not configured
const isDemoMode = () => {
  return !process.env.SUPABASE_URL ||
    process.env.SUPABASE_URL.includes('placeholder') ||
    process.env.SUPABASE_URL.includes('your-project-id');
};

// GET /api/doctors
router.get('/', authenticate, async (req, res) => {
  try {
    if (isDemoMode()) {
      const { search, specialization, is_available } = req.query;
      let list = [...mockDb.doctors];
      if (specialization) {
        list = list.filter(d => d.specialization?.toLowerCase() === specialization.toLowerCase());
      }
      if (is_available !== undefined) {
        list = list.filter(d => String(d.is_available) === String(is_available));
      }
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(d =>
          (d.full_name && d.full_name.toLowerCase().includes(q)) ||
          (d.profiles?.full_name && d.profiles.full_name.toLowerCase().includes(q)) ||
          (d.specialization && d.specialization.toLowerCase().includes(q)) ||
          (d.doctor_number && d.doctor_number.toLowerCase().includes(q))
        );
      }
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const total = list.length;
      const paginated = list.slice((page - 1) * limit, page * limit);
      return res.json({ data: paginated, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    }
    const { search, specialization, is_available, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('doctors')
      .select('*, profiles(full_name, email, phone, avatar_url)', { count: 'exact' });

    if (specialization) query = query.eq('specialization', specialization);
    if (is_available !== undefined) query = query.eq('is_available', is_available === 'true');

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ error: error.message });

    let filtered = data || [];
    if (search) {
      filtered = filtered.filter(d =>
        d.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        d.specialization?.toLowerCase().includes(search.toLowerCase()) ||
        d.doctor_number?.toLowerCase().includes(search.toLowerCase())
      );
    }

    res.json({
      data: filtered,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: count, pages: Math.ceil(count / parseInt(limit)) }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

// GET /api/doctors/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    if (isDemoMode()) {
      const doc = mockDb.doctors.find(d => d.id === req.params.id || d.user_id === req.params.id) || mockDb.doctors[0];
      if (!doc) return res.status(404).json({ error: 'Doctor not found' });
      return res.json(doc);
    }
    const { data, error } = await supabaseAdmin
      .from('doctors')
      .select('*, profiles(full_name, email, phone, avatar_url), doctor_schedules(*)')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Doctor not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch doctor' });
  }
});

// POST /api/doctors (Admin can create doctor with user account or link existing)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const {
      full_name,
      email,
      password,
      phone,
      specialization,
      consultation_fee,
      room_number,
      license_number,
      bio,
      user_id
    } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Doctor email is required' });
    }

    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 9000) + 1000;
    const doctorNumber = `DOC-${random}`;
    const doctorPassword = password || 'Doctor@123456';

    if (isDemoMode()) {
      let linkedUserId = user_id;
      let doctorName = full_name;
      let doctorEmail = email.toLowerCase().trim();
      let doctorPhone = phone;

      // If existing user_id provided, look up profile
      if (linkedUserId) {
        const existingUser = mockDb.users.find(u => u.id === linkedUserId);
        if (existingUser) {
          doctorName = doctorName || existingUser.full_name;
          doctorEmail = doctorEmail || existingUser.email;
          doctorPhone = doctorPhone || existingUser.phone;
          if (password) existingUser.password = password;
        }
      } else {
        // Check if user with this email already exists
        const existingByEmail = mockDb.users.find(u => u.email && u.email.toLowerCase() === doctorEmail);
        if (existingByEmail) {
          linkedUserId = existingByEmail.id;
          doctorName = doctorName || existingByEmail.full_name;
          doctorPhone = doctorPhone || existingByEmail.phone;
          if (password) existingByEmail.password = password;
        } else {
          // Create user account for doctor with password
          linkedUserId = `usr-doc-${Date.now()}`;
          const newUser = {
            id: linkedUserId,
            email: doctorEmail,
            password: doctorPassword,
            full_name: doctorName || 'Dr. Specialist',
            role: 'doctor',
            phone: doctorPhone || '+1-555-0199',
            is_active: true,
            created_at: new Date().toISOString()
          };
          mockDb.users.unshift(newUser);
        }
      }

      const newDoc = {
        id: `doc-${Date.now()}`,
        user_id: linkedUserId,
        doctor_number: doctorNumber,
        specialization: specialization || 'General Medicine',
        consultation_fee: parseFloat(consultation_fee) || 60.00,
        room_number: room_number || 'Suite 101',
        license_number: license_number || `MED-${random}`,
        bio: bio || 'Clinic attending physician.',
        is_available: true,
        full_name: doctorName,
        email: doctorEmail,
        phone: doctorPhone,
        profiles: {
          full_name: doctorName,
          email: doctorEmail,
          phone: doctorPhone
        },
        schedules: [
          { day_of_week: 1, start_time: '09:00', end_time: '17:00', max_patients: 15, is_available: true },
          { day_of_week: 2, start_time: '09:00', end_time: '17:00', max_patients: 15, is_available: true },
          { day_of_week: 3, start_time: '09:00', end_time: '17:00', max_patients: 15, is_available: true },
          { day_of_week: 4, start_time: '09:00', end_time: '17:00', max_patients: 15, is_available: true },
          { day_of_week: 5, start_time: '09:00', end_time: '14:00', max_patients: 10, is_available: true }
        ],
        created_at: new Date().toISOString()
      };

      mockDb.doctors.unshift(newDoc);
      return res.status(201).json(newDoc);
    }

    let authUserId = user_id;
    if (!authUserId) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password: doctorPassword,
        email_confirm: true
      });
      if (authError) return res.status(400).json({ error: authError.message });
      authUserId = authData.user.id;
      await supabaseAdmin.from('profiles').insert({
        id: authUserId,
        email: email.toLowerCase().trim(),
        full_name,
        role: 'doctor',
        phone: phone || null
      });
    }

    const docLicense = license_number || `LIC-${random}`;
    // Check duplicate license
    const { data: existingLic } = await supabaseAdmin
      .from('doctors')
      .select('id')
      .eq('license_number', docLicense)
      .maybeSingle();

    if (existingLic) {
      return res.status(400).json({ error: 'A doctor with this license number already exists' });
    }

    const { data, error } = await supabaseAdmin
      .from('doctors')
      .insert({
        profile_id: authUserId,
        doctor_number: doctorNumber,
        specialization: specialization || 'General Medicine',
        consultation_fee: parseFloat(consultation_fee) || 60.00,
        license_number: docLicense,
        qualification: req.body.qualification || 'MBBS',
        years_experience: parseInt(req.body.years_experience) || 5,
        bio: bio || null,
        is_available: true
      })
      .select('*, profiles(full_name, email, phone)')
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Seed default schedules Monday to Friday
    const defaultSchedules = [1, 2, 3, 4, 5].map(day => ({
      doctor_id: data.id,
      day_of_week: day,
      start_time: '09:00:00',
      end_time: '17:00:00',
      max_patients: 20,
      is_available: true
    }));
    await supabaseAdmin.from('doctor_schedules').insert(defaultSchedules).catch(() => {});

    res.status(201).json(data);
  } catch (err) {
    console.error('Create doctor error:', err);
    res.status(500).json({ error: 'Failed to create doctor' });
  }
});

// PUT /api/doctors/:id
router.put('/:id', authenticate, authorize('admin', 'doctor'), async (req, res) => {
  if (isDemoMode()) {
    const idx = mockDb.doctors.findIndex(d => d.id === req.params.id || d.user_id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Doctor not found' });

    mockDb.doctors[idx] = {
      ...mockDb.doctors[idx],
      ...req.body
    };

    if (req.body.full_name || req.body.email || req.body.phone) {
      if (!mockDb.doctors[idx].profiles) mockDb.doctors[idx].profiles = {};
      if (req.body.full_name) {
        mockDb.doctors[idx].full_name = req.body.full_name;
        mockDb.doctors[idx].profiles.full_name = req.body.full_name;
      }
      if (req.body.email) {
        mockDb.doctors[idx].email = req.body.email;
        mockDb.doctors[idx].profiles.email = req.body.email;
      }
      if (req.body.phone) {
        mockDb.doctors[idx].phone = req.body.phone;
        mockDb.doctors[idx].profiles.phone = req.body.phone;
      }
      // Also update mockDb.users
      const uIdx = mockDb.users.findIndex(u => u.id === mockDb.doctors[idx].user_id);
      if (uIdx !== -1) {
        if (req.body.full_name) mockDb.users[uIdx].full_name = req.body.full_name;
        if (req.body.email) mockDb.users[uIdx].email = req.body.email;
        if (req.body.phone) mockDb.users[uIdx].phone = req.body.phone;
        if (req.body.password) mockDb.users[uIdx].password = req.body.password;
      }
    }

    return res.json(mockDb.doctors[idx]);
  }
  try {
    const { doctor_number, created_at, password, full_name, email, phone, ...updateData } = req.body;

    const { data: docData } = await supabaseAdmin
      .from('doctors')
      .select('profile_id')
      .eq('id', req.params.id)
      .single();

    const targetProfileId = docData?.profile_id;

    if (targetProfileId) {
      if (password) {
        await supabaseAdmin.auth.admin.updateUserById(targetProfileId, { password }).catch(() => {});
      }
      if (full_name || phone || email) {
        const profUpdates = {};
        if (full_name) profUpdates.full_name = full_name;
        if (phone) profUpdates.phone = phone;
        if (email) profUpdates.email = email;
        await supabaseAdmin.from('profiles').update(profUpdates).eq('id', targetProfileId);
      }
    }

    // Clean updateData for doctors table
    delete updateData.profiles;
    delete updateData.user_id;
    delete updateData.id;

    const { data, error } = await supabaseAdmin
      .from('doctors')
      .update(updateData)
      .eq('id', req.params.id)
      .select('*, profiles(full_name, email, phone)')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update doctor' });
  }
});

// DELETE /api/doctors/:id (Admin only - remove doctor)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    if (isDemoMode()) {
      const idx = mockDb.doctors.findIndex(d => d.id === req.params.id || d.user_id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'Doctor not found' });
      const removed = mockDb.doctors.splice(idx, 1)[0];
      // Also deactivate or mark user
      const uIdx = mockDb.users.findIndex(u => u.id === removed.user_id);
      if (uIdx !== -1) {
        mockDb.users[uIdx].is_active = false;
      }
      return res.json({ message: 'Doctor removed successfully', id: req.params.id, doctor: removed });
    }

    const { error } = await supabaseAdmin.from('doctors').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Doctor removed successfully', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove doctor' });
  }
});

// GET /api/doctors/:id/schedule
router.get('/:id/schedule', authenticate, async (req, res) => {
  if (isDemoMode()) {
    // Return a simple weekly schedule mock
    const mockSchedule = [
      { day_of_week: 1, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30, is_active: true },
      { day_of_week: 2, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30, is_active: true },
      { day_of_week: 3, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30, is_active: true },
      { day_of_week: 4, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30, is_active: true },
      { day_of_week: 5, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30, is_active: true }
    ];
    return res.json(mockSchedule);
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('doctor_schedules')
      .select('*')
      .eq('doctor_id', req.params.id)
      .eq('is_active', true)
      .order('day_of_week');

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// POST /api/doctors/:id/schedule
router.post('/:id/schedule', authenticate, authorize('admin', 'doctor'), async (req, res) => {
  if (isDemoMode()) {
    // Just echo back the schedule array the client sent
    return res.json(Array.isArray(req.body) ? req.body : [req.body]);
  }
  try {
    const schedules = Array.isArray(req.body) ? req.body : [req.body];
    const toInsert = schedules.map(s => ({ ...s, doctor_id: req.params.id }));

    // Upsert schedules
    const { data, error } = await supabaseAdmin
      .from('doctor_schedules')
      .upsert(toInsert, { onConflict: 'doctor_id,day_of_week' })
      .select();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// GET /api/doctors/:id/availability
router.get('/:id/availability', authenticate, async (req, res) => {
  if (isDemoMode()) {
    // Simple static availability for demo – all slots open for a given date
    const slots = [];
    for (let h = 9; h < 17; h++) {
      const time = `${String(h).padStart(2, '0')}:00`;
      slots.push({ time, available: true });
    }
    return res.json({ available: true, schedule: { start_time: '09:00', end_time: '17:00', slot_duration_minutes: 60 }, slots });
  }
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date required' });

    const dayOfWeek = new Date(date).getDay();

    const [scheduleResult, appointmentsResult] = await Promise.all([
      supabaseAdmin.from('doctor_schedules').select('*').eq('doctor_id', req.params.id).eq('day_of_week', dayOfWeek).eq('is_active', true).single(),
      supabaseAdmin.from('appointments').select('appointment_time, duration_minutes').eq('doctor_id', req.params.id).eq('appointment_date', date).neq('status', 'cancelled')
    ]);

    if (!scheduleResult.data) {
      return res.json({ available: false, slots: [], message: 'Doctor not available on this day' });
    }

    const schedule = scheduleResult.data;
    const bookedTimes = appointmentsResult.data || [];

    // Generate time slots
    const slots = [];
    const start = schedule.start_time.split(':').map(Number);
    const end = schedule.end_time.split(':').map(Number);
    const duration = schedule.slot_duration_minutes;

    let current = start[0] * 60 + start[1];
    const endMinutes = end[0] * 60 + end[1];

    while (current + duration <= endMinutes) {
      const hours = Math.floor(current / 60);
      const mins = current % 60;
      const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

      const isBooked = bookedTimes.some(b => b.appointment_time.slice(0, 5) === timeStr);

      slots.push({ time: timeStr, available: !isBooked });
      current += duration;
    }

    res.json({ available: true, schedule, slots });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// GET /api/doctors/specializations
router.get('/meta/specializations', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('doctors')
      .select('specialization')
      .order('specialization');

    if (error) return res.status(400).json({ error: error.message });
    const unique = [...new Set(data.map(d => d.specialization))];
    res.json(unique);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch specializations' });
  }
});

module.exports = router;
