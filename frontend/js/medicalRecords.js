/* ============================================================
   MEDICALRECORDS.JS - Clinical Consultation Notes & Diagnoses
   ============================================================ */

const MedicalRecordsPage = {
  currentPage: 1,
  limit: 10,
  searchQuery: '',

  async load() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>Medical Records & Consultations</h2>
          <p>Clinical notes, diagnoses, symptoms, and physician treatment plans</p>
        </div>
        <div class="page-header-actions">
          ${Auth.hasRole('doctor', 'admin') ? `
            <button class="btn btn-primary" onclick="MedicalRecordsPage.showCreate()">
              <i class="fas fa-file-medical"></i> New Clinical Note
            </button>
          ` : ''}
        </div>
      </div>

      <div class="search-filter-bar">
        <div class="search-input-wrapper">
          <i class="fas fa-search"></i>
          <input type="text" id="mr-search" placeholder="Search diagnosis or symptoms..." oninput="MedicalRecordsPage.onSearch(this.value)">
        </div>
        <button class="btn btn-secondary" onclick="MedicalRecordsPage.loadList()"><i class="fas fa-sync-alt"></i></button>
      </div>

      <div class="card">
        <div class="card-body" style="padding: 0;" id="mr-table-container">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
        <div id="mr-pagination"></div>
      </div>
    `;

    await this.loadList();
  },

  onSearch: debounce(function(val) {
    MedicalRecordsPage.searchQuery = val.trim();
    MedicalRecordsPage.currentPage = 1;
    MedicalRecordsPage.loadList();
  }, 350),

  async loadList() {
    const container = document.getElementById('mr-table-container');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
      const res = await API.medicalRecords.list({
        page: this.currentPage,
        limit: this.limit,
        search: this.searchQuery
      });

      const records = res.data || res.records || [];
      const pagination = res.pagination;

      if (!records.length) {
        showEmptyState(
          'mr-table-container',
          'fas fa-notes-medical',
          'No Medical Records',
          'No consultation notes matching query.',
          Auth.hasRole('doctor', 'admin') ? `<button class="btn btn-primary" onclick="MedicalRecordsPage.showCreate()"><i class="fas fa-file-medical"></i> New Clinical Note</button>` : ''
        );
        document.getElementById('mr-pagination').innerHTML = '';
        return;
      }

      container.innerHTML = `
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Diagnosis</th>
                <th>Symptoms</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(r => {
                const pName = r.patients ? `${r.patients.first_name} ${r.patients.last_name}` : 'Unknown';
                const dName = r.doctors?.profiles ? r.doctors.profiles.full_name : 'Physician';
                return `
                  <tr>
                    <td>${formatDate(r.created_at)}</td>
                    <td><strong>${pName}</strong> <span style="font-size:11px;color:var(--gray-400);">(${r.patients?.patient_number || ''})</span></td>
                    <td>Dr. ${dName}</td>
                    <td><strong style="color:var(--primary);">${r.diagnosis || 'Clinical Note'}</strong></td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.symptoms || '-'}</td>
                    <td style="text-align: right;">
                      <button class="btn btn-sm btn-secondary" onclick="MedicalRecordsPage.viewDetails('${r.id}')">
                        <i class="fas fa-eye"></i> View Note
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      renderPagination('mr-pagination', pagination, 'MedicalRecordsPage.goToPage');
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
      const [patientsRes, doctorsRes] = await Promise.all([
        API.patients.list({ limit: 100 }),
        API.doctors.list({ limit: 100 })
      ]);

      const patients = patientsRes.data || patientsRes.patients || [];
      const doctors = doctorsRes.data || doctorsRes.doctors || [];

      openModal('New Clinical Consultation Note', `
        <form id="create-mr-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Patient <span class="required">*</span></label>
              <select id="cmr-patient" class="form-control" required>
                <option value="">Select patient...</option>
                ${patients.map(p => `<option value="${p.id}" ${preselectedPatientId === p.id ? 'selected' : ''}>${p.first_name} ${p.last_name} (${p.patient_number || p.phone})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Doctor <span class="required">*</span></label>
              <select id="cmr-doctor" class="form-control" required>
                <option value="">Select doctor...</option>
                ${doctors.map(d => `<option value="${d.id}">Dr. ${d.profiles?.full_name || d.full_name} (${d.specialization})</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Chief Complaint / Symptoms <span class="required">*</span></label>
            <textarea id="cmr-symptoms" class="form-control" required rows="2" placeholder="Patient reported symptoms, onset, severity..."></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Physical Examination Findings</label>
            <textarea id="cmr-exam" class="form-control" rows="2" placeholder="Clinical observations, cardiovascular, respiratory, ENT findings..."></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Primary Diagnosis <span class="required">*</span></label>
            <input type="text" id="cmr-diagnosis" class="form-control" required placeholder="e.g. Acute Pharyngitis, Hypertension Stage 1">
          </div>

          <div class="form-group">
            <label class="form-label">Treatment Plan & Recommendations <span class="required">*</span></label>
            <textarea id="cmr-plan" class="form-control" required rows="2" placeholder="Prescribed medication regimen, rest, diet, lifestyle recommendations..."></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Follow-up Instructions / Confidential Notes</label>
            <input type="text" id="cmr-notes" class="form-control" placeholder="e.g. Return in 7 days if fever persists">
          </div>

          <div class="card-footer" style="padding: 12px 0 0; background: transparent;">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-save-mr">Save Clinical Note</button>
          </div>
        </form>
      `, 'modal-lg');

      document.getElementById('create-mr-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading('#btn-save-mr', true);

        const payload = {
          patient_id: document.getElementById('cmr-patient').value,
          doctor_id: document.getElementById('cmr-doctor').value,
          appointment_id: preselectedAppointmentId || null,
          symptoms: document.getElementById('cmr-symptoms').value.trim(),
          physical_examination: document.getElementById('cmr-exam').value.trim() || null,
          diagnosis: document.getElementById('cmr-diagnosis').value.trim(),
          treatment_plan: document.getElementById('cmr-plan').value.trim(),
          notes: document.getElementById('cmr-notes').value.trim() || null
        };

        try {
          await API.medicalRecords.create(payload);
          showToast('success', 'Saved', 'Clinical medical record created.');
          closeModal();
          MedicalRecordsPage.loadList();
        } catch (err) {
          showToast('error', 'Error', err.message);
        } finally {
          setLoading('#btn-save-mr', false);
        }
      });
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  async viewDetails(id) {
    try {
      const r = await API.medicalRecords.get(id);
      const pName = r.patients ? `${r.patients.first_name} ${r.patients.last_name}` : 'Patient';
      const dName = r.doctors?.profiles ? r.doctors.profiles.full_name : 'Physician';

      openModal(`Consultation Note: ${r.diagnosis || 'Medical Record'}`, `
        <div style="background: var(--gray-50); border: 1px solid var(--gray-100); border-radius: var(--radius); padding: 18px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="font-size: 18px; color: var(--primary); margin: 0;">${r.diagnosis || 'Clinical Consultation'}</h3>
            <span style="font-size: 13px; color: var(--gray-500);">${formatDate(r.created_at)}</span>
          </div>
          <div class="detail-grid">
            <div class="detail-item"><label>Patient</label><p><strong>${pName}</strong> (${r.patients?.patient_number || '-'})</p></div>
            <div class="detail-item"><label>Attending Physician</label><p>Dr. <strong>${dName}</strong> (${r.doctors?.specialization || 'General'})</p></div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="card" style="border: 1px solid var(--gray-100); padding: 16px;">
            <h4 style="font-size: 13px; text-transform: uppercase; color: var(--gray-500); margin-bottom: 8px;">Reported Symptoms</h4>
            <p style="font-size: 14px; color: var(--gray-800); margin: 0; line-height: 1.5;">${r.symptoms || '-'}</p>
          </div>

          ${r.physical_examination ? `
            <div class="card" style="border: 1px solid var(--gray-100); padding: 16px;">
              <h4 style="font-size: 13px; text-transform: uppercase; color: var(--gray-500); margin-bottom: 8px;">Physical Examination</h4>
              <p style="font-size: 14px; color: var(--gray-800); margin: 0; line-height: 1.5;">${r.physical_examination}</p>
            </div>
          ` : ''}

          <div class="card" style="border: 1px solid var(--gray-100); padding: 16px;">
            <h4 style="font-size: 13px; text-transform: uppercase; color: var(--gray-500); margin-bottom: 8px;">Treatment Plan</h4>
            <p style="font-size: 14px; color: var(--gray-800); margin: 0; line-height: 1.5;">${r.treatment_plan || '-'}</p>
          </div>

          ${r.notes ? `
            <div class="card" style="border: 1px solid var(--gray-100); padding: 16px;">
              <h4 style="font-size: 13px; text-transform: uppercase; color: var(--gray-500); margin-bottom: 8px;">Doctor Notes & Follow-Up</h4>
              <p style="font-size: 13px; color: var(--gray-600); margin: 0;">${r.notes}</p>
            </div>
          ` : ''}
        </div>

        <div class="card-footer" style="padding: 16px 0 0; background: transparent; display: flex; justify-content: space-between;">
          <button class="btn btn-secondary" onclick="closeModal()">Close</button>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-outline" onclick="closeModal(); PrescriptionsPage.showCreate('${r.patient_id}', '${r.doctor_id}')">
              <i class="fas fa-prescription"></i> Write Prescription
            </button>
            <button class="btn btn-primary" onclick="closeModal(); LabTestsPage.showCreate('${r.patient_id}', '${r.doctor_id}')">
              <i class="fas fa-flask"></i> Request Lab Test
            </button>
          </div>
        </div>
      `, 'modal-lg');
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  }
};

window.MedicalRecordsPage = MedicalRecordsPage;
