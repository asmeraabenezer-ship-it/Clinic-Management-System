const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validate');
const jwt = require('jsonwebtoken');
const { logAudit } = require('../middleware/audit');

// ============================================================
// DEMO MODE - Works without Supabase configured
// ============================================================
const DEMO_USERS = {
  'admin@clinic.com':        { password: 'Admin@123456',  role: 'admin',         full_name: 'System Administrator', phone: '+1-555-0100' },
  'dr.smith@clinic.com':     { password: 'Doctor@123456', role: 'doctor',        full_name: 'Dr. Sarah Smith',       phone: '+1-555-0101' },
  'receptionist@clinic.com': { password: 'Recept@123456', role: 'receptionist',  full_name: 'Emily Johnson',         phone: '+1-555-0102' },
  'nurse@clinic.com':        { password: 'Nurse@123456',  role: 'nurse',         full_name: 'Nurse Maria Garcia',    phone: '+1-555-0103' },
  'pharmacist@clinic.com':   { password: 'Pharma@123456', role: 'pharmacist',    full_name: 'James Wilson',          phone: '+1-555-0104' },
  'laboratorist@clinic.com': { password: 'Lab@123456',    role: 'laboratorist',  full_name: 'David Chen (MLS)',      phone: '+1-555-0106' },
  'cashier@clinic.com':      { password: 'Cashier@123456', role: 'cashier',       full_name: 'Grace Hopper (Cashier)', phone: '+1-555-0107' },
};

