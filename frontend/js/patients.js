/* ============================================================
   PATIENTS.JS - Patient Registration, Directory & Profiles
   ============================================================ */

const PatientsPage = {
  currentPage: 1,
  limit: 10,
  searchQuery: '',
  selectedGender: '',

  async load() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>Patient Directory</h2>
          <p>Search, manage and register patient medical profiles</p>
        </div>
        <div class="page-header-actions">
          ${Auth.hasRole('admin', 'receptionist', 'nurse') ? `
            <button class="btn btn-primary" onclick="PatientsPage.showCreate()">
              <i class="fas fa-user-plus"></i> Register Patient
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Search & Filters -->
      <div class="search-filter-bar">
        <div class="search-input-wrapper">
          <i class="fas fa-search"></i>
          <input type="text" id="patients-search" placeholder="Search by name, patient #, or phone..." oninput="PatientsPage.onSearchInput(this.value)">
        </div>
        <select class="filter-select" id="patients-gender-filter" onchange="PatientsPage.onGenderFilter(this.value)">
          <option value="">All Genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
        <button class="btn btn-secondary" onclick="PatientsPage.loadList()"><i class="fas fa-sync-alt"></i></button>
      </div>

      <!-- Patient Table Card -->
      <div class="card">
        <div class="card-body" style="padding: 0;" id="patients-table-container">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
        <div id="patients-pagination"></div>
      </div>
    `;

    await this.loadList();
  },

  onSearchInput: debounce(function(val) {
    PatientsPage.searchQuery = val.trim();
    PatientsPage.currentPage = 1;
    PatientsPage.loadList();
  }, 350),

  onGenderFilter(val) {
    this.selectedGender = val;
    this.currentPage = 1;
    this.loadList();
  },

  search() {
    this.currentPage = 1;
    this.loadList();
  },

  async loadList() {
    const container = document.getElementById('patients-table-container');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
      const params = {
        page: this.currentPage,
        limit: this.limit,
        search: this.searchQuery,
        gender: this.selectedGender
      };

      const res = await API.patients.list(params);
      const patients = res.data || res.patients || [];
      const pagination = res.pagination;

      if (!patients.length) {
        showEmptyState(
          'patients-table-container',
          'fas fa-user-slash',
          'No Patients Found',
          this.searchQuery ? `No matching records found for "${this.searchQuery}"` : 'Get started by registering a new patient.',
          Auth.hasRole('admin', 'receptionist') ? `<button class="btn btn-primary" onclick="PatientsPage.showCreate()"><i class="fas fa-user-plus"></i> Register Patient</button>` : ''
        );
        document.getElementById('patients-pagination').innerHTML = '';
        return;
      }

      container.innerHTML = `
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Patient #</th>
                <th>Name</th>
                <th>Age / Gender</th>
                <th>Phone</th>
                <th>Blood Group</th>
                <th>Registered</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${patients.map(p => `
                <tr onclick="PatientsPage.viewProfile('${p.id}')" style="cursor: pointer;">
                  <td><span style="font-weight: 700; color: var(--primary); font-family: monospace;">${p.patient_number || 'N/A'}</span></td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <div class="avatar avatar-sm">${getInitials(`${p.first_name} ${p.last_name}`)}</div>
                      <div>
                        <strong>${p.first_name} ${p.last_name}</strong>
                        ${p.allergies ? `<div style="font-size:11px;color:var(--danger);"><i class="fas fa-allergies"></i> ${p.allergies}</div>` : ''}
                      </div>
                    </div>
                  </td>
                  <td>${formatAge(p.date_of_birth)} &bull; ${p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : '-'}</td>
                  <td>${p.phone || '-'}</td>
                  <td>
                    ${(p.blood_type || p.blood_group) ? `<span class="status-badge" style="background: #fee2e2; color: #991b1b; font-weight: 700;">${p.blood_type || p.blood_group}</span>` : '-'}
                  </td>
                  <td>${formatDate(p.created_at)}</td>
                  <td style="text-align: right;" onclick="event.stopPropagation()">
                    <div style="display: inline-flex; gap: 6px;">
                      <button class="btn btn-sm btn-secondary" title="View Profile" onclick="PatientsPage.viewProfile('${p.id}')">
                        <i class="fas fa-eye"></i>
                      </button>
                      ${Auth.hasRole('admin', 'receptionist') ? `
                        <button class="btn btn-sm btn-primary" title="Book Appointment" onclick="AppointmentsPage.showCreate('${p.id}')">
                          <i class="fas fa-calendar-plus"></i>
                        </button>
                        <button class="btn btn-sm btn-ghost" title="Edit Patient" onclick="PatientsPage.showEdit('${p.id}')">
                          <i class="fas fa-edit"></i>
                        </button>
                      ` : ''}
                      ${Auth.hasRole('doctor', 'nurse') ? `
                        <button class="btn btn-sm btn-outline" title="Record Vitals" onclick="VitalSignsPage.showCreate('${p.id}')">
                          <i class="fas fa-heartbeat"></i>
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      renderPagination('patients-pagination', pagination, 'PatientsPage.goToPage');
    } catch (err) {
      container.innerHTML = `<div class="p-4 text-center text-danger">${err.message}</div>`;
    }
  },

  goToPage(page) {
    this.currentPage = page;
    this.loadList();
  },

  showCreate() {
    openModal('Register New Patient', `
      <form id="create-patient-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">First Name <span class="required">*</span></label>
            <input type="text" id="cp-first-name" class="form-control" required placeholder="e.g. John">
          </div>
          <div class="form-group">
            <label class="form-label">Last Name <span class="required">*</span></label>
            <input type="text" id="cp-last-name" class="form-control" required placeholder="e.g. Doe">
          </div>
        </div>

        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Date of Birth <span class="required">*</span></label>
            <input type="date" id="cp-dob" class="form-control" required max="${today()}">
          </div>
          <div class="form-group">
            <label class="form-label">Gender <span class="required">*</span></label>
            <select id="cp-gender" class="form-control" required>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Blood Group</label>
            <select id="cp-blood" class="form-control">
              <option value="">Unknown</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Phone Number <span class="required">*</span></label>
            <input type="tel" id="cp-phone" class="form-control" required placeholder="e.g. +1 555-0192">
          </div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" id="cp-email" class="form-control" placeholder="e.g. john@example.com">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Residential Address</label>
          <input type="text" id="cp-address" class="form-control" placeholder="Street address, City, State, ZIP">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Emergency Contact Name</label>
            <input type="text" id="cp-em-name" class="form-control" placeholder="Contact person">
          </div>
          <div class="form-group">
            <label class="form-label">Emergency Contact Phone</label>
            <input type="tel" id="cp-em-phone" class="form-control" placeholder="Phone number">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Known Allergies</label>
            <input type="text" id="cp-allergies" class="form-control" placeholder="e.g. Penicillin, Peanuts, Latex">
          </div>
          <div class="form-group">
            <label class="form-label">Medical History / Chronic Conditions</label>
            <input type="text" id="cp-history" class="form-control" placeholder="e.g. Hypertension, Diabetes Type 2">
          </div>
        </div>

        <div class="card-footer" style="padding-right: 0; padding-left: 0; background: transparent;">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-patient">
            <span class="btn-text"><i class="fas fa-save"></i> Register Patient</span>
            <span class="btn-spinner" style="display:none;"><i class="fas fa-spinner fa-spin"></i> Saving...</span>
          </button>
        </div>
      </form>
    `, 'modal-lg');

    document.getElementById('create-patient-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      setLoading('#btn-save-patient', true);

      const payload = {
        first_name: document.getElementById('cp-first-name').value.trim(),
        last_name: document.getElementById('cp-last-name').value.trim(),
        date_of_birth: document.getElementById('cp-dob').value,
        gender: document.getElementById('cp-gender').value,
        blood_type: document.getElementById('cp-blood').value || null,
        blood_group: document.getElementById('cp-blood').value || null,
        phone: document.getElementById('cp-phone').value.trim(),
        email: document.getElementById('cp-email').value.trim() || null,
        address: document.getElementById('cp-address').value.trim() || null,
        emergency_contact_name: document.getElementById('cp-em-name').value.trim() || null,
        emergency_contact_phone: document.getElementById('cp-em-phone').value.trim() || null,
        allergies: document.getElementById('cp-allergies').value.trim() || null,
        medical_history: document.getElementById('cp-history').value.trim() || null
      };

      try {
        const created = await API.patients.create(payload);
        showToast('success', 'Patient Registered', `${payload.first_name} ${payload.last_name} (${created.patient_number || ''}) registered.`);
        closeModal();
        PatientsPage.loadList();
      } catch (err) {
        showToast('error', 'Registration Failed', err.message);
      } finally {
        setLoading('#btn-save-patient', false);
      }
    });
  },

  async showEdit(id) {
    try {
      const p = await API.patients.get(id);
      openModal('Edit Patient Details', `
        <form id="edit-patient-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">First Name <span class="required">*</span></label>
              <input type="text" id="ep-first-name" class="form-control" value="${p.first_name || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Last Name <span class="required">*</span></label>
              <input type="text" id="ep-last-name" class="form-control" value="${p.last_name || ''}" required>
            </div>
          </div>
          <div class="form-row-3">
            <div class="form-group">
              <label class="form-label">Date of Birth <span class="required">*</span></label>
              <input type="date" id="ep-dob" class="form-control" value="${formatDateForInput(p.date_of_birth)}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Gender <span class="required">*</span></label>
              <select id="ep-gender" class="form-control" required>
                <option value="male" ${p.gender === 'male' ? 'selected' : ''}>Male</option>
                <option value="female" ${p.gender === 'female' ? 'selected' : ''}>Female</option>
                <option value="other" ${p.gender === 'other' ? 'selected' : ''}>Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Blood Group</label>
              <select id="ep-blood" class="form-control">
                <option value="">Unknown</option>
                ${['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => `<option value="${bg}" ${(p.blood_type || p.blood_group) === bg ? 'selected' : ''}>${bg}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Phone Number <span class="required">*</span></label>
              <input type="tel" id="ep-phone" class="form-control" value="${p.phone || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" id="ep-email" class="form-control" value="${p.email || ''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Address</label>
            <input type="text" id="ep-address" class="form-control" value="${p.address || ''}">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Emergency Contact Name</label>
              <input type="text" id="ep-em-name" class="form-control" value="${p.emergency_contact_name || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Emergency Contact Phone</label>
              <input type="tel" id="ep-em-phone" class="form-control" value="${p.emergency_contact_phone || ''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Allergies</label>
              <input type="text" id="ep-allergies" class="form-control" value="${p.allergies || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Medical History</label>
              <input type="text" id="ep-history" class="form-control" value="${p.medical_history || ''}">
            </div>
          </div>
          <div class="card-footer" style="padding-right: 0; padding-left: 0; background: transparent;">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-update-patient">Save Changes</button>
          </div>
        </form>
      `, 'modal-lg');

      document.getElementById('edit-patient-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          first_name: document.getElementById('ep-first-name').value.trim(),
          last_name: document.getElementById('ep-last-name').value.trim(),
          date_of_birth: document.getElementById('ep-dob').value,
          gender: document.getElementById('ep-gender').value,
          blood_type: document.getElementById('ep-blood').value || null,
          blood_group: document.getElementById('ep-blood').value || null,
          phone: document.getElementById('ep-phone').value.trim(),
          email: document.getElementById('ep-email').value.trim() || null,
          address: document.getElementById('ep-address').value.trim() || null,
          emergency_contact_name: document.getElementById('ep-em-name').value.trim() || null,
          emergency_contact_phone: document.getElementById('ep-em-phone').value.trim() || null,
          allergies: document.getElementById('ep-allergies').value.trim() || null,
          medical_history: document.getElementById('ep-history').value.trim() || null
        };

        try {
          await API.patients.update(id, payload);
          showToast('success', 'Updated', 'Patient profile updated successfully.');
          closeModal();
          PatientsPage.loadList();
        } catch (err) {
          showToast('error', 'Update Failed', err.message);
        }
      });
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  async viewProfile(id) {
    try {
      const p = await API.patients.get(id);
      openModal(`Patient Profile: ${p.first_name} ${p.last_name}`, `
        <!-- Patient Banner -->
        <div style="background: linear-gradient(135deg, var(--primary), var(--primary-dark)); border-radius: var(--radius); padding: 24px; color: white; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 18px;">
            <div class="avatar avatar-lg" style="background: rgba(255,255,255,0.25); border: 2px solid rgba(255,255,255,0.6);">${getInitials(`${p.first_name} ${p.last_name}`)}</div>
            <div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <h2 style="font-size: 22px; font-weight: 800; color: white; margin: 0;">${p.first_name} ${p.last_name}</h2>
                <span style="background: rgba(255,255,255,0.2); padding: 2px 10px; border-radius: var(--radius-full); font-size: 12px; font-family: monospace;">${p.patient_number || ''}</span>
              </div>
              <div style="opacity: 0.9; font-size: 13px; margin-top: 4px;">
                ${formatAge(p.date_of_birth)} &bull; ${p.gender ? p.gender.toUpperCase() : ''} &bull; DOB: ${formatDate(p.date_of_birth)}
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            ${(p.blood_type || p.blood_group) ? `<div style="background: white; color: var(--danger); font-weight: 800; border-radius: var(--radius); padding: 8px 14px; text-align: center;"><div style="font-size: 10px; text-transform: uppercase;">Blood</div><div style="font-size: 18px; line-height: 1;">${p.blood_type || p.blood_group}</div></div>` : ''}
            <button class="btn btn-sm" style="background: white; color: var(--primary);" onclick="AppointmentsPage.showCreate('${p.id}')">
              <i class="fas fa-calendar-plus"></i> Book Appt
            </button>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="tabs">
          <button class="tab-btn active" onclick="PatientsPage.switchTab('p-tab-overview', this)"><i class="fas fa-id-card"></i> Overview</button>
          <button class="tab-btn" onclick="PatientsPage.switchTab('p-tab-history', this); PatientsPage.loadPatientHistory('${p.id}')"><i class="fas fa-notes-medical"></i> Medical History</button>
          <button class="tab-btn" onclick="PatientsPage.switchTab('p-tab-vitals', this); PatientsPage.loadPatientVitals('${p.id}')"><i class="fas fa-heartbeat"></i> Vital Signs</button>
          <button class="tab-btn" onclick="PatientsPage.switchTab('p-tab-files', this); PatientsPage.loadPatientFiles('${p.id}')"><i class="fas fa-file-medical"></i> Documents</button>
        </div>

        <!-- Tab 1: Overview -->
        <div class="tab-content active" id="p-tab-overview">
          <div class="detail-grid" style="margin-bottom: 20px;">
            <div class="detail-item"><label>Phone Number</label><p>${p.phone || '-'}</p></div>
            <div class="detail-item"><label>Email Address</label><p>${p.email || '-'}</p></div>
            <div class="detail-item"><label>Address</label><p>${p.address || '-'}</p></div>
            <div class="detail-item"><label>Registered Date</label><p>${formatDate(p.created_at)}</p></div>
          </div>

          <div style="border-top: 1px solid var(--gray-100); padding-top: 16px; margin-bottom: 20px;">
            <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: var(--gray-800);">Emergency Contact</h4>
            <div class="detail-grid">
              <div class="detail-item"><label>Contact Person</label><p>${p.emergency_contact_name || 'None listed'}</p></div>
              <div class="detail-item"><label>Contact Phone</label><p>${p.emergency_contact_phone || 'None listed'}</p></div>
            </div>
          </div>

          <div style="border-top: 1px solid var(--gray-100); padding-top: 16px;">
            <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: var(--gray-800);">Clinical Alerts</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div class="alert alert-error" style="margin-bottom: 0;">
                <i class="fas fa-allergies"></i>
                <div><strong>Allergies:</strong> ${p.allergies || 'No known allergies reported'}</div>
              </div>
              <div class="alert alert-info" style="margin-bottom: 0;">
                <i class="fas fa-history"></i>
                <div><strong>Medical History:</strong> ${p.medical_history || 'No prior chronic conditions recorded'}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: Medical History -->
        <div class="tab-content" id="p-tab-history">
          <div id="patient-history-content" class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        </div>

        <!-- Tab 3: Vital Signs -->
        <div class="tab-content" id="p-tab-vitals">
          <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
            <button class="btn btn-sm btn-primary" onclick="VitalSignsPage.showCreate('${p.id}')"><i class="fas fa-plus"></i> Record New Vitals</button>
          </div>
          <div id="patient-vitals-content" class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        </div>

        <!-- Tab 4: Documents / Medical Files -->
        <div class="tab-content" id="p-tab-files">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <span style="font-size: 13px; color: var(--gray-500);">Securely uploaded medical imaging, PDFs, and laboratory reports</span>
            <button class="btn btn-sm btn-primary" onclick="PatientsPage.showUploadFile('${p.id}')"><i class="fas fa-upload"></i> Upload Document</button>
          </div>
          <div id="patient-files-content" class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
      `, 'modal-xl');
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  switchTab(tabId, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');
  },

  async loadPatientHistory(patientId) {
    const el = document.getElementById('patient-history-content');
    if (!el) return;
    try {
      const records = await API.medicalRecords.list({ patient_id: patientId });
      const items = records.data || records || [];
      if (!items.length) {
        el.innerHTML = '<div class="empty-state" style="padding: 24px;"><p>No medical records or consultations recorded yet.</p></div>';
        return;
      }
      el.innerHTML = `
        <div class="timeline">
          ${items.map(r => `
            <div class="timeline-item">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div class="timeline-header">
                  <strong>${r.diagnosis || 'Clinical Consultation'}</strong>
                  <span class="timeline-date">${formatDate(r.created_at)}</span>
                </div>
                <p style="font-size: 13px; color: var(--gray-700); margin: 6px 0;"><strong>Symptoms:</strong> ${r.symptoms || '-'}</p>
                <p style="font-size: 13px; color: var(--gray-600); margin: 0;"><strong>Treatment Plan:</strong> ${r.treatment_plan || '-'}</p>
                ${r.notes ? `<p style="font-size: 12px; color: var(--gray-500); margin-top: 6px; font-style: italic;">Note: ${r.notes}</p>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      el.innerHTML = `<div class="p-3 text-danger">${err.message}</div>`;
    }
  },

  async loadPatientVitals(patientId) {
    const el = document.getElementById('patient-vitals-content');
    if (!el) return;
    try {
      const vitals = await API.vitalSigns.list({ patient_id: patientId, limit: 5 });
      const items = vitals.data || vitals || [];
      if (!items.length) {
        el.innerHTML = '<div class="empty-state" style="padding: 24px;"><p>No vital signs recorded yet.</p></div>';
        return;
      }
      el.innerHTML = `
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>BP</th>
                <th>Heart Rate</th>
                <th>Temp</th>
                <th>SpO2</th>
                <th>BMI</th>
                <th>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(v => `
                <tr>
                  <td>${formatDateTime(v.recorded_at || v.created_at)}</td>
                  <td><strong>${v.blood_pressure_systolic && v.blood_pressure_diastolic ? `${v.blood_pressure_systolic}/${v.blood_pressure_diastolic}` : '-'}</strong> <span style="font-size:11px;color:var(--gray-400);">mmHg</span></td>
                  <td>${v.pulse_rate ? `${v.pulse_rate} bpm` : '-'}</td>
                  <td>${v.temperature ? `${v.temperature}°C` : '-'}</td>
                  <td>${v.oxygen_saturation ? `${v.oxygen_saturation}%` : '-'}</td>
                  <td>${v.bmi ? v.bmi : '-'}</td>
                  <td>${v.recorded_by_name || 'Staff'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      el.innerHTML = `<div class="p-3 text-danger">${err.message}</div>`;
    }
  },

  async loadPatientFiles(patientId) {
    const el = document.getElementById('patient-files-content');
    if (!el) return;
    try {
      const files = await API.files.getByPatient(patientId);
      const items = files.data || files || [];
      if (!items.length) {
        el.innerHTML = '<div class="empty-state" style="padding: 24px;"><p>No medical files or scans attached to this profile.</p></div>';
        return;
      }
      el.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px;">
          ${items.map(f => `
            <div class="card" style="border: 1px solid var(--gray-200); padding: 14px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <i class="fas fa-file-pdf" style="font-size: 24px; color: var(--danger);"></i>
                <div style="overflow: hidden;">
                  <div style="font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${f.file_name}</div>
                  <div style="font-size: 11px; color: var(--gray-400);">${formatDate(f.created_at)}</div>
                </div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; border-top: 1px solid var(--gray-100); padding-top: 8px;">
                <span style="font-size: 11px; color: var(--gray-500);">${f.category || 'Document'}</span>
                <a href="${f.file_url}" target="_blank" class="btn btn-sm btn-outline"><i class="fas fa-download"></i> View</a>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      el.innerHTML = `<div class="p-3 text-danger">${err.message}</div>`;
    }
  },

  showUploadFile(patientId) {
    openModal('Upload Medical Document', `
      <form id="upload-file-form">
        <div class="form-group">
          <label class="form-label">Document Category <span class="required">*</span></label>
          <select id="uf-category" class="form-control" required>
            <option value="lab_report">Laboratory Report</option>
            <option value="radiology">Radiology / X-Ray / MRI</option>
            <option value="prescription">Prescription Copy</option>
            <option value="insurance">Insurance Document</option>
            <option value="other">Other Medical Record</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Select File <span class="required">*</span></label>
          <input type="file" id="uf-file" class="form-control" required accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">
          <div class="form-hint">Supported formats: PDF, JPEG, PNG, DOC (Max 15MB)</div>
        </div>
        <div class="form-group">
          <label class="form-label">Notes / Description</label>
          <textarea id="uf-notes" class="form-control" rows="2" placeholder="Brief description of the document..."></textarea>
        </div>
        <div class="card-footer" style="padding: 12px 0 0; background: transparent;">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-submit-upload">Upload File</button>
        </div>
      </form>
    `);

    document.getElementById('upload-file-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('uf-file');
      if (!fileInput.files.length) return;

      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('patient_id', patientId);
      formData.append('category', document.getElementById('uf-category').value);
      formData.append('notes', document.getElementById('uf-notes').value.trim());

      setLoading('#btn-submit-upload', true);
      try {
        await API.files.upload(formData);
        showToast('success', 'File Uploaded', 'Document safely stored in Supabase.');
        closeModal();
        PatientsPage.loadPatientFiles(patientId);
      } catch (err) {
        showToast('error', 'Upload Error', err.message);
      } finally {
        setLoading('#btn-submit-upload', false);
      }
    });
  }
};

window.PatientsPage = PatientsPage;
