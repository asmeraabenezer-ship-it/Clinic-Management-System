/* ============================================================
   NAVIGATION.JS - Routing & Navigation
   ============================================================ */

const NAV_CONFIG = {
  admin: [
    { section: 'Executive', items: [
      { id: 'dashboard', icon: 'fa-tachometer-alt', label: 'Admin Dashboard' },
      { id: 'users', icon: 'fa-users-cog', label: 'User & Staff Management' }
    ]},
    { section: 'Clinical Management', items: [
      { id: 'patients', icon: 'fa-users', label: 'Patient Management' },
      { id: 'doctors', icon: 'fa-user-md', label: 'Doctor Management' },
      { id: 'appointments', icon: 'fa-calendar-check', label: 'Appointment Management' },
      { id: 'visits', icon: 'fa-stream', label: 'Patient Flow Monitoring' }
    ]},
    { section: 'Hospital Services', items: [
      { id: 'medicines', icon: 'fa-pills', label: 'Pharmacy & Inventory' },
      { id: 'lab-tests', icon: 'fa-flask', label: 'Laboratory Management' },
      { id: 'financial', icon: 'fa-file-invoice-dollar', label: 'Financial Management' }
    ]},
    { section: 'Administration', items: [
      { id: 'reports', icon: 'fa-chart-bar', label: 'Reports & Analytics' },
      { id: 'settings', icon: 'fa-cog', label: 'System Settings' },
      { id: 'audit-logs', icon: 'fa-clipboard-list', label: 'Audit Logs' }
    ]}
  ],
  doctor: [
    { section: 'Main', items: [
      { id: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
      { id: 'visits', icon: 'fa-stream', label: 'Clinical Queue' },
      { id: 'appointments', icon: 'fa-calendar-check', label: 'Appointments' }
    ]},
    { section: 'Patient Care', items: [
      { id: 'patients', icon: 'fa-users', label: 'Patients' },
      { id: 'medical-records', icon: 'fa-file-medical', label: 'Medical Records' },
      { id: 'vital-signs', icon: 'fa-heartbeat', label: 'Vital Signs' },
      { id: 'prescriptions', icon: 'fa-prescription-bottle', label: 'Prescriptions' },
      { id: 'lab-tests', icon: 'fa-flask', label: 'Lab Tests' }
    ]},
    { section: 'Other', items: [
      { id: 'reports', icon: 'fa-chart-bar', label: 'Reports' }
    ]}
  ],
  receptionist: [
    { section: 'Main', items: [
      { id: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
      { id: 'visits', icon: 'fa-stream', label: 'Patient Flow' },
      { id: 'appointments', icon: 'fa-calendar-check', label: 'Appointments' }
    ]},
    { section: 'Patient Care', items: [
      { id: 'patients', icon: 'fa-users', label: 'Patients' }
    ]},
    { section: 'Billing', items: [
      { id: 'invoices', icon: 'fa-file-invoice', label: 'Invoices' },
      { id: 'payments', icon: 'fa-credit-card', label: 'Payments' }
    ]}
  ],
  nurse: [
    { section: 'Main', items: [
      { id: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
      { id: 'visits', icon: 'fa-stream', label: 'Patient Queue' },
      { id: 'appointments', icon: 'fa-calendar-check', label: 'Appointments' }
    ]},
    { section: 'Patient Care', items: [
      { id: 'patients', icon: 'fa-users', label: 'Patients' },
      { id: 'vital-signs', icon: 'fa-heartbeat', label: 'Vital Signs' },
      { id: 'lab-tests', icon: 'fa-flask', label: 'Lab Tests' }
    ]}
  ],
  pharmacist: [
    { section: 'Main', items: [
      { id: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
      { id: 'visits', icon: 'fa-stream', label: 'Pharmacy Queue' }
    ]},
    { section: 'Pharmacy', items: [
      { id: 'prescriptions', icon: 'fa-prescription-bottle', label: 'Prescriptions' },
      { id: 'medicines', icon: 'fa-pills', label: 'Medicines' }
    ]}
  ],
  laboratorist: [
    { section: 'Main', items: [
      { id: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
      { id: 'visits', icon: 'fa-stream', label: 'Lab Orders Queue' }
    ]},
    { section: 'Laboratory', items: [
      { id: 'lab-tests', icon: 'fa-flask', label: 'Lab Tests' },
      { id: 'patients', icon: 'fa-users', label: 'Patients' }
    ]}
  ],
  cashier: [
    { section: 'Main', items: [
      { id: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
      { id: 'visits', icon: 'fa-stream', label: 'Checkout Queue' }
    ]},
    { section: 'Billing', items: [
      { id: 'invoices', icon: 'fa-file-invoice', label: 'Invoices' },
      { id: 'payments', icon: 'fa-credit-card', label: 'Payments' },
      { id: 'patients', icon: 'fa-users', label: 'Patients' }
    ]}
  ]
};

let currentPage = 'dashboard';

function buildNav() {
  const role = Auth.getRole();
  const config = NAV_CONFIG[role] || NAV_CONFIG.receptionist;
  const nav = document.getElementById('sidebar-nav');

  nav.innerHTML = config.map(section => `
    <div class="nav-section">
      <div class="nav-section-title">${section.section}</div>
      ${section.items.map(item => `
        <div class="nav-item ${item.id === currentPage ? 'active' : ''}" 
             id="nav-${item.id}"
             onclick="showPage('${item.id}')">
          <i class="fas ${item.icon}"></i>
          <span>${item.label}</span>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function showPage(pageId) {
  if (!pageId) pageId = 'dashboard';

  // Role security guard: restricted admin pages
  const adminOnlyPages = ['users', 'settings', 'audit-logs'];
  if (adminOnlyPages.includes(pageId) && !Auth.hasRole('admin')) {
    showToast('error', 'Access Restricted', 'Administrator privilege is required to access this section.');
    pageId = 'dashboard';
  }

  currentPage = pageId;

  // Persist current page & sync with URL hash so refresh retains current screen
  try {
    localStorage.setItem('clinic_current_page', pageId);
    if (window.location.hash !== `#${pageId}`) {
      window.location.hash = pageId;
    }
  } catch (e) {}

  // Update nav active states
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.getElementById(`nav-${pageId}`);
  if (activeNav) activeNav.classList.add('active');

  // Update breadcrumb
  const labels = {
    dashboard: 'Admin Dashboard',
    users: 'User & Staff Management',
    patients: 'Patient Management',
    doctors: 'Doctor Management',
    appointments: 'Appointment Management',
    visits: 'Patient Flow Monitoring',
    medicines: 'Pharmacy & Inventory',
    'pharmacy-inventory': 'Pharmacy & Inventory',
    'lab-tests': 'Laboratory Management',
    financial: 'Financial Management',
    invoices: 'Invoices & Billing',
    payments: 'Payment Transactions',
    'medical-records': 'Medical Records',
    'vital-signs': 'Vital Signs',
    prescriptions: 'Prescriptions',
    reports: 'Reports & Analytics',
    profile: 'My Profile',
    'audit-logs': 'Audit Logs',
    settings: 'System Settings'
  };

  const breadcrumbEl = document.getElementById('breadcrumb');
  if (breadcrumbEl) {
    breadcrumbEl.innerHTML = `<span class="current">${labels[pageId] || pageId}</span>`;
  }

  // Load page
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

  // Close mobile sidebar
  closeSidebar();

  // Dispatch to page modules
  const pageLoaders = {
    dashboard: () => DashboardPage.load(),
    users: () => UsersPage.load(),
    patients: () => PatientsPage.load(),
    appointments: () => AppointmentsPage.load(),
    doctors: () => DoctorsPage.load(),
    'medical-records': () => MedicalRecordsPage.load(),
    'vital-signs': () => VitalSignsPage.load(),
    prescriptions: () => PrescriptionsPage.load(),
    medicines: () => MedicinesPage.load(),
    'pharmacy-inventory': () => MedicinesPage.load(),
    'lab-tests': () => LabTestsPage.load(),
    financial: () => (window.FinancialPage ? FinancialPage.load() : InvoicesPage.load()),
    invoices: () => InvoicesPage.load(),
    payments: () => PaymentsPage.load(),
    reports: () => ReportsPage.load(),
    profile: () => ProfilePage.load(),
    visits: () => VisitsPage.load(),
    'audit-logs': () => AuditLogsPage.load(),
    settings: () => SettingsPage.load()
  };

  if (pageLoaders[pageId]) {
    setTimeout(() => pageLoaders[pageId](), 0);
  } else {
    content.innerHTML = `<div class="empty-state"><i class="fas fa-tools"></i><h3>Page Not Found</h3><p>The requested page "${escapeHtml(pageId)}" could not be loaded.</p></div>`;
  }
}

function isMobileView() {
  return window.matchMedia('(max-width: 992px)').matches;
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar) return;

  if (isMobileView()) {
    // Prevent desktop collapsed state from corrupting mobile drawer
    sidebar.classList.remove('collapsed');
    const willOpen = !sidebar.classList.contains('mobile-open');
    if (willOpen) {
      sidebar.classList.add('mobile-open');
      if (overlay) overlay.classList.add('active');
      document.body.classList.add('sidebar-open');
    } else {
      closeSidebar();
    }
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (overlay) overlay.classList.remove('active');
  document.body.classList.remove('sidebar-open');
}

function toggleNotifications(event) {
  if (event) event.stopPropagation();
  const dd = document.getElementById('notifications-dropdown');
  const userDd = document.getElementById('user-dropdown');
  if (userDd) userDd.style.display = 'none';

  if (!dd) return;
  const isHidden = dd.style.display === 'none' || getComputedStyle(dd).display === 'none';
  if (isHidden) {
    dd.style.display = 'flex';
    Notifications.loadDropdown();
  } else {
    dd.style.display = 'none';
  }
}

function toggleUserMenu(event) {
  if (event) event.stopPropagation();
  const dd = document.getElementById('user-dropdown');
  const notifDd = document.getElementById('notifications-dropdown');
  if (notifDd) notifDd.style.display = 'none';

  if (!dd) return;
  const isHidden = dd.style.display === 'none' || getComputedStyle(dd).display === 'none';
  dd.style.display = isHidden ? 'block' : 'none';
}

function closeDropdowns() {
  const nd = document.getElementById('notifications-dropdown');
  const ud = document.getElementById('user-dropdown');
  if (nd) nd.style.display = 'none';
  if (ud) ud.style.display = 'none';
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  const notifBtnWrapper = document.querySelector('.notification-btn-wrapper');
  const userMenuWrapper = document.querySelector('.user-menu-wrapper');
  if (notifBtnWrapper && !notifBtnWrapper.contains(e.target)) {
    const nd = document.getElementById('notifications-dropdown');
    if (nd) nd.style.display = 'none';
  }
  if (userMenuWrapper && !userMenuWrapper.contains(e.target)) {
    const ud = document.getElementById('user-dropdown');
    if (ud) ud.style.display = 'none';
  }
});

// Close mobile sidebar on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSidebar();
    closeDropdowns();
  }
});

// Handle window resize between mobile and desktop views
window.addEventListener('resize', () => {
  const sidebar = document.getElementById('sidebar');
  if (!isMobileView()) {
    // Switched to desktop mode: dismiss mobile drawer and overlay
    closeSidebar();
  } else {
    // Switched to mobile mode: clean up desktop collapsed class
    if (sidebar) sidebar.classList.remove('collapsed');
  }
});

// Global search
const globalSearch = document.getElementById('global-search');
if (globalSearch) {
  globalSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      showPage('patients');
      setTimeout(() => {
        const searchInput = document.getElementById('patients-search');
        if (searchInput) {
          searchInput.value = e.target.value;
          PatientsPage.search();
        }
        globalSearch.value = '';
      }, 300);
    }
  });
}

// Users page (admin)
const UsersPage = {
  filters: {
    search: '',
    role: '',
    status: ''
  },
  cachedUsers: [],

  async load() {
    const user = Auth.getUser();
    if (user.role !== 'admin') {
      document.getElementById('page-content').innerHTML = `<div class="empty-state"><i class="fas fa-lock"></i><h3>Access Denied</h3><p>Admin access required.</p></div>`;
      return;
    }

    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>User & Staff Management</h2>
          <p>Register clinic professionals, assign roles, configure doctor credentials, and audit staff accounts</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" onclick="UsersPage.showCreate()">
            <i class="fas fa-user-plus"></i> Register Staff
          </button>
        </div>
      </div>

      <!-- Filters & Search Bar -->
      <div class="card" style="margin-bottom: 24px; padding: 16px;">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
          <div style="flex:1;min-width:220px;position:relative;">
            <input type="text" id="user-search-input" class="form-control" placeholder="Search staff by name or email..." onkeyup="UsersPage.onSearch(event)">
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:12px;font-weight:600;color:var(--gray-600);">Role:</label>
            <select id="user-role-filter" class="form-control" style="width:150px;" onchange="UsersPage.onFilterChange()">
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="doctor">Doctor</option>
              <option value="receptionist">Receptionist</option>
              <option value="nurse">Nurse</option>
              <option value="pharmacist">Pharmacist</option>
              <option value="laboratorist">Laboratorist</option>
              <option value="cashier">Cashier</option>
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:12px;font-weight:600;color:var(--gray-600);">Status:</label>
            <select id="user-status-filter" class="form-control" style="width:130px;" onchange="UsersPage.onFilterChange()">
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <button class="btn btn-outline" onclick="UsersPage.resetFilters()">
            <i class="fas fa-times"></i> Reset
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-body" id="users-list" style="padding:0;">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
      </div>
    `;

    await this.loadList();
  },

  onSearch(e) {
    this.filters.search = e.target.value.trim().toLowerCase();
    this.filterAndRender();
  },

  onFilterChange() {
    this.filters.role = document.getElementById('user-role-filter').value;
    this.filters.status = document.getElementById('user-status-filter').value;
    this.filterAndRender();
  },

  resetFilters() {
    this.filters = { search: '', role: '', status: '' };
    const sInput = document.getElementById('user-search-input');
    const rInput = document.getElementById('user-role-filter');
    const stInput = document.getElementById('user-status-filter');
    if (sInput) sInput.value = '';
    if (rInput) rInput.value = '';
    if (stInput) stInput.value = '';
    this.filterAndRender();
  },

  async loadList() {
    const container = document.getElementById('users-list');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
      this.cachedUsers = await API.auth.getUsers();
      this.filterAndRender();
    } catch(err) {
      container.innerHTML = `<div class="p-4 text-center text-danger">${err.message}</div>`;
    }
  },

  filterAndRender() {
    const container = document.getElementById('users-list');
    if (!container) return;

    let users = this.cachedUsers || [];
    if (this.filters.search) {
      const q = this.filters.search;
      users = users.filter(u => 
        (u.full_name && u.full_name.toLowerCase().includes(q)) || 
        (u.email && u.email.toLowerCase().includes(q))
      );
    }
    if (this.filters.role) {
      users = users.filter(u => u.role === this.filters.role);
    }
    if (this.filters.status) {
      const wantActive = this.filters.status === 'active';
      users = users.filter(u => !!u.is_active === wantActive);
    }

    if (!users.length) {
      container.innerHTML = '<div class="empty-state p-5" style="text-align:center;"><i class="fas fa-users" style="font-size:36px;color:var(--gray-400);margin-bottom:12px;"></i><h3>No Staff Found</h3><p style="color:var(--gray-500);">No accounts match the selected filters.</p></div>';
      return;
    }

    container.innerHTML = `
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>Staff Member</th>
              <th>Email</th>
              <th>Role</th>
              <th>Professional Details</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => {
              const doc = u.doctor_details || (Array.isArray(u.doctors) && u.doctors[0]) || null;
              const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString() : '-';

              return `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <div class="avatar avatar-sm">${getInitials(u.full_name)}</div>
                    <div>
                      <strong>${u.full_name}</strong>
                      ${doc ? `<div style="font-size:11px;color:var(--primary);font-weight:600;">Lic: ${doc.license_number || '-'}</div>` : ''}
                    </div>
                  </div>
                </td>
                <td style="font-size:13px;">${u.email}</td>
                <td>${getRoleBadge(u.role)}</td>
                <td style="font-size:12px;color:var(--gray-600);">
                  ${doc ? `
                    <div><strong>${doc.specialization || 'General'}</strong></div>
                    <div>Fee: ${formatCurrency(doc.consultation_fee || 0)}</div>
                  ` : '<span style="color:var(--gray-400);">-</span>'}
                </td>
                <td style="font-size:13px;">${u.phone || '-'}</td>
                <td>
                  <span class="status-badge ${u.is_active ? 'badge-completed' : 'badge-cancelled'}">
                    ${u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style="font-size:12px;color:var(--gray-500);white-space:nowrap;">${dateStr}</td>
                <td>
                  <div style="display:flex;gap:5px;align-items:center;">
                    ${u.id !== Auth.user?.id ? `
                      <button class="btn btn-sm btn-outline" style="color:#b45309;border-color:#f59e0b;padding:3px 7px;font-size:11px;" title="Assume / Act as this staff member" onclick="Auth.assumeUser('${u.id}', '${u.full_name.replace(/'/g, "\\'")}')">
                        <i class="fas fa-user-secret"></i>
                      </button>
                    ` : ''}
                    <button class="btn btn-sm btn-secondary" style="padding:3px 7px;font-size:11px;" title="Edit Staff Details" onclick="UsersPage.showEdit('${u.id}', '${u.full_name.replace(/'/g, "\\'")}', '${u.role}', '${u.phone || ''}', ${u.is_active}, '${encodeURIComponent(JSON.stringify(doc || {}))}')">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline" style="padding:3px 7px;font-size:11px;" title="Reset Password" onclick="UsersPage.showResetPassword('${u.id}', '${u.full_name.replace(/'/g, "\\'")}')">
                      <i class="fas fa-key"></i>
                    </button>
                    <button class="btn btn-sm ${u.is_active ? 'btn-warning' : 'btn-success'}" style="padding:3px 7px;font-size:11px;" title="${u.is_active ? 'Deactivate Account' : 'Activate Account'}" onclick="UsersPage.toggleActive('${u.id}', ${u.is_active})">
                      <i class="fas ${u.is_active ? 'fa-ban' : 'fa-check'}"></i>
                    </button>
                    ${u.id !== Auth.user?.id ? `
                      <button class="btn btn-sm btn-danger" style="padding:3px 7px;font-size:11px;" title="Deactivate / Delete User" onclick="UsersPage.confirmDelete('${u.id}', '${u.full_name.replace(/'/g, "\\'")}')">
                        <i class="fas fa-trash-alt"></i>
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

  showCreate() {
    openModal('Register Clinic Staff Member', `
      <form id="create-user-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Full Name <span class="required">*</span></label>
            <input type="text" id="cu-name" class="form-control" placeholder="Dr. Jane Doe" required>
          </div>
          <div class="form-group">
            <label class="form-label">Email Address <span class="required">*</span></label>
            <input type="email" id="cu-email" class="form-control" placeholder="jane@clinic.com" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Password <span class="required">*</span></label>
            <div style="position:relative;">
              <input type="password" id="cu-password" class="form-control" required minlength="6" placeholder="Min 6 characters">
              <button type="button" class="toggle-password" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:var(--gray-500);" onclick="togglePassword('cu-password')">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input type="text" id="cu-phone" class="form-control" placeholder="+1-555-0100">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Staff Role <span class="required">*</span></label>
          <select id="cu-role" class="form-control" required onchange="UsersPage.toggleDoctorFields(this.value)">
            <option value="">Select role...</option>
            <option value="admin">Administrator</option>
            <option value="doctor">Doctor / Physician</option>
            <option value="receptionist">Receptionist</option>
            <option value="nurse">Nurse</option>
            <option value="pharmacist">Pharmacist</option>
            <option value="laboratorist">Laboratorist</option>
            <option value="cashier">Cashier</option>
          </select>
        </div>

        <!-- Doctor Professional Fields (Shown when role is doctor) -->
        <div id="doctor-spec-fields" style="display:none;background:var(--gray-50);border:1px solid var(--gray-200);border-radius:6px;padding:16px;margin-bottom:16px;">
          <h4 style="font-size:13px;font-weight:700;color:var(--primary);margin-bottom:12px;">
            <i class="fas fa-user-md"></i> Doctor Professional Credentials
          </h4>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Specialization <span class="required">*</span></label>
              <select id="cu-doc-spec" class="form-control">
                <option value="General Medicine">General Medicine</option>
                <option value="Cardiology">Cardiology</option>
                <option value="Pediatrics">Pediatrics</option>
                <option value="Orthopedics">Orthopedics</option>
                <option value="Dermatology">Dermatology</option>
                <option value="Neurology">Neurology</option>
                <option value="Gynecology">Gynecology</option>
                <option value="Ophthalmology">Ophthalmology</option>
                <option value="Internal Medicine">Internal Medicine</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Medical License Number <span class="required">*</span></label>
              <input type="text" id="cu-doc-lic" class="form-control" placeholder="MD-88219">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Qualification</label>
              <input type="text" id="cu-doc-qual" class="form-control" placeholder="MBBS, MD">
            </div>
            <div class="form-group">
              <label class="form-label">Consultation Fee ($)</label>
              <input type="number" id="cu-doc-fee" class="form-control" step="0.01" min="0" value="50.00">
            </div>
            <div class="form-group">
              <label class="form-label">Years of Experience</label>
              <input type="number" id="cu-doc-exp" class="form-control" min="0" value="5">
            </div>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Professional Bio / Summary</label>
            <input type="text" id="cu-doc-bio" class="form-control" placeholder="Board-certified specialist...">
          </div>
        </div>

        <div class="card-footer" style="padding-top:10px;">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="cu-submit-btn">
            <i class="fas fa-check"></i> Register Staff Member
          </button>
        </div>
      </form>
    `);

    document.getElementById('create-user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const role = document.getElementById('cu-role').value;
      const submitBtn = document.getElementById('cu-submit-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
      }

      try {
        const payload = {
          full_name: document.getElementById('cu-name').value.trim(),
          email: document.getElementById('cu-email').value.trim(),
          password: document.getElementById('cu-password').value,
          phone: document.getElementById('cu-phone').value.trim() || null,
          role: role
        };

        if (role === 'doctor') {
          payload.specialization = document.getElementById('cu-doc-spec').value;
          payload.license_number = document.getElementById('cu-doc-lic').value.trim();
          payload.qualification = document.getElementById('cu-doc-qual').value.trim() || 'MD';
          payload.consultation_fee = parseFloat(document.getElementById('cu-doc-fee').value) || 50;
          payload.years_experience = parseInt(document.getElementById('cu-doc-exp').value) || 0;
          payload.bio = document.getElementById('cu-doc-bio').value.trim() || null;

          if (!payload.license_number) {
            throw new Error('Medical license number is required for doctors.');
          }
        }

        await API.auth.createUser(payload);
        showToast('success', 'Staff Registered', `Account for ${payload.full_name} created successfully.`);
        closeModal();
        this.loadList();
      } catch(err) {
        showToast('error', 'Registration Failed', err.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-check"></i> Register Staff Member';
        }
      }
    });
  },

  toggleDoctorFields(role) {
    const el = document.getElementById('doctor-spec-fields');
    if (!el) return;
    el.style.display = role === 'doctor' ? 'block' : 'none';
    const licInput = document.getElementById('cu-doc-lic');
    if (licInput) {
      licInput.required = (role === 'doctor');
    }
  },

  showEdit(id, name, role, phone, isActive, encodedDoc) {
    let doc = {};
    try {
      doc = JSON.parse(decodeURIComponent(encodedDoc || '{}'));
    } catch(e) {}

    openModal('Edit Staff Account', `
      <form id="edit-user-form">
        <div class="form-group">
          <label class="form-label">Full Name <span class="required">*</span></label>
          <input type="text" id="eu-name" class="form-control" value="${name}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Staff Role</label>
            <select id="eu-role" class="form-control" onchange="UsersPage.toggleEditDocFields(this.value)">
              <option value="admin" ${role === 'admin' ? 'selected' : ''}>Administrator</option>
              <option value="doctor" ${role === 'doctor' ? 'selected' : ''}>Doctor</option>
              <option value="receptionist" ${role === 'receptionist' ? 'selected' : ''}>Receptionist</option>
              <option value="nurse" ${role === 'nurse' ? 'selected' : ''}>Nurse</option>
              <option value="pharmacist" ${role === 'pharmacist' ? 'selected' : ''}>Pharmacist</option>
              <option value="laboratorist" ${role === 'laboratorist' ? 'selected' : ''}>Laboratorist</option>
              <option value="cashier" ${role === 'cashier' ? 'selected' : ''}>Cashier</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="text" id="eu-phone" class="form-control" value="${phone || ''}">
          </div>
        </div>

        <!-- Doctor Details Section in Edit -->
        <div id="eu-doc-section" style="display:${role === 'doctor' ? 'block' : 'none'};background:var(--gray-50);border:1px solid var(--gray-200);border-radius:6px;padding:14px;margin-bottom:16px;">
          <h4 style="font-size:13px;font-weight:700;color:var(--primary);margin-bottom:12px;">Doctor Information</h4>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Specialization</label>
              <input type="text" id="eu-doc-spec" class="form-control" value="${doc.specialization || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">License Number</label>
              <input type="text" id="eu-doc-lic" class="form-control" value="${doc.license_number || ''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Consultation Fee ($)</label>
              <input type="number" id="eu-doc-fee" class="form-control" step="0.01" min="0" value="${doc.consultation_fee ?? 50}">
            </div>
            <div class="form-group">
              <label class="form-label">Years of Experience</label>
              <input type="number" id="eu-doc-exp" class="form-control" min="0" value="${doc.years_experience ?? 5}">
            </div>
          </div>
        </div>

        <div class="card-footer">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    `);

    document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const newRole = document.getElementById('eu-role').value;
        const payload = {
          full_name: document.getElementById('eu-name').value.trim(),
          role: newRole,
          phone: document.getElementById('eu-phone').value.trim()
        };

        if (newRole === 'doctor') {
          payload.specialization = document.getElementById('eu-doc-spec').value.trim();
          payload.license_number = document.getElementById('eu-doc-lic').value.trim();
          payload.consultation_fee = parseFloat(document.getElementById('eu-doc-fee').value) || 0;
          payload.years_experience = parseInt(document.getElementById('eu-doc-exp').value) || 0;
        }

        await API.auth.updateUser(id, payload);
        showToast('success', 'User Updated', 'Account changes saved successfully');
        closeModal();
        this.loadList();
      } catch(err) {
        showToast('error', 'Error', err.message);
      }
    });
  },

  toggleEditDocFields(role) {
    const el = document.getElementById('eu-doc-section');
    if (el) el.style.display = role === 'doctor' ? 'block' : 'none';
  },

  showResetPassword(id, name) {
    openModal(`Reset Password for ${name}`, `
      <form id="reset-password-form">
        <p style="color:var(--gray-600);font-size:13px;margin-bottom:16px;">
          Enter a new secure password for <strong>${name}</strong>. The user can use this immediately to log in.
        </p>
        <div class="form-group">
          <label class="form-label">New Password <span class="required">*</span></label>
          <div style="position:relative;">
            <input type="password" id="rp-password" class="form-control" required minlength="6" placeholder="Min 6 characters">
            <button type="button" class="toggle-password" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:var(--gray-500);" onclick="togglePassword('rp-password')">
              <i class="fas fa-eye"></i>
            </button>
          </div>
        </div>
        <div class="card-footer">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary"><i class="fas fa-key"></i> Update Password</button>
        </div>
      </form>
    `);

    document.getElementById('reset-password-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const password = document.getElementById('rp-password').value;
        await API.auth.updateUser(id, { password });
        showToast('success', 'Password Reset', `Password updated successfully for ${name}.`);
        closeModal();
      } catch (err) {
        showToast('error', 'Reset Failed', err.message);
      }
    });
  },

  async toggleActive(id, currentStatus) {
    const action = currentStatus ? 'deactivate' : 'activate';
    confirmAction(`Are you sure you want to ${action} this staff account? Deactivated staff will not be able to log in.`, async () => {
      try {
        await API.auth.updateUser(id, { is_active: !currentStatus });
        showToast('success', 'Status Updated', `Staff account ${action}d successfully`);
        this.loadList();
      } catch(err) {
        showToast('error', 'Error', err.message);
      }
    });
  },

  confirmDelete(id, name) {
    confirmAction(
      `Are you sure you want to remove user "${name}"? If the user has active or historical clinical records (appointments, medical notes, invoices), their account will be safely deactivated to preserve clinical history.`,
      async () => {
        try {
          await API.auth.deleteUser(id);
          showToast('success', 'User Removed', `User "${name}" has been removed/deactivated.`);
          this.loadList();
        } catch (err) {
          showToast('error', 'Error', err.message);
        }
      },
      'Deactivate User'
    );
  }
};

