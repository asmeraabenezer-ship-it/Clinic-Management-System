const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');

// Default in-memory settings fallback
let defaultSettings = {
  id: 'clinic-settings-default',
  clinic_name: 'ClinicCare Pro',
  clinic_address: '100 Medical Center Blvd, Suite 400',
  clinic_phone: '+1-555-0100',
  clinic_email: 'admin@clinic.com',
  clinic_logo: '',
  default_consultation_fee: 75.00,
  appointment_slot_duration: 30,
  waiting_time_threshold_minutes: 30,
  notification_preferences: {
    email: true,
    sms: false,
    in_app: true,
    low_stock_alerts: true
  },
  updated_at: new Date().toISOString()
};

// GET /api/settings - Read clinic settings (authenticated staff)
router.get('/', authenticate, async (req, res) => {
  try {
    if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('placeholder')) {
      const { data, error } = await supabaseAdmin
        .from('clinic_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return res.json(data);
      }
    }

    res.json(defaultSettings);
  } catch (err) {
    console.error('Fetch settings error:', err);
    res.json(defaultSettings);
  }
});

// PUT /api/settings - Update clinic settings (admin only)
router.put('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const {
      clinic_name,
      clinic_address,
      clinic_phone,
      clinic_email,
      clinic_logo,
      default_consultation_fee,
      appointment_slot_duration,
      waiting_time_threshold_minutes,
      notification_preferences
    } = req.body;

    const updates = {
      clinic_name: clinic_name || defaultSettings.clinic_name,
      clinic_address: clinic_address || defaultSettings.clinic_address,
      clinic_phone: clinic_phone || defaultSettings.clinic_phone,
      clinic_email: clinic_email || defaultSettings.clinic_email,
      clinic_logo: clinic_logo !== undefined ? clinic_logo : defaultSettings.clinic_logo,
      default_consultation_fee: parseFloat(default_consultation_fee) || 75.00,
      appointment_slot_duration: parseInt(appointment_slot_duration) || 30,
      waiting_time_threshold_minutes: parseInt(waiting_time_threshold_minutes) || 30,
      notification_preferences: notification_preferences || defaultSettings.notification_preferences,
      updated_at: new Date().toISOString()
    };

    if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('placeholder')) {
      // Check if row exists
      const { data: existing } = await supabaseAdmin
        .from('clinic_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      let result;
      if (existing) {
        result = await supabaseAdmin
          .from('clinic_settings')
          .update(updates)
          .eq('id', existing.id)
          .select()
          .single();
      } else {
        result = await supabaseAdmin
          .from('clinic_settings')
          .insert(updates)
          .select()
          .single();
      }

      if (!result.error && result.data) {
        defaultSettings = { ...defaultSettings, ...result.data };
        await logAudit(req, 'settings_update', 'settings', result.data.id, updates);
        return res.json(result.data);
      }
    }

    defaultSettings = { ...defaultSettings, ...updates };
    await logAudit(req, 'settings_update', 'settings', 'default', updates);
    res.json(defaultSettings);
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update system settings' });
  }
});

module.exports = router;
