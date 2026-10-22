const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const mockDb = require('../mockDb');

// GET /api/notifications
router.get('/', authenticate, async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      return res.json({ notifications: mockDb.notifications });
    }

    const { is_read, limit = 50 } = req.query;
    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id);

    if (is_read !== undefined) query = query.eq('is_read', is_read === 'true');

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) return res.status(400).json({ error: error.message });
    res.json({ notifications: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const notif = mockDb.notifications.find(n => n.id === req.params.id);
      if (notif) notif.is_read = true;
      return res.json(notif || { is_read: true });
    }

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// PUT /api/notifications/read-all/mark
router.put('/read-all/mark', authenticate, async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      mockDb.notifications.forEach(n => n.is_read = true);
      return res.json({ message: 'All notifications marked as read' });
    }

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// GET /api/notifications/unread/count
router.get('/unread/count', authenticate, async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const unread = mockDb.notifications.filter(n => !n.is_read).length;
      return res.json({ count: unread });
    }

    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ count: count || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

module.exports = router;
