const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const mockDb = require('../mockDb');
const { getAuditLogs } = require('../middleware/audit');

// Demo mode helper
const isDemoMode = () => {
  return !process.env.SUPABASE_URL ||
    process.env.SUPABASE_URL.includes('your-project-id') ||
    process.env.SUPABASE_URL.includes('placeholder');
};

// GET /api/dashboard/stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const monthStart = thisMonth.toISOString().split('T')[0];

    if (isDemoMode()) {
      return res.json({
        total_patients: mockDb.patients.length,
        total_staff: mockDb.users.length,
        total_doctors: mockDb.doctors.length,
        appointments_today: mockDb.appointments.length,
        appointments_this_month: 28,
        today_revenue: 450.00,
        monthly_revenue: 14250.00,
        outstanding_balance: 1450.00,
        pending_invoices: mockDb.invoices.filter(i => i.status === 'unpaid').length,
        low_stock_medicines: mockDb.medicines.filter(m => m.stock_quantity <= m.minimum_stock_level).length,
        expiring_medicines: 1,
        pending_lab_tests: mockDb.labTests.filter(l => l.status !== 'completed').length,
        pending_prescriptions: mockDb.prescriptions.filter(p => p.status === 'pending').length,
        waiting_patients: mockDb.patientVisits.filter(v => v.status === 'waiting_doctor_initial' || v.status === 'waiting_doctor_final').length,
        in_consultation: mockDb.patientVisits.filter(v => v.status === 'in_consultation_initial' || v.status === 'in_consultation_final').length,
        waiting_pharmacy: mockDb.patientVisits.filter(v => v.status === 'waiting_pharmacy').length,
        waiting_payment: mockDb.patientVisits.filter(v => v.status === 'waiting_payment').length,
        completed_visits: mockDb.patientVisits.filter(v => v.status === 'completed').length,
        today_appointments: { scheduled: 1, confirmed: 1, in_progress: 0, completed: 1, cancelled: 0, no_show: 0 }
      });
    }

    // Production mode with Supabase queries
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [
      patientsResult,
      staffResult,
      doctorsResult,
      apptsTodayResult,
      apptsMonthResult,
      revenueTodayResult,
      revenueMonthResult,
      invoicesResult,
      medicinesResult,
      pendingLabsResult,
      pendingRxResult,
      visitsResult
    ] = await Promise.all([
      supabaseAdmin.from('patients').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('doctors').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('appointments').select('id', { count: 'exact', head: true }).eq('appointment_date', today).neq('status', 'cancelled'),
      supabaseAdmin.from('appointments').select('id', { count: 'exact', head: true }).gte('appointment_date', monthStart).neq('status', 'cancelled'),
      supabaseAdmin.from('payments').select('amount').gte('payment_date', today),
      supabaseAdmin.from('payments').select('amount').gte('payment_date', monthStart),
      supabaseAdmin.from('invoices').select('balance_amount, status'),
      supabaseAdmin.from('medicines').select('id, stock_quantity, minimum_stock_level, expiry_date').eq('is_active', true),
      supabaseAdmin.from('lab_tests').select('id', { count: 'exact', head: true }).in('status', ['requested', 'sample_collected', 'processing']),
      supabaseAdmin.from('prescriptions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('patient_visits').select('status')
    ]);

    const todayRevenue = revenueTodayResult.data?.reduce((s, p) => s + parseFloat(p.amount || 0), 0) || 0;
    const monthlyRevenue = revenueMonthResult.data?.reduce((s, p) => s + parseFloat(p.amount || 0), 0) || 0;

    let outstandingBalance = 0;
    let pendingInvoicesCount = 0;
    if (invoicesResult.data) {
      invoicesResult.data.forEach(inv => {
        if (inv.status === 'unpaid' || inv.status === 'partial') {
          outstandingBalance += parseFloat(inv.balance_amount || 0);
          pendingInvoicesCount++;
        }
      });
    }

    // Low stock and expiring medicines calculation from real Supabase records
    let lowStockCount = 0;
    let expiringCount = 0;
    if (medicinesResult.data) {
      medicinesResult.data.forEach(m => {
        const qty = parseInt(m.stock_quantity) || 0;
        const minQty = m.minimum_stock_level !== null && m.minimum_stock_level !== undefined ? parseInt(m.minimum_stock_level) : 10;
        if (qty <= minQty) {
          lowStockCount++;
        }
        if (m.expiry_date && m.expiry_date <= thirtyDaysFromNow && qty > 0) {
          expiringCount++;
        }
      });
    }

    // Patient visits breakdown
    let waitingPatients = 0;
    let inConsultation = 0;
    let waitingPharmacy = 0;
    let waitingPayment = 0;
    let completedVisits = 0;

    if (visitsResult.data) {
      visitsResult.data.forEach(v => {
        if (v.status === 'waiting_doctor_initial' || v.status === 'waiting_doctor_final') waitingPatients++;
        else if (v.status === 'in_consultation_initial' || v.status === 'in_consultation_final') inConsultation++;
        else if (v.status === 'waiting_pharmacy') waitingPharmacy++;
        else if (v.status === 'waiting_payment') waitingPayment++;
        else if (v.status === 'completed') completedVisits++;
      });
    }

    // Today's appointments status breakdown
    const { data: todayAppts } = await supabaseAdmin
      .from('appointments')
      .select('status')
      .eq('appointment_date', today);

    const apptStats = { scheduled: 0, confirmed: 0, in_progress: 0, completed: 0, cancelled: 0, no_show: 0 };
    todayAppts?.forEach(a => { if (apptStats.hasOwnProperty(a.status)) apptStats[a.status]++; });

    res.json({
      total_patients: patientsResult.count || 0,
      total_staff: staffResult.count || 0,
      total_doctors: doctorsResult.count || 0,
      appointments_today: apptsTodayResult.count || 0,
      appointments_this_month: apptsMonthResult.count || 0,
      today_revenue: todayRevenue,
      monthly_revenue: monthlyRevenue,
      outstanding_balance: outstandingBalance,
      pending_invoices: pendingInvoicesCount,
      low_stock_medicines: lowStockCount,
      expiring_medicines: expiringCount,
      pending_lab_tests: pendingLabsResult.count || 0,
      pending_prescriptions: pendingRxResult.count || 0,
      waiting_patients: waitingPatients,
      in_consultation: inConsultation,
      waiting_pharmacy: waitingPharmacy,
      waiting_payment: waitingPayment,
      completed_visits: completedVisits,
      today_appointments: apptStats
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// GET /api/dashboard/admin-analytics - Live charts data
router.get('/admin-analytics', authenticate, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const numDays = parseInt(days) || 30;
    const sinceDate = new Date(Date.now() - numDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (isDemoMode()) {
      return res.json({
        revenue_over_time: [
          { label: 'May', revenue: 9800 },
          { label: 'Jun', revenue: 11200 },
          { label: 'Jul', revenue: 13500 },
          { label: 'Aug', revenue: 12900 },
          { label: 'Sep', revenue: 14750 },
          { label: 'Oct', revenue: 16200 }
        ],
        patient_flow: [
          { stage: 'Wait Doctor (Initial)', count: 2 },
          { stage: 'Exam Initial', count: 1 },
          { stage: 'Wait Lab', count: 2 },
          { stage: 'Wait Doctor (Final)', count: 1 },
          { stage: 'Exam Final', count: 1 },
          { stage: 'Wait Pharmacy', count: 1 },
          { stage: 'Wait Payment', count: 1 },
          { stage: 'Completed', count: 14 }
        ],
        appointments_by_status: { scheduled: 8, confirmed: 6, in_progress: 2, completed: 25, cancelled: 3, no_show: 1 },
        registrations_over_time: [
          { label: 'May', count: 12 },
          { label: 'Jun', count: 18 },
          { label: 'Jul', count: 24 },
          { label: 'Aug', count: 15 },
          { label: 'Sep', count: 28 },
          { label: 'Oct', count: 32 }
        ],
        lab_activity: { requested: 4, sample_collected: 2, processing: 3, completed: 18, cancelled: 1 },
        inventory_status: { in_stock: 45, low_stock: 4, out_of_stock: 1, expiring_soon: 2 }
      });
    }

    // 1. Revenue over past 6 months
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: d.toLocaleString('default', { month: 'short' }),
        start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
      });
    }

    const { data: allPayments } = await supabaseAdmin
      .from('payments')
      .select('amount, payment_date')
      .gte('payment_date', months[0].start);

    const revenueOverTime = months.map(m => {
      const total = (allPayments || [])
        .filter(p => p.payment_date >= m.start && p.payment_date <= m.end)
        .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      return { label: m.label, revenue: total };
    });

    // 2. Patient flow by stage
    const { data: visits } = await supabaseAdmin.from('patient_visits').select('status');
    const flowCounts = {
      'waiting_doctor_initial': 0,
      'in_consultation_initial': 0,
      'waiting_laboratory': 0,
      'waiting_doctor_final': 0,
      'in_consultation_final': 0,
      'waiting_pharmacy': 0,
      'waiting_payment': 0,
      'completed': 0,
      'cancelled': 0
    };
    visits?.forEach(v => {
      if (flowCounts.hasOwnProperty(v.status)) flowCounts[v.status]++;
    });

    const patientFlow = [
      { stage: 'Waiting Doctor Initial', count: flowCounts.waiting_doctor_initial },
      { stage: 'Initial Exam', count: flowCounts.in_consultation_initial },
      { stage: 'Waiting Lab', count: flowCounts.waiting_laboratory },
      { stage: 'Waiting Doctor Final', count: flowCounts.waiting_doctor_final },
      { stage: 'Final Exam', count: flowCounts.in_consultation_final },
      { stage: 'Waiting Pharmacy', count: flowCounts.waiting_pharmacy },
      { stage: 'Waiting Payment', count: flowCounts.waiting_payment },
      { stage: 'Completed', count: flowCounts.completed }
    ];

    // 3. Appointments by status
    const { data: appts } = await supabaseAdmin
      .from('appointments')
      .select('status')
      .gte('appointment_date', sinceDate);

    const apptsByStatus = { scheduled: 0, confirmed: 0, in_progress: 0, completed: 0, cancelled: 0, no_show: 0 };
    appts?.forEach(a => { if (apptsByStatus.hasOwnProperty(a.status)) apptsByStatus[a.status]++; });

    // 4. Patient registrations over time (by month)
    const { data: allPatients } = await supabaseAdmin
      .from('patients')
      .select('created_at')
      .gte('created_at', months[0].start);

    const registrationsOverTime = months.map(m => {
      const count = (allPatients || []).filter(p => p.created_at >= m.start && p.created_at <= m.end + 'T23:59:59').length;
      return { label: m.label, count };
    });

    // 5. Lab activity
    const { data: labs } = await supabaseAdmin.from('lab_tests').select('status');
    const labActivity = { requested: 0, sample_collected: 0, processing: 0, completed: 0, cancelled: 0 };
    labs?.forEach(l => { if (labActivity.hasOwnProperty(l.status)) labActivity[l.status]++; });

    // 6. Inventory status
    const { data: medicines } = await supabaseAdmin.from('medicines').select('stock_quantity, minimum_stock_level, expiry_date');
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    let inStock = 0, lowStock = 0, outOfStock = 0, expiringSoon = 0;
    medicines?.forEach(m => {
      if (m.stock_quantity <= 0) outOfStock++;
      else if (m.stock_quantity <= m.minimum_stock_level) lowStock++;
      else inStock++;
      if (m.expiry_date && m.expiry_date <= thirtyDays) expiringSoon++;
    });

    res.json({
      revenue_over_time: revenueOverTime,
      patient_flow: patientFlow,
      appointments_by_status: apptsByStatus,
      registrations_over_time: registrationsOverTime,
      lab_activity: labActivity,
      inventory_status: { in_stock: inStock, low_stock: lowStock, out_of_stock: outOfStock, expiring_soon: expiringSoon }
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/dashboard/recent-feeds - Live real-time feeds
router.get('/recent-feeds', authenticate, async (req, res) => {
  try {
    if (isDemoMode()) {
      const mockPayments = mockDb.invoices.slice(0, 5).map(i => ({
        payment_number: `PAY-${i.invoice_number}`,
        amount: i.total_amount,
        patient_name: i.patient_name || 'Patient',
        payment_method: 'Cash',
        created_at: i.created_at
      }));
      const mockActivities = [
        { action: 'staff_login', entity_type: 'auth', details: { email: 'admin@clinic.com' }, created_at: new Date().toISOString() }
      ];
      return res.json({
        recent_appointments: mockDb.appointments.slice(0, 5),
        recent_patients: mockDb.patients.slice(0, 5),
        recent_payments: mockPayments,
        recent_activities: mockActivities,
        appointments: mockDb.appointments.slice(0, 5),
        patients: mockDb.patients.slice(0, 5),
        payments: mockPayments,
        auditLogs: mockActivities
      });
    }

    const [apptsRes, patientsRes, paymentsRes, auditRes] = await Promise.all([
      supabaseAdmin
        .from('appointments')
        .select('*, patients(first_name, last_name, patient_number), doctors(specialization, profiles(full_name))')
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false })
        .limit(5),
      supabaseAdmin
        .from('patients')
        .select('id, patient_number, first_name, last_name, phone, created_at, is_active')
        .order('created_at', { ascending: false })
        .limit(5),
      supabaseAdmin
        .from('payments')
        .select('*, patients(first_name, last_name, patient_number)')
        .order('created_at', { ascending: false })
        .limit(5),
      getAuditLogs({ limit: 5 })
    ]);

    const appts = apptsRes.data || [];
    const patients = patientsRes.data || [];
    const payments = paymentsRes.data || [];
    const activities = auditRes.data || [];

    res.json({
      recent_appointments: appts,
      recent_patients: patients,
      recent_payments: payments,
      recent_activities: activities,
      appointments: appts,
      patients: patients,
      payments: payments,
      auditLogs: activities
    });
  } catch (err) {
    console.error('Recent feeds error:', err);
    res.status(500).json({ error: 'Failed to fetch recent feeds' });
  }
});

// GET /api/dashboard/recent-appointments (legacy compatibility)
router.get('/recent-appointments', authenticate, async (req, res) => {
  try {
    if (isDemoMode()) return res.json(mockDb.appointments);
    const { data, error } = await supabaseAdmin
      .from('appointments')
      .select('*, patients(first_name, last_name, patient_number), doctors(specialization, profiles(full_name))')
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })
      .limit(10);
    if (error) return res.status(400).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch recent appointments' });
  }
});

