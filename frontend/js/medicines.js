/* ============================================================
   MEDICINES.JS - Inventory, Stock Tracking, Expiration Alerts & Restocking
   ============================================================ */

const MedicinesPage = {
  currentPage: 1,
  limit: 10,
  searchQuery: '',
  selectedCategory: '',
  filterLowStock: false,

  async load() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>Medicine Inventory & Pharmacy Stock</h2>
          <p>Track pharmaceuticals, inventory stock levels, expiration dates, and restocking</p>
        </div>
        <div class="page-header-actions">
          ${Auth.hasRole('pharmacist', 'admin') ? `
            <button class="btn btn-primary" onclick="MedicinesPage.showCreate()">
              <i class="fas fa-plus"></i> Add New Medicine
            </button>
          ` : ''}
        </div>
      </div>

      <div class="search-filter-bar">
        <div class="search-input-wrapper">
          <i class="fas fa-search"></i>
          <input type="text" id="med-search" placeholder="Search medicine name, generic name, batch #..." oninput="MedicinesPage.onSearch(this.value)">
        </div>

        <select class="filter-select" id="med-filter-category" onchange="MedicinesPage.onCategoryFilter(this.value)">
          <option value="">All Categories</option>
          <option value="Antibiotic">Antibiotic</option>
          <option value="Analgesic">Analgesic / Pain Relief</option>
          <option value="Antipyretic">Antipyretic</option>
          <option value="Antihypertensive">Antihypertensive</option>
          <option value="Antidiabetic">Antidiabetic</option>
          <option value="Antihistamine">Antihistamine</option>
          <option value="Vitamin / Supplement">Vitamin / Supplement</option>
          <option value="Topical / Ointment">Topical / Ointment</option>
          <option value="Other">Other</option>
        </select>

        <button class="btn ${this.filterLowStock ? 'btn-danger' : 'btn-secondary'}" id="btn-filter-low-stock" onclick="MedicinesPage.toggleLowStockFilter()">
          <i class="fas fa-exclamation-triangle"></i> Low Stock Only
        </button>

        <button class="btn btn-secondary" onclick="MedicinesPage.loadList()"><i class="fas fa-sync-alt"></i></button>
      </div>

      <div class="card">
        <div class="card-body" style="padding: 0;" id="med-table-container">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
        <div id="med-pagination"></div>
      </div>
    `;

    await this.loadList();
  },

  onSearch: debounce(function(val) {
    MedicinesPage.searchQuery = val.trim();
    MedicinesPage.currentPage = 1;
    MedicinesPage.loadList();
  }, 350),

  onCategoryFilter(val) {
    this.selectedCategory = val;
    this.currentPage = 1;
    this.loadList();
  },

  toggleLowStockFilter() {
    this.filterLowStock = !this.filterLowStock;
    const btn = document.getElementById('btn-filter-low-stock');
    if (btn) {
      btn.className = `btn ${this.filterLowStock ? 'btn-danger' : 'btn-secondary'}`;
    }
    this.currentPage = 1;
    this.loadList();
  },

  async loadList() {
    const container = document.getElementById('med-table-container');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
      const params = {
        page: this.currentPage,
        limit: this.limit,
        search: this.searchQuery,
        category: this.selectedCategory,
        low_stock: this.filterLowStock ? 'true' : undefined
      };

      const res = await API.medicines.list(params);
      const medicines = res.data || res.medicines || [];
      const pagination = res.pagination;

      if (!medicines.length) {
        showEmptyState(
          'med-table-container',
          'fas fa-pills',
          'No Medicines Found',
          'No pharmacy inventory items match current filter criteria.',
          Auth.hasRole('pharmacist', 'admin') ? `<button class="btn btn-primary" onclick="MedicinesPage.showCreate()"><i class="fas fa-plus"></i> Add Medicine</button>` : ''
        );
        document.getElementById('med-pagination').innerHTML = '';
        return;
      }

      const todayDate = new Date();
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      container.innerHTML = `
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Drug Name</th>
                <th>Category</th>
                <th>Strength / Unit</th>
                <th>Stock Level</th>
                <th>Unit Price</th>
                <th>Batch #</th>
                <th>Expiry Date</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${medicines.map(m => {
                const isLow = m.stock_quantity <= (m.minimum_stock_level || 10);
                const expiry = m.expiry_date ? new Date(m.expiry_date) : null;
                const isExpired = expiry && expiry < todayDate;
                const isExpiringSoon = expiry && !isExpired && expiry <= thirtyDaysFromNow;

                return `
                  <tr>
                    <td>
                      <div style="font-weight: 700; color: var(--gray-900);">${m.name}</div>
                      ${m.generic_name ? `<div style="font-size: 11px; color: var(--gray-400);">${m.generic_name}</div>` : ''}
                    </td>
                    <td><span class="role-badge role-nurse" style="font-size: 11px;">${m.category || 'General'}</span></td>
                    <td>${m.strength || '-'} &bull; ${m.unit || 'units'}</td>
                    <td>
                      ${getStockLevel(m.stock_quantity, m.minimum_stock_level || 10)}
                    </td>
                    <td><strong>${formatCurrency(m.unit_price)}</strong></td>
                    <td><span style="font-family: monospace; font-size: 12px;">${m.batch_number || '-'}</span></td>
                    <td>
                      ${isExpired ? `
                        <span class="status-badge badge-cancelled" style="font-size: 11px;"><i class="fas fa-times-circle"></i> Expired</span>
                        <div style="font-size: 11px; color: var(--danger);">${formatDate(m.expiry_date)}</div>
                      ` : isExpiringSoon ? `
                        <span class="status-badge badge-pending" style="font-size: 11px;"><i class="fas fa-clock"></i> Expiring</span>
                        <div style="font-size: 11px; color: var(--warning-dark);">${formatDate(m.expiry_date)}</div>
                      ` : `
                        <span>${formatDate(m.expiry_date)}</span>
                      `}
                    </td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 4px;">
                        ${Auth.hasRole('pharmacist', 'admin') ? `
                          <button class="btn btn-sm btn-outline" title="Inventory Adjustment" onclick="MedicinesPage.showAdjustStock('${m.id}', '${m.name.replace(/'/g, "\\'")}', ${m.stock_quantity})">
                            <i class="fas fa-balance-scale"></i>
                          </button>
                          <button class="btn btn-sm btn-success" title="Restock" onclick="MedicinesPage.showRestock('${m.id}', '${m.name.replace(/'/g, "\\'")}')">
                            <i class="fas fa-boxes"></i>
                          </button>
                          <button class="btn btn-sm btn-secondary" title="Edit" onclick="MedicinesPage.showEdit('${m.id}')">
                            <i class="fas fa-edit"></i>
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

      renderPagination('med-pagination', pagination, 'MedicinesPage.goToPage');
    } catch (err) {
      container.innerHTML = `<div class="p-4 text-center text-danger">${err.message}</div>`;
    }
  },

  goToPage(p) {
    this.currentPage = p;
    this.loadList();
  },

  showCreate() {
    openModal('Add Medicine to Inventory', `
      <form id="create-med-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Brand / Trade Name <span class="required">*</span></label>
            <input type="text" id="cm-name" class="form-control" required placeholder="e.g. Amoxicillin Trihydrate">
          </div>
          <div class="form-group">
            <label class="form-label">Generic Name</label>
            <input type="text" id="cm-generic" class="form-control" placeholder="e.g. Amoxicillin">
          </div>
        </div>

        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Category <span class="required">*</span></label>
            <select id="cm-category" class="form-control" required>
              <option value="Antibiotic">Antibiotic</option>
              <option value="Analgesic">Analgesic</option>
              <option value="Antipyretic">Antipyretic</option>
              <option value="Antihypertensive">Antihypertensive</option>
              <option value="Antidiabetic">Antidiabetic</option>
              <option value="Antihistamine">Antihistamine</option>
              <option value="Vitamin / Supplement">Vitamin / Supplement</option>
              <option value="Topical / Ointment">Topical / Ointment</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Strength <span class="required">*</span></label>
            <input type="text" id="cm-strength" class="form-control" required placeholder="e.g. 500mg, 10mg/ml">
          </div>
          <div class="form-group">
            <label class="form-label">Dosage Form <span class="required">*</span></label>
            <select id="cm-unit" class="form-control" required>
              <option value="tablet">Tablet</option>
              <option value="capsule">Capsule</option>
              <option value="syrup">Syrup</option>
              <option value="injection">Injection</option>
              <option value="cream">Cream</option>
              <option value="ointment">Ointment</option>
              <option value="drops">Drops</option>
              <option value="inhaler">Inhaler</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Initial Stock Qty <span class="required">*</span></label>
            <input type="number" id="cm-stock" class="form-control" required min="0" value="100">
          </div>
          <div class="form-group">
            <label class="form-label">Min Stock Threshold <span class="required">*</span></label>
            <input type="number" id="cm-min-stock" class="form-control" required min="1" value="20">
          </div>
          <div class="form-group">
            <label class="form-label">Unit Selling Price ($) <span class="required">*</span></label>
            <input type="number" id="cm-price" class="form-control" required min="0" step="0.01" value="15.00">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Batch / Lot Number</label>
            <input type="text" id="cm-batch" class="form-control" placeholder="e.g. BATCH-2026-X">
          </div>
          <div class="form-group">
            <label class="form-label">Expiration Date <span class="required">*</span></label>
            <input type="date" id="cm-expiry" class="form-control" required min="${today()}">
          </div>
        </div>

        <div class="card-footer" style="padding: 12px 0 0; background: transparent;">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-med">Save Medicine</button>
        </div>
      </form>
    `, 'modal-lg');

    document.getElementById('create-med-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      setLoading('#btn-save-med', true);

      const dosageForm = document.getElementById('cm-unit').value;
      const payload = {
        name: document.getElementById('cm-name').value.trim(),
        generic_name: document.getElementById('cm-generic').value.trim() || null,
        category: document.getElementById('cm-category').value,
        dosage_form: dosageForm,
        unit: dosageForm,
        strength: document.getElementById('cm-strength').value.trim(),
        stock_quantity: parseInt(document.getElementById('cm-stock').value) || 0,
        minimum_stock_level: parseInt(document.getElementById('cm-min-stock').value) || 10,
        unit_price: parseFloat(document.getElementById('cm-price').value) || 0,
        batch_number: document.getElementById('cm-batch').value.trim() || null,
        expiry_date: document.getElementById('cm-expiry').value
      };

      try {
        await API.medicines.create(payload);
        showToast('success', 'Medicine Added', `${payload.name} added to pharmacy catalog.`);
        closeModal();
        MedicinesPage.loadList();
      } catch (err) {
        showToast('error', 'Error', err.message);
      } finally {
        setLoading('#btn-save-med', false);
      }
    });
  },

  async showEdit(id) {
    try {
      const m = await API.medicines.get(id);
      openModal('Edit Medicine Details', `
        <form id="edit-med-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Brand Name <span class="required">*</span></label>
              <input type="text" id="em-name" class="form-control" value="${m.name}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Generic Name</label>
              <input type="text" id="em-generic" class="form-control" value="${m.generic_name || ''}">
            </div>
          </div>

          <div class="form-row-3">
            <div class="form-group">
              <label class="form-label">Category</label>
              <input type="text" id="em-category" class="form-control" value="${m.category || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Strength</label>
              <input type="text" id="em-strength" class="form-control" value="${m.strength || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Unit</label>
              <input type="text" id="em-unit" class="form-control" value="${m.unit || 'tablets'}">
            </div>
          </div>

          <div class="form-row-3">
            <div class="form-group">
              <label class="form-label">Stock Quantity</label>
              <input type="number" id="em-stock" class="form-control" value="${m.stock_quantity}">
            </div>
            <div class="form-group">
              <label class="form-label">Min Stock Threshold</label>
              <input type="number" id="em-min-stock" class="form-control" value="${m.minimum_stock_level || 10}">
            </div>
            <div class="form-group">
              <label class="form-label">Unit Price ($)</label>
              <input type="number" id="em-price" class="form-control" value="${m.unit_price || 0}" step="0.01">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Batch Number</label>
              <input type="text" id="em-batch" class="form-control" value="${m.batch_number || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Expiry Date</label>
              <input type="date" id="em-expiry" class="form-control" value="${formatDateForInput(m.expiry_date)}">
            </div>
          </div>

          <div class="card-footer" style="padding: 12px 0 0; background: transparent;">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-update-med">Update Medicine</button>
          </div>
        </form>
      `, 'modal-lg');

      document.getElementById('edit-med-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading('#btn-update-med', true);

        try {
          await API.medicines.update(id, {
            name: document.getElementById('em-name').value.trim(),
            generic_name: document.getElementById('em-generic').value.trim() || null,
            category: document.getElementById('em-category').value.trim(),
            strength: document.getElementById('em-strength').value.trim(),
            unit: document.getElementById('em-unit').value.trim(),
            stock_quantity: parseInt(document.getElementById('em-stock').value) || 0,
            minimum_stock_level: parseInt(document.getElementById('em-min-stock').value) || 10,
            unit_price: parseFloat(document.getElementById('em-price').value) || 0,
            batch_number: document.getElementById('em-batch').value.trim() || null,
            expiry_date: document.getElementById('em-expiry').value || null
          });
          showToast('success', 'Updated', 'Medicine updated successfully.');
          closeModal();
          MedicinesPage.loadList();
        } catch (err) {
          showToast('error', 'Error', err.message);
        } finally {
          setLoading('#btn-update-med', false);
        }
      });
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  showRestock(id, name) {
    openModal(`Restock Medicine: ${name}`, `
      <form id="restock-med-form">
        <div class="form-group">
          <label class="form-label">Units to Add <span class="required">*</span></label>
          <input type="number" id="rm-qty" class="form-control" required min="1" value="50">
        </div>
        <div class="form-group">
          <label class="form-label">New Batch Number (Optional)</label>
          <input type="text" id="rm-batch" class="form-control" placeholder="e.g. BATCH-2026-NEW">
        </div>
        <div class="form-group">
          <label class="form-label">New Expiration Date (Optional)</label>
          <input type="date" id="rm-expiry" class="form-control" min="${today()}">
        </div>
        <div class="card-footer" style="padding: 12px 0 0; background: transparent;">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-success" id="btn-save-restock">Add to Stock</button>
        </div>
      </form>
    `);

    document.getElementById('restock-med-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      setLoading('#btn-save-restock', true);

      const payload = {
        quantity: parseInt(document.getElementById('rm-qty').value) || 0,
        batch_number: document.getElementById('rm-batch').value.trim() || undefined,
        expiry_date: document.getElementById('rm-expiry').value || undefined
      };

      try {
        await API.medicines.restock(id, payload);
        showToast('success', 'Restocked', `${payload.quantity} units added to ${name}.`);
        closeModal();
        MedicinesPage.loadList();
      } catch (err) {
        showToast('error', 'Error', err.message);
      } finally {
        setLoading('#btn-save-restock', false);
      }
    });
  },

  showAdjustStock(id, name, currentStock) {
    openModal(`Inventory Adjustment: ${name}`, `
      <form id="adjust-med-form">
        <div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:6px;padding:12px;margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;">
            <span>Current Recorded Stock:</span>
            <strong style="font-size:15px;color:var(--primary);">${currentStock} units</strong>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Adjustment Type <span class="required">*</span></label>
            <select id="adj-type" class="form-control" required>
              <option value="addition">Addition (+)</option>
              <option value="subtraction">Subtraction (-)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Quantity <span class="required">*</span></label>
            <input type="number" id="adj-qty" class="form-control" required min="1" value="10">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Reason for Adjustment <span class="required">*</span></label>
          <select id="adj-reason" class="form-control" required>
            <option value="Stock count reconciliation">Stock count reconciliation</option>
            <option value="Damaged / broken packaging">Damaged / broken packaging</option>
            <option value="Expired batch write-off">Expired batch write-off</option>
            <option value="Supplier return">Supplier return</option>
            <option value="Emergency clinical transfer">Emergency clinical transfer</option>
            <option value="Correction of previous entry error">Correction of previous entry error</option>
          </select>
        </div>
        <div class="card-footer" style="padding: 12px 0 0; background: transparent;">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-adjust">Apply Adjustment</button>
        </div>
      </form>
    `);

    document.getElementById('adjust-med-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      setLoading('#btn-save-adjust', true);

      const adjType = document.getElementById('adj-type').value;
      const rawQty = parseInt(document.getElementById('adj-qty').value) || 0;
      const changeAmount = adjType === 'addition' ? rawQty : -rawQty;
      const reason = document.getElementById('adj-reason').value;

      try {
        await API.medicines.adjustStock(id, {
          change_amount: changeAmount,
          reason: reason
        });
        showToast('success', 'Stock Adjusted', `Inventory updated for ${name}.`);
        closeModal();
        MedicinesPage.loadList();
      } catch (err) {
        showToast('error', 'Adjustment Error', err.message);
      } finally {
        setLoading('#btn-save-adjust', false);
      }
    });
  }
};

window.MedicinesPage = MedicinesPage;
