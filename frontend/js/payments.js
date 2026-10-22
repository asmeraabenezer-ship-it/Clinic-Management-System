/* ============================================================
   PAYMENTS.JS - Payment Processing, Receipts & Collections
   ============================================================ */

const PaymentsPage = {
  currentPage: 1,
  limit: 10,
  filterMethod: '',

  async load() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>Payment Transactions</h2>
          <p>Collect payments, track transaction channels, and print customer payment receipts</p>
        </div>
        <div class="page-header-actions">
          ${Auth.hasRole('receptionist', 'admin') ? `
            <button class="btn btn-primary" onclick="PaymentsPage.showRecordModal()">
              <i class="fas fa-credit-card"></i> Record Payment
            </button>
          ` : ''}
        </div>
      </div>

      <div class="search-filter-bar">
        <select class="filter-select" id="pay-filter-method" onchange="PaymentsPage.onMethodFilter(this.value)">
          <option value="">All Payment Methods</option>
          <option value="cash">Cash</option>
          <option value="credit_card">Credit Card</option>
          <option value="debit_card">Debit Card</option>
          <option value="insurance">Insurance Coverage</option>
          <option value="bank_transfer">Bank Transfer</option>
        </select>
        <button class="btn btn-secondary" onclick="PaymentsPage.loadList()"><i class="fas fa-sync-alt"></i></button>
      </div>

      <div class="card">
        <div class="card-body" style="padding: 0;" id="pay-table-container">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
        <div id="pay-pagination"></div>
      </div>
    `;

    await this.loadList();
  },

  onMethodFilter(val) {
    this.filterMethod = val;
    this.currentPage = 1;
    this.loadList();
  },

  async loadList() {
    const container = document.getElementById('pay-table-container');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
      const res = await API.payments.list({
        page: this.currentPage,
        limit: this.limit,
        method: this.filterMethod
      });

      const payments = res.data || res.payments || [];
      const pagination = res.pagination;

      if (!payments.length) {
        showEmptyState(
          'pay-table-container',
          'fas fa-receipt',
          'No Payments Recorded',
          'Payment records will show here once processed.',
          Auth.hasRole('receptionist', 'admin') ? `<button class="btn btn-primary" onclick="PaymentsPage.showRecordModal()"><i class="fas fa-credit-card"></i> Record Payment</button>` : ''
        );
        document.getElementById('pay-pagination').innerHTML = '';
        return;
      }

      container.innerHTML = `
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Receipt / Trans #</th>
                <th>Invoice #</th>
                <th>Patient</th>
                <th>Payment Date</th>
                <th>Amount</th>
                <th>Method</th>
                <th style="text-align: right;">Receipt</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map(p => {
                const pName = p.invoices?.patients ? `${p.invoices.patients.first_name} ${p.invoices.patients.last_name}` : 'Patient';
                return `
                  <tr>
                    <td><strong style="font-family: monospace; color: var(--primary);">${p.payment_number || p.id.slice(0, 8)}</strong></td>
                    <td><span style="font-family: monospace;">${p.invoices?.invoice_number || '-'}</span></td>
                    <td><strong>${pName}</strong></td>
                    <td>${formatDate(p.payment_date || p.created_at)}</td>
                    <td><strong style="color: var(--success-dark); font-size: 15px;">${formatCurrency(p.amount)}</strong></td>
                    <td><span style="text-transform: capitalize; background: var(--gray-100); padding: 3px 8px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 600;">${(p.payment_method || 'cash').replace('_', ' ')}</span></td>
                    <td style="text-align: right;">
                      <button class="btn btn-sm btn-outline" title="Print Receipt" onclick="PaymentsPage.printReceipt('${p.id}')">
                        <i class="fas fa-receipt"></i> Print
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      renderPagination('pay-pagination', pagination, 'PaymentsPage.goToPage');
    } catch (err) {
      container.innerHTML = `<div class="p-4 text-center text-danger">${err.message}</div>`;
    }
  },

  goToPage(p) {
    this.currentPage = p;
    this.loadList();
  },

  async showRecordModal(preselectedInvoiceId = null) {
    try {
      const invRes = await API.invoices.list({ limit: 100 });
      const unpaidInvoices = (invRes.data || invRes.invoices || []).filter(i => i.balance_amount > 0 || i.id === preselectedInvoiceId);

      openModal('Record Patient Payment', `
        <form id="record-pay-form">
          <div class="form-group">
            <label class="form-label">Select Unpaid Invoice <span class="required">*</span></label>
            <select id="rp-invoice" class="form-control" required onchange="PaymentsPage.onInvoiceSelected(this.value)">
              <option value="">Select invoice to pay...</option>
              ${unpaidInvoices.map(i => {
                const pName = i.patients ? `${i.patients.first_name} ${i.patients.last_name}` : 'Patient';
                return `<option value="${i.id}" data-balance="${i.balance_amount}" ${preselectedInvoiceId === i.id ? 'selected' : ''}>${i.invoice_number} - ${pName} (Due: ${formatCurrency(i.balance_amount)})</option>`;
              }).join('')}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Payment Amount ($) <span class="required">*</span></label>
              <input type="number" id="rp-amount" class="form-control" required min="0.01" step="0.01">
            </div>
            <div class="form-group">
              <label class="form-label">Payment Method <span class="required">*</span></label>
              <select id="rp-method" class="form-control" required>
                <option value="cash">Cash</option>
                <option value="credit_card">Credit Card</option>
                <option value="debit_card">Debit Card</option>
                <option value="insurance">Insurance Direct</option>
                <option value="bank_transfer">Bank Wire / Transfer</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Transaction Reference #</label>
              <input type="text" id="rp-ref" class="form-control" placeholder="e.g. Auth Code, Check #, Card Last 4">
            </div>
            <div class="form-group">
              <label class="form-label">Payment Date <span class="required">*</span></label>
              <input type="date" id="rp-date" class="form-control" required value="${today()}">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Notes</label>
            <input type="text" id="rp-notes" class="form-control" placeholder="Optional payment remarks...">
          </div>

          <div class="card-footer" style="padding: 12px 0 0; background: transparent;">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-success" id="btn-save-pay">Process Payment</button>
          </div>
        </form>
      `);

      if (preselectedInvoiceId) {
        this.onInvoiceSelected(preselectedInvoiceId);
      }

      document.getElementById('record-pay-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading('#btn-save-pay', true);

        const payload = {
          invoice_id: document.getElementById('rp-invoice').value,
          amount: parseFloat(document.getElementById('rp-amount').value),
          payment_method: document.getElementById('rp-method').value,
          payment_date: document.getElementById('rp-date').value,
          reference_number: document.getElementById('rp-ref').value.trim() || null,
          notes: document.getElementById('rp-notes').value.trim() || null
        };

        try {
          await API.payments.create(payload);
          showToast('success', 'Payment Received', `${formatCurrency(payload.amount)} collected successfully.`);
          closeModal();
          PaymentsPage.loadList();
        } catch (err) {
          showToast('error', 'Error', err.message);
        } finally {
          setLoading('#btn-save-pay', false);
        }
      });
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  onInvoiceSelected(invId) {
    const select = document.getElementById('rp-invoice');
    const selectedOpt = select?.options[select.selectedIndex];
    const balance = selectedOpt?.getAttribute('data-balance');
    const amountInput = document.getElementById('rp-amount');
    if (amountInput && balance) {
      amountInput.value = parseFloat(balance).toFixed(2);
    }
  },

  async printReceipt(id) {
    try {
      const p = await API.payments.receipt(id);
      const patientName = p.invoices?.patients ? `${p.invoices.patients.first_name} ${p.invoices.patients.last_name}` : 'Patient';

      const html = `
        <div class="receipt-print">
          <div class="receipt-header">
            <h2 style="font-size: 16px; margin: 0 0 4px;">CLINICCARE PRO</h2>
            <p style="font-size: 11px; margin: 0;">123 Healthcare Blvd, Medical District</p>
            <p style="font-size: 11px; margin: 0;">Tel: (555) 019-2834</p>
            <p style="font-size: 12px; font-weight: bold; margin-top: 8px;">PAYMENT RECEIPT</p>
          </div>

          <div class="receipt-row"><span>Receipt #:</span><span>${p.payment_number || p.id.slice(0, 8)}</span></div>
          <div class="receipt-row"><span>Date:</span><span>${formatDateTime(p.payment_date || p.created_at)}</span></div>
          <div class="receipt-row"><span>Invoice #:</span><span>${p.invoices?.invoice_number || '-'}</span></div>
          <div class="receipt-row"><span>Patient:</span><span>${patientName}</span></div>
          <div class="receipt-row"><span>Patient #:</span><span>${p.invoices?.patients?.patient_number || '-'}</span></div>

          <hr class="receipt-divider">

          <div class="receipt-row"><span>Payment Method:</span><span style="text-transform: uppercase;">${(p.payment_method || 'cash').replace('_', ' ')}</span></div>
          ${p.reference_number ? `<div class="receipt-row"><span>Ref / Auth:</span><span>${p.reference_number}</span></div>` : ''}

          <hr class="receipt-divider">

          <div class="receipt-row"><span>Invoice Total:</span><span>${formatCurrency(p.invoices?.total_amount)}</span></div>
          <div class="receipt-row"><span>Remaining Balance:</span><span>${formatCurrency(p.invoices?.balance_amount)}</span></div>

          <div class="receipt-total">
            <span>AMOUNT PAID:</span>
            <span>${formatCurrency(p.amount)}</span>
          </div>

          <hr class="receipt-divider">

          <div style="text-align: center; margin-top: 14px; font-size: 11px;">
            <p style="margin: 0;">Thank you for your payment!</p>
            <p style="margin: 4px 0 0; color: #555;">Please retain this receipt for your records.</p>
          </div>
        </div>
      `;

      printContent(html);
    } catch (err) {
      showToast('error', 'Receipt Error', err.message);
    }
  }
};

window.PaymentsPage = PaymentsPage;
