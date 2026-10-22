const { supabaseAdmin } = require('../config/supabase');

// In-memory fallback if audit_logs table has not been created yet in Supabase
const memoryAuditLogs = [];

/**
 * Log an audit action securely from server-side.
 * @param {Object} req Express request object (contains user info and ip)
 * @param {string} action Action name (e.g. 'staff_create', 'role_change', 'status_update')
 * @param {string} entityType Entity type ('user', 'doctor', 'patient', 'appointment', 'visit', 'medicine', 'settings')
 * @param {string} entityId Primary key or identifier of affected entity
 * @param {Object} details Additional structured details (excluding sensitive credentials)
 */
async function logAudit(req, action, entityType, entityId, details = {}) {
  try {
    const userId = req?.user?.id || null;
    const ipAddress = req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '127.0.0.1';

    // Strip passwords or tokens if accidentally passed
    const sanitizedDetails = { ...details };
    delete sanitizedDetails.password;
    delete sanitizedDetails.token;
    delete sanitizedDetails.access_token;
    delete sanitizedDetails.refresh_token;

    const entry = {
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: String(entityId || ''),
      details: sanitizedDetails,
      ip_address: ipAddress,
      created_at: new Date().toISOString()
    };

    // Try Supabase DB insert
    if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('placeholder')) {
      const { error } = await supabaseAdmin.from('audit_logs').insert(entry);
      if (error) {
        // Table might not exist yet; store in memory fallback
        memoryAuditLogs.unshift({ ...entry, id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` });
      }
    } else {
      memoryAuditLogs.unshift({ ...entry, id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` });
    }
  } catch (err) {
    console.warn('Audit log write error:', err.message);
  }
}

/**
 * Retrieve audit logs with filtering and pagination
 */
async function getAuditLogs({ user_id, action, entity_type, date_from, date_to, limit = 50, page = 1 }) {
  try {
    const offset = (parseInt(page) - 1) * parseInt(limit);

    if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('placeholder')) {
      let query = supabaseAdmin
        .from('audit_logs')
        .select('*, profiles(full_name, email, role)', { count: 'exact' });

      if (user_id) query = query.eq('user_id', user_id);
      if (action) query = query.eq('action', action);
      if (entity_type) query = query.eq('entity_type', entity_type);
      if (date_from) query = query.gte('created_at', date_from);
      if (date_to) query = query.lte('created_at', date_to + 'T23:59:59.999Z');

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);

      if (!error && data) {
        return { data, total: count || data.length, page: parseInt(page), limit: parseInt(limit) };
      }
    }

    // Memory fallback
    let list = [...memoryAuditLogs];
    if (user_id) list = list.filter(l => l.user_id === user_id);
    if (action) list = list.filter(l => l.action === action);
    if (entity_type) list = list.filter(l => l.entity_type === entity_type);
    if (date_from) list = list.filter(l => l.created_at >= date_from);
    if (date_to) list = list.filter(l => l.created_at <= date_to + 'T23:59:59.999Z');

    const total = list.length;
    const paginated = list.slice(offset, offset + parseInt(limit));
    return { data: paginated, total, page: parseInt(page), limit: parseInt(limit) };
  } catch (err) {
    console.error('Fetch audit logs error:', err);
    return { data: [], total: 0, page: 1, limit };
  }
}

module.exports = { logAudit, getAuditLogs };
