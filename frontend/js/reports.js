/* ============================================================
   REPORTS.JS - Analytics, Financial Breakdown & Clinic Metrics
   ============================================================ */

const ReportsPage = {
  currentType: 'revenue',
  dateFrom: '',
  dateTo: '',
  currentData: null,

  async load() {
    // Default to last 30 days
    const d = new Date();
    this.dateTo = d.toISOString().split('T')[0];
    const past = new Date();
    past.setDate(past.getDate() - 30);
    this.dateFrom = past.toISOString().split('T')[0];

    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>Clinical & Financial Reports</h2>
          <p>Multi-dimensional operational oversight, revenue reports, diagnostic statistics, and patient flow analytics</p>
        </div>
        <div class="page-header-actions" style="display:flex;gap:8px;">
          <button class="btn btn-secondary" onclick="ReportsPage.exportCSV()">
            <i class="fas fa-file-csv"></i> Export CSV
          </button>
          <button class="btn btn-secondary" onclick="window.print()">
            <i class="fas fa-print"></i> Print
          </button>
        </div>
      </div>

      <!-- Report Tabs -->
      <div style="display:flex;gap:8px;margin-bottom:16px;overflow-x:auto;padding-bottom:4px;" id="reports-tab-bar">
        ${[
          { id: 'revenue', icon: 'fa-dollar-sign', label: 'Revenue' },
          { id: 'patients', icon: 'fa-user-injured', label: 'Patients' },
          { id: 'appointments', icon: 'fa-calendar-check', label: 'Appointments' },
          { id: 'doctors', icon: 'fa-user-md', label: 'Doctors' },
          { id: 'laboratory', icon: 'fa-flask', label: 'Laboratory' },
          { id: 'pharmacy', icon: 'fa-pills', label: 'Pharmacy' },
          { id: 'staff', icon: 'fa-users-cog', label: 'Staff' },
          { id: 'flow', icon: 'fa-stream', label: 'Patient Flow' }
        ].map(tab => `
          <button class="btn ${tab.id === this.currentType ? 'btn-primary' : 'btn-outline'}" 
                  id="tab-btn-${tab.id}" 
                  style="white-space:nowrap;font-size:13px;padding:8px 14px;" 
                  onclick="ReportsPage.switchTab('${tab.id}')">
            <i class="fas ${tab.icon}" style="margin-right:6px;"></i> ${tab.label}
          </button>
        `).join('')}
      </div>

      <!-- Date Range Controls -->
      <div class="card" style="margin-bottom: 24px; padding: 16px;">
        <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-size: 13px; font-weight: 600; color: var(--gray-700);">From:</label>
            <input type="date" id="rep-from" class="form-control" style="width: 160px;" value="${this.dateFrom}" onchange="ReportsPage.onDateChange()">
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-size: 13px; font-weight: 600; color: var(--gray-700);">To:</label>
            <input type="date" id="rep-to" class="form-control" style="width: 160px;" value="${this.dateTo}" onchange="ReportsPage.onDateChange()">
          </div>
          <button class="btn btn-primary" onclick="ReportsPage.generate()">
            <i class="fas fa-sync-alt"></i> Update Report
          </button>
        </div>
      </div>

      <div id="reports-output">
        <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
      </div>
    `;

    await this.generate();
  },

  switchTab(type) {
    this.currentType = type;
    document.querySelectorAll('#reports-tab-bar button').forEach(btn => {
      btn.className = 'btn btn-outline';
    });
    const activeBtn = document.getElementById(`tab-btn-${type}`);
    if (activeBtn) activeBtn.className = 'btn btn-primary';
    this.generate();
  },

  onDateChange() {
    this.dateFrom = document.getElementById('rep-from').value;
    this.dateTo = document.getElementById('rep-to').value;
  },

  async generate() {
    const container = document.getElementById('reports-output');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
      const data = await API.reports.detailed({
        type: this.currentType,
        date_from: this.dateFrom,
        date_to: this.dateTo
      });
      this.currentData = data;

      const summaryCards = data.summaryCards || [];
      const rows = data.rows || [];
      const columns = data.columns || [];

      container.innerHTML = `
        <!-- KPI Summary Cards -->
        <div class="stats-grid" style="margin-bottom:24px;">
          ${summaryCards.map(c => `
            <div class="stat-card ${c.type || 'primary'}">
              <div class="stat-card-header">
                <div class="stat-icon"><i class="fas ${c.icon || 'fa-chart-bar'}"></i></div>
                <span class="stat-trend up">Period</span>
              </div>
              <div class="stat-value">${c.value}</div>
              <div class="stat-label">${c.label}</div>
            </div>
          `).join('')}
        </div>

        <!-- Data Table Card -->
        <div class="card">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <h3 class="card-title">
              <i class="fas fa-table"></i> ${this.getReportTitle(this.currentType)}
            </h3>
            <span style="font-size:12px;color:var(--gray-500);font-weight:600;">
              Total Records: ${rows.length}
            </span>
          </div>
          <div class="card-body" style="padding:0;">
            ${rows.length === 0 ? `
              <div class="empty-state p-5" style="text-align:center;">
                <i class="fas fa-folder-open" style="font-size:36px;color:var(--gray-400);margin-bottom:12px;"></i>
                <h3>No records found</h3>
                <p style="color:var(--gray-500);">No transactions or clinical activities recorded for the selected date window.</p>
              </div>
            ` : `
              <div class="table-wrapper">
                <table class="table">
                  <thead>
                    <tr>
                      ${columns.map(col => `<th>${col.label || col.key}</th>`).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${rows.map(row => `
                      <tr>
                        ${columns.map(col => `
                          <td>${this.formatCell(row[col.key], col.key)}</td>
                        `).join('')}
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `
        <div class="card p-4 text-center text-danger">
          <i class="fas fa-exclamation-triangle" style="font-size:32px;margin-bottom:8px;"></i>
          <div>Failed to generate report: ${err.message}</div>
          <button class="btn btn-sm btn-primary" style="margin-top:12px;" onclick="ReportsPage.generate()">Retry</button>
        </div>
      `;
    }
  },

  getReportTitle(type) {
    const titles = {
      revenue: 'Payment Receipts & Revenue Transactions',
      patients: 'Patient Registration Directory',
      appointments: 'Appointment Log & Outcomes',
      doctors: 'Doctor Performance & Consultation Metrics',
      laboratory: 'Laboratory Orders & Diagnostic Results',
      pharmacy: 'Medicine Inventory & Dispensing Roster',
      staff: 'Staff Directory & System Activity',
      flow: 'Patient Queue & Workflow Turnaround'
    };
    return titles[type] || 'Report Data';
  },

  formatCell(val, key) {
    if (val === null || val === undefined || val === '') return '-';
    if (key.includes('amount') || key.includes('revenue') || key.includes('balance') || key.includes('fee')) {
      const num = parseFloat(val);
      if (!isNaN(num)) return `<strong>${formatCurrency(num)}</strong>`;
    }
    if (key.includes('status')) {
      return `<span class="status-badge badge-info" style="text-transform:capitalize;">${val}</span>`;
    }
    if (key.includes('date') || key.includes('time') || key.includes('created_at')) {
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.toLocaleDateString();
      } catch (e) {}
    }
    return String(val);
  },

  exportCSV() {
    if (!this.currentData || !this.currentData.rows || !this.currentData.rows.length) {
      showToast('warning', 'Export Unavailable', 'No data available to export in current report.');
      return;
    }

    const { rows, columns } = this.currentData;
    const headerRow = columns.map(c => `"${(c.label || c.key).replace(/"/g, '""')}"`).join(',');
    const bodyRows = rows.map(r => {
      return columns.map(c => {
        const cell = r[c.key] ?? '';
        return `"${String(cell).replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = [headerRow, ...bodyRows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cliniccare_${this.currentType}_report_${this.dateFrom}_to_${this.dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'CSV Exported', `Downloaded ${this.currentType} report successfully.`);
  }
};

window.ReportsPage = ReportsPage;