const isDemoMode = () => {
  return !process.env.SUPABASE_URL ||
    process.env.SUPABASE_URL.includes('your-project-id') ||
    process.env.SUPABASE_URL.includes('placeholder');
};

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { email, password } = req.body;

    // --- DEMO MODE (no Supabase configured) ---
    if (isDemoMode()) {
      const mockDb = require('../mockDb');
      const normalizedEmail = email.toLowerCase().trim();
      const dbUser = mockDb.users.find(u => u.email && u.email.toLowerCase() === normalizedEmail);
      const demoUser = DEMO_USERS[normalizedEmail];

      const userRecord = dbUser || demoUser;
      if (!userRecord) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const expectedPassword = userRecord.password || 'Doctor@123456';
      if (expectedPassword !== password) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (userRecord.is_active === false) {
        return res.status(403).json({ error: 'Account is deactivated. Contact administrator.' });
      }

      const userId = userRecord.id || `demo-${normalizedEmail.replace(/[@.]/g, '-')}`;
      const userRole = userRecord.role;
      const userFullName = userRecord.full_name;
      const userPhone = userRecord.phone || null;

      const token = jwt.sign(
        { id: userId, email: normalizedEmail, role: userRole, full_name: userFullName, demo: true },
        process.env.JWT_SECRET || 'cliniccare-demo-secret',
        { expiresIn: '8h' }
      );
      return res.json({
        token,
        refresh_token: 'demo-refresh-token',
        user: { id: userId, email: normalizedEmail, full_name: userFullName, role: userRole, phone: userPhone, avatar_url: null },
        demo_mode: true
      });
    }

    // --- PRODUCTION MODE (Supabase configured) ---
    const normalizedEmail = email.toLowerCase().trim();
    let { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

    // If login failed, check if it's a defined demo user with valid demo credentials
    if (error && DEMO_USERS[normalizedEmail] && DEMO_USERS[normalizedEmail].password === password) {
      const demoUser = DEMO_USERS[normalizedEmail];
      try {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        let authUser = listData?.users?.find(u => u.email && u.email.toLowerCase() === normalizedEmail);

        if (!authUser) {
          const { data: newAuth, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            password: demoUser.password,
            email_confirm: true,
            user_metadata: { full_name: demoUser.full_name, role: demoUser.role }
          });
          if (!createErr && newAuth?.user) authUser = newAuth.user;
        } else {
          await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
            password: demoUser.password,
            email_confirm: true,
            user_metadata: { full_name: demoUser.full_name, role: demoUser.role }
          });
        }

        if (authUser) {
          await supabaseAdmin.from('profiles').upsert({
            id: authUser.id,
            email: normalizedEmail,
            full_name: demoUser.full_name,
            role: demoUser.role,
            phone: demoUser.phone || null,
            is_active: true
          });

          const retry = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
          if (!retry.error && retry.data) {
            data = retry.data;
            error = null;
          }
        }
      } catch (provisionErr) {
        console.error('Demo auto-provision error:', provisionErr);
      }
    }

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    // Get profile
    let { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // Auto-create missing profile for demo users if it doesn't exist yet
    if ((profileError || !profile) && DEMO_USERS[normalizedEmail]) {
      const demoUser = DEMO_USERS[normalizedEmail];
      const { data: upsertedProfile } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: normalizedEmail,
          full_name: demoUser.full_name,
          role: demoUser.role,
          phone: demoUser.phone || null,
          is_active: true
        })
        .select()
        .single();

      if (upsertedProfile) {
        profile = upsertedProfile;
        profileError = null;
      }
    }

    if (profileError || !profile) {
      return res.status(401).json({ error: 'User profile not found' });
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      return res.status(403).json({ error: 'Account is deactivated. Contact administrator.' });
    }

    res.json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        phone: profile.phone,
        avatar_url: profile.avatar_url
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    await supabase.auth.signOut();
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    full_name: req.user.full_name,
    role: req.user.role,
    phone: req.user.phone,
    avatar_url: req.user.avatar_url
  });
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'Refresh token required' });

    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error) return res.status(401).json({ error: error.message });

    res.json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token
    });
  } catch (err) {
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// POST /api/auth/create-user (admin only - only admin can add doctor or other roles by email and password)
router.post('/create-user', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required to create staff users' });
    }

    const {
      email,
      password,
      full_name,
      role,
      phone,
      specialization,
      license_number,
      qualification,
      consultation_fee,
      years_experience,
      bio
    } = req.body;

    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Email, password, full name, and role are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const validRoles = ['admin', 'doctor', 'receptionist', 'nurse', 'pharmacist', 'laboratorist', 'cashier'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (isDemoMode()) {
      const mockDb = require('../mockDb');
      const normalizedEmail = email.toLowerCase().trim();

      const existing = mockDb.users.find(u => u.email && u.email.toLowerCase() === normalizedEmail);
      if (existing) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      const newUser = {
        id: `usr-${Date.now()}`,
        email: normalizedEmail,
        password: password,
        full_name,
        role,
        phone: phone || null,
        is_active: true,
        created_at: new Date().toISOString()
      };
      mockDb.users.unshift(newUser);

      DEMO_USERS[normalizedEmail] = {
        password: password,
        role,
        full_name,
        phone: phone || null
      };

      if (role === 'doctor') {
        const random = Math.floor(Math.random() * 9000) + 1000;
        const newDoc = {
          id: `doc-${Date.now()}`,
          user_id: newUser.id,
          doctor_number: `DOC-${random}`,
          specialization: specialization || 'General Medicine',
          consultation_fee: parseFloat(consultation_fee) || 75.00,
          license_number: license_number || `MED-${random}`,
          qualification: qualification || 'MD, MBBS',
          years_experience: parseInt(years_experience) || 5,
          bio: bio || 'Attending physician appointed by clinic administration.',
          is_available: true,
          full_name,
          email: normalizedEmail,
          phone: phone || null,
          profiles: { full_name, email: normalizedEmail, phone: phone || null },
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
      }

      await logAudit(req, 'staff_register', 'user', newUser.id, { full_name, email: normalizedEmail, role });
      return res.status(201).json({ message: 'User created successfully', user: newUser });
    }

    // Check duplicate doctor license if role === 'doctor'
    if (role === 'doctor' && license_number) {
      const { data: existingLic } = await supabaseAdmin
        .from('doctors')
        .select('id')
        .eq('license_number', license_number)
        .maybeSingle();

      if (existingLic) {
        return res.status(400).json({ error: 'A doctor with this license number already exists' });
      }
    }

    // Create auth user securely on server-side
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) return res.status(400).json({ error: authError.message });

    // Create profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name,
        role,
        phone: phone || null,
        is_active: true
      })
      .select()
      .single();

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ error: profileError.message });
    }

    // If role is doctor, create doctors record
    if (role === 'doctor') {
      const random = Math.floor(Math.random() * 9000) + 1000;
      const docLicense = license_number || `LIC-${random}`;
      const { data: createdDoc, error: docError } = await supabaseAdmin
        .from('doctors')
        .insert({
          profile_id: authData.user.id,
          doctor_number: `DR-${new Date().getFullYear()}-${random}`,
          specialization: specialization || 'General Medicine',
          license_number: docLicense,
          qualification: qualification || 'MD, MBBS',
          years_experience: parseInt(years_experience) || 5,
          consultation_fee: parseFloat(consultation_fee) || 75.00,
          bio: bio || null,
          is_available: true
        })
        .select()
        .single();

      if (!docError && createdDoc) {
        // Seed standard schedules
        const defaultSchedules = [1, 2, 3, 4, 5].map(d => ({
          doctor_id: createdDoc.id,
          day_of_week: d,
          start_time: '09:00:00',
          end_time: '17:00:00',
          max_patients: 20,
          is_available: true
        }));
        await supabaseAdmin.from('doctor_schedules').insert(defaultSchedules).catch(() => {});
      }
    }

    await logAudit(req, 'staff_register', 'user', profile.id, { full_name, email, role });
    res.status(201).json({ message: 'User created successfully', user: profile });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// GET /api/auth/users (admin only)
