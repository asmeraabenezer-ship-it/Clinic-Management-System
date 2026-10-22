/* ============================================================
   INVOICES.JS - Billing, Invoicing, Line Items & Print
   ============================================================ */

const InvoicesPage = {
  currentPage: 1,
  limit: 10,
  filterStatus: '',

  async load() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>Invoices & Billing</h2>
          <p>Generate clinic billing statements, track unpaid accounts, and manage line items</p>
        </div>
        <div class="page-header-actions">
          ${Auth.hasRole('receptionist', 'admin') ? `
            <button class="btn btn-primary" onclick="InvoicesPage.showCreate()">
              <i class="fas fa-file-invoice-dollar"></i> Create Invoice
            </button>
          ` : ''}
        </div>
      </div>

      <div class="search-filter-bar">
        <select class="filter-select" id="inv-filter-status" onchange="InvoicesPage.onStatusFilter(this.value)">
          <option value="">All Statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partially Paid</option>
          <option value="paid">Fully Paid</option>
          <option value="refunded">Refunded</option>
        </select>
        <button class="btn btn-secondary" onclick="InvoicesPage.loadList()"><i class="fas fa-sync-alt"></i></button>
      </div>

      <div class="card">
        <div class="card-body" style="padding: 0;" id="inv-table-container">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
        <div id="inv-pagination"></div>
      </div>
    `;

    await this.loadList();
  },

  onStatusFilter(val) {
    this.filterStatus = val;
    this.currentPage = 1;
    this.loadList();
  },

  async loadList() {
    const container = document.getElementById('inv-table-container');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
      const res = await API.invoices.list({
        page: this.currentPage,
        limit: this.limit,
        status: this.filterStatus
      });

      const invoices = res.data || res.invoices || [];
      const pagination = res.pagination;

      if (!invoices.length) {
        showEmptyState(
          'inv-table-container',
          'fas fa-file-invoice',
          'No Invoices Found',
          'Clinic invoices and patient bills will appear here.',
          Auth.hasRole('receptionist', 'admin') ? `<button class="btn btn-primary" onclick="InvoicesPage.showCreate()"><i class="fas fa-file-invoice-dollar"></i> Create Invoice</button>` : ''
        );
        document.getElementById('inv-pagination').innerHTML = '';
        return;
      }

      container.innerHTML = `
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Patient</th>
                <th>Invoice Date</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance Due</th>
                <th>Status</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.map(inv => {
                const pName = inv.patients ? `${inv.patients.first_name} ${inv.patients.last_name}` : 'Patient';
                return `
                  <tr>
                    <td><strong style="color:var(--primary); font-family:monospace;">${inv.invoice_number}</strong></td>
                    <td><strong>${pName}</strong> <span style="font-size:11px;color:var(--gray-400);">(${inv.patients?.patient_number || ''})</span></td>
                    <td>${formatDate(inv.invoice_date || inv.created_at)}</td>
                    <td><strong>${formatCurrency(inv.total_amount)}</strong></td>
                    <td><span style="color:var(--success-dark); font-weight:600;">${formatCurrency(inv.paid_amount || 0)}</span></td>
                    <td><strong style="color:${inv.balance_amount > 0 ? 'var(--danger)' : 'var(--gray-600)'};">${formatCurrency(inv.balance_amount)}</strong></td>
                    <td>${getStatusBadge(inv.status)}</td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 4px;">
                        <button class="btn btn-sm btn-secondary" title="View Invoice" onclick="InvoicesPage.viewDetails('${inv.id}')">
                          <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" title="Print Invoice" onclick="InvoicesPage.printInvoice('${inv.id}')">
                          <i class="fas fa-print"></i>
                        </button>
                        ${inv.status !== 'paid' && Auth.hasRole('receptionist', 'admin') ? `
                          <button class="btn btn-sm btn-success" title="Record Payment" onclick="PaymentsPage.showRecordModal('${inv.id}')">
                            <i class="fas fa-credit-card"></i> Pay
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      renderPagination('inv-pagination', pagination, 'InvoicesPage.goToPage');
    } catch (err) {
      container.innerHTML = `<div class="p-4 text-center text-danger">${err.message}</div>`;
    }
  },

  goToPage(p) {
    this.currentPage = p;
    this.loadList();
  },

  async showCreate(preselectedPatientId = null, preselectedAppointmentId = null) {
    try {
      const patientsRes = await API.patients.list({ limit: 100 });
      const patients = patientsRes.data || patientsRes.patients || [];

      openModal('Generate Patient Invoice', `
        <form id="create-inv-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Patient <span class="required">*</span></label>
              <select id="cinv-patient" class="form-control" required>
                <option value="">Select patient...</option>
                ${patients.map(p => `<option value="${p.id}" ${preselectedPatientId === p.id ? 'selected' : ''}>${p.first_name} ${p.last_name} (${p.patient_number || p.phone})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Payment Due Date <span class="required">*</span></label>
              <input type="date" id="cinv-due-date" class="form-control" required value="${today()}">
            </div>
          </div>

          <!-- Line items -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h4 style="font-size: 14px; font-weight: 700; margin: 0; color: var(--gray-800);">Invoice Line Items</h4>
              <button type="button" class="btn btn-sm btn-outline" onclick="InvoicesPage.addLineItemRow()">
                <i class="fas fa-plus"></i> Add Item
              </button>
            </div>
            <div id="inv-items-container" style="display: flex; flex-direction: column; gap: 8px;">
              <!-- Dynamic line items -->
            </div>
          </div>

          <!-- Totals calculation summary -->
          <div style="background: var(--gray-50); border: 1px solid var(--gray-100); border-radius: var(--radius); padding: 16px; margin-bottom: 20px;">
            <div style="display: flex; flex-direction: column; gap: 8px; max-width: 320px; margin-left: auto;">
              <div style="display: flex; justify-content: space-between; font-size: 13px;">
                <span>Subtotal:</span>
                <strong id="cinv-subtotal-display">$0.00</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
                <span>Tax Rate (%):</span>
                <input type="number" id="cinv-tax-rate" class="form-control" value="0" min="0" max="100" step="0.5" style="width: 80px; padding: 4px 8px;" oninput="InvoicesPage.calcTotals()">
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
                <span>Discount ($):</span>
                <input type="number" id="cinv-discount" class="form-control" value="0" min="0" step="1" style="width: 80px; padding: 4px 8px;" oninput="InvoicesPage.calcTotals()">
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; border-top: 2px solid var(--gray-200); padding-top: 8px; color: var(--primary);">
                <span>Total Due:</span>
                <strong id="cinv-total-display">$0.00</strong>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Invoice Notes</label>
            <input type="text" id="cinv-notes" class="form-control" placeholder="e.g. Consultation and laboratory diagnostics fee">
          </div>

          <div class="card-footer" style="padding: 12px 0 0; background: transparent;">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-save-inv">Issue Invoice</button>
          </div>
        </form>
      `, 'modal-lg');

      // Add default consultation item
      this.addLineItemRow('General Physician Consultation', 1, 50.00);

      document.getElementById('create-inv-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading('#btn-save-inv', true);

        const rows = document.querySelectorAll('.inv-item-row');
        const items = [];

        rows.forEach(r => {
          const desc = r.querySelector('.inv-item-desc').value.trim();
          const qty = parseInt(r.querySelector('.inv-item-qty').value) || 1;
          const price = parseFloat(r.querySelector('.inv-item-price').value) || 0;

          if (desc && price >= 0) {
            items.push({
              description: desc,
              quantity: qty,
              unit_price: price,
              total_price: qty * price
            });
          }
        });

        if (!items.length) {
          showToast('error', 'Error', 'Please add at least one line item.');
          setLoading('#btn-save-inv', false);
          return;
        }

        const subtotal = items.reduce((sum, i) => sum + i.total_price, 0);
        const taxRate = parseFloat(document.getElementById('cinv-tax-rate').value) || 0;
        const discount = parseFloat(document.getElementById('cinv-discount').value) || 0;
        const taxAmount = (subtotal * taxRate) / 100;
        const total = Math.max(0, subtotal + taxAmount - discount);

        const payload = {
          patient_id: document.getElementById('cinv-patient').value,
          appointment_id: preselectedAppointmentId || null,
          due_date: document.getElementById('cinv-due-date').value,
          subtotal,
          tax_amount: taxAmount,
          discount_amount: discount,
          total_amount: total,
          notes: document.getElementById('cinv-notes').value.trim() || null,
          items
        };

        try {
          await API.invoices.create(payload);
          showToast('success', 'Invoice Created', 'Billing record generated.');
          closeModal();
          InvoicesPage.loadList();
        } catch (err) {
          showToast('error', 'Error', err.message);
        } finally {
          setLoading('#btn-save-inv', false);
        }
      });
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  addLineItemRow(desc = '', qty = 1, price = 0) {
    const container = document.getElementById('inv-items-container');
    if (!container) return;
    const rowId = `inv-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const div = document.createElement('div');
    div.className = 'inv-item-row';
    div.id = rowId;
    div.style.cssText = 'display: grid; grid-template-columns: 3fr 1fr 1.5fr 1.5fr auto; gap: 8px; align-items: center;';
    div.innerHTML = `
      <div>
        <input type="text" class="form-control inv-item-desc" placeholder="Service or product description..." value="${desc}" required>
      </div>
      <div>
        <input type="number" class="form-control inv-item-qty" placeholder="Qty" value="${qty}" min="1" required oninput="InvoicesPage.calcTotals()">
      </div>
      <div>
        <input type="number" class="form-control inv-item-price" placeholder="Unit Price ($)" value="${price}" min="0" step="0.01" required oninput="InvoicesPage.calcTotals()">
      </div>
      <div style="font-weight: 700; color: var(--gray-800); text-align: right; padding-right: 8px;" class="inv-item-line-total">
        ${formatCurrency(qty * price)}
      </div>
      <div>
        <button type="button" class="btn btn-sm btn-ghost" onclick="document.getElementById('${rowId}').remove(); InvoicesPage.calcTotals();" title="Remove">
          <i class="fas fa-trash text-danger"></i>
        </button>
      </div>
    `;

    container.appendChild(div);
    this.calcTotals();
  },

  calcTotals() {
    const rows = document.querySelectorAll('.inv-item-row');
    let subtotal = 0;

    rows.forEach(r => {
      const qty = parseInt(r.querySelector('.inv-item-qty')?.value) || 0;
      const price = parseFloat(r.querySelector('.inv-item-price')?.value) || 0;
      const line = qty * price;
      subtotal += line;
      const lineTotalEl = r.querySelector('.inv-item-line-total');
      if (lineTotalEl) lineTotalEl.textContent = formatCurrency(line);
    });

    const taxRate = parseFloat(document.getElementById('cinv-tax-rate')?.value) || 0;
    const discount = parseFloat(document.getElementById('cinv-discount')?.value) || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const grandTotal = Math.max(0, subtotal + taxAmount - discount);

    const subEl = document.getElementById('cinv-subtotal-display');
    const totEl = document.getElementById('cinv-total-display');
    if (subEl) subEl.textContent = formatCurrency(subtotal);
    if (totEl) totEl.textContent = formatCurrency(grandTotal);
  },

  async viewDetails(id) {
    try {
      const inv = await API.invoices.get(id);
      const pName = inv.patients ? `${inv.patients.first_name} ${inv.patients.last_name}` : 'Patient';

      openModal(`Invoice: ${inv.invoice_number}`, `
        <div class="invoice-header">
          <div class="invoice-logo">
            <div style="width: 44px; height: 44px; border-radius: var(--radius); background: linear-gradient(135deg, var(--primary), var(--accent)); color: white; display: flex; align-items: center; justify-content: center; font-size: 20px;">
              <i class="fas fa-clinic-medical"></i>
            </div>
            <div>
              <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: var(--gray-900);">ClinicCare Pro</h3>
              <p style="margin: 0; font-size: 12px; color: var(--gray-400);">Healthcare Invoice & Receipt</p>
            </div>
          </div>
          <div class="invoice-number-display">
            <div class="inv-number">${inv.invoice_number}</div>
            <div style="margin-top: 4px;">${getStatusBadge(inv.status)}</div>
          </div>
        </div>

        <div class="detail-grid" style="background: var(--gray-50); border: 1px solid var(--gray-100); border-radius: var(--radius); padding: 16px; margin-bottom: 20px;">
          <div class="detail-item"><label>Billed To</label><p><strong>${pName}</strong> (${inv.patients?.patient_number || '-'})</p></div>
          <div class="detail-item"><label>Invoice Date</label><p>${formatDate(inv.invoice_date || inv.created_at)}</p></div>
          <div class="detail-item"><label>Due Date</label><p>${formatDate(inv.due_date)}</p></div>
          <div class="detail-item"><label>Patient Phone</label><p>${inv.patients?.phone || '-'}</p></div>
        </div>

        <div class="table-wrapper" style="margin-bottom: 20px;">
          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(inv.invoice_items || []).map(i => `
                <tr>
                  <td><strong>${i.description}</strong></td>
                  <td>${i.quantity}</td>
                  <td>${formatCurrency(i.unit_price)}</td>
                  <td style="text-align: right; font-weight: 700;">${formatCurrency(i.total_price)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="invoice-totals">
          <div class="invoice-total-row"><span class="label">Subtotal:</span><span class="amount">${formatCurrency(inv.subtotal)}</span></div>
          ${inv.tax_amount > 0 ? `<div class="invoice-total-row"><span class="label">Tax:</span><span class="amount">${formatCurrency(inv.tax_amount)}</span></div>` : ''}
          ${inv.discount_amount > 0 ? `<div class="invoice-total-row"><span class="label">Discount:</span><span class="amount" style="color:var(--danger);">- ${formatCurrency(inv.discount_amount)}</span></div>` : ''}
          <div class="invoice-total-row grand-total"><span class="label">Grand Total:</span><span class="amount">${formatCurrency(inv.total_amount)}</span></div>
          <div class="invoice-total-row"><span class="label">Paid Amount:</span><span class="amount" style="color:var(--success-dark);">${formatCurrency(inv.paid_amount || 0)}</span></div>
          <div class="invoice-total-row" style="font-weight: 800;"><span class="label" style="color:var(--danger);">Balance Due:</span><span class="amount" style="color:var(--danger);">${formatCurrency(inv.balance_amount)}</span></div>
        </div>

        <div class="card-footer" style="padding: 16px 0 0; background: transparent; display: flex; justify-content: space-between;">
          <button class="btn btn-secondary" onclick="closeModal()">Close</button>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-outline" onclick="InvoicesPage.printInvoice('${inv.id}')">
              <i class="fas fa-print"></i> Print Invoice
            </button>
            ${inv.status !== 'paid' && Auth.hasRole('receptionist', 'admin') ? `
              <button class="btn btn-success" onclick="closeModal(); PaymentsPage.showRecordModal('${inv.id}')">
                <i class="fas fa-credit-card"></i> Record Payment
              </button>
            ` : ''}
          </div>
        </div>
      `, 'modal-lg');
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  async printInvoice(id) {
    try {
      const inv = await API.invoices.get(id);
      const pName = inv.patients ? `${inv.patients.first_name} ${inv.patients.last_name}` : 'Patient';

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 30px; color: #333;">
          <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 20px;">
            <div>
              <h1 style="color: #6366f1; margin: 0; font-size: 26px;">ClinicCare Medical Center</h1>
              <p style="margin: 4px 0; font-size: 13px; color: #666;">123 Healthcare Blvd, Medical District</p>
              <p style="margin: 0; font-size: 13px; color: #666;">Tel: (555) 019-2834 &bull; billing@cliniccare.pro</p>
            </div>
            <div style="text-align: right;">
              <h2 style="margin: 0; font-size: 20px; color: #111;">INVOICE</h2>
              <p style="margin: 4px 0; font-size: 15px; font-weight: bold; color: #6366f1;">${inv.invoice_number}</p>
              <p style="margin: 0; font-size: 12px; color: #666;">Date: ${formatDate(inv.invoice_date || inv.created_at)}</p>
              <p style="margin: 0; font-size: 12px; color: #666;">Due: ${formatDate(inv.due_date)}</p>
            </div>
          </div>

          <div style="margin-bottom: 24px;">
            <h3 style="font-size: 14px; text-transform: uppercase; color: #888; margin-bottom: 6px;">Billed To:</h3>
            <p style="font-size: 16px; font-weight: bold; margin: 0;">${pName}</p>
            <p style="font-size: 13px; color: #555; margin: 2px 0;">Patient #: ${inv.patients?.patient_number || '-'}</p>
            <p style="font-size: 13px; color: #555; margin: 2px 0;">Phone: ${inv.patients?.phone || '-'}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 10px; text-align: left;">Item Description</th>
                <th style="padding: 10px; text-align: center;">Qty</th>
                <th style="padding: 10px; text-align: right;">Unit Price</th>
                <th style="padding: 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(inv.invoice_items || []).map(i => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px;">${i.description}</td>
                  <td style="padding: 10px; text-align: center;">${i.quantity}</td>
                  <td style="padding: 10px; text-align: right;">${formatCurrency(i.unit_price)}</td>
                  <td style="padding: 10px; text-align: right; font-weight: bold;">${formatCurrency(i.total_price)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
            <div style="width: 250px; font-size: 14px;">
              <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span>Subtotal:</span><span>${formatCurrency(inv.subtotal)}</span></div>
              ${inv.tax_amount > 0 ? `<div style="display: flex; justify-content: space-between; padding: 4px 0;"><span>Tax:</span><span>${formatCurrency(inv.tax_amount)}</span></div>` : ''}
              ${inv.discount_amount > 0 ? `<div style="display: flex; justify-content: space-between; padding: 4px 0; color: red;"><span>Discount:</span><span>-${formatCurrency(inv.discount_amount)}</span></div>` : ''}
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-top: 2px solid #333; font-weight: bold; font-size: 16px;"><span>Total Due:</span><span style="color: #6366f1;">${formatCurrency(inv.total_amount)}</span></div>
              <div style="display: flex; justify-content: space-between; padding: 4px 0; color: green;"><span>Paid:</span><span>${formatCurrency(inv.paid_amount || 0)}</span></div>
              <div style="display: flex; justify-content: space-between; padding: 4px 0; font-weight: bold; color: #dc2626;"><span>Balance:</span><span>${formatCurrency(inv.balance_amount)}</span></div>
            </div>
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #888; text-align: center;">
            <p>Thank you for choosing ClinicCare Medical Center. Payment is requested within 30 days.</p>
          </div>
        </div>
      `;

      printContent(html);
    } catch (err) {
      showToast('error', 'Print Error', err.message);
    }
  }
};

window.InvoicesPage = InvoicesPage;
