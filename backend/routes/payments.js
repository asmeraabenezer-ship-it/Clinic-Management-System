const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const mockDb = require('../mockDb');

const generatePaymentNumber = () => `PAY-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;

// GET /api/payments  -- financial roles only
router.get('/', authenticate, requirePermission('payments', 'read'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const { payment_method, page = 1, limit = 20 } = req.query;
      let filtered = [...mockDb.payments];
      if (payment_method) filtered = filtered.filter(p => p.payment_method === payment_method);
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      const total = filtered.length;
      return res.json({
        data: filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum),
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) || 1 }
      });
    }

    const { invoice_id, patient_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('payments')
      .select(`
        *,
        invoices(invoice_number, total_amount, status),
        patients(first_name, last_name, patient_number)
      `, { count: 'exact' });

    if (invoice_id) query = query.eq('invoice_id', invoice_id);
    if (patient_id) query = query.eq('patient_id', patient_id);

    const { data, error, count } = await query
      .order('payment_date', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ data, pagination: { page: parseInt(page), limit: parseInt(limit), total: count, pages: Math.ceil(count / parseInt(limit)) } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// POST /api/payments  -- cashier, receptionist, admin
router.post('/', authenticate, authorize('admin', 'receptionist', 'cashier'), requirePermission('payments', 'write'), async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      const inv = mockDb.invoices.find(i => i.id === req.body.invoice_id) || mockDb.invoices[0];
      const payAmount = parseFloat(req.body.amount) || 50;
      if (inv) {
        inv.paid_amount = (parseFloat(inv.paid_amount) || 0) + payAmount;
        inv.balance_amount = Math.max(0, (parseFloat(inv.total_amount) || 0) - inv.paid_amount);
        inv.status = inv.balance_amount === 0 ? 'paid' : 'partial';
      }
      const newPay = {
        id: `pay-${Date.now()}`,
        payment_number: generatePaymentNumber(),
        invoice_id: req.body.invoice_id,
        amount: payAmount,
        payment_method: req.body.payment_method || 'cash',
        payment_date: new Date().toISOString().split('T')[0],
        notes: req.body.notes || 'Recorded via counter',
        created_at: new Date().toISOString(),
        invoices: {
          invoice_number: inv?.invoice_number || 'INV-001',
          patients: { first_name: inv?.patients?.first_name || 'Patient', last_name: inv?.patients?.last_name || '', patient_number: inv?.patients?.patient_number || 'P-100' }
        }
      };
      mockDb.payments.unshift(newPay);
      return res.status(201).json(newPay);
    }

    const { invoice_id, amount, payment_method, reference_number, notes } = req.body;
    if (!invoice_id || !amount || !payment_method) {
      return res.status(400).json({ error: 'Invoice ID, amount, and payment method are required' });
    }

    const { data: invoice } = await supabaseAdmin.from('invoices').select('*').eq('id', invoice_id).single();
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const payNumber = generatePaymentNumber();
    const { data, error } = await supabaseAdmin.from('payments').insert({
      payment_number: payNumber,
      invoice_id,
      patient_id: invoice.patient_id,
      amount: parseFloat(amount),
      payment_method,
      reference_number,
      notes,
      recorded_by: req.user.id
    }).select().single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

module.exports = router;