router.get('/users', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { search, role, status } = req.query;

    if (isDemoMode()) {
      const mockDb = require('../mockDb');
      let list = [...mockDb.users];
      if (role) list = list.filter(u => u.role === role);
      if (status === 'active') list = list.filter(u => u.is_active);
      if (status === 'inactive') list = list.filter(u => !u.is_active);
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(u => u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
      }
      return res.json(list);
    }

    let query = supabaseAdmin
      .from('profiles')
      .select('*, doctors(*)')
      .order('created_at', { ascending: false });

    if (role) query = query.eq('role', role);
    if (status === 'active') query = query.eq('is_active', true);
    if (status === 'inactive') query = query.eq('is_active', false);

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });

    let filtered = data || [];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(u =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q)
      );
    }

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /api/auth/users/:id (admin only)
router.put('/users/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (isDemoMode()) {
      const mockDb = require('../mockDb');
      const idx = mockDb.users.findIndex(u => u.id === req.params.id);
      if (idx !== -1) {
        mockDb.users[idx] = { ...mockDb.users[idx], ...req.body };
        if (mockDb.users[idx].email) {
          DEMO_USERS[mockDb.users[idx].email.toLowerCase()] = {
            password: mockDb.users[idx].password || 'Doctor@123456',
            role: mockDb.users[idx].role,
            full_name: mockDb.users[idx].full_name,
            phone: mockDb.users[idx].phone
          };
        }
        await logAudit(req, 'staff_update', 'user', req.params.id, req.body);
        return res.json(mockDb.users[idx]);
      }
      return res.json({ id: req.params.id, ...req.body });
    }

    const {
      full_name,
      role,
      phone,
      is_active,
      password,
      specialization,
      license_number,
      qualification,
      consultation_fee,
      years_experience,
      bio
    } = req.body;

    if (password) {
      await supabaseAdmin.auth.admin.updateUserById(req.params.id, { password }).catch(() => {});
      await logAudit(req, 'password_reset', 'user', req.params.id, { initiated_by: req.user.id });
    }

    const profileUpdates = {};
    if (full_name !== undefined) profileUpdates.full_name = full_name;
    if (role !== undefined) profileUpdates.role = role;
    if (phone !== undefined) profileUpdates.phone = phone;
    if (is_active !== undefined) profileUpdates.is_active = is_active;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // If user is a doctor or editing doctor details
    if (role === 'doctor' || specialization || license_number || consultation_fee !== undefined) {
      const docUpdates = {};
      if (specialization) docUpdates.specialization = specialization;
      if (license_number) docUpdates.license_number = license_number;
      if (qualification) docUpdates.qualification = qualification;
      if (consultation_fee !== undefined) docUpdates.consultation_fee = parseFloat(consultation_fee);
      if (years_experience !== undefined) docUpdates.years_experience = parseInt(years_experience);
      if (bio !== undefined) docUpdates.bio = bio;

      if (Object.keys(docUpdates).length > 0) {
        await supabaseAdmin.from('doctors').update(docUpdates).eq('profile_id', req.params.id);
      }
    }

    await logAudit(req, is_active !== undefined ? 'staff_toggle_active' : 'staff_update', 'user', req.params.id, profileUpdates);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/auth/users/:id (admin only - soft delete / deactivate preferred)
