/* ============================================================
   FINANCIAL.JS - Financial Management (Admin & Cashier Module)
   Combines Billing, Patient Invoices, Payment Processing,
   and Revenue Analytics into an integrated command center.
   ============================================================ */

const FinancialPage = {
  activeTab: 'invoices',

  async load() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header" style="margin-bottom: 20px;">
        <div class="page-header-info">
          <h2>Financial Management & Revenue</h2>
          <p>Oversee clinic billing cycles, outstanding accounts, patient invoices, payments, and revenue collection.</p>
        </div>
        <div class="page-header-actions" style="display:flex; gap:10px;">
          <button class="btn btn-secondary" onclick="InvoicesPage.showCreate()">
            <i class="fas fa-file-invoice-dollar"></i> Create Invoice
          </button>
          <button class="btn btn-primary" onclick="PaymentsPage.showRecordModal()">
            <i class="fas fa-credit-card"></i> Record Payment
          </button>
        </div>
      </div>

      <!-- Financial KPI Dashboard Overview -->
      <div class="stats-grid" id="fin-kpi-bar" style="margin-bottom: 24px;">
        <div class="stat-card success">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-coins"></i></div>
            <span class="stat-trend up">Today</span>
          </div>
          <div class="stat-value" id="fin-stat-today">-</div>
          <div class="stat-label">Today's Recorded Collections</div>
        </div>

        <div class="stat-card primary">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
            <span class="stat-trend up">Monthly</span>
          </div>
          <div class="stat-value" id="fin-stat-month">-</div>
          <div class="stat-label">This Month's Total Revenue</div>
        </div>

        <div class="stat-card warning">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-clock"></i></div>
            <span class="stat-trend down" id="fin-unpaid-count">-</span>
          </div>
          <div class="stat-value" id="fin-stat-outstanding">-</div>
          <div class="stat-label">Outstanding Unpaid Balances</div>
        </div>

        <div class="stat-card info">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-cash-register"></i></div>
            <span class="stat-trend up">Active Desk</span>
          </div>
          <div class="stat-value" id="fin-stat-queue">-</div>
          <div class="stat-label">Patients Waiting at Cashier</div>
        </div>
      </div>

      <!-- Section Tabs: Invoices vs Payments -->
      <div class="card" style="box-shadow: var(--shadow);">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div class="tabs" style="border:none; margin:0; padding:0; display:flex; gap:8px;">
            <button class="btn ${this.activeTab === 'invoices' ? 'btn-primary' : 'btn-ghost'}" id="fin-tab-btn-inv" onclick="FinancialPage.switchTab('invoices')">
              <i class="fas fa-file-invoice"></i> Invoices & Billing Statements
            </button>
            <button class="btn ${this.activeTab === 'payments' ? 'btn-primary' : 'btn-ghost'}" id="fin-tab-btn-pay" onclick="FinancialPage.switchTab('payments')">
              <i class="fas fa-receipt"></i> Payment Transactions & Receipts
            </button>
          </div>
          <div style="font-size:12px; color:var(--gray-500);">
            <i class="fas fa-shield-alt" style="color:var(--success);"></i> Live Financial Sync
          </div>
        </div>
        <div class="card-body" style="padding: 18px;" id="financial-subcontent">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading...</div>
        </div>
      </div>
    `;

    this.fetchFinancialKPIs();
    this.renderSubcontent();
  },

  async fetchFinancialKPIs() {
    try {
      const stats = await API.dashboard.stats();
      const elToday = document.getElementById('fin-stat-today');
      const elMonth = document.getElementById('fin-stat-month');
      const elOut = document.getElementById('fin-stat-outstanding');
      const elUnpaidCount = document.getElementById('fin-unpaid-count');
      const elQueue = document.getElementById('fin-stat-queue');

      if (elToday) elToday.textContent = formatCurrency(stats.today_revenue || 0);
      if (elMonth) elMonth.textContent = formatCurrency(stats.monthly_revenue || 0);
      if (elOut) elOut.textContent = formatCurrency(stats.outstanding_balance || 0);
      if (elUnpaidCount) elUnpaidCount.textContent = `${stats.pending_invoices || 0} unpaid`;
      if (elQueue) elQueue.textContent = stats.waiting_payment || 0;
    } catch (e) {
      console.warn('Could not fetch financial KPIs:', e);
    }
  },

  switchTab(tab) {
    this.activeTab = tab;
    const btnInv = document.getElementById('fin-tab-btn-inv');
    const btnPay = document.getElementById('fin-tab-btn-pay');

    if (btnInv && btnPay) {
      if (tab === 'invoices') {
        btnInv.className = 'btn btn-primary';
        btnPay.className = 'btn btn-ghost';
      } else {
        btnInv.className = 'btn btn-ghost';
        btnPay.className = 'btn btn-primary';
      }
    }

    this.renderSubcontent();
  },

  renderSubcontent() {
    const container = document.getElementById('financial-subcontent');
    if (!container) return;

    if (this.activeTab === 'invoices') {
      container.innerHTML = `
        <div class="search-filter-bar" style="margin-bottom:16px;">
          <select class="filter-select" id="inv-filter-status" onchange="InvoicesPage.onStatusFilter(this.value)">
            <option value="">All Invoice Statuses</option>
            <option value="unpaid">Unpaid Invoices</option>
            <option value="partial">Partially Paid</option>
            <option value="paid">Fully Settled</option>
            <option value="refunded">Refunded</option>
          </select>
          <button class="btn btn-secondary" onclick="InvoicesPage.loadList()"><i class="fas fa-sync-alt"></i> Refresh Invoices</button>
        </div>
        <div id="inv-table-container">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading invoices...</div>
        </div>
        <div id="inv-pagination"></div>
      `;
      InvoicesPage.loadList();
    } else {
      container.innerHTML = `
        <div class="search-filter-bar" style="margin-bottom:16px;">
          <select class="filter-select" id="pay-filter-method" onchange="PaymentsPage.onMethodFilter(this.value)">
            <option value="">All Payment Methods</option>
            <option value="cash">Cash Payment</option>
            <option value="credit_card">Credit Card</option>
            <option value="debit_card">Debit Card</option>
            <option value="insurance">Insurance Billing</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
          <button class="btn btn-secondary" onclick="PaymentsPage.loadList()"><i class="fas fa-sync-alt"></i> Refresh Payments</button>
        </div>
        <div id="pay-table-container">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading payments...</div>
        </div>
        <div id="pay-pagination"></div>
      `;
      PaymentsPage.loadList();
    }
  }
};
