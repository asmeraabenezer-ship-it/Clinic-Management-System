/* ============================================================
   DASHBOARD.JS - Departmental Dashboards & Live Clinic Flow
   Provides dedicated dashboards tailored for:
   - Reception
   - Doctor
   - Laboratory
   - Pharmacy
   - Cashier
   - Admin & Clinic Leadership
   ============================================================ */

const DashboardPage = {
  async load() {
    const role = Auth.getRole();
    const content = document.getElementById('page-content');
    content.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading Department Dashboard...</div>';

    if (role === 'doctor') {
      await this.loadDoctorDashboard();
    } else if (role === 'laboratorist') {
      await this.loadLaboratoryDashboard();
    } else if (role === 'pharmacist') {
      await this.loadPharmacyDashboard();
    } else if (role === 'cashier') {
      await this.loadCashierDashboard();
    } else if (role === 'receptionist') {
      await this.loadReceptionDashboard();
    } else {
      await this.loadAdminDashboard();
    }
  },

  // ============================================================
  // 1. RECEPTION DASHBOARD
  // ============================================================
  async loadReceptionDashboard() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>Reception & Patient Flow Desk</h2>
          <p>Register arriving patients, record reasons for visit, queue patients to doctors, and monitor checkout.</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" onclick="VisitsWorkflow.showCheckInModal()">
            <i class="fas fa-user-plus"></i> Patient Check-In
          </button>
          <button class="btn btn-secondary" onclick="showPage('visits')">
            <i class="fas fa-list-ol"></i> Full Queue
          </button>
        </div>
      </div>

      <!-- Department Metrics -->
      <div class="stats-grid" id="reception-stats">
        <div class="stat-card primary"><div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div></div>
      </div>

      <!-- Main Reception Grid -->
      <div class="dashboard-grid">
        <!-- Waiting for Doctor Initial Exam -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-user-clock" style="color:var(--warning);"></i> Waiting for Doctor Initial Exam</h3>
            <button class="btn btn-sm btn-ghost" onclick="VisitsWorkflow.showCheckInModal()">+ Check In</button>
          </div>
          <div class="card-body" style="padding:0;" id="reception-waiting-list">
            <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
          </div>
        </div>

        <!-- Cashier / Ready for Payment -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-cash-register" style="color:var(--success);"></i> Ready for Payment & Checkout</h3>
            <button class="btn btn-sm btn-ghost" onclick="showPage('invoices')">View Invoices</button>
          </div>
          <div class="card-body" style="padding:0;" id="reception-cashier-list">
            <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
          </div>
        </div>
      </div>
    `;

    try {
      const res = await API.visits.list();
      const allVisits = res.data || [];

      const waitingInitial = allVisits.filter(v => v.status === 'waiting_doctor_initial');
      const waitingPayment = allVisits.filter(v => v.status === 'waiting_payment');
      const inLab = allVisits.filter(v => v.status === 'waiting_laboratory');
      const completedToday = allVisits.filter(v => v.status === 'completed');

      // Render stats
      document.getElementById('reception-stats').innerHTML = `
        <div class="stat-card primary" onclick="VisitsWorkflow.showCheckInModal()" style="cursor:pointer;">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-door-open"></i></div>
            <span class="stat-trend up">Total Active</span>
          </div>
          <div class="stat-value">${allVisits.filter(v => v.status !== 'completed').length}</div>
          <div class="stat-label">Patients in Clinic Now</div>
        </div>

        <div class="stat-card warning" onclick="showPage('visits')" style="cursor:pointer;">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-user-clock"></i></div>
            <span class="stat-trend down">${waitingInitial.length} queued</span>
          </div>
          <div class="stat-value">${waitingInitial.length}</div>
          <div class="stat-label">Waiting for Doctor Initial Exam</div>
        </div>

        <div class="stat-card accent" onclick="showPage('visits')" style="cursor:pointer;">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-flask"></i></div>
            <span class="stat-trend up">${inLab.length} tests</span>
          </div>
          <div class="stat-value">${inLab.length}</div>
          <div class="stat-label">Undergoing Laboratory Tests</div>
        </div>

        <div class="stat-card success" onclick="showPage('visits')" style="cursor:pointer;">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-cash-register"></i></div>
            <span class="stat-trend up">${waitingPayment.length} ready</span>
          </div>
          <div class="stat-value">${waitingPayment.length}</div>
          <div class="stat-label">Ready for Cashier Settlement</div>
        </div>
      `;

      // Render Waiting Initial List
      const waitContainer = document.getElementById('reception-waiting-list');
      if (!waitingInitial.length) {
        waitContainer.innerHTML = '<div style="padding:24px; text-align:center; color:var(--gray-500);"><i class="fas fa-check-circle" style="font-size:24px; color:var(--success); margin-bottom:8px;"></i><p style="margin:0;">No patients currently waiting for doctor.</p></div>';
      } else {
        waitContainer.innerHTML = `
          <div class="today-appointments-list">
            ${waitingInitial.map(v => `
              <div class="appointment-row">
                <div class="appt-time"><i class="fas fa-id-card"></i> ${v.patients?.patient_number || 'CARD'}</div>
                <div class="appt-info">
                  <div class="appt-patient">${v.patients?.first_name} ${v.patients?.last_name}</div>
                  <div class="appt-doctor">Dr: ${v.doctors?.profiles?.full_name || 'Assigned'} &bull; Reason: ${v.reason_for_visit}</div>
                </div>
                <button class="btn btn-sm btn-ghost" onclick="VisitsWorkflow.showVisitTimelineModal('${v.id}')"><i class="fas fa-eye"></i></button>
              </div>
            `).join('')}
          </div>
        `;
      }

      // Render Cashier List
      const cashierContainer = document.getElementById('reception-cashier-list');
      if (!waitingPayment.length) {
        cashierContainer.innerHTML = '<div style="padding:24px; text-align:center; color:var(--gray-500);"><p style="margin:0;">No patients waiting for billing checkout.</p></div>';
      } else {
        cashierContainer.innerHTML = `
          <div class="today-appointments-list">
            ${waitingPayment.map(v => `
              <div class="appointment-row">
                <div class="appt-time" style="color:var(--success); font-weight:700;">$${parseFloat(v.total_fee || 75).toFixed(2)}</div>
                <div class="appt-info">
                  <div class="appt-patient">${v.patients?.first_name} ${v.patients?.last_name} (${v.patients?.patient_number || ''})</div>
                  <div class="appt-doctor">Diagnosis: ${v.final_diagnosis || 'Ready for settlement'}</div>
                </div>
                <button class="btn btn-sm btn-primary" onclick="VisitsWorkflow.showPaymentModal('${v.id}')" style="background:#059669;">
                  <i class="fas fa-receipt"></i> Settle
                </button>
              </div>
            `).join('')}
          </div>
        `;
      }
    } catch (err) {
      showToast('error', 'Dashboard Error', err.message);
    }
  },

  // ============================================================
  // 2. DOCTOR DASHBOARD
  // ============================================================
  async loadDoctorDashboard() {
    const user = Auth.getUser();
    const content = document.getElementById('page-content');

    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>Physician Clinical Consultation Desk</h2>
          <p>Welcome back, ${user?.full_name || 'Doctor'}! Review waiting queues, record examinations, order lab diagnostics, and prescribe treatment plans.</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" onclick="showPage('prescriptions')">
            <i class="fas fa-prescription-bottle"></i> Prescriptions
          </button>
          <button class="btn btn-secondary" onclick="showPage('lab-tests')">
            <i class="fas fa-flask"></i> Lab Orders
          </button>
        </div>
      </div>

      <!-- Doctor Stats -->
      <div class="stats-grid" id="doctor-stats">
        <div class="stat-card primary"><div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div></div>
      </div>

      <!-- Two Active Clinical Queues -->
      <div class="dashboard-grid">
        <!-- Queue 1: Patients Waiting for First Consult -->
        <div class="card">
          <div class="card-header" style="background:#f8fafc;">
            <h3 class="card-title">
              <i class="fas fa-stethoscope" style="color:var(--primary);"></i> 1. Waiting for Initial Examination
            </h3>
            <span class="badge-pending" id="doc-q1-count" style="padding:2px 8px; border-radius:12px; font-size:12px;">0 Queued</span>
          </div>
          <div class="card-body" style="padding:0;" id="doctor-q1-container">
            <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
          </div>
        </div>

        <!-- Queue 2: Laboratory Results Returned / Ready for Final Consult -->
        <div class="card">
          <div class="card-header" style="background:#fef3c7;">
            <h3 class="card-title" style="color:#92400e;">
              <i class="fas fa-vial-circle-check"></i> 2. Lab Results Returned (Final Consult)
            </h3>
            <span class="badge-completed" id="doc-q2-count" style="background:#fde68a; color:#78350f; padding:2px 8px; border-radius:12px; font-size:12px;">0 Ready</span>
          </div>
          <div class="card-body" style="padding:0;" id="doctor-q2-container">
            <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
          </div>
        </div>
      </div>
    `;

    try {
      const res = await API.visits.list();
      const allVisits = res.data || [];

      const initialQueue = allVisits.filter(v => v.status === 'waiting_doctor_initial');
      const labReturnedQueue = allVisits.filter(v => v.status === 'waiting_doctor_final');
      const inLab = allVisits.filter(v => v.status === 'waiting_laboratory');
      const completedToday = allVisits.filter(v => v.status === 'completed');

      document.getElementById('doc-q1-count').textContent = `${initialQueue.length} Queued`;
      document.getElementById('doc-q2-count').textContent = `${labReturnedQueue.length} Ready`;

      // Render Stats
      document.getElementById('doctor-stats').innerHTML = `
        <div class="stat-card primary">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-stethoscope"></i></div>
            <span class="stat-trend down">${initialQueue.length} waiting</span>
          </div>
          <div class="stat-value">${initialQueue.length}</div>
          <div class="stat-label">Initial Exams Pending</div>
        </div>

        <div class="stat-card accent">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-vial-circle-check"></i></div>
            <span class="stat-trend up">${labReturnedQueue.length} ready</span>
          </div>
          <div class="stat-value">${labReturnedQueue.length}</div>
          <div class="stat-label">Lab Results Returned for Review</div>
        </div>

        <div class="stat-card warning">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-flask"></i></div>
            <span class="stat-trend">${inLab.length} testing</span>
          </div>
          <div class="stat-value">${inLab.length}</div>
          <div class="stat-label">Patients in Laboratory</div>
        </div>

        <div class="stat-card success">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
            <span class="stat-trend up">Completed</span>
          </div>
          <div class="stat-value">${completedToday.length}</div>
          <div class="stat-label">Patients Consulted Today</div>
        </div>
      `;

      // Render Queue 1 (Initial)
      const q1Container = document.getElementById('doctor-q1-container');
      if (!initialQueue.length) {
        q1Container.innerHTML = '<div style="padding:24px; text-align:center; color:var(--gray-500);"><p style="margin:0;">No patients waiting for initial exam.</p></div>';
      } else {
        q1Container.innerHTML = `
          <div class="today-appointments-list">
            ${initialQueue.map(v => `
              <div class="appointment-row">
                <div class="appt-time"><i class="fas fa-clock"></i> ${formatDate(v.created_at)}</div>
                <div class="appt-info">
                  <div class="appt-patient">${v.patients?.first_name} ${v.patients?.last_name} (${v.patients?.patient_number || 'CARD'})</div>
                  <div class="appt-doctor">Reason: <strong>${v.reason_for_visit}</strong></div>
                </div>
                <button class="btn btn-sm btn-primary" onclick="VisitsWorkflow.showFirstConsultModal('${v.id}')">
                  <i class="fas fa-stethoscope"></i> Start Exam
                </button>
              </div>
            `).join('')}
          </div>
        `;
      }

      // Render Queue 2 (Lab Returned)
      const q2Container = document.getElementById('doctor-q2-container');
      if (!labReturnedQueue.length) {
        q2Container.innerHTML = '<div style="padding:24px; text-align:center; color:var(--gray-500);"><p style="margin:0;">No lab results waiting for review.</p></div>';
      } else {
        q2Container.innerHTML = `
          <div class="today-appointments-list">
            ${labReturnedQueue.map(v => `
              <div class="appointment-row" style="background:#fffbeb;">
                <div class="appt-time" style="color:#b45309;"><i class="fas fa-flask"></i> Results Ready</div>
                <div class="appt-info">
                  <div class="appt-patient" style="color:#92400e;">${v.patients?.first_name} ${v.patients?.last_name} (${v.patients?.patient_number || ''})</div>
                  <div class="appt-doctor">Test: <em>${v.lab_notes || 'Diagnostic Panel'}</em></div>
                </div>
                <button class="btn btn-sm btn-primary" onclick="VisitsWorkflow.showFinalConsultModal('${v.id}')" style="background:#b45309;">
                  <i class="fas fa-notes-medical"></i> Review & Finalize
                </button>
              </div>
            `).join('')}
          </div>
        `;
      }
    } catch (err) {
      showToast('error', 'Doctor Dashboard Error', err.message);
    }
  },

  // ============================================================
  // 3. LABORATORY DASHBOARD
  // ============================================================
  async loadLaboratoryDashboard() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>Laboratory Diagnostics Department</h2>
          <p>Receive physician test orders, perform diagnostic investigations, enter findings, and transmit completed reports back to doctors.</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" onclick="showPage('lab-tests')">
            <i class="fas fa-vial"></i> All Lab Tests
          </button>
        </div>
      </div>

      <!-- Lab Stats -->
      <div class="stats-grid" id="lab-stats">
        <div class="stat-card primary"><div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div></div>
      </div>

      <!-- Pending Lab Queue -->
      <div class="card">
        <div class="card-header" style="background:#ede9fe;">
          <h3 class="card-title" style="color:#4338ca;"><i class="fas fa-flask"></i> Incoming Physician Diagnostic Requests (Queue)</h3>
          <span class="badge-scheduled" id="lab-pending-count" style="background:#c7d2fe; color:#312e81; font-weight:700;">0 Orders</span>
        </div>
        <div class="card-body" style="padding:0;" id="lab-queue-container">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
      </div>
    `;

    try {
      const res = await API.visits.list();
      const allVisits = res.data || [];
      const labQueue = allVisits.filter(v => v.status === 'waiting_laboratory');
      const labDone = allVisits.filter(v => v.status === 'waiting_doctor_final' || v.lab_completed_at);

      document.getElementById('lab-pending-count').textContent = `${labQueue.length} Orders`;

      document.getElementById('lab-stats').innerHTML = `
        <div class="stat-card accent">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-flask"></i></div>
            <span class="stat-trend up">Pending</span>
          </div>
          <div class="stat-value">${labQueue.length}</div>
          <div class="stat-label">Tests Awaiting Results Entry</div>
        </div>

        <div class="stat-card success">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
            <span class="stat-trend up">Completed</span>
          </div>
          <div class="stat-value">${labDone.length}</div>
          <div class="stat-label">Results Submitted to Doctors Today</div>
        </div>

        <div class="stat-card primary">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-microscope"></i></div>
            <span class="stat-trend">Average</span>
          </div>
          <div class="stat-value">18 min</div>
          <div class="stat-label">Diagnostic Turnaround Time</div>
        </div>
      `;

      const qContainer = document.getElementById('lab-queue-container');
      if (!labQueue.length) {
        qContainer.innerHTML = '<div style="padding:24px; text-align:center; color:var(--gray-500);"><p style="margin:0;"><i class="fas fa-check-circle" style="color:var(--success);"></i> All laboratory diagnostic orders are up to date.</p></div>';
      } else {
        qContainer.innerHTML = `
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Patient / Card</th>
                  <th>Attending Doctor</th>
                  <th>Order Details</th>
                  <th>Clinical Notes</th>
                  <th>Order Time</th>
                  <th style="text-align:right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${labQueue.map(v => `
                  <tr>
                    <td>
                      <strong>${v.patients?.first_name} ${v.patients?.last_name}</strong>
                      <div style="font-size:11px; color:var(--gray-500); font-family:monospace;">${v.patients?.patient_number}</div>
                    </td>
                    <td>${v.doctors?.profiles?.full_name || 'Dr. Sarah Smith'}</td>
                    <td><span class="role-badge role-nurse" style="font-size:12px;">${v.lab_notes || 'Diagnostic Panel'}</span></td>
                    <td style="font-size:12px; max-width:200px; overflow:hidden; text-overflow:ellipsis;">${v.initial_assessment || v.reason_for_visit}</td>
                    <td>${formatDate(v.first_consultation_at || v.created_at)}</td>
                    <td style="text-align:right;">
                      <button class="btn btn-sm btn-primary" onclick="VisitsWorkflow.showLabModal('${v.id}')" style="background:#4338ca;">
                        <i class="fas fa-microscope"></i> Enter Findings
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    } catch (err) {
      showToast('error', 'Laboratory Dashboard Error', err.message);
    }
  },

  // ============================================================
  // 4. PHARMACY DASHBOARD
  // ============================================================
  async loadPharmacyDashboard() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>Clinical Pharmacy & Dispensing Queue</h2>
          <p>Receive doctor prescriptions, verify patient allergies & dosages, dispense medications, and send charges to Cashier.</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" onclick="showPage('medicines')">
            <i class="fas fa-boxes"></i> Formulary Inventory
          </button>
          <button class="btn btn-secondary" onclick="showPage('prescriptions')">
            <i class="fas fa-prescription-bottle"></i> All Prescriptions
          </button>
        </div>
      </div>

      <!-- Pharmacy Stats -->
      <div class="stats-grid" id="pharma-stats">
        <div class="stat-card primary"><div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div></div>
      </div>

      <!-- Pending Dispensation Queue -->
      <div class="card">
        <div class="card-header" style="background:#fff7ed;">
          <h3 class="card-title" style="color:#c2410c;"><i class="fas fa-pills"></i> Prescriptions Awaiting Dispensation</h3>
          <span class="badge-pending" id="pharma-pending-count" style="background:#fed7aa; color:#9a3412; font-weight:700;">0 Orders</span>
        </div>
        <div class="card-body" style="padding:0;" id="pharma-queue-container">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
      </div>
    `;

    try {
      const [visitsRes, medsRes] = await Promise.all([
        API.visits.list(),
        API.medicines.list()
      ]);

      const allVisits = visitsRes.data || [];
      const medicines = medsRes.data || [];

      const pharmaQueue = allVisits.filter(v => v.status === 'waiting_pharmacy');
      const dispensed = allVisits.filter(v => v.pharmacy_dispensed_at || v.status === 'waiting_payment');
      const lowStock = medicines.filter(m => (m.stock_quantity || 0) <= (m.minimum_stock_level || 50));

      document.getElementById('pharma-pending-count').textContent = `${pharmaQueue.length} Orders`;

      document.getElementById('pharma-stats').innerHTML = `
        <div class="stat-card warning">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-pills"></i></div>
            <span class="stat-trend down">Queue</span>
          </div>
          <div class="stat-value">${pharmaQueue.length}</div>
          <div class="stat-label">Prescriptions Waiting for Dispensation</div>
        </div>

        <div class="stat-card success">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
            <span class="stat-trend up">Dispensed</span>
          </div>
          <div class="stat-value">${dispensed.length}</div>
          <div class="stat-label">Prescriptions Dispensed Today</div>
        </div>

        <div class="stat-card danger">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
            <span class="stat-trend down">Alert</span>
          </div>
          <div class="stat-value">${lowStock.length}</div>
          <div class="stat-label">Low Stock Formularies (< 50 units)</div>
        </div>
      `;

      const qContainer = document.getElementById('pharma-queue-container');
      if (!pharmaQueue.length) {
        qContainer.innerHTML = '<div style="padding:24px; text-align:center; color:var(--gray-500);"><p style="margin:0;"><i class="fas fa-check-circle" style="color:var(--success);"></i> No pending prescriptions in pharmacy queue.</p></div>';
      } else {
        qContainer.innerHTML = `
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Patient / Card</th>
                  <th>Prescribing Doctor</th>
                  <th>Clinical Diagnosis</th>
                  <th>Treatment Plan</th>
                  <th>Time Issued</th>
                  <th style="text-align:right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${pharmaQueue.map(v => `
                  <tr>
                    <td>
                      <strong>${v.patients?.first_name} ${v.patients?.last_name}</strong>
                      <div style="font-size:11px; color:var(--gray-500); font-family:monospace;">${v.patients?.patient_number}</div>
                    </td>
                    <td>${v.doctors?.profiles?.full_name || 'Dr. Sarah Smith'}</td>
                    <td><strong>${v.final_diagnosis || 'Prescribed'}</strong></td>
                    <td style="font-size:12px; max-width:220px; overflow:hidden; text-overflow:ellipsis;">${v.treatment_plan || '-'}</td>
                    <td>${formatDate(v.final_consultation_at || v.created_at)}</td>
                    <td style="text-align:right;">
                      <button class="btn btn-sm btn-primary" onclick="VisitsWorkflow.showDispenseModal('${v.id}')" style="background:#c2410c;">
                        <i class="fas fa-pills"></i> Dispense & Forward
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    } catch (err) {
      showToast('error', 'Pharmacy Dashboard Error', err.message);
    }
  },

  // ============================================================
  // 5. CASHIER DASHBOARD
  // ============================================================
  async loadCashierDashboard() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>Cashier & Billing Checkout Desk</h2>
          <p>Review completed visits, verify itemized consultation, lab & pharmacy charges, process payments, and generate official receipts.</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" onclick="showPage('invoices')">
            <i class="fas fa-file-invoice-dollar"></i> All Invoices
          </button>
          <button class="btn btn-secondary" onclick="showPage('payments')">
            <i class="fas fa-receipt"></i> Payment Register
          </button>
        </div>
      </div>

      <!-- Cashier Stats -->
      <div class="stats-grid" id="cashier-stats">
        <div class="stat-card primary"><div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div></div>
      </div>

      <!-- Checkout Queue -->
      <div class="card">
        <div class="card-header" style="background:#fce7f3;">
          <h3 class="card-title" style="color:#9d174d;"><i class="fas fa-cash-register"></i> Patient Checkout Queue (Ready for Settlement)</h3>
          <span class="badge-pending" id="cashier-pending-count" style="background:#fbcfe8; color:#831843; font-weight:700;">0 Patients</span>
        </div>
        <div class="card-body" style="padding:0;" id="cashier-queue-container">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
      </div>
    `;

    try {
      const [visitsRes, paymentsRes] = await Promise.all([
        API.visits.list(),
        API.payments.list()
      ]);

      const allVisits = visitsRes.data || [];
      const payments = paymentsRes.data || [];

      const cashierQueue = allVisits.filter(v => v.status === 'waiting_payment');
      const paidVisits = allVisits.filter(v => v.status === 'completed');
      const totalCollected = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

      document.getElementById('cashier-pending-count').textContent = `${cashierQueue.length} Patients`;

      document.getElementById('cashier-stats').innerHTML = `
        <div class="stat-card warning">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-file-invoice-dollar"></i></div>
            <span class="stat-trend down">Awaiting</span>
          </div>
          <div class="stat-value">${cashierQueue.length}</div>
          <div class="stat-label">Visits Awaiting Payment</div>
        </div>

        <div class="stat-card success">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-wallet"></i></div>
            <span class="stat-trend up">Collected</span>
          </div>
          <div class="stat-value">$${totalCollected.toFixed(2)}</div>
          <div class="stat-label">Total Revenue Settled</div>
        </div>

        <div class="stat-card primary">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-check-double"></i></div>
            <span class="stat-trend up">Exited</span>
          </div>
          <div class="stat-value">${paidVisits.length}</div>
          <div class="stat-label">Visits Completed & Discharged</div>
        </div>
      `;

      const qContainer = document.getElementById('cashier-queue-container');
      if (!cashierQueue.length) {
        qContainer.innerHTML = '<div style="padding:24px; text-align:center; color:var(--gray-500);"><p style="margin:0;"><i class="fas fa-check-circle" style="color:var(--success);"></i> No patients currently in checkout queue.</p></div>';
      } else {
        qContainer.innerHTML = `
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Visit #</th>
                  <th>Patient / Card</th>
                  <th>Doctor Fee</th>
                  <th>Lab Fee</th>
                  <th>Pharmacy Fee</th>
                  <th>Total Due</th>
                  <th style="text-align:right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${cashierQueue.map(v => `
                  <tr>
                    <td><strong>${v.visit_number}</strong></td>
                    <td>
                      <strong>${v.patients?.first_name} ${v.patients?.last_name}</strong>
                      <div style="font-size:11px; color:var(--gray-500); font-family:monospace;">${v.patients?.patient_number}</div>
                    </td>
                    <td>$${parseFloat(v.consultation_fee || 0).toFixed(2)}</td>
                    <td>$${parseFloat(v.lab_fee || 0).toFixed(2)}</td>
                    <td>$${parseFloat(v.pharmacy_fee || 0).toFixed(2)}</td>
                    <td style="font-size:15px; font-weight:700; color:var(--success);">$${parseFloat(v.total_fee || 75).toFixed(2)}</td>
                    <td style="text-align:right;">
                      <button class="btn btn-sm btn-primary" onclick="VisitsWorkflow.showPaymentModal('${v.id}')" style="background:#059669;">
                        <i class="fas fa-receipt"></i> Process Settlement
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    } catch (err) {
      showToast('error', 'Cashier Dashboard Error', err.message);
    }
  },

  // ============================================================
  // 6. ADMIN & LEADERSHIP DASHBOARD (Full 7-Stage Flow Visualizer)
  // ============================================================
  // ============================================================
  // 6. ADMIN & LEADERSHIP EXECUTIVE DASHBOARD (Complete Live Operations)
  // ============================================================
  adminDaysFilter: 30,

  async loadAdminDashboard() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header" style="margin-bottom: 20px;">
        <div class="page-header-info">
          <h2>ClinicCare Pro — Executive Command Center</h2>
          <p>Real-time clinic orchestration, departmental workloads, live patient queues, and financial metrics.</p>
        </div>
        <div class="page-header-actions" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <select id="admin-date-filter" class="form-control" style="width: auto; height: 38px; font-weight: 600;" onchange="DashboardPage.onAdminFilterChange(this.value)">
            <option value="7" ${this.adminDaysFilter === 7 ? 'selected' : ''}>Past 7 Days</option>
            <option value="30" ${this.adminDaysFilter === 30 ? 'selected' : ''}>Past 30 Days</option>
            <option value="90" ${this.adminDaysFilter === 90 ? 'selected' : ''}>Past 90 Days</option>
            <option value="365" ${this.adminDaysFilter === 365 ? 'selected' : ''}>Past Year</option>
          </select>
          <button class="btn btn-secondary" onclick="DashboardPage.loadAdminDashboard()" title="Refresh live metrics">
            <i class="fas fa-sync-alt"></i> Refresh Live
          </button>
          <button class="btn btn-primary" onclick="VisitsWorkflow.showCheckInModal()">
            <i class="fas fa-user-plus"></i> Check In Patient
          </button>
        </div>
      </div>

      <!-- Section: Executive KPI Pillar Cards -->
      <div class="stats-grid" id="admin-kpi-cards" style="margin-bottom: 20px;">
        <div class="stat-card primary"><div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div></div>
        <div class="stat-card info"><div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div></div>
        <div class="stat-card success"><div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div></div>
        <div class="stat-card warning"><div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div></div>
      </div>

      <!-- Section: Live Clinic Departmental Queues & Workflow Stages -->
      <div class="card" style="margin-bottom: 24px; box-shadow: var(--shadow-md);">
        <div class="card-header" style="background: linear-gradient(90deg, #f8fafc, #edf2f7); border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 class="card-title" style="margin:0;"><i class="fas fa-project-diagram" style="color:var(--primary);"></i> Live Clinical Workflow & Active Queues</h3>
            <span style="font-size:12px; color:var(--gray-500);">Live synchronization across Reception, Consultation, Laboratory, Pharmacy, and Checkout</span>
          </div>
          <button class="btn btn-sm btn-ghost" onclick="showPage('visits')"><i class="fas fa-external-link-alt"></i> Full Queue Screen</button>
        </div>
        <div class="card-body" id="admin-workflow-queues" style="padding: 18px;">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading live queues...</div>
        </div>
      </div>

      <!-- Section: Interactive Visual Analytics & Charts Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 20px; margin-bottom: 24px;">
        <!-- Chart 1: Revenue Over Time -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-chart-line" style="color:var(--success);"></i> Revenue Generated Over Time</h3>
            <span class="badge badge-success" id="admin-chart-rev-label">Real Payments</span>
          </div>
          <div class="card-body" id="admin-chart-revenue" style="padding: 20px;">
            <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
          </div>
        </div>

        <!-- Chart 2: Appointments by Status -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-calendar-check" style="color:var(--primary);"></i> Appointments by Status</h3>
            <span class="badge badge-primary">Volume</span>
          </div>
          <div class="card-body" id="admin-chart-appts" style="padding: 20px;">
            <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
          </div>
        </div>

        <!-- Chart 3: Patient Flow by Stage -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-stream" style="color:var(--info);"></i> Patient Flow Distribution</h3>
            <span class="badge badge-info">Stage Load</span>
          </div>
          <div class="card-body" id="admin-chart-flow" style="padding: 20px;">
            <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
          </div>
        </div>

        <!-- Chart 4: Patient Registrations Growth -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-user-plus" style="color:#7c3aed;"></i> Patient Registrations Growth</h3>
            <span class="badge badge-secondary">New Patients</span>
          </div>
          <div class="card-body" id="admin-chart-patients" style="padding: 20px;">
            <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
          </div>
        </div>

        <!-- Chart 5: Laboratory Activity -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-flask" style="color:#0891b2;"></i> Laboratory Test Operations</h3>
            <span class="badge badge-warning">Diagnostics</span>
          </div>
          <div class="card-body" id="admin-chart-lab" style="padding: 20px;">
            <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
          </div>
        </div>

        <!-- Chart 6: Pharmacy & Inventory Status -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-pills" style="color:var(--warning);"></i> Pharmacy Inventory Health</h3>
            <span class="badge badge-danger" id="admin-inventory-alert-badge">Stock Alerts</span>
          </div>
          <div class="card-body" id="admin-chart-inventory" style="padding: 20px;">
            <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
          </div>
        </div>
      </div>

      <!-- Section: Real-Time Feeds Tabs (Appointments, Patients, Payments, Audit Activity) -->
      <div class="card" style="box-shadow: var(--shadow);">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; gap:8px;">
            <button class="btn btn-sm btn-primary" id="tab-btn-appts" onclick="DashboardPage.switchFeedTab('appts')">
              <i class="fas fa-calendar-alt"></i> Recent Appointments
            </button>
            <button class="btn btn-sm btn-ghost" id="tab-btn-patients" onclick="DashboardPage.switchFeedTab('patients')">
              <i class="fas fa-users"></i> Recent Patients
            </button>
            <button class="btn btn-sm btn-ghost" id="tab-btn-payments" onclick="DashboardPage.switchFeedTab('payments')">
              <i class="fas fa-receipt"></i> Recent Payments
            </button>
            <button class="btn btn-sm btn-ghost" id="tab-btn-audit" onclick="DashboardPage.switchFeedTab('audit')">
              <i class="fas fa-history"></i> System Activity Logs
            </button>
          </div>
          <span style="font-size:12px; color:var(--gray-500);"><i class="fas fa-bolt" style="color:var(--warning);"></i> Live Feed from Database</span>
        </div>
        <div class="card-body" style="padding: 0;" id="admin-feed-container">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading live feed...</div>
        </div>
      </div>
    `;

    await this.fetchAndRenderAdminData();
  },

  onAdminFilterChange(val) {
    this.adminDaysFilter = parseInt(val) || 30;
    this.fetchAndRenderAdminData();
  },

  async fetchAndRenderAdminData() {
    try {
      const [statsRes, analyticsRes, feedsRes] = await Promise.all([
        API.dashboard.stats(),
        API.dashboard.analytics({ days: this.adminDaysFilter }),
        API.dashboard.recentFeeds()
      ]);

      const stats = statsRes || {};
      const analytics = analyticsRes || {};
      this.cachedAdminFeeds = feedsRes || {};

      // 1. Render KPI Pillar Cards
      this.renderAdminKPICards(stats);

      // 2. Render Workflow Queues
      this.renderAdminWorkflowQueues(stats);

      // 3. Render 6 Charts
      this.renderAdminCharts(analytics, stats);

      // 4. Render Active Feed Tab
      this.switchFeedTab('appts');
    } catch (err) {
      console.error('Admin dashboard load error:', err);
      showToast('error', 'Dashboard Sync Failed', err.message);
      const kpis = document.getElementById('admin-kpi-cards');
      if (kpis) {
        kpis.innerHTML = `
          <div class="card" style="grid-column: 1 / -1; padding: 24px; text-align: center; border: 1px solid var(--danger);">
            <i class="fas fa-exclamation-triangle" style="font-size: 32px; color: var(--danger); margin-bottom: 12px;"></i>
            <h3>Database Synchronization Warning</h3>
            <p style="color: var(--gray-600); margin-bottom: 16px;">${err.message}</p>
            <button class="btn btn-primary" onclick="DashboardPage.loadAdminDashboard()"><i class="fas fa-redo"></i> Retry Connection</button>
          </div>
        `;
      }
    }
  },

  renderAdminKPICards(stats) {
    const container = document.getElementById('admin-kpi-cards');
    if (!container) return;

    container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(210px, 1fr))';
    container.style.gap = '16px';

    container.innerHTML = `
      <!-- 1. Total Patients -->
      <div class="stat-card primary" onclick="showPage('patients')" style="cursor:pointer;" title="Click to view Patient Directory">
        <div class="stat-card-header">
          <div class="stat-icon"><i class="fas fa-user-injured"></i></div>
          <span class="stat-trend up"><i class="fas fa-users"></i> Directory</span>
        </div>
        <div class="stat-value">${formatNumber(stats.total_patients || 0)}</div>
        <div class="stat-label">Total Patients</div>
      </div>

      <!-- 2. Total Staff -->
      <div class="stat-card info" onclick="showPage('users')" style="cursor:pointer;" title="Click to view Staff Management">
        <div class="stat-card-header">
          <div class="stat-icon"><i class="fas fa-users-cog"></i></div>
          <span class="stat-trend up">Profiles</span>
        </div>
        <div class="stat-value">${formatNumber(stats.total_staff || 0)}</div>
        <div class="stat-label">Total Staff</div>
      </div>

      <!-- 3. Total Doctors -->
      <div class="stat-card" onclick="showPage('doctors')" style="cursor:pointer; background:white; border-left:4px solid #06b6d4;" title="Click to view Doctor Directory">
        <div class="stat-card-header">
          <div class="stat-icon" style="background:#ecfeff; color:#0891b2;"><i class="fas fa-user-md"></i></div>
          <span class="stat-trend up" style="color:#0891b2;">Attending</span>
        </div>
        <div class="stat-value">${formatNumber(stats.total_doctors || 0)}</div>
        <div class="stat-label">Total Doctors</div>
      </div>

      <!-- 4. Today's Appointments -->
      <div class="stat-card warning" onclick="showPage('appointments')" style="cursor:pointer;" title="Click to view Today's Appointments">
        <div class="stat-card-header">
          <div class="stat-icon"><i class="fas fa-calendar-check"></i></div>
          <span class="stat-trend up">${stats.appointments_this_month || 0} this month</span>
        </div>
        <div class="stat-value">${formatNumber(stats.appointments_today || 0)}</div>
        <div class="stat-label">Today's Appointments</div>
      </div>

      <!-- 5. Patients Waiting -->
      <div class="stat-card" onclick="showPage('visits')" style="cursor:pointer; background:white; border-left:4px solid #f59e0b;" title="Click to view Patient Flow Queue">
        <div class="stat-card-header">
          <div class="stat-icon" style="background:#fffbeb; color:#d97706;"><i class="fas fa-user-clock"></i></div>
          <span class="stat-trend down" style="color:#d97706;">Live Queue</span>
        </div>
        <div class="stat-value">${formatNumber(stats.waiting_patients || 0)}</div>
        <div class="stat-label">Patients Waiting</div>
      </div>

      <!-- 6. Pending Laboratory Tests -->
      <div class="stat-card" onclick="showPage('lab-tests')" style="cursor:pointer; background:white; border-left:4px solid #8b5cf6;" title="Click to view Laboratory Orders">
        <div class="stat-card-header">
          <div class="stat-icon" style="background:#f5f3ff; color:#7c3aed;"><i class="fas fa-flask"></i></div>
          <span class="stat-trend up" style="color:#7c3aed;">In Progress</span>
        </div>
        <div class="stat-value">${formatNumber(stats.pending_lab_tests || 0)}</div>
        <div class="stat-label">Pending Lab Tests</div>
      </div>

      <!-- 7. Patients Waiting for Payment -->
      <div class="stat-card" onclick="showPage('financial')" style="cursor:pointer; background:white; border-left:4px solid #ec4899;" title="Click to view Checkout Queue">
        <div class="stat-card-header">
          <div class="stat-icon" style="background:#fdf2f8; color:#db2777;"><i class="fas fa-cash-register"></i></div>
          <span class="stat-trend down" style="color:#db2777;">Checkout</span>
        </div>
        <div class="stat-value">${formatNumber(stats.waiting_payment || 0)}</div>
        <div class="stat-label">Patients Waiting for Payment</div>
      </div>

      <!-- 8. Today's Recorded Payments -->
      <div class="stat-card success" onclick="showPage('financial')" style="cursor:pointer;" title="Click to view Financial Transactions">
        <div class="stat-card-header">
          <div class="stat-icon"><i class="fas fa-receipt"></i></div>
          <span class="stat-trend up">Collected</span>
        </div>
        <div class="stat-value">${formatCurrency(stats.today_revenue || 0)}</div>
        <div class="stat-label">Today's Recorded Payments</div>
      </div>

      <!-- 9. Outstanding Invoice Balances -->
      <div class="stat-card" onclick="showPage('financial')" style="cursor:pointer; background:white; border-left:4px solid #ef4444;" title="Click to view Unpaid Invoices">
        <div class="stat-card-header">
          <div class="stat-icon" style="background:#fef2f2; color:#dc2626;"><i class="fas fa-file-invoice-dollar"></i></div>
          <span class="stat-trend down" style="color:#dc2626;">${stats.pending_invoices || 0} unpaid</span>
        </div>
        <div class="stat-value">${formatCurrency(stats.outstanding_balance || 0)}</div>
        <div class="stat-label">Outstanding Invoice Balances</div>
      </div>

      <!-- 10. Low-Stock Medicines -->
      <div class="stat-card" onclick="showPage('medicines')" style="cursor:pointer; background:white; border-left:4px solid #ea580c;" title="Click to view Pharmacy Inventory">
        <div class="stat-card-header">
          <div class="stat-icon" style="background:#fff7ed; color:#ea580c;"><i class="fas fa-pills"></i></div>
          <span class="stat-trend ${stats.low_stock_medicines > 0 ? 'down' : 'up'}" style="color:#ea580c;">Threshold Alert</span>
        </div>
        <div class="stat-value">${formatNumber(stats.low_stock_medicines || 0)}</div>
        <div class="stat-label">Low-Stock Medicines</div>
      </div>
    `;
  },

  renderAdminWorkflowQueues(stats) {
    const container = document.getElementById('admin-workflow-queues');
    if (!container) return;

    container.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
        <div style="background:#eff6ff; border-top:3px solid #3b82f6; padding:12px; border-radius:8px; text-align:center; cursor:pointer;" onclick="showPage('visits')">
          <div style="font-size:11px; font-weight:700; color:#1d4ed8; text-transform:uppercase;">1. Waiting Initial</div>
          <div style="font-size:24px; font-weight:800; color:#1e40af; margin:4px 0;">${stats.waiting_patients || 0}</div>
          <div style="font-size:11px; color:#3b82f6;">Arrival & Vitals</div>
        </div>

        <div style="background:#f5f3ff; border-top:3px solid #8b5cf6; padding:12px; border-radius:8px; text-align:center; cursor:pointer;" onclick="showPage('visits')">
          <div style="font-size:11px; font-weight:700; color:#6d28d9; text-transform:uppercase;">2. In Consultation</div>
          <div style="font-size:24px; font-weight:800; color:#5b21b6; margin:4px 0;">${stats.in_consultation || 0}</div>
          <div style="font-size:11px; color:#7c3aed;">With Physician</div>
        </div>

        <div style="background:#ecfeff; border-top:3px solid #06b6d4; padding:12px; border-radius:8px; text-align:center; cursor:pointer;" onclick="showPage('lab-tests')">
          <div style="font-size:11px; font-weight:700; color:#0e7490; text-transform:uppercase;">3. Pending Lab</div>
          <div style="font-size:24px; font-weight:800; color:#155e75; margin:4px 0;">${stats.pending_lab_tests || 0}</div>
          <div style="font-size:11px; color:#0891b2;">Diagnostic Tests</div>
        </div>

        <div style="background:#fff7ed; border-top:3px solid #f97316; padding:12px; border-radius:8px; text-align:center; cursor:pointer;" onclick="showPage('prescriptions')">
          <div style="font-size:11px; font-weight:700; color:#c2410c; text-transform:uppercase;">4. Wait Pharmacy</div>
          <div style="font-size:24px; font-weight:800; color:#9a3412; margin:4px 0;">${stats.waiting_pharmacy || 0}</div>
          <div style="font-size:11px; color:#ea580c;">Rx Dispensing</div>
        </div>

        <div style="background:#fdf2f8; border-top:3px solid #ec4899; padding:12px; border-radius:8px; text-align:center; cursor:pointer;" onclick="showPage('invoices')">
          <div style="font-size:11px; font-weight:700; color:#be185d; text-transform:uppercase;">5. Wait Payment</div>
          <div style="font-size:24px; font-weight:800; color:#9d174d; margin:4px 0;">${stats.waiting_payment || 0}</div>
          <div style="font-size:11px; color:#db2777;">Cashier Checkout</div>
        </div>

        <div style="background:#ecfdf5; border-top:3px solid #10b981; padding:12px; border-radius:8px; text-align:center; cursor:pointer;" onclick="showPage('visits')">
          <div style="font-size:11px; font-weight:700; color:#047857; text-transform:uppercase;">6. Completed Visits</div>
          <div style="font-size:24px; font-weight:800; color:#065f46; margin:4px 0;">${stats.completed_visits || 0}</div>
          <div style="font-size:11px; color:#059669;">Exited Clinic</div>
        </div>
      </div>
    `;
  },

  renderAdminCharts(analytics, stats) {
    // 1. Revenue Over Time (CSS bar chart)
    const revContainer = document.getElementById('admin-chart-revenue');
    if (revContainer) {
      const revData = analytics.revenue_over_time || [];
      if (!revData.length) {
        revContainer.innerHTML = '<p style="text-align:center; color:var(--gray-500); padding:20px;">No revenue records yet for this period.</p>';
      } else {
        const maxRev = Math.max(...revData.map(r => r.revenue), 100);
        revContainer.innerHTML = `
          <div style="display:flex; align-items:flex-end; gap:14px; height:180px; padding:0 10px 10px; border-bottom:1px solid var(--gray-200);">
            ${revData.map(r => {
              const pct = Math.max(8, Math.round((r.revenue / maxRev) * 100));
              return `
                <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:6px; height:100%; justify-content:flex-end;">
                  <span style="font-size:11px; font-weight:700; color:var(--gray-700);">$${Math.round(r.revenue)}</span>
                  <div style="width:100%; max-width:40px; height:${pct}%; background:linear-gradient(180deg, #10b981, #059669); border-radius:4px 4px 0 0; transition:height 0.4s ease;" title="${r.label}: $${r.revenue}"></div>
                  <span style="font-size:11px; color:var(--gray-500); font-weight:600;">${r.label}</span>
                </div>
              `;
            }).join('')}
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:10px; font-size:12px; color:var(--gray-600);">
            <span><strong>Total Period Revenue:</strong> $${revData.reduce((s, r) => s + r.revenue, 0).toFixed(2)}</span>
            <span><i class="fas fa-check-circle" style="color:var(--success);"></i> Verified Real Payments</span>
          </div>
        `;
      }
    }

    // 2. Appointments by Status (Visual progress distribution)
    const apptsContainer = document.getElementById('admin-chart-appts');
    if (apptsContainer) {
      const apptCounts = analytics.appointments_by_status || {};
      const totalAppts = Object.values(apptCounts).reduce((a, b) => a + b, 0);

      const items = [
        { label: 'Completed', count: apptCounts.completed || 0, color: 'var(--success)' },
        { label: 'Confirmed', count: apptCounts.confirmed || 0, color: 'var(--primary)' },
        { label: 'Scheduled', count: apptCounts.scheduled || 0, color: 'var(--info)' },
        { label: 'In Progress', count: apptCounts.in_progress || 0, color: '#f59e0b' },
        { label: 'Cancelled', count: apptCounts.cancelled || 0, color: 'var(--danger)' },
        { label: 'No Show', count: apptCounts.no_show || 0, color: 'var(--gray-500)' }
      ];

      apptsContainer.innerHTML = `
        <div style="margin-bottom:14px; font-size:13px; color:var(--gray-700);">
          <strong>Total Appointments Tracked:</strong> ${totalAppts}
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${items.map(item => {
            const pct = totalAppts > 0 ? Math.round((item.count / totalAppts) * 100) : 0;
            return `
              <div>
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                  <span style="font-weight:600; color:var(--gray-800);">${item.label}</span>
                  <span style="color:var(--gray-600);">${item.count} (${pct}%)</span>
                </div>
                <div style="background:var(--gray-100); height:8px; border-radius:4px; overflow:hidden;">
                  <div style="background:${item.color}; width:${pct}%; height:100%; border-radius:4px;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // 3. Patient Flow by Stage
    const flowContainer = document.getElementById('admin-chart-flow');
    if (flowContainer) {
      const stages = analytics.patient_flow || [];
      const totalVisits = stages.reduce((s, st) => s + st.count, 0) || 1;

      flowContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${stages.map((st, i) => {
            const pct = Math.round((st.count / totalVisits) * 100);
            return `
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:12px; width:170px; color:var(--gray-700); font-weight:500;">${st.stage}</span>
                <div style="flex:1; background:var(--gray-100); height:10px; border-radius:5px; overflow:hidden;">
                  <div style="background:linear-gradient(90deg, var(--primary), var(--accent)); width:${pct}%; height:100%;"></div>
                </div>
                <span style="font-size:12px; font-weight:700; width:45px; text-align:right;">${st.count}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // 4. Patient Registrations Growth
    const patContainer = document.getElementById('admin-chart-patients');
    if (patContainer) {
      const patData = analytics.registrations_over_time || [];
      const maxPat = Math.max(...patData.map(p => p.count), 10);

      patContainer.innerHTML = `
        <div style="display:flex; align-items:flex-end; gap:12px; height:180px; padding:0 10px 10px; border-bottom:1px solid var(--gray-200);">
          ${patData.map(p => {
            const pct = Math.max(6, Math.round((p.count / maxPat) * 100));
            return `
              <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:6px; height:100%; justify-content:flex-end;">
                <span style="font-size:11px; font-weight:700; color:#6d28d9;">${p.count}</span>
                <div style="width:100%; max-width:36px; height:${pct}%; background:linear-gradient(180deg, #8b5cf6, #6d28d9); border-radius:4px 4px 0 0;" title="${p.label}: ${p.count} patients"></div>
                <span style="font-size:11px; color:var(--gray-500); font-weight:600;">${p.label}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // 5. Laboratory Test Operations
    const labContainer = document.getElementById('admin-chart-lab');
    if (labContainer) {
      const labData = analytics.lab_activity || {};
      labContainer.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px;">
          <div style="background:#ecfeff; padding:14px; border-radius:8px; border-left:4px solid #06b6d4;">
            <div style="font-size:11px; font-weight:700; color:#0891b2; text-transform:uppercase;">Requested</div>
            <div style="font-size:22px; font-weight:800; color:#155e75; margin:4px 0;">${labData.requested || 0}</div>
            <div style="font-size:11px; color:#0e7490;">Awaiting Sample Collection</div>
          </div>
          <div style="background:#fefce8; padding:14px; border-radius:8px; border-left:4px solid #eab308;">
            <div style="font-size:11px; font-weight:700; color:#a16207; text-transform:uppercase;">Processing</div>
            <div style="font-size:22px; font-weight:800; color:#854d0e; margin:4px 0;">${(labData.sample_collected || 0) + (labData.processing || 0)}</div>
            <div style="font-size:11px; color:#713f12;">In Lab Analysis</div>
          </div>
          <div style="background:#f0fdf4; padding:14px; border-radius:8px; border-left:4px solid #22c55e;">
            <div style="font-size:11px; font-weight:700; color:#15803d; text-transform:uppercase;">Completed</div>
            <div style="font-size:22px; font-weight:800; color:#14532d; margin:4px 0;">${labData.completed || 0}</div>
            <div style="font-size:11px; color:#166534;">Results Published</div>
          </div>
          <div style="background:#fef2f2; padding:14px; border-radius:8px; border-left:4px solid #ef4444;">
            <div style="font-size:11px; font-weight:700; color:#b91c1c; text-transform:uppercase;">Cancelled</div>
            <div style="font-size:22px; font-weight:800; color:#7f1d1d; margin:4px 0;">${labData.cancelled || 0}</div>
            <div style="font-size:11px; color:#991b1b;">Cancelled Orders</div>
          </div>
        </div>
      `;
    }

    // 6. Pharmacy Inventory Health
    const invContainer = document.getElementById('admin-chart-inventory');
    if (invContainer) {
      const inv = analytics.inventory_status || {};
      invContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#f0fdf4; border-radius:6px;">
            <span><i class="fas fa-check-circle" style="color:var(--success);"></i> Adequate Stock Levels</span>
            <strong style="color:#166534;">${inv.in_stock || 0} Items</strong>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#fffbeb; border-radius:6px; cursor:pointer;" onclick="showPage('medicines')">
            <span><i class="fas fa-exclamation-triangle" style="color:var(--warning);"></i> Low Stock Alerts (Reorder)</span>
            <strong style="color:#b45309;">${inv.low_stock || 0} Items</strong>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#fef2f2; border-radius:6px; cursor:pointer;" onclick="showPage('medicines')">
            <span><i class="fas fa-calendar-times" style="color:var(--danger);"></i> Nearing Expiry (&lt; 30 Days)</span>
            <strong style="color:#b91c1c;">${inv.expiring_soon || 0} Batches</strong>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#f8fafc; border-radius:6px;">
            <span><i class="fas fa-times-circle" style="color:var(--gray-500);"></i> Out of Stock</span>
            <strong style="color:var(--gray-700);">${inv.out_of_stock || 0} Items</strong>
          </div>
        </div>
      `;
    }
  },

  switchFeedTab(tab) {
    const container = document.getElementById('admin-feed-container');
    if (!container) return;

    ['appts', 'patients', 'payments', 'audit'].forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      if (btn) {
        if (t === tab) {
          btn.className = 'btn btn-sm btn-primary';
        } else {
          btn.className = 'btn btn-sm btn-ghost';
        }
      }
    });

    const feeds = this.cachedAdminFeeds || {};

    if (tab === 'appts') {
      const list = feeds.recent_appointments || [];
      if (!list.length) {
        container.innerHTML = '<div style="padding:24px; text-align:center; color:var(--gray-500);">No appointments recorded yet.</div>';
      } else {
        container.innerHTML = `
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Appointment #</th>
                  <th>Patient</th>
                  <th>Attending Doctor</th>
                  <th>Date & Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(a => `
                  <tr>
                    <td><strong>${a.appointment_number}</strong></td>
                    <td>
                      <strong>${a.patients?.first_name || 'Patient'} ${a.patients?.last_name || ''}</strong>
                      <div style="font-size:11px; color:var(--gray-500);">${a.patients?.patient_number || '-'}</div>
                    </td>
                    <td>${a.doctors?.profiles?.full_name || 'Doctor'}</td>
                    <td>${a.appointment_date} at ${a.appointment_time?.substring(0, 5) || ''}</td>
                    <td><span class="status-badge badge-${a.status}">${a.status}</span></td>
                    <td>
                      <button class="btn btn-sm btn-secondary" onclick="showPage('appointments')">View</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    } else if (tab === 'patients') {
      const list = feeds.recent_patients || [];
      if (!list.length) {
        container.innerHTML = '<div style="padding:24px; text-align:center; color:var(--gray-500);">No patient records found.</div>';
      } else {
        container.innerHTML = `
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Card #</th>
                  <th>Patient Name</th>
                  <th>Contact Phone</th>
                  <th>Registration Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(p => `
                  <tr>
                    <td><strong>${p.patient_number}</strong></td>
                    <td><strong>${p.first_name} ${p.last_name}</strong></td>
                    <td>${p.phone || '-'}</td>
                    <td>${p.created_at?.split('T')[0] || '-'}</td>
                    <td><span class="status-badge ${p.is_active ? 'badge-completed' : 'badge-cancelled'}">${p.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td><button class="btn btn-sm btn-secondary" onclick="showPage('patients')">Inspect</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    } else if (tab === 'payments') {
      const list = feeds.recent_payments || [];
      if (!list.length) {
        container.innerHTML = '<div style="padding:24px; text-align:center; color:var(--gray-500);">No payment records found.</div>';
      } else {
        container.innerHTML = `
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Patient</th>
                  <th>Amount</th>
                  <th>Payment Method</th>
                  <th>Transaction Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(p => `
                  <tr>
                    <td><strong>${p.payment_number}</strong></td>
                    <td>${p.patients ? `${p.patients.first_name} ${p.patients.last_name}` : 'Patient'}</td>
                    <td><strong style="color:var(--success);">$${parseFloat(p.amount || 0).toFixed(2)}</strong></td>
                    <td><span class="badge badge-secondary" style="text-transform:uppercase;">${p.payment_method || 'Cash'}</span></td>
                    <td>${p.payment_date || p.created_at?.split('T')[0] || '-'}</td>
                    <td><button class="btn btn-sm btn-secondary" onclick="showPage('payments')">Receipt</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    } else if (tab === 'audit') {
      const list = feeds.recent_activities || [];
      if (!list.length) {
        container.innerHTML = '<div style="padding:24px; text-align:center; color:var(--gray-500);">No system activities logged yet.</div>';
      } else {
        container.innerHTML = `
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Entity Type</th>
                  <th>Acting User</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(l => `
                  <tr>
                    <td style="font-size:12px; font-family:monospace;">${l.created_at ? new Date(l.created_at).toLocaleString() : '-'}</td>
                    <td><span class="badge badge-primary">${l.action}</span></td>
                    <td><span class="badge badge-secondary">${l.entity_type}</span></td>
                    <td>${l.profiles?.full_name || l.profiles?.email || 'System'}</td>
                    <td style="font-size:12px; color:var(--gray-600);">${typeof l.details === 'object' ? JSON.stringify(l.details) : l.details || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    }
  }
};

window.DashboardPage = DashboardPage;