router.delete('/users/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete your own admin account' });
    }

    if (isDemoMode()) {
      const mockDb = require('../mockDb');
      const idx = mockDb.users.findIndex(u => u.id === req.params.id);
      if (idx !== -1) {
        const removed = mockDb.users.splice(idx, 1)[0];
        const docIdx = mockDb.doctors.findIndex(d => d.user_id === req.params.id || d.id === req.params.id);
        if (docIdx !== -1) mockDb.doctors.splice(docIdx, 1);
        await logAudit(req, 'staff_delete', 'user', req.params.id, { name: removed.full_name });
        return res.json({ message: 'User deleted successfully', user: removed });
      }
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has associated medical records, appointments, visits, or invoices
    const [appts, visits] = await Promise.all([
      supabaseAdmin.from('appointments').select('id', { count: 'exact', head: true }).eq('doctor_id', req.params.id),
      supabaseAdmin.from('patient_visits').select('id', { count: 'exact', head: true }).eq('doctor_id', req.params.id)
    ]);

    if ((appts.count || 0) > 0 || (visits.count || 0) > 0) {
      // Deactivate instead of hard delete to preserve historical medical records
      await supabaseAdmin.from('profiles').update({ is_active: false }).eq('id', req.params.id);
      await logAudit(req, 'staff_deactivate_preserve_history', 'user', req.params.id, { reason: 'Has historical clinical records' });
      return res.json({ message: 'User deactivated to preserve historical clinical and financial records.' });
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', req.params.id);

    try {
      await supabaseAdmin.auth.admin.deleteUser(req.params.id);
    } catch (e) {}

    await logAudit(req, 'staff_delete', 'user', req.params.id, {});
    if (profileError) return res.status(400).json({ error: profileError.message });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// POST /api/auth/assume/:id (admin only - assume / act as doctor or staff)
router.post('/assume/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required to assume role' });
    }

    const targetId = req.params.id;

    if (isDemoMode()) {
      const mockDb = require('../mockDb');
      let targetUser = mockDb.users.find(u => u.id === targetId || u.email === targetId);

      // If not directly in users, check if targetId matches a doctor ID
      if (!targetUser) {
        const doc = mockDb.doctors.find(d => d.id === targetId || d.user_id === targetId);
        if (doc) {
          targetUser = mockDb.users.find(u => u.id === doc.user_id) || {
            id: doc.user_id || doc.id,
            email: doc.email || 'doctor@clinic.com',
            full_name: doc.full_name || doc.profiles?.full_name || 'Dr. Attending',
            role: 'doctor',
            phone: doc.phone || ''
          };
        }
      }

      if (!targetUser) {
        return res.status(404).json({ error: 'Target user/doctor not found' });
      }

      const token = jwt.sign(
        {
          id: targetUser.id,
          email: targetUser.email,
          role: targetUser.role,
          full_name: targetUser.full_name,
          demo: true,
          assumed_by: req.user.id
        },
        process.env.JWT_SECRET || 'cliniccare-demo-secret',
        { expiresIn: '8h' }
      );

      return res.json({
        token,
        refresh_token: 'demo-refresh-token',
        user: {
          id: targetUser.id,
          email: targetUser.email,
          full_name: targetUser.full_name,
          role: targetUser.role,
          phone: targetUser.phone,
          avatar_url: targetUser.avatar_url || null
        },
        assumed: true,
        assumed_by: {
          id: req.user.id,
          email: req.user.email,
          full_name: req.user.full_name
        }
      });
    }

    // Production Supabase mode
    let { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .single();

    if (error || !profile) {
      // Check if targetId is doctor id
      const { data: doc } = await supabaseAdmin
        .from('doctors')
        .select('*, profiles(*)')
        .eq('id', targetId)
        .single();
      if (doc?.profiles) profile = doc.profiles;
    }

    if (!profile) return res.status(404).json({ error: 'User not found' });

    const token = jwt.sign(
      {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        full_name: profile.full_name,
        assumed_by: req.user.id
      },
      process.env.JWT_SECRET || 'cliniccare-secret',
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: profile,
      assumed: true,
      assumed_by: {
        id: req.user.id,
        email: req.user.email,
        full_name: req.user.full_name
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assume role' });
  }
});

// PUT /api/auth/change-password
router.put('/change-password', authenticate, [
  body('new_password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  handleValidationErrors
], async (req, res) => {
  try {
    if (isDemoMode()) {
      return res.json({ message: 'Password changed successfully' });
    }

    const { new_password } = req.body;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, { password: new_password });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
