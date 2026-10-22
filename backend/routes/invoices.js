const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const mockDb = require('../mockDb');

const generateInvoiceNumber = () => `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;

// GET /api/invoices  -- financial roles only (cashier, receptionist, admin)
router.get('/', authenticate, requirePermission('invoices', 'read'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const { status, search, page = 1, limit = 20 } = req.query;
      let filtered = [...mockDb.invoices];
      if (status) filtered = filtered.filter(i => i.status === status);
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(i =>
          i.invoice_number?.toLowerCase().includes(q) ||
          i.patients?.first_name?.toLowerCase().includes(q) ||
          i.patients?.last_name?.toLowerCase().includes(q)
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

    const { patient_id, status, page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('invoices')
      .select(`
        *,
        patients(first_name, last_name, patient_number),
        appointments(appointment_date, type)
      `, { count: 'exact' });

    if (patient_id) query = query.eq('patient_id', patient_id);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) return res.status(400).json({ error: error.message });

    let filtered = data || [];
    if (search) {
      filtered = filtered.filter(i =>
        i.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
        i.patients?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
        i.patients?.last_name?.toLowerCase().includes(search.toLowerCase()) ||
        i.patients?.patient_number?.toLowerCase().includes(search.toLowerCase())
      );
    }

    res.json({ data: filtered, pagination: { page: parseInt(page), limit: parseInt(limit), total: count, pages: Math.ceil(count / parseInt(limit)) } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET /api/invoices/:id  -- financial roles only
router.get('/:id', authenticate, requirePermission('invoices', 'read'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const inv = mockDb.invoices.find(i => i.id === req.params.id) || mockDb.invoices[0];
      return res.json(inv);
    }

    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select(`
        *,
        patients(*),
        appointments(*),
        invoice_items(*),
        payments(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Invoice not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// POST /api/invoices  -- receptionist, cashier, admin
router.post('/', authenticate, authorize('receptionist', 'cashier', 'admin'), requirePermission('invoices', 'write'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const pat = mockDb.patients.find(p => p.id === req.body.patient_id) || mockDb.patients[0];
      const items = req.body.items || [];
      const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.total_price) || (parseFloat(item.unit_price) * parseInt(item.quantity || 1))), 0);
      const newInv = {
        id: `inv-${Date.now()}`,
        invoice_number: generateInvoiceNumber(),
        patient_id: req.body.patient_id,
        appointment_id: req.body.appointment_id,
        total_amount: totalAmount || 75.00,
        paid_amount: 0.00,
        balance_amount: totalAmount || 75.00,
        status: 'unpaid',
        due_date: req.body.due_date || new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        patients: { first_name: pat?.first_name || 'Patient', last_name: pat?.last_name || '', patient_number: pat?.patient_number || 'P-100', phone: pat?.phone || '' },
        invoice_items: items
      };
      mockDb.invoices.unshift(newInv);
      return res.status(201).json(newInv);
    }

    const { items, ...invoiceData } = req.body;
    let invoiceNumber;
    let attempts = 0;
    do {
      invoiceNumber = generateInvoiceNumber();
      const { data } = await supabaseAdmin.from('invoices').select('id').eq('invoice_number', invoiceNumber).single();
      if (!data) break;
    } while (++attempts < 5);

    const { data: inv, error: invError } = await supabaseAdmin
      .from('invoices')
      .insert({ ...invoiceData, invoice_number: invoiceNumber, balance_amount: invoiceData.total_amount })
      .select()
      .single();

    if (invError) return res.status(400).json({ error: invError.message });

    if (items && items.length > 0) {
      const itemsToInsert = items.map(item => ({ ...item, invoice_id: inv.id }));
      await supabaseAdmin.from('invoice_items').insert(itemsToInsert);
    }

    res.status(201).json(inv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

module.exports = router;