// GET /api/dashboard/revenue-chart (legacy compatibility)
router.get('/revenue-chart', authenticate, async (req, res) => {
  try {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: d.toLocaleString('default', { month: 'short', year: 'numeric' })
      });
    }

    if (isDemoMode()) {
      return res.json(months.map((m, idx) => ({ label: m.label, revenue: (idx + 1) * 3200 })));
    }

    const revenueData = await Promise.all(months.map(async (m) => {
      const start = `${m.year}-${String(m.month).padStart(2, '0')}-01`;
      const end = new Date(m.year, m.month, 0).toISOString().split('T')[0];
      const { data } = await supabaseAdmin
        .from('payments')
        .select('amount')
        .gte('payment_date', start)
        .lte('payment_date', end);
      const total = data?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;
      return { label: m.label, revenue: total };
    }));

    res.json(revenueData);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch revenue chart data' });
  }
});

// GET /api/dashboard/alerts
router.get('/alerts', authenticate, async (req, res) => {
  try {
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    if (isDemoMode()) {
      return res.json({
        low_stock: mockDb.medicines.filter(m => m.stock_quantity <= m.minimum_stock_level),
        expiring_medicines: []
      });
    }

    const [lowStock, expiring] = await Promise.all([
      supabaseAdmin
        .from('medicines')
        .select('id, name, medicine_code, stock_quantity, minimum_stock_level')
        .filter('stock_quantity', 'lte', 'minimum_stock_level')
        .eq('is_active', true)
        .limit(10),
      supabaseAdmin
        .from('medicines')
        .select('id, name, medicine_code, expiry_date, stock_quantity')
        .lte('expiry_date', thirtyDaysFromNow)
        .gt('stock_quantity', 0)
        .eq('is_active', true)
        .limit(10)
    ]);

    res.json({
      low_stock: lowStock.data || [],
      expiring_medicines: expiring.data || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

module.exports = router;
