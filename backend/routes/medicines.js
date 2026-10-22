const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const mockDb = require('../mockDb');

const generateMedicineCode = () => `MED${String(Math.floor(Math.random() * 9000) + 1000)}`;

// GET /api/medicines
router.get('/', authenticate, async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const { search, category, low_stock, page = 1, limit = 20 } = req.query;
      let filtered = mockDb.medicines.filter(m => m.is_active);
      if (category) filtered = filtered.filter(m => m.category === category);
      if (low_stock === 'true') filtered = filtered.filter(m => m.stock_quantity <= m.minimum_stock_level);
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(m =>
          m.name.toLowerCase().includes(q) ||
          m.generic_name.toLowerCase().includes(q) ||
          (m.batch_number && m.batch_number.toLowerCase().includes(q))
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

    const { search, category, dosage_form, low_stock, expiring_soon, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('medicines')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    if (category) query = query.eq('category', category);
    if (dosage_form) query = query.eq('dosage_form', dosage_form);

    if (low_stock === 'true') {
      query = query.filter('stock_quantity', 'lte', 'minimum_stock_level');
    }

    if (expiring_soon === 'true') {
      const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      query = query.lte('expiry_date', thirtyDaysLater);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,generic_name.ilike.%${search}%,medicine_code.ilike.%${search}%,category.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order('name', { ascending: true })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ data, pagination: { page: parseInt(page), limit: parseInt(limit), total: count, pages: Math.ceil(count / parseInt(limit)) } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch medicines' });
  }
});

// GET /api/medicines/alerts
router.get('/alerts', authenticate, async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      return res.json({
        low_stock: mockDb.medicines.filter(m => m.stock_quantity <= m.minimum_stock_level),
        expiring: [mockDb.medicines[1]]
      });
    }

    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const [lowStock, expiring] = await Promise.all([
      supabaseAdmin.from('medicines').select('*').filter('stock_quantity', 'lte', 'minimum_stock_level').eq('is_active', true),
      supabaseAdmin.from('medicines').select('*').lte('expiry_date', thirtyDaysFromNow).gt('stock_quantity', 0).eq('is_active', true)
    ]);

    res.json({ low_stock: lowStock.data || [], expiring: expiring.data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inventory alerts' });
  }
});

// POST /api/medicines
router.post('/', authenticate, authorize('pharmacist', 'admin'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const newMed = {
        id: `med-${Date.now()}`,
        medicine_code: generateMedicineCode(),
        ...req.body,
        is_active: true
      };
      mockDb.medicines.unshift(newMed);
      return res.status(201).json(newMed);
    }

    const medicineCode = generateMedicineCode();
    const { data, error } = await supabaseAdmin
      .from('medicines')
      .insert({ ...req.body, medicine_code: medicineCode })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create medicine' });
  }
});

// PUT /api/medicines/:id
router.put('/:id', authenticate, authorize('pharmacist', 'admin'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const idx = mockDb.medicines.findIndex(m => m.id === req.params.id);
      if (idx !== -1) {
        mockDb.medicines[idx] = { ...mockDb.medicines[idx], ...req.body };
        return res.json(mockDb.medicines[idx]);
      }
      return res.json({ id: req.params.id, ...req.body });
    }

    const { data, error } = await supabaseAdmin
      .from('medicines')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    const { logAudit } = require('../middleware/audit');
    await logAudit(req, 'medicine_update', 'medicine', req.params.id, { name: data.name });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update medicine' });
  }
});

// POST /api/medicines/:id/adjust-stock (Admin & Pharmacist)
router.post('/:id/adjust-stock', authenticate, authorize('pharmacist', 'admin'), async (req, res) => {
  try {
    const { change_type = 'adjustment', quantity, reason } = req.body;
    const qty = parseInt(quantity);

    if (isNaN(qty) || qty === 0) {
      return res.status(400).json({ error: 'Valid non-zero quantity is required' });
    }
    if (!reason) {
      return res.status(400).json({ error: 'Reason for stock adjustment is required' });
    }

    if (mockDb.isDemoMode()) {
      const med = mockDb.medicines.find(m => m.id === req.params.id);
      if (!med) return res.status(404).json({ error: 'Medicine not found' });
      const prev = med.stock_quantity;
      const next = change_type === 'addition' || change_type === 'return' ? prev + Math.abs(qty) : Math.max(0, prev - Math.abs(qty));
      med.stock_quantity = next;
      return res.json({ message: 'Stock adjusted successfully', previous_stock: prev, new_stock: next, medicine: med });
    }

    // Supabase mode
    const { data: med, error: fetchErr } = await supabaseAdmin
      .from('medicines')
      .select('id, name, stock_quantity')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !med) return res.status(404).json({ error: 'Medicine not found' });

    const prevStock = med.stock_quantity || 0;
    let nextStock = prevStock;

    if (change_type === 'addition' || change_type === 'return') {
      nextStock = prevStock + Math.abs(qty);
    } else {
      if (prevStock < Math.abs(qty)) {
        return res.status(400).json({ error: `Cannot subtract ${Math.abs(qty)} units. Only ${prevStock} units in stock.` });
      }
      nextStock = Math.max(0, prevStock - Math.abs(qty));
    }

    // Update medicine stock
    const { data: updatedMed, error: updateErr } = await supabaseAdmin
      .from('medicines')
      .update({ stock_quantity: nextStock, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateErr) return res.status(400).json({ error: updateErr.message });

    // Insert movement record if table exists
    await supabaseAdmin.from('inventory_movements').insert({
      medicine_id: req.params.id,
      change_type,
      quantity: Math.abs(qty),
      previous_stock: prevStock,
      new_stock: nextStock,
      reason,
      created_by: req.user.id
    }).catch(() => {});

    const { logAudit } = require('../middleware/audit');
    await logAudit(req, 'medicine_stock_adjust', 'medicine', req.params.id, {
      name: med.name,
      change_type,
      quantity: Math.abs(qty),
      previous_stock: prevStock,
      new_stock: nextStock,
      reason
    });

    res.json({
      message: 'Stock adjusted successfully',
      previous_stock: prevStock,
      new_stock: nextStock,
      medicine: updatedMed
    });
  } catch (err) {
    console.error('Adjust stock error:', err);
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
});

// GET /api/medicines/movements - Stock movement logs
router.get('/movements/history', authenticate, authorize('pharmacist', 'admin'), async (req, res) => {
  try {
    const { medicine_id, limit = 50 } = req.query;

    if (mockDb.isDemoMode()) {
      return res.json([
        { id: 'mov-1', medicine_id: 'med-1', change_type: 'addition', quantity: 100, previous_stock: 400, new_stock: 500, reason: 'Supplier restock BATCH-2024', created_at: new Date().toISOString() }
      ]);
    }

    let query = supabaseAdmin
      .from('inventory_movements')
      .select('*, medicines(name, medicine_code), profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (medicine_id) query = query.eq('medicine_id', medicine_id);

    const { data, error } = await query;
    if (error) {
      // Table might not exist yet; return empty list
      return res.json([]);
    }
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inventory movements' });
  }
});

module.exports = router;
