const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getAuditLogs } = require('../middleware/audit');

// GET /api/audit-logs - Admin access only
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { user_id, action, entity_type, date_from, date_to, page, limit } = req.query;

    const results = await getAuditLogs({
      user_id,
      action,
      entity_type,
      date_from,
      date_to,
      page: page || 1,
      limit: limit || 50
    });

    res.json(results.data || []);
  } catch (err) {
    console.error('Audit logs route error:', err);
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
});

module.exports = router;
