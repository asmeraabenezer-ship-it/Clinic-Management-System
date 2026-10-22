/* ============================================================
   LABTESTS.JS - Laboratory Requests, Sample Collection & Diagnostics Results
   ============================================================ */

const LabTestsPage = {
  currentPage: 1,
  limit: 10,
  filterStatus: '',

  async load() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>Laboratory Tests & Diagnostics</h2>
          <p>Order tests, record sample collection, log findings, and review clinical reports</p>
        </div>
        <div class="page-header-actions">
          ${Auth.hasRole('doctor', 'admin', 'laboratorist') ? `
            <button class="btn btn-primary" onclick="LabTestsPage.showCreate()">
              <i class="fas fa-flask"></i> Request Lab Test
            </button>
          ` : ''}
        </div>
      </div>

      <div class="search-filter-bar">
        <select class="filter-select" id="lab-filter-status" onchange="LabTestsPage.onStatusFilter(this.value)">
          <option value="">All Statuses</option>
          <option value="requested">Requested</option>
          <option value="sample_collected">Sample Collected</option>
          <option value="processing">In Processing</option>
          <option value="completed">Completed (Results Available)</option>
        </select>
        <button class="btn btn-secondary" onclick="LabTestsPage.loadList()"><i class="fas fa-sync-alt"></i></button>
      </div>

      <div class="card">
        <div class="card-body" style="padding: 0;" id="lab-table-container">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
        <div id="lab-pagination"></div>
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
    const container = document.getElementById('lab-table-container');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
      const res = await API.labTests.list({
        page: this.currentPage,
        limit: this.limit,
        status: this.filterStatus
      });

      const tests = res.data || res.lab_tests || [];
      const pagination = res.pagination;

      if (!tests.length) {
        showEmptyState(
          'lab-table-container',
          'fas fa-vial',
          'No Lab Tests Found',
          'Laboratory diagnostic requests will be listed here.',
          Auth.hasRole('doctor', 'admin', 'laboratorist') ? `<button class="btn btn-primary" onclick="LabTestsPage.showCreate()"><i class="fas fa-flask"></i> Request Lab Test</button>` : ''
        );
        document.getElementById('lab-pagination').innerHTML = '';
        return;
      }

      container.innerHTML = `
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Patient</th>
                <th>Test Name</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${tests.map(t => {
                const patientName = t.patients ? `${t.patients.first_name} ${t.patients.last_name}` : 'Patient';
                const priorityBadge = t.priority === 'stat' ? 'badge-cancelled' : t.priority === 'urgent' ? 'badge-pending' : 'badge-scheduled';

                return `
                  <tr>
                    <td>${formatDate(t.created_at)}</td>
                    <td><strong>${patientName}</strong> <span style="font-size:11px;color:var(--gray-400);">(${t.patients?.patient_number || ''})</span></td>
                    <td><strong>${t.test_name}</strong> ${t.test_code ? `<span style="font-size:11px;color:var(--gray-400);">(${t.test_code})</span>` : ''}</td>
                    <td><span class="role-badge role-nurse" style="font-size: 11px;">${t.category || 'General'}</span></td>
                    <td><span class="status-badge ${priorityBadge}" style="text-transform: uppercase; font-size: 11px;">${t.priority || 'routine'}</span></td>
                    <td>${getStatusBadge(t.status)}</td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 4px;">
                        <button class="btn btn-sm btn-secondary" title="View Lab Report" onclick="LabTestsPage.viewDetails('${t.id}')">
                          <i class="fas fa-eye"></i>
                        </button>
                        ${t.status === 'requested' && Auth.hasRole('nurse', 'doctor', 'admin', 'laboratorist') ? `
                          <button class="btn btn-sm btn-outline" title="Collect Sample" onclick="LabTestsPage.collectSample('${t.id}')">
                            <i class="fas fa-vial"></i> Collect
                          </button>
                        ` : ''}
                        ${['sample_collected', 'processing'].includes(t.status) && Auth.hasRole('doctor', 'admin', 'nurse', 'laboratorist') ? `
                          <button class="btn btn-sm btn-primary" title="Enter Findings" onclick="LabTestsPage.showEnterResults('${t.id}')">
                            <i class="fas fa-microscope"></i> Results
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

      renderPagination('lab-pagination', pagination, 'LabTestsPage.goToPage');
    } catch (err) {
      container.innerHTML = `<div class="p-4 text-center text-danger">${err.message}</div>`;
    }
  },

  goToPage(p) {
    this.currentPage = p;
    this.loadList();
  },

  async showCreate(preselectedPatientId = null, preselectedDoctorId = null) {
    try {
      const [patientsRes, doctorsRes] = await Promise.all([
        API.patients.list({ limit: 100 }),
        API.doctors.list({ limit: 100 })
      ]);

      const patients = patientsRes.data || patientsRes.patients || [];
      const doctors = doctorsRes.data || doctorsRes.doctors || [];

      openModal('Order Diagnostic Laboratory Test', `
        <form id="create-lab-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Patient <span class="required">*</span></label>
              <select id="clt-patient" class="form-control" required>
                <option value="">Select patient...</option>
                ${patients.map(p => `<option value="${p.id}" ${preselectedPatientId === p.id ? 'selected' : ''}>${p.first_name} ${p.last_name} (${p.patient_number || p.phone})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Ordering Physician <span class="required">*</span></label>
              <select id="clt-doctor" class="form-control" required>
                <option value="">Select doctor...</option>
                ${doctors.map(d => `<option value="${d.id}" ${preselectedDoctorId === d.id ? 'selected' : ''}>Dr. ${d.profiles?.full_name || d.full_name}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Test Name <span class="required">*</span></label>
              <input type="text" id="clt-name" class="form-control" required placeholder="e.g. Complete Blood Count (CBC), Lipid Panel">
            </div>
            <div class="form-group">
              <label class="form-label">Test Code</label>
              <input type="text" id="clt-code" class="form-control" placeholder="e.g. CBC-01">
            </div>
          </div>

          <div class="form-row-3">
            <div class="form-group">
              <label class="form-label">Category <span class="required">*</span></label>
              <select id="clt-category" class="form-control" required>
                <option value="Hematology">Hematology</option>
                <option value="Biochemistry">Biochemistry</option>
                <option value="Microbiology">Microbiology</option>
                <option value="Serology / Immunology">Serology / Immunology</option>
                <option value="Urinalysis">Urinalysis</option>
                <option value="Pathology">Pathology</option>
                <option value="Radiology">Radiology / Imaging</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Priority <span class="required">*</span></label>
              <select id="clt-priority" class="form-control" required>
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">STAT (Immediate Emergency)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Estimated Cost ($)</label>
              <input type="number" id="clt-cost" class="form-control" min="0" step="0.01" value="45.00">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Clinical Indication / Reason for Request</label>
            <textarea id="clt-notes" class="form-control" rows="2" placeholder="Clinical justification, suspected pathology..."></textarea>
          </div>

          <div class="card-footer" style="padding: 12px 0 0; background: transparent;">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-save-lab">Submit Lab Request</button>
          </div>
        </form>
      `, 'modal-lg');

      document.getElementById('create-lab-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading('#btn-save-lab', true);

        const payload = {
          patient_id: document.getElementById('clt-patient').value,
          doctor_id: document.getElementById('clt-doctor').value,
          test_name: document.getElementById('clt-name').value.trim(),
          test_code: document.getElementById('clt-code').value.trim() || null,
          category: document.getElementById('clt-category').value,
          priority: document.getElementById('clt-priority').value,
          cost: parseFloat(document.getElementById('clt-cost').value) || 0,
          notes: document.getElementById('clt-notes').value.trim() || null
        };

        try {
          await API.labTests.create(payload);
          showToast('success', 'Lab Requested', `${payload.test_name} order placed.`);
          closeModal();
          LabTestsPage.loadList();
        } catch (err) {
          showToast('error', 'Error', err.message);
        } finally {
          setLoading('#btn-save-lab', false);
        }
      });
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  async collectSample(id) {
    try {
      await API.labTests.collect(id);
      showToast('success', 'Sample Collected', 'Status updated to Sample Collected.');
      LabTestsPage.loadList();
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  showEnterResults(id) {
    openModal('Enter Diagnostic Laboratory Results', `
      <form id="enter-lab-results-form">
        <div class="form-group">
          <label class="form-label">Diagnostic Findings & Observations <span class="required">*</span></label>
          <textarea id="elr-result" class="form-control" required rows="4" placeholder="Detailed numerical or qualitative laboratory test results..."></textarea>
        </div>

        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Normal Reference Range</label>
            <input type="text" id="elr-range" class="form-control" placeholder="e.g. 4.5 - 11.0">
          </div>
          <div class="form-group">
            <label class="form-label">Measurement Unit</label>
            <input type="text" id="elr-unit" class="form-control" placeholder="e.g. x10^3/uL, mg/dL">
          </div>
          <div class="form-group">
            <label class="form-label">Abnormality Flag</label>
            <select id="elr-abnormal" class="form-control">
              <option value="false">Normal (Within Range)</option>
              <option value="true">Abnormal / Critical Value</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Pathologist / Lab Technologist Interpretation</label>
          <textarea id="elr-remarks" class="form-control" rows="2" placeholder="Clinical remarks, suggested further workup..."></textarea>
        </div>

        <div class="card-footer" style="padding: 12px 0 0; background: transparent;">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-success" id="btn-save-results">Submit Final Results</button>
        </div>
      </form>
    `, 'modal-lg');

    document.getElementById('enter-lab-results-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      setLoading('#btn-save-results', true);

      const payload = {
        results: document.getElementById('elr-result').value.trim(),
        reference_range: document.getElementById('elr-range').value.trim() || null,
        unit: document.getElementById('elr-unit').value.trim() || null,
        is_abnormal: document.getElementById('elr-abnormal').value === 'true',
        remarks: document.getElementById('elr-remarks').value.trim() || null
      };

      try {
        await API.labTests.submitResults(id, payload);
        showToast('success', 'Results Logged', 'Lab results finalized.');
        closeModal();
        LabTestsPage.loadList();
      } catch (err) {
        showToast('error', 'Error', err.message);
      } finally {
        setLoading('#btn-save-results', false);
      }
    });
  },

  async viewDetails(id) {
    try {
      const t = await API.labTests.get(id);
      const patientName = t.patients ? `${t.patients.first_name} ${t.patients.last_name}` : 'Patient';
      const docName = t.doctors?.profiles ? t.doctors.profiles.full_name : 'Physician';

      const steps = ['requested', 'sample_collected', 'processing', 'completed'];
      const currentIdx = steps.indexOf(t.status);

      openModal(`Laboratory Diagnostic Report: ${t.test_name}`, `
        <!-- Timeline Steps -->
        <div class="lab-status-timeline">
          ${steps.map((st, idx) => {
            const isDone = idx <= currentIdx;
            const isCurrent = idx === currentIdx;
            const label = st.replace('_', ' ').toUpperCase();
            return `
              <div class="lab-step ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}">
                <div class="lab-step-dot"><i class="fas ${isDone ? 'fa-check' : 'fa-circle'}"></i></div>
                <div class="lab-step-label">${label}</div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="background: var(--gray-50); border: 1px solid var(--gray-100); border-radius: var(--radius); padding: 16px; margin: 16px 0;">
          <div class="detail-grid">
            <div class="detail-item"><label>Patient</label><p><strong>${patientName}</strong> (${t.patients?.patient_number || '-'})</p></div>
            <div class="detail-item"><label>Ordering Doctor</label><p>Dr. <strong>${docName}</strong></p></div>
            <div class="detail-item"><label>Test Category</label><p>${t.category || 'General'}</p></div>
            <div class="detail-item"><label>Order Date</label><p>${formatDateTime(t.created_at)}</p></div>
          </div>
        </div>

        <!-- Findings Section -->
        <div class="card" style="border: 1px solid var(--gray-200); padding: 18px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="font-size: 14px; font-weight: 700; margin: 0; color: var(--gray-900);">Diagnostic Findings</h4>
            ${t.is_abnormal ? `<span class="status-badge badge-cancelled" style="font-weight: 700;"><i class="fas fa-exclamation-triangle"></i> ABNORMAL FINDING</span>` : t.status === 'completed' ? `<span class="status-badge badge-completed"><i class="fas fa-check"></i> Within Normal Limits</span>` : ''}
          </div>

          ${t.results ? `
            <div style="font-family: monospace; background: white; border: 1px solid var(--gray-100); padding: 12px; border-radius: var(--radius-sm); font-size: 14px; line-height: 1.5; white-space: pre-wrap; margin-bottom: 14px;">${t.results}</div>
            <div class="detail-grid" style="font-size: 13px;">
              <div class="detail-item"><label>Reference Range</label><p>${t.reference_range || 'Not specified'}</p></div>
              <div class="detail-item"><label>Units</label><p>${t.unit || '-'}</p></div>
            </div>
            ${t.remarks ? `<div style="margin-top: 10px; font-size: 13px; color: var(--gray-700);"><strong>Technologist Remarks:</strong> ${t.remarks}</div>` : ''}
          ` : `
            <div style="text-align: center; padding: 24px; color: var(--gray-400);">
              <i class="fas fa-hourglass-half" style="font-size: 28px; margin-bottom: 8px;"></i>
              <p style="margin: 0; font-size: 13px;">Findings have not been entered yet for this sample.</p>
            </div>
          `}
        </div>

        <div class="card-footer" style="padding: 12px 0 0; background: transparent; display: flex; justify-content: space-between;">
          <button class="btn btn-secondary" onclick="closeModal()">Close</button>
          ${['sample_collected', 'processing'].includes(t.status) && Auth.hasRole('doctor', 'admin', 'nurse', 'laboratorist') ? `
            <button class="btn btn-primary" onclick="closeModal(); LabTestsPage.showEnterResults('${t.id}')">
              <i class="fas fa-microscope"></i> Enter Results
            </button>
          ` : ''}
        </div>
      `, 'modal-lg');
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  }
};

window.LabTestsPage = LabTestsPage;