// Profile page
const ProfilePage = {
  async load() {
    const user = Auth.getUser();
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>My Profile</h2>
          <p>View and update your account information</p>
        </div>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-user"></i> Profile Information</h3>
          </div>
          <div class="card-body">
            <div style="text-align:center;margin-bottom:24px;">
              <div class="avatar avatar-xl" style="margin:0 auto 12px;">${getInitials(user.full_name)}</div>
              <h3 style="font-size:20px;font-weight:700;">${user.full_name}</h3>
              <p style="color:var(--gray-500);">${user.email}</p>
              ${getRoleBadge(user.role)}
            </div>
            <div class="detail-grid">
              <div class="detail-item"><label>Phone</label><p>${user.phone || '-'}</p></div>
              <div class="detail-item"><label>Role</label><p>${user.role}</p></div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-shield-alt"></i> Security</h3>
          </div>
          <div class="card-body">
            <p style="color:var(--gray-500);margin-bottom:20px;">Update your password to keep your account secure.</p>
            <button class="btn btn-primary" onclick="showChangePassword()">
              <i class="fas fa-key"></i> Change Password
            </button>
          </div>
        </div>
      </div>
    `;
  }
};

window.UsersPage = UsersPage;
window.ProfilePage = ProfilePage;
window.showPage = showPage;
window.isMobileView = isMobileView;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.toggleNotifications = toggleNotifications;
window.toggleUserMenu = toggleUserMenu;
window.closeDropdowns = closeDropdowns;
window.buildNav = buildNav;
