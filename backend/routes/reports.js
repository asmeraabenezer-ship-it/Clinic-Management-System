const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const mockDb = require('../mockDb');

// Helper for demo mode check
const isDemoMode = () => {
  return !process.env.SUPABASE_URL ||
    process.env.SUPABASE_URL.includes('your-project-id') ||
    process.env.SUPABASE_URL.includes('placeholder');
};

// GET /api/reports/summary (legacy overview)
router.get('/summary', authenticate, authorize('admin', 'doctor'), async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const start = date_from || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0];
    const end = date_to || new Date().toISOString().split('T')[0];

    if (isDemoMode()) {
      return res.json({
        date_range: { from: start, to: end },
        appointments: {
          total: mockDb.appointments.length + 24,
          breakdown: { completed: 18, scheduled: 5, confirmed: 3, cancelled: 1 }
        },
        new_patients: mockDb.patients.length + 12,
        total_revenue: 18650.00,
        outstanding_invoices: 1450.00,
        lab_tests: { total: mockDb.labTests.length + 15 },
        prescriptions: { total: mockDb.prescriptions.length + 30 }
      });
    }

    const [appointments, patients, revenue, invoices, labTests, prescriptions] = await Promise.all([
      supabaseAdmin.from('appointments').select('status', { count: 'exact' }).gte('appointment_date', start).lte('appointment_date', end),
      supabaseAdmin.from('patients').select('id', { count: 'exact', head: true }).gte('created_at', start).lte('created_at', end + 'T23:59:59'),
      supabaseAdmin.from('payments').select('amount').gte('payment_date', start).lte('payment_date', end),
      supabaseAdmin.from('invoices').select('balance_amount').in('status', ['unpaid', 'partial']),
      supabaseAdmin.from('lab_tests').select('status', { count: 'exact' }).gte('created_at', start).lte('created_at', end + 'T23:59:59'),
      supabaseAdmin.from('prescriptions').select('status', { count: 'exact' }).gte('created_at', start).lte('created_at', end + 'T23:59:59')
    ]);

    const totalRevenue = revenue.data?.reduce((s, p) => s + parseFloat(p.amount || 0), 0) || 0;
    const outstanding = invoices.data?.reduce((s, i) => s + parseFloat(i.balance_amount || 0), 0) || 0;
    const apptStats = {};
    appointments.data?.forEach(a => { apptStats[a.status] = (apptStats[a.status] || 0) + 1; });

    res.json({
      date_range: { from: start, to: end },
      appointments: { total: appointments.count || 0, breakdown: apptStats },
      new_patients: patients.count || 0,
      total_revenue: totalRevenue,
      outstanding_invoices: outstanding,
      lab_tests: { total: labTests.count || 0 },
      prescriptions: { total: prescriptions.count || 0 }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate summary report' });
  }
});

