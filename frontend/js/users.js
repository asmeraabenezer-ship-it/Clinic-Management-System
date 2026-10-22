/* ============================================================
   USERS.JS - User & Staff Management (Admin Module)
   Provides complete management of clinic staff:
   - Live retrieval of profiles from Supabase
   - Account status tracking (Active / Deactivated)
   - Role assignment (admin, doctor, receptionist, nurse, pharmacist, laboratorist, cashier)
   - Secure staff registration with password
   - Doctor credentials & schedule initialization
   - Real-time searching, role filtering, status toggling
   - Administrative role assumption (Override mode)
   ============================================================ */

const UsersPage = {
  staffList: [],
  filteredStaff: [],
  searchQuery: '',
  roleFilter: '',
  statusFilter: '',
  isLoading: false,

  async load() {
    // Route guard: only admin can access
    if (!Auth.hasRole('admin')) {
      showToast('error', 'Access Restricted', 'Administrator privilege is required to access User & Staff Management.');
      showPage('dashboard');
      return;
    }

    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header" style="margin-bottom: 24px;">
        <div class="page-header-info">
          <h2>User & Staff Management</h2>
          <p>Administer clinical and administrative accounts, staff roles, system privileges, and access credentials.</p>
        </div>
        <div class="page-header-actions" style="display:flex; gap:10px;">
          <button class="btn btn-secondary" onclick="UsersPage.loadList()" title="Refresh staff list">
            <i class="fas fa-sync-alt"></i> Refresh
          </button>
          <button class="btn btn-primary" onclick="UsersPage.showCreateModal()">
            <i class="fas fa-user-plus"></i> Add New Staff
          </button>
        </div>
      </div>

      <!-- Quick Metrics Summary Bar -->
      <div class="stats-grid" id="users-stats-bar" style="margin-bottom: 24px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
        <div class="stat-card primary">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-users-cog"></i></div>
            <span class="stat-trend up">Total</span>
          </div>
          <div class="stat-value" id="ustats-total">-</div>
          <div class="stat-label">Total Staff Accounts</div>
        </div>
        <div class="stat-card success">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-user-check"></i></div>
            <span class="stat-trend up">Active</span>
          </div>
          <div class="stat-value" id="ustats-active">-</div>
          <div class="stat-label">Active & Authorized</div>
        </div>
        <div class="stat-card info">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-user-md"></i></div>
            <span class="stat-trend up">Medical</span>
          </div>
          <div class="stat-value" id="ustats-doctors">-</div>
          <div class="stat-label">Attending Doctors</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-card-header">
            <div class="stat-icon"><i class="fas fa-user-lock"></i></div>
            <span class="stat-trend down">Restricted</span>
          </div>
          <div class="stat-value" id="ustats-inactive">-</div>
          <div class="stat-label">Deactivated Accounts</div>
        </div>
      </div>

      <!-- Search & Filters Tooling -->
      <div class="search-filter-bar" style="margin-bottom: 20px; display:flex; flex-wrap:wrap; gap:12px; align-items:center;">
        <div class="search-input-wrapper" style="flex: 1; min-width: 260px;">
          <i class="fas fa-search"></i>
          <input type="text" id="users-search-input" placeholder="Search staff by full name, email, or phone..." oninput="UsersPage.onSearch(this.value)">
        </div>

        <select class="filter-select" id="users-filter-role" style="min-width: 170px;" onchange="UsersPage.onRoleFilter(this.value)">
          <option value="">All Roles</option>
          <option value="admin">Administrator</option>
          <option value="doctor">Doctor / Physician</option>
          <option value="receptionist">Receptionist</option>
          <option value="nurse">Nurse</option>
          <option value="pharmacist">Pharmacist</option>
          <option value="laboratorist">Laboratorist</option>
          <option value="cashier">Cashier</option>
        </select>

        <select class="filter-select" id="users-filter-status" style="min-width: 150px;" onchange="UsersPage.onStatusFilter(this.value)">
          <option value="">All Statuses</option>
          <option value="active">Active Accounts</option>
          <option value="inactive">Deactivated</option>
        </select>
      </div>

      <!-- Main Staff Table Card -->
      <div class="card" style="box-shadow: var(--shadow);">
        <div class="card-body" style="padding: 0;" id="users-table-container">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading staff accounts from Supabase...</div>
        </div>
      </div>
    `;

    await this.loadList();
  },

  async loadList() {
    const container = document.getElementById('users-table-container');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading staff accounts...</div>';

    try {
      this.isLoading = true;
      const params = {};
      if (this.roleFilter) params.role = this.roleFilter;
      if (this.statusFilter) params.status = this.statusFilter;
      if (this.searchQuery) params.search = this.searchQuery;

      const data = await API.auth.getUsers(params);
      this.staffList = Array.isArray(data) ? data : [];
      this.filteredStaff = [...this.staffList];

      this.updateStatsBar();
      this.renderTable();
    } catch (err) {
      console.error('Failed to load staff profiles:', err);
      container.innerHTML = `
        <div class="empty-state" style="padding: 40px 20px;">
          <i class="fas fa-exclamation-triangle" style="color: var(--danger); font-size: 38px; margin-bottom: 12px;"></i>
          <h3>Failed to Load Staff Directory</h3>
          <p style="color: var(--gray-600); max-width: 480px; margin: 0 auto 16px auto;">
            ${escapeHtml(err.message || 'Unable to connect to Supabase profiles database.')}
          </p>
          <button class="btn btn-primary" onclick="UsersPage.loadList()">
            <i class="fas fa-redo"></i> Retry Connection
          </button>
        </div>
      `;
    } finally {
      this.isLoading = false;
    }
  },

  updateStatsBar() {
    const total = this.staffList.length;
    const active = this.staffList.filter(u => u.is_active).length;
    const inactive = total - active;
    const doctors = this.staffList.filter(u => u.role === 'doctor').length;

    const elTotal = document.getElementById('ustats-total');
    const elActive = document.getElementById('ustats-active');
    const elInactive = document.getElementById('ustats-inactive');
    const elDoctors = document.getElementById('ustats-doctors');

    if (elTotal) elTotal.textContent = total;
    if (elActive) elActive.textContent = active;
    if (elInactive) elInactive.textContent = inactive;
    if (elDoctors) elDoctors.textContent = doctors;
  },

  onSearch(val) {
    this.searchQuery = (val || '').toLowerCase().trim();
    this.applyFilters();
  },

  onRoleFilter(val) {
    this.roleFilter = val;
    this.loadList();
  },

  onStatusFilter(val) {
    this.statusFilter = val;
    this.loadList();
  },

  applyFilters() {
    if (!this.searchQuery) {
      this.filteredStaff = [...this.staffList];
    } else {
      this.filteredStaff = this.staffList.filter(u =>
        (u.full_name && u.full_name.toLowerCase().includes(this.searchQuery)) ||
        (u.email && u.email.toLowerCase().includes(this.searchQuery)) ||
        (u.phone && u.phone.toLowerCase().includes(this.searchQuery)) ||
        (u.role && u.role.toLowerCase().includes(this.searchQuery))
      );
    }
    this.renderTable();
  },

  getRoleBadge(role) {
    const roles = {
      admin: { label: 'Administrator', bg: '#fee2e2', color: '#991b1b', icon: 'fa-shield-alt' },
      doctor: { label: 'Doctor / MD', bg: '#e0e7ff', color: '#3730a3', icon: 'fa-user-md' },
      receptionist: { label: 'Receptionist', bg: '#dcfce7', color: '#166534', icon: 'fa-headset' },
      nurse: { label: 'Nurse', bg: '#ccfbf1', color: '#115e59', icon: 'fa-heartbeat' },
      pharmacist: { label: 'Pharmacist', bg: '#fef3c7', color: '#92400e', icon: 'fa-pills' },
      laboratorist: { label: 'Laboratorist', bg: '#cffafe', color: '#155e75', icon: 'fa-flask' },
      cashier: { label: 'Cashier / Billing', bg: '#f3e8ff', color: '#6b21a8', icon: 'fa-cash-register' }
    };
    const r = roles[role] || { label: role, bg: '#f1f5f9', color: '#475569', icon: 'fa-user' };
    return `
      <span class="status-badge" style="background:${r.bg}; color:${r.color}; display:inline-flex; align-items:center; gap:6px; font-weight:600; padding:4px 10px; border-radius:20px;">
        <i class="fas ${r.icon}" style="font-size:11px;"></i> ${r.label}
      </span>
    `;
  },

  renderTable() {
    const container = document.getElementById('users-table-container');
    if (!container) return;

    if (!this.filteredStaff || this.filteredStaff.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 48px 20px; text-align: center;">
          <i class="fas fa-users-slash" style="font-size: 42px; color: var(--gray-400); margin-bottom: 14px;"></i>
          <h3>No Staff Members Found</h3>
          <p style="color: var(--gray-500); margin-bottom: 16px;">No user profiles match your filter criteria.</p>
          <button class="btn btn-sm btn-secondary" onclick="UsersPage.clearFilters()">Clear Filters</button>
        </div>
      `;
      return;
    }

    const currentUserId = Auth.getUser()?.id;

    container.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Staff Member</th>
              <th>Assigned Role</th>
              <th>Contact Details</th>
              <th>Account Status</th>
              <th>Registered On</th>
              <th style="text-align: right; padding-right: 20px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.filteredStaff.map(u => {
              const isCurrentUser = u.id === currentUserId;
              const docInfo = u.doctors && u.doctors.length > 0 ? u.doctors[0] : null;

              return `
                <tr id="user-row-${u.id}">
                  <td>
                    <div style="display:flex; align-items:center; gap:12px;">
                      <div class="avatar avatar-sm" style="background: ${u.is_active ? 'var(--primary)' : 'var(--gray-400)'}; color:white; font-weight:700;">
                        ${getInitials(u.full_name || u.email)}
                      </div>
                      <div>
                        <div style="font-weight: 600; color: var(--gray-900); display: flex; align-items: center; gap: 6px;">
                          ${escapeHtml(u.full_name || 'Unnamed Staff')}
                          ${isCurrentUser ? '<span class="badge badge-info" style="font-size:10px;">YOU</span>' : ''}
                        </div>
                        <div style="font-size: 12px; color: var(--gray-500);">
                          ${escapeHtml(u.email)}
                        </div>
                        ${docInfo ? `
                          <div style="font-size: 11px; color: var(--primary); margin-top: 2px;">
                            <i class="fas fa-stethoscope"></i> ${escapeHtml(docInfo.specialization)} &bull; ${escapeHtml(docInfo.license_number || '')}
                          </div>
                        ` : ''}
                      </div>
                    </div>
                  </td>
                  <td>
                    ${this.getRoleBadge(u.role)}
                  </td>
                  <td>
                    <div style="font-size: 13px;">
                      <i class="fas fa-phone-alt" style="color:var(--gray-400); width:16px;"></i> ${escapeHtml(u.phone || 'No phone')}
                    </div>
                  </td>
                  <td>
                    <span class="status-badge ${u.is_active ? 'status-active' : 'status-inactive'}" style="padding: 4px 10px;">
                      <i class="fas ${u.is_active ? 'fa-check-circle' : 'fa-ban'}"></i>
                      ${u.is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td style="font-size: 12px; color: var(--gray-500);">
                    ${formatDate(u.created_at)}
                  </td>
                  <td style="text-align: right; padding-right: 20px;" onclick="event.stopPropagation()">
                    <div style="display:inline-flex; gap:6px; align-items:center;">
                      <!-- Assume / Impersonate (Admin feature) -->
                      ${!isCurrentUser && u.is_active ? `
                        <button class="btn btn-sm btn-ghost" title="Operate as this user (Impersonate)" onclick="Auth.assumeUser('${u.id}', '${escapeHtml(u.full_name)}')">
                          <i class="fas fa-user-secret" style="color: #d97706;"></i>
                        </button>
                      ` : ''}

                      <!-- Edit Profile -->
                      <button class="btn btn-sm btn-secondary" title="Edit Staff Details" onclick="UsersPage.showEditModal('${u.id}')">
                        <i class="fas fa-edit"></i>
                      </button>

                      <!-- Toggle Active / Deactivate -->
                      ${!isCurrentUser ? `
                        <button class="btn btn-sm ${u.is_active ? 'btn-ghost text-danger' : 'btn-success'}" 
                                title="${u.is_active ? 'Deactivate Account' : 'Activate Account'}"
                                onclick="UsersPage.toggleActiveStatus('${u.id}', ${!u.is_active})">
                          <i class="fas ${u.is_active ? 'fa-user-slash' : 'fa-user-check'}"></i>
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
  },

  clearFilters() {
    this.searchQuery = '';
    this.roleFilter = '';
    this.statusFilter = '';
    const sInput = document.getElementById('users-search-input');
    const rSelect = document.getElementById('users-filter-role');
    const stSelect = document.getElementById('users-filter-status');
    if (sInput) sInput.value = '';
    if (rSelect) rSelect.value = '';
    if (stSelect) stSelect.value = '';
    this.loadList();
  },

  // ============================================================
  // CREATE STAFF MODAL
  // ============================================================
  showCreateModal() {
    const modalBody = `
      <form id="create-user-form" onsubmit="UsersPage.handleCreateUser(event)">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label for="cu-fullname">Full Legal Name <span style="color:var(--danger)">*</span></label>
            <div class="input-wrapper">
              <i class="fas fa-user"></i>
              <input type="text" id="cu-fullname" placeholder="e.g. Dr. Alex Morgan or Sarah Jenkins" required>
            </div>
          </div>

          <div class="form-group">
            <label for="cu-email">Email Address (Login ID) <span style="color:var(--danger)">*</span></label>
            <div class="input-wrapper">
              <i class="fas fa-envelope"></i>
              <input type="email" id="cu-email" placeholder="staff@clinic.com" required autocomplete="off">
            </div>
          </div>

          <div class="form-group">
            <label for="cu-password">Initial Password <span style="color:var(--danger)">*</span></label>
            <div class="input-wrapper">
              <i class="fas fa-lock"></i>
              <input type="password" id="cu-password" placeholder="At least 6 characters" minlength="6" required autocomplete="new-password">
              <button type="button" class="toggle-password" onclick="togglePassword('cu-password')"><i class="fas fa-eye"></i></button>
            </div>
          </div>

          <div class="form-group">
            <label for="cu-role">Assigned Role & Privileges <span style="color:var(--danger)">*</span></label>
            <select id="cu-role" class="form-control" required onchange="UsersPage.onRoleSelectChange(this.value)">
              <option value="doctor">Doctor (Clinical & Queue)</option>
              <option value="receptionist">Receptionist (Check-In & Billing)</option>
              <option value="nurse">Nurse (Triage & Vitals)</option>
              <option value="pharmacist">Pharmacist (Dispensing & Stock)</option>
              <option value="laboratorist">Laboratorist (Lab Orders)</option>
              <option value="cashier">Cashier (Billing & Receipts)</option>
              <option value="admin">System Administrator (Full Control)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="cu-phone">Direct Contact Phone</label>
            <div class="input-wrapper">
              <i class="fas fa-phone"></i>
              <input type="text" id="cu-phone" placeholder="+1-555-0199">
            </div>
          </div>
        </div>

        <!-- Optional Doctor Specific Attributes Section -->
        <div id="doctor-attributes-panel" style="display:block; margin-top:16px; padding:16px; background:#f8fafc; border:1px solid var(--gray-200); border-radius:var(--radius);">
          <div style="font-weight:700; font-size:13px; color:var(--primary); margin-bottom:12px; display:flex; align-items:center; gap:6px;">
            <i class="fas fa-user-md"></i> Physician Credentials & Consultation Setup
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            <div class="form-group">
              <label for="cu-specialization">Medical Specialization</label>
              <input type="text" id="cu-specialization" class="form-control" placeholder="e.g. General Medicine, Pediatrics, Cardiology" value="General Medicine">
            </div>
            <div class="form-group">
              <label for="cu-license">Medical License Number</label>
              <input type="text" id="cu-license" class="form-control" placeholder="e.g. LIC-98421">
            </div>
            <div class="form-group">
              <label for="cu-fee">Standard Consultation Fee ($)</label>
              <input type="number" step="0.01" id="cu-fee" class="form-control" placeholder="75.00" value="75.00">
            </div>
            <div class="form-group">
              <label for="cu-qualification">Qualifications</label>
              <input type="text" id="cu-qualification" class="form-control" placeholder="e.g. MD, MBBS, FACP" value="MD, MBBS">
            </div>
            <div class="form-group">
              <label for="cu-experience">Years of Experience</label>
              <input type="number" id="cu-experience" class="form-control" placeholder="5" value="5">
            </div>
            <div class="form-group">
              <label for="cu-bio">Physician Bio</label>
              <input type="text" id="cu-bio" class="form-control" placeholder="Brief clinical background...">
            </div>
          </div>
        </div>

        <div id="cu-error" class="alert alert-error" style="display:none; margin-top:16px;"></div>

        <div class="modal-footer" style="padding: 16px 0 0 0; margin-top: 20px; display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="cu-submit-btn">
            <i class="fas fa-user-check"></i> Register Staff Account
          </button>
        </div>
      </form>
    `;

    openModal('Register New Clinic Staff Account', modalBody);
  },

  onRoleSelectChange(role) {
    const docPanel = document.getElementById('doctor-attributes-panel');
    if (docPanel) {
      docPanel.style.display = role === 'doctor' ? 'block' : 'none';
    }
  },

  async handleCreateUser(e) {
    e.preventDefault();
    const errBox = document.getElementById('cu-error');
    const submitBtn = document.getElementById('cu-submit-btn');
    if (errBox) errBox.style.display = 'none';

    const full_name = document.getElementById('cu-fullname').value.trim();
    const email = document.getElementById('cu-email').value.trim();
    const password = document.getElementById('cu-password').value;
    const role = document.getElementById('cu-role').value;
    const phone = document.getElementById('cu-phone').value.trim();

    if (!full_name || !email || !password || !role) {
      if (errBox) {
        errBox.textContent = 'Please fill out all mandatory fields.';
        errBox.style.display = 'block';
      }
      return;
    }

    const payload = {
      full_name,
      email,
      password,
      role,
      phone: phone || null
    };

    if (role === 'doctor') {
      payload.specialization = document.getElementById('cu-specialization').value.trim() || 'General Medicine';
      payload.license_number = document.getElementById('cu-license').value.trim() || `LIC-${Math.floor(10000 + Math.random() * 90000)}`;
      payload.consultation_fee = parseFloat(document.getElementById('cu-fee').value) || 75.00;
      payload.qualification = document.getElementById('cu-qualification').value.trim() || 'MD, MBBS';
      payload.years_experience = parseInt(document.getElementById('cu-experience').value) || 5;
      payload.bio = document.getElementById('cu-bio').value.trim() || null;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';

      const res = await API.auth.createUser(payload);
      closeModal();
      showToast('success', 'Staff Created', `Account for ${full_name} (${role}) has been registered.`);
      await this.loadList();
    } catch (err) {
      console.error('Create staff error:', err);
      if (errBox) {
        errBox.textContent = err.message || 'Failed to create staff account.';
        errBox.style.display = 'block';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-user-check"></i> Register Staff Account';
      }
    }
  },

  // ============================================================
  // EDIT STAFF MODAL
  // ============================================================
  showEditModal(userId) {
    const user = this.staffList.find(u => u.id === userId);
    if (!user) return;

    const docInfo = user.doctors && user.doctors.length > 0 ? user.doctors[0] : null;

    const modalBody = `
      <form id="edit-user-form" onsubmit="UsersPage.handleUpdateUser(event, '${user.id}')">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label for="eu-fullname">Full Legal Name <span style="color:var(--danger)">*</span></label>
            <input type="text" id="eu-fullname" class="form-control" value="${escapeHtml(user.full_name || '')}" required>
          </div>

          <div class="form-group">
            <label>Email Address</label>
            <input type="email" class="form-control" value="${escapeHtml(user.email || '')}" disabled style="background:var(--gray-100); cursor:not-allowed;">
          </div>

          <div class="form-group">
            <label for="eu-phone">Contact Phone</label>
            <input type="text" id="eu-phone" class="form-control" value="${escapeHtml(user.phone || '')}">
          </div>

          <div class="form-group">
            <label for="eu-role">Staff Role <span style="color:var(--danger)">*</span></label>
            <select id="eu-role" class="form-control" required onchange="UsersPage.onEditRoleChange(this.value)">
              <option value="doctor" ${user.role === 'doctor' ? 'selected' : ''}>Doctor</option>
              <option value="receptionist" ${user.role === 'receptionist' ? 'selected' : ''}>Receptionist</option>
              <option value="nurse" ${user.role === 'nurse' ? 'selected' : ''}>Nurse</option>
              <option value="pharmacist" ${user.role === 'pharmacist' ? 'selected' : ''}>Pharmacist</option>
              <option value="laboratorist" ${user.role === 'laboratorist' ? 'selected' : ''}>Laboratorist</option>
              <option value="cashier" ${user.role === 'cashier' ? 'selected' : ''}>Cashier</option>
              <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrator</option>
            </select>
          </div>

          <div class="form-group">
            <label for="eu-status">Account Authorization</label>
            <select id="eu-status" class="form-control">
              <option value="true" ${user.is_active ? 'selected' : ''}>Active (Authorized to Sign In)</option>
              <option value="false" ${!user.is_active ? 'selected' : ''}>Deactivated (Access Suspended)</option>
            </select>
          </div>

          <div class="form-group" style="grid-column: 1 / -1;">
            <label for="eu-password">Reset Password (Leave blank to keep current)</label>
            <input type="password" id="eu-password" class="form-control" placeholder="Enter new password if changing" minlength="6" autocomplete="new-password">
          </div>
        </div>

        <!-- Doctor fields if doctor -->
        <div id="eu-doctor-panel" style="display:${user.role === 'doctor' ? 'block' : 'none'}; margin-top:16px; padding:16px; background:#f8fafc; border:1px solid var(--gray-200); border-radius:var(--radius);">
          <div style="font-weight:700; font-size:13px; color:var(--primary); margin-bottom:12px;">
            <i class="fas fa-stethoscope"></i> Physician Details
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            <div class="form-group">
              <label for="eu-specialization">Specialization</label>
              <input type="text" id="eu-specialization" class="form-control" value="${escapeHtml(docInfo?.specialization || 'General Medicine')}">
            </div>
            <div class="form-group">
              <label for="eu-license">License Number</label>
              <input type="text" id="eu-license" class="form-control" value="${escapeHtml(docInfo?.license_number || '')}">
            </div>
            <div class="form-group">
              <label for="eu-fee">Consultation Fee ($)</label>
              <input type="number" step="0.01" id="eu-fee" class="form-control" value="${docInfo?.consultation_fee || 75.00}">
            </div>
            <div class="form-group">
              <label for="eu-qualification">Qualification</label>
              <input type="text" id="eu-qualification" class="form-control" value="${escapeHtml(docInfo?.qualification || 'MD, MBBS')}">
            </div>
          </div>
        </div>

        <div id="eu-error" class="alert alert-error" style="display:none; margin-top:16px;"></div>

        <div class="modal-footer" style="padding: 16px 0 0 0; margin-top: 20px; display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="eu-submit-btn">
            <i class="fas fa-save"></i> Save Changes
          </button>
        </div>
      </form>
    `;

    openModal(`Edit Staff Profile: ${user.full_name}`, modalBody);
  },

  onEditRoleChange(role) {
    const panel = document.getElementById('eu-doctor-panel');
    if (panel) panel.style.display = role === 'doctor' ? 'block' : 'none';
  },

  async handleUpdateUser(e, userId) {
    e.preventDefault();
    const errBox = document.getElementById('eu-error');
    const submitBtn = document.getElementById('eu-submit-btn');
    if (errBox) errBox.style.display = 'none';

    const full_name = document.getElementById('eu-fullname').value.trim();
    const role = document.getElementById('eu-role').value;
    const phone = document.getElementById('eu-phone').value.trim();
    const is_active = document.getElementById('eu-status').value === 'true';
    const password = document.getElementById('eu-password').value;

    const payload = {
      full_name,
      role,
      phone: phone || null,
      is_active
    };

    if (password && password.length >= 6) {
      payload.password = password;
    }

    if (role === 'doctor') {
      const spec = document.getElementById('eu-specialization')?.value.trim();
      const lic = document.getElementById('eu-license')?.value.trim();
      const fee = document.getElementById('eu-fee')?.value;
      const qual = document.getElementById('eu-qualification')?.value.trim();
      if (spec) payload.specialization = spec;
      if (lic) payload.license_number = lic;
      if (fee) payload.consultation_fee = parseFloat(fee);
      if (qual) payload.qualification = qual;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

      await API.auth.updateUser(userId, payload);
      closeModal();
      showToast('success', 'Profile Updated', `Updated staff record for ${full_name}.`);
      await this.loadList();
    } catch (err) {
      console.error('Update staff error:', err);
      if (errBox) {
        errBox.textContent = err.message || 'Failed to update staff record.';
        errBox.style.display = 'block';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
      }
    }
  },

  // ============================================================
  // TOGGLE ACTIVE / DEACTIVATE STATUS
  // ============================================================
  async toggleActiveStatus(userId, newActiveStatus) {
    const user = this.staffList.find(u => u.id === userId);
    if (!user) return;

    const actionText = newActiveStatus ? 'activate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${actionText} ${user.full_name}'s account?`)) {
      return;
    }

    try {
      await API.auth.updateUser(userId, { is_active: newActiveStatus });
      showToast('success', 'Status Changed', `${user.full_name} is now ${newActiveStatus ? 'Active' : 'Deactivated'}.`);
      await this.loadList();
    } catch (err) {
      console.error('Toggle status error:', err);
      showToast('error', 'Status Update Failed', err.message);
    }
  }
};
