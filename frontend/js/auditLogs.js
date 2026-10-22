/* ============================================================
   AUDITLOGS.JS - System Operations & Security Audit Trail
   ============================================================ */

const AuditLogsPage = {
  filters: {
    action: '',
    entity_type: '',
    date_from: '',
    date_to: ''
  },

  async load() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>System Audit Logs</h2>
          <p>Immutable record of privileged operations, security actions, clinical workflow changes, and inventory movements</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary" onclick="AuditLogsPage.loadList()">
            <i class="fas fa-sync-alt"></i> Refresh
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="card" style="margin-bottom: 24px; padding: 16px;">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:12px;font-weight:600;color:var(--gray-600);">Action:</label>
            <select id="al-action" class="form-control" style="width:160px;" onchange="AuditLogsPage.onFilterChange()">
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="status_change">Status Change</option>
              <option value="stock_adjust">Stock Adjust</option>
              <option value="settings_update">Settings Update</option>
              <option value="password_reset">Password Reset</option>
            </select>
          </div>

          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:12px;font-weight:600;color:var(--gray-600);">Entity Type:</label>
            <select id="al-entity" class="form-control" style="width:160px;" onchange="AuditLogsPage.onFilterChange()">
              <option value="">All Entities</option>
              <option value="user">User / Staff</option>
              <option value="doctor">Doctor</option>
              <option value="patient">Patient</option>
              <option value="appointment">Appointment</option>
              <option value="medicine">Medicine / Pharmacy</option>
              <option value="lab_test">Lab Test</option>
              <option value="settings">Clinic Settings</option>
            </select>
          </div>

          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:12px;font-weight:600;color:var(--gray-600);">From:</label>
            <input type="date" id="al-from" class="form-control" style="width:145px;" onchange="AuditLogsPage.onFilterChange()">
          </div>

          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:12px;font-weight:600;color:var(--gray-600);">To:</label>
            <input type="date" id="al-to" class="form-control" style="width:145px;" onchange="AuditLogsPage.onFilterChange()">
          </div>

          <button class="btn btn-outline" onclick="AuditLogsPage.resetFilters()">
            <i class="fas fa-times"></i> Clear Filters
          </button>
        </div>
      </div>

      <!-- Logs Table -->
      <div class="card">
        <div id="audit-logs-container">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
      </div>
    `;

    await this.loadList();
  },

  onFilterChange() {
    this.filters.action = document.getElementById('al-action').value;
    this.filters.entity_type = document.getElementById('al-entity').value;
    this.filters.date_from = document.getElementById('al-from').value;
    this.filters.date_to = document.getElementById('al-to').value;
    this.loadList();
  },

  resetFilters() {
    document.getElementById('al-action').value = '';
    document.getElementById('al-entity').value = '';
    document.getElementById('al-from').value = '';
    document.getElementById('al-to').value = '';
    this.filters = { action: '', entity_type: '', date_from: '', date_to: '' };
    this.loadList();
  },

  async loadList() {
    const container = document.getElementById('audit-logs-container');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
      const params = {};
      if (this.filters.action) params.action = this.filters.action;
      if (this.filters.entity_type) params.entity_type = this.filters.entity_type;
      if (this.filters.date_from) params.date_from = this.filters.date_from;
      if (this.filters.date_to) params.date_to = this.filters.date_to;

      const res = await API.auditLogs.list(params);
      const logs = Array.isArray(res) ? res : (res?.data || []);

      if (!logs || !logs.length) {
        container.innerHTML = `
          <div class="empty-state p-5" style="text-align:center;">
            <i class="fas fa-clipboard-check" style="font-size:42px;color:var(--gray-400);margin-bottom:12px;"></i>
            <h3>No Audit Logs Found</h3>
            <p style="color:var(--gray-500);">No administrative or system activities match the selected filter criteria.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th style="width:160px;">Timestamp</th>
                <th>Action</th>
                <th>Entity Type</th>
                <th>Entity Target</th>
                <th>Actor</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => {
                const actionBadgeClass = this.getActionBadge(log.action);
                const detailsText = this.formatDetails(log.details);
                const dateStr = log.created_at ? new Date(log.created_at).toLocaleString() : '-';

                return `
                  <tr>
                    <td style="font-size:12px;color:var(--gray-600);white-space:nowrap;">
                      <i class="far fa-clock" style="margin-right:4px;"></i>${dateStr}
                    </td>
                    <td>
                      <span class="status-badge ${actionBadgeClass}" style="text-transform:uppercase;font-size:11px;font-weight:700;">
                        ${log.action || 'ACTION'}
                      </span>
                    </td>
                    <td>
                      <span style="font-weight:600;color:var(--gray-700);">
                        <i class="${this.getEntityIcon(log.entity_type)}" style="margin-right:6px;color:var(--primary);"></i>
                        ${log.entity_type || '-'}
                      </span>
                    </td>
                    <td style="font-family:monospace;font-size:12px;color:var(--gray-600);">
                      ${log.entity_id ? log.entity_id.substring(0, 16) + (log.entity_id.length > 16 ? '...' : '') : '-'}
                    </td>
                    <td style="font-size:13px;">
                      ${log.actor_name ? `<strong>${log.actor_name}</strong>` : `<span style="color:var(--gray-500);">${log.user_id ? log.user_id.substring(0, 8) + '...' : 'System'}</span>`}
                    </td>
                    <td style="max-width:320px;">
                      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                        <span style="font-size:12px;color:var(--gray-600);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${detailsText}">
                          ${detailsText}
                        </span>
                        <button class="btn btn-sm btn-outline" style="padding:2px 8px;font-size:11px;" onclick="AuditLogsPage.viewDetails('${encodeURIComponent(JSON.stringify(log))}')">
                          <i class="fas fa-eye"></i> View
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `
        <div class="p-4 text-center text-danger">
          <i class="fas fa-exclamation-circle" style="font-size:24px;margin-bottom:8px;"></i>
          <div>Failed to retrieve audit trail: ${err.message}</div>
          <button class="btn btn-sm btn-primary" style="margin-top:12px;" onclick="AuditLogsPage.loadList()">Retry</button>
        </div>
      `;
    }
  },

  getActionBadge(action) {
    if (!action) return 'badge-secondary';
    const a = action.toLowerCase();
    if (a.includes('create') || a.includes('add')) return 'badge-completed';
    if (a.includes('delete') || a.includes('remove') || a.includes('deactivate')) return 'badge-cancelled';
    if (a.includes('update') || a.includes('adjust') || a.includes('change')) return 'badge-in-progress';
    if (a.includes('reset')) return 'badge-waiting';
    return 'badge-info';
  },

  getEntityIcon(entity) {
    if (!entity) return 'fas fa-cube';
    const e = entity.toLowerCase();
    if (e.includes('user') || e.includes('staff')) return 'fas fa-user-cog';
    if (e.includes('doctor')) return 'fas fa-user-md';
    if (e.includes('patient')) return 'fas fa-user-injured';
    if (e.includes('appointment')) return 'fas fa-calendar-check';
    if (e.includes('medicine')) return 'fas fa-pills';
    if (e.includes('lab')) return 'fas fa-flask';
    if (e.includes('setting')) return 'fas fa-cog';
    if (e.includes('invoice') || e.includes('payment')) return 'fas fa-file-invoice-dollar';
    return 'fas fa-cube';
  },

  formatDetails(details) {
    if (!details) return '-';
    if (typeof details === 'string') return details;
    try {
      const parts = [];
      for (const [k, v] of Object.entries(details)) {
        if (typeof v === 'object' && v !== null) {
          parts.push(`${k}: {...}`);
        } else {
          parts.push(`${k}: ${v}`);
        }
      }
      return parts.join(', ') || '-';
    } catch (e) {
      return JSON.stringify(details);
    }
  },

  viewDetails(encodedLog) {
    try {
      const log = JSON.parse(decodeURIComponent(encodedLog));
      openModal('Audit Log Entry Details', `
        <div style="font-size:13px;">
          <div class="detail-grid" style="margin-bottom:16px;">
            <div class="detail-item"><label>Timestamp</label><p>${new Date(log.created_at).toLocaleString()}</p></div>
            <div class="detail-item"><label>Action</label><p><strong>${log.action}</strong></p></div>
            <div class="detail-item"><label>Entity Type</label><p>${log.entity_type}</p></div>
            <div class="detail-item"><label>Entity ID</label><p style="font-family:monospace;">${log.entity_id || '-'}</p></div>
            <div class="detail-item"><label>Acting User ID</label><p style="font-family:monospace;">${log.user_id || 'System'}</p></div>
            <div class="detail-item"><label>IP Address</label><p>${log.ip_address || 'Internal/Session'}</p></div>
          </div>
          <div class="card" style="background:var(--gray-50);border:1px solid var(--gray-200);padding:14px;">
            <label style="font-weight:700;font-size:12px;text-transform:uppercase;color:var(--gray-600);margin-bottom:8px;display:block;">Payload Details</label>
            <pre style="margin:0;font-size:12px;max-height:260px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;">${JSON.stringify(log.details || {}, null, 2)}</pre>
          </div>
          <div class="card-footer" style="margin-top:16px;">
            <button class="btn btn-secondary" onclick="closeModal()">Close</button>
          </div>
        </div>
      `);
    } catch (e) {
      showToast('error', 'Error', 'Failed to inspect log details');
    }
  }
};

window.AuditLogsPage = AuditLogsPage;