// GET /api/reports/detailed - Full module report with metrics & data rows for CSV export
router.get('/detailed', authenticate, authorize('admin', 'doctor'), async (req, res) => {
  try {
    // Accept both 'type' and 'module' for frontend/legacy compatibility
    let { module: mod, type, date_from, date_to } = req.query;
    mod = mod || type || 'revenue';
    // Alias 'laboratory' -> 'lab'
    if (mod === 'laboratory') mod = 'lab';

    const start = date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = date_to || new Date().toISOString().split('T')[0];

    // Helper: build standard response expected by frontend ReportsPage
    const buildResponse = (modName, summaryCards, columns, rows) => ({
      module: modName,
      summaryCards,
      columns,
      rows,
      // legacy compat
      summary: summaryCards.reduce((acc, c) => { acc[c.key || c.label] = c.rawValue; return acc; }, {})
    });

    // 1. REVENUE REPORT
    if (mod === 'revenue') {
      if (isDemoMode()) {
        const rows = mockDb.invoices.map(i => ({
          date: i.created_at?.split('T')[0] || start,
          invoice_number: i.invoice_number,
          patient_name: i.patient_name || 'Demo Patient',
          amount: parseFloat(i.total_amount || 75),
          payment_method: 'Cash',
          status: i.status
        }));
        return res.json(buildResponse('revenue', [
          { key: 'total_revenue', label: 'Total Revenue', value: '$14,250.00', rawValue: 14250, icon: 'fa-dollar-sign', type: 'success' },
          { key: 'outstanding', label: 'Outstanding Balance', value: '$1,450.00', rawValue: 1450, icon: 'fa-hourglass', type: 'warning' },
          { key: 'transactions', label: 'Transactions', value: String(rows.length), rawValue: rows.length, icon: 'fa-receipt', type: 'primary' }
        ], [
          { key: 'date', label: 'Date' }, { key: 'invoice_number', label: 'Invoice #' },
          { key: 'patient_name', label: 'Patient' }, { key: 'amount', label: 'Amount' },
          { key: 'payment_method', label: 'Method' }, { key: 'status', label: 'Status' }
        ], rows));
      }

      const [paymentsRes, invoicesRes] = await Promise.all([
        supabaseAdmin
          .from('payments')
          .select('*, patients(first_name, last_name, patient_number)')
          .gte('payment_date', start)
          .lte('payment_date', end)
          .order('payment_date', { ascending: false }),
        supabaseAdmin
          .from('invoices')
          .select('balance_amount, status')
          .in('status', ['unpaid', 'partial'])
      ]);

      const payments = paymentsRes.data || [];
      const totalPayments = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      const outstandingBalance = (invoicesRes.data || []).reduce((sum, i) => sum + parseFloat(i.balance_amount || 0), 0);
      const methodBreakdown = {};
      payments.forEach(p => {
        const m = p.payment_method || 'other';
        methodBreakdown[m] = (methodBreakdown[m] || 0) + parseFloat(p.amount || 0);
      });

      const rows = payments.map(p => ({
        date: p.payment_date || p.created_at?.split('T')[0],
        payment_number: p.payment_number,
        patient_name: p.patients ? `${p.patients.first_name} ${p.patients.last_name}` : 'Patient',
        patient_number: p.patients?.patient_number || '-',
        amount: parseFloat(p.amount || 0),
        payment_method: p.payment_method || 'cash',
        reference: p.reference_number || '-'
      }));

      return res.json(buildResponse('revenue', [
        { key: 'total_revenue', label: 'Total Revenue', value: `$${totalPayments.toFixed(2)}`, rawValue: totalPayments, icon: 'fa-dollar-sign', type: 'success' },
        { key: 'outstanding', label: 'Outstanding Balance', value: `$${outstandingBalance.toFixed(2)}`, rawValue: outstandingBalance, icon: 'fa-hourglass', type: 'warning' },
        { key: 'transactions', label: 'Transactions', value: String(rows.length), rawValue: rows.length, icon: 'fa-receipt', type: 'primary' }
      ], [
        { key: 'date', label: 'Date' }, { key: 'payment_number', label: 'Payment #' },
        { key: 'patient_name', label: 'Patient' }, { key: 'patient_number', label: 'Patient #' },
        { key: 'amount', label: 'Amount' }, { key: 'payment_method', label: 'Method' },
        { key: 'reference', label: 'Reference' }
      ], rows));
    }

    // 2. PATIENT REPORT
    if (mod === 'patients') {
      const [allPatientsRes, newPatientsRes] = await Promise.all([
        supabaseAdmin.from('patients').select('id, is_active'),
        supabaseAdmin
          .from('patients')
          .select('*')
          .gte('created_at', start)
          .lte('created_at', end + 'T23:59:59')
          .order('created_at', { ascending: false })
      ]);

      const all = allPatientsRes.data || [];
      const activeCount = all.filter(p => p.is_active).length;
      const inactiveCount = all.filter(p => !p.is_active).length;

      const rows = (newPatientsRes.data || []).map(p => ({
        patient_number: p.patient_number,
        name: `${p.first_name} ${p.last_name}`,
        gender: p.gender,
        date_of_birth: p.date_of_birth,
        blood_type: p.blood_type || '-',
        phone: p.phone,
        status: p.is_active ? 'Active' : 'Inactive',
        registered_at: p.created_at?.split('T')[0]
      }));

      return res.json(buildResponse('patients', [
        { key: 'total', label: 'Total Patients', value: String(all.length), rawValue: all.length, icon: 'fa-user-injured', type: 'primary' },
        { key: 'new_period', label: 'New This Period', value: String(rows.length), rawValue: rows.length, icon: 'fa-user-plus', type: 'success' },
        { key: 'active', label: 'Active', value: String(activeCount), rawValue: activeCount, icon: 'fa-check-circle', type: 'info' },
        { key: 'inactive', label: 'Inactive', value: String(inactiveCount), rawValue: inactiveCount, icon: 'fa-ban', type: 'warning' }
      ], [
        { key: 'patient_number', label: 'Patient #' }, { key: 'name', label: 'Name' },
        { key: 'gender', label: 'Gender' }, { key: 'date_of_birth', label: 'DOB' },
        { key: 'blood_type', label: 'Blood Type' }, { key: 'phone', label: 'Phone' },
        { key: 'status', label: 'Status' }, { key: 'registered_at', label: 'Registered' }
      ], rows));
    }

    // 3. APPOINTMENT REPORT
    if (mod === 'appointments') {
      const { data: appts } = await supabaseAdmin
        .from('appointments')
        .select('*, patients(first_name, last_name, patient_number), doctors(specialization, profiles(full_name))')
        .gte('appointment_date', start)
        .lte('appointment_date', end)
        .order('appointment_date', { ascending: false });

      const list = appts || [];
      const statusCounts = { completed: 0, scheduled: 0, confirmed: 0, cancelled: 0, no_show: 0, in_progress: 0 };
      list.forEach(a => {
        if (statusCounts.hasOwnProperty(a.status)) statusCounts[a.status]++;
      });

      const rows = list.map(a => ({
        appointment_number: a.appointment_number,
        date: a.appointment_date,
        time: a.appointment_time,
        patient_name: a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : 'Patient',
        doctor: a.doctors?.profiles?.full_name || 'Doctor',
        status: a.status,
        cancellation_reason: a.cancellation_reason || '-'
      }));

      return res.json(buildResponse('appointments', [
        { key: 'total', label: 'Total Appointments', value: String(list.length), rawValue: list.length, icon: 'fa-calendar-check', type: 'primary' },
        { key: 'completed', label: 'Completed', value: String(statusCounts.completed), rawValue: statusCounts.completed, icon: 'fa-check', type: 'success' },
        { key: 'cancelled', label: 'Cancelled', value: String(statusCounts.cancelled + statusCounts.no_show), rawValue: statusCounts.cancelled, icon: 'fa-times', type: 'danger' }
      ], [
        { key: 'appointment_number', label: 'Appt #' }, { key: 'date', label: 'Date' },
        { key: 'time', label: 'Time' }, { key: 'patient_name', label: 'Patient' },
        { key: 'doctor', label: 'Doctor' }, { key: 'status', label: 'Status' },
        { key: 'cancellation_reason', label: 'Cancel Reason' }
      ], rows));
    }

    // 4. DOCTOR REPORT
    if (mod === 'doctors') {
      const [doctorsRes, apptsRes, visitsRes] = await Promise.all([
        supabaseAdmin.from('doctors').select('*, profiles(full_name, email, phone)'),
        supabaseAdmin.from('appointments').select('doctor_id, status').gte('appointment_date', start).lte('appointment_date', end),
        supabaseAdmin.from('patient_visits').select('doctor_id, status').gte('created_at', start).lte('created_at', end + 'T23:59:59')
      ]);

      const doctors = doctorsRes.data || [];
      const appts = apptsRes.data || [];
      const visits = visitsRes.data || [];

      const rows = doctors.map(d => {
        const docAppts = appts.filter(a => a.doctor_id === d.id);
        const docVisits = visits.filter(v => v.doctor_id === d.id);
        const completedVisits = docVisits.filter(v => v.status === 'completed').length;
        return {
          doctor_number: d.doctor_number,
          name: d.profiles?.full_name || 'Dr. Specialist',
          specialization: d.specialization,
          license_number: d.license_number,
          consultation_fee: d.consultation_fee,
          appointments_count: docAppts.length,
          visits_count: docVisits.length,
          completed_consultations: completedVisits,
          is_available: d.is_available ? 'Available' : 'Unavailable'
        };
      });

      return res.json(buildResponse('doctors', [
        { key: 'total_doctors', label: 'Total Doctors', value: String(doctors.length), rawValue: doctors.length, icon: 'fa-user-md', type: 'primary' },
        { key: 'total_appointments', label: 'Period Appointments', value: String(appts.length), rawValue: appts.length, icon: 'fa-calendar-check', type: 'info' },
        { key: 'total_visits', label: 'Clinical Visits', value: String(visits.length), rawValue: visits.length, icon: 'fa-stethoscope', type: 'success' }
      ], [
        { key: 'doctor_number', label: 'Doctor #' }, { key: 'name', label: 'Name' },
        { key: 'specialization', label: 'Specialization' }, { key: 'license_number', label: 'License' },
        { key: 'consultation_fee', label: 'Fee ($)' }, { key: 'appointments_count', label: 'Appointments' },
        { key: 'completed_consultations', label: 'Completed' }, { key: 'is_available', label: 'Availability' }
      ], rows));
    }

    // 5. LABORATORY REPORT
    if (mod === 'lab') {
      const { data: labs } = await supabaseAdmin
        .from('lab_tests')
        .select('*, patients(first_name, last_name, patient_number)')
        .gte('created_at', start)
        .lte('created_at', end + 'T23:59:59')
        .order('created_at', { ascending: false });

      const list = labs || [];
      const statusCounts = { requested: 0, sample_collected: 0, processing: 0, completed: 0, cancelled: 0 };
      list.forEach(l => { if (statusCounts.hasOwnProperty(l.status)) statusCounts[l.status]++; });

      const rows = list.map(l => ({
        test_number: l.test_number,
        test_name: l.test_name,
        category: l.category,
        urgency: l.urgency,
        status: l.status,
        patient_name: l.patients ? `${l.patients.first_name} ${l.patients.last_name}` : 'Patient',
        sample_type: l.sample_type || '-',
        requested_at: l.created_at?.split('T')[0],
        completed_at: l.completed_at?.split('T')[0] || '-'
      }));

      return res.json(buildResponse('lab', [
        { key: 'total', label: 'Total Tests', value: String(list.length), rawValue: list.length, icon: 'fa-flask', type: 'primary' },
        { key: 'completed', label: 'Completed', value: String(statusCounts.completed), rawValue: statusCounts.completed, icon: 'fa-check-circle', type: 'success' },
        { key: 'pending', label: 'Pending / In Progress', value: String(list.length - statusCounts.completed - statusCounts.cancelled), rawValue: list.length - statusCounts.completed, icon: 'fa-hourglass', type: 'warning' }
      ], [
        { key: 'test_number', label: 'Test #' }, { key: 'test_name', label: 'Test Name' },
        { key: 'category', label: 'Category' }, { key: 'urgency', label: 'Urgency' },
        { key: 'patient_name', label: 'Patient' }, { key: 'status', label: 'Status' },
        { key: 'requested_at', label: 'Requested' }, { key: 'completed_at', label: 'Completed' }
      ], rows));
    }

    // 6. PHARMACY REPORT
    if (mod === 'pharmacy') {
      const { data: medicines } = await supabaseAdmin
        .from('medicines')
        .select('*')
        .order('name', { ascending: true });

      const list = medicines || [];
      const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];

      let lowStockCount = 0;
      let expiredCount = 0;
      let expiringSoonCount = 0;

      const rows = list.map(m => {
        const isLow = m.stock_quantity <= m.minimum_stock_level;
        const isExp = m.expiry_date && m.expiry_date <= todayStr;
        const isSoon = m.expiry_date && m.expiry_date <= thirtyDays && !isExp;

        if (isLow) lowStockCount++;
        if (isExp) expiredCount++;
        if (isSoon) expiringSoonCount++;

        return {
          code: m.medicine_code,
          name: m.name,
          category: m.category,
          stock: m.stock_quantity,
          min_stock: m.minimum_stock_level,
          unit_price: m.unit_price,
          expiry_date: m.expiry_date || '-',
          status: isExp ? 'EXPIRED' : isSoon ? 'EXPIRING SOON' : isLow ? 'LOW STOCK' : 'IN STOCK'
        };
      });

      return res.json(buildResponse('pharmacy', [
        { key: 'total_items', label: 'Total Items', value: String(list.length), rawValue: list.length, icon: 'fa-pills', type: 'primary' },
        { key: 'low_stock', label: 'Low Stock', value: String(lowStockCount), rawValue: lowStockCount, icon: 'fa-exclamation-triangle', type: 'warning' },
        { key: 'expired', label: 'Expired', value: String(expiredCount), rawValue: expiredCount, icon: 'fa-times-circle', type: 'danger' },
        { key: 'expiring_soon', label: 'Expiring Soon', value: String(expiringSoonCount), rawValue: expiringSoonCount, icon: 'fa-clock', type: 'info' }
      ], [
        { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' },
        { key: 'category', label: 'Category' }, { key: 'stock', label: 'Stock' },
        { key: 'min_stock', label: 'Min Stock' }, { key: 'unit_price', label: 'Unit Price' },
        { key: 'expiry_date', label: 'Expiry' }, { key: 'status', label: 'Status' }
      ], rows));
    }

    // 7. STAFF REPORT
    if (mod === 'staff') {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      const list = profiles || [];
      const byRole = {};
      let active = 0, inactive = 0;

      list.forEach(p => {
        byRole[p.role] = (byRole[p.role] || 0) + 1;
        if (p.is_active) active++; else inactive++;
      });

      const rows = list.map(p => ({
        name: p.full_name,
        email: p.email,
        role: p.role,
        phone: p.phone || '-',
        status: p.is_active ? 'Active' : 'Inactive',
        created_at: p.created_at?.split('T')[0]
      }));

      return res.json(buildResponse('staff', [
        { key: 'total', label: 'Total Staff', value: String(list.length), rawValue: list.length, icon: 'fa-users', type: 'primary' },
        { key: 'active', label: 'Active', value: String(active), rawValue: active, icon: 'fa-check-circle', type: 'success' },
        { key: 'inactive', label: 'Inactive', value: String(inactive), rawValue: inactive, icon: 'fa-ban', type: 'warning' }
      ], [
        { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role' }, { key: 'phone', label: 'Phone' },
        { key: 'status', label: 'Status' }, { key: 'created_at', label: 'Joined' }
      ], rows));
    }

    // 8. PATIENT FLOW REPORT
    if (mod === 'flow') {
      const { data: visits } = await supabaseAdmin
        .from('patient_visits')
        .select('*, patients(first_name, last_name, patient_number), doctors(profiles(full_name))')
        .gte('created_at', start)
        .lte('created_at', end + 'T23:59:59')
        .order('created_at', { ascending: false });

      const list = visits || [];
      const stageCounts = {};
      list.forEach(v => { stageCounts[v.status] = (stageCounts[v.status] || 0) + 1; });

      const rows = list.map(v => ({
        visit_number: v.visit_number,
        patient_name: v.patients ? `${v.patients.first_name} ${v.patients.last_name}` : 'Patient',
        patient_number: v.patients?.patient_number || '-',
        doctor: v.doctors?.profiles?.full_name || 'Doctor',
        status: v.status,
        total_fee: v.total_fee,
        created_at: v.created_at?.split('T')[0]
      }));

      return res.json(buildResponse('flow', [
        { key: 'total_visits', label: 'Total Visits', value: String(list.length), rawValue: list.length, icon: 'fa-stream', type: 'primary' },
        { key: 'completed', label: 'Completed', value: String(stageCounts.completed || 0), rawValue: stageCounts.completed || 0, icon: 'fa-check-circle', type: 'success' },
        { key: 'in_progress', label: 'In Progress', value: String(list.length - (stageCounts.completed || 0) - (stageCounts.cancelled || 0)), rawValue: 0, icon: 'fa-hourglass', type: 'info' }
      ], [
        { key: 'visit_number', label: 'Visit #' }, { key: 'patient_name', label: 'Patient' },
        { key: 'patient_number', label: 'Patient #' }, { key: 'doctor', label: 'Doctor' },
        { key: 'status', label: 'Status' }, { key: 'total_fee', label: 'Fee ($)' },
        { key: 'created_at', label: 'Date' }
      ], rows));
    }

    res.status(400).json({ error: 'Unknown report module' });
  } catch (err) {
    console.error('Detailed report error:', err);
    res.status(500).json({ error: 'Failed to generate detailed report' });
  }
});

module.exports = router;
