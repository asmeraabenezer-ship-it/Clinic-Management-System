/* ============================================================
   VISITS.JS - Real-World End-to-End Clinic Workflow System
   Stages:
   1. Reception (Search/Register Card -> Reason for Visit -> Queue to Doctor)
   2. Doctor First Consultation (Symptoms & Exam -> Lab Request OR Direct Finish)
   3. Laboratory (Receive Request -> Run Tests -> Submit Results to Doctor)
   4. Doctor Final Consultation (Review Lab -> Final Diagnosis -> Prescribe OR Cashier)
   5. Pharmacy (Open Prescription -> Dispense Medicines -> Calculate Cost -> Send to Cashier)
   6. Payment / Cashier (Itemized Bill: Consult + Lab + Pharmacy -> Process Payment -> Print Receipt)
   7. Patient Exit (Visit Completed -> Archive Timeline -> Patient Exits Queue)
   ============================================================ */

function getVisitStatusBadge(status) {
  const map = {
    waiting_doctor_initial: { label: '1. Waiting for Doctor', cls: 'badge-pending', icon: 'fa-user-clock' },
    in_consultation_initial: { label: '2. In Initial Exam', cls: 'badge-in-progress', icon: 'fa-stethoscope' },
    waiting_laboratory: { label: '3. Sent to Laboratory', cls: 'badge-scheduled', icon: 'fa-flask', style: 'background:#ede9fe;color:#5b21b6;' },
    waiting_doctor_final: { label: '4. Lab Done / Waiting Doctor', cls: 'badge-completed', icon: 'fa-vial-circle-check', style: 'background:#fef3c7;color:#92400e;' },
    in_consultation_final: { label: '4. In Final Consult', cls: 'badge-in-progress', icon: 'fa-notes-medical' },
    waiting_pharmacy: { label: '5. Sent to Pharmacy', cls: 'badge-pending', icon: 'fa-pills', style: 'background:#fff7ed;color:#c2410c;' },
    waiting_payment: { label: '6. Waiting for Payment', cls: 'badge-cancelled', icon: 'fa-file-invoice-dollar', style: 'background:#fce7f3;color:#9d174d;' },
    completed: { label: '7. Completed & Exited', cls: 'badge-completed', icon: 'fa-check-circle', style: 'background:#d1fae5;color:#065f46;' },
    cancelled: { label: 'Cancelled', cls: 'badge-cancelled', icon: 'fa-times-circle' }
  };
  const item = map[status] || { label: status, cls: 'badge-scheduled', icon: 'fa-circle' };
  return `<span class="status-badge ${item.cls}" style="font-size:12px; ${item.style || ''}"><i class="fas ${item.icon}" style="margin-right:5px;"></i>${item.label}</span>`;
}

const VisitsWorkflow = {
  // ------------------------------------------------------------
  // STAGE 1: RECEPTION CHECK-IN
  // ------------------------------------------------------------
  async showCheckInModal() {
    try {
      const [patientsRes, doctorsRes] = await Promise.all([
        API.patients.list({ limit: 100 }),
        API.doctors.list({ limit: 50 })
      ]);

      const patients = patientsRes.data || patientsRes || [];
      const doctors = doctorsRes.data || doctorsRes || [];

      openModal('Patient Check-In & Doctor Queue Assignment', `
        <form id="visit-checkin-form">
          <div style="background: var(--primary-light, #eff6ff); border: 1px solid #bfdbfe; border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 16px;">
            <p style="margin: 0; font-size: 13px; color: #1e40af;">
              <i class="fas fa-info-circle"></i> <strong>Reception Step:</strong> Search patient by name or card number. If new, enter their details to automatically assign a new card.
            </p>
          </div>

          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <label class="form-label" style="margin:0;">Select Existing Patient <span class="required">*</span></label>
              <button type="button" class="btn btn-sm btn-outline" id="toggle-new-patient-btn" onclick="VisitsWorkflow.toggleNewPatientForm()">
                <i class="fas fa-user-plus"></i> Or Register New Patient
              </button>
            </div>
            <select id="vci-patient-id" class="form-control" required style="width: 100%;">
              <option value="">Search patient by card number or name...</option>
              ${patients.map(p => `
                <option value="${p.id}">
                  [${p.patient_number || 'CARD'}] ${p.first_name} ${p.last_name} (${p.phone || 'No phone'}) - ${p.blood_group || p.blood_type || ''}
                </option>
              `).join('')}
            </select>
          </div>

          <!-- New Patient Quick Registration Panel (hidden by default) -->
          <div id="vci-new-patient-panel" style="display:none; background: #f8fafc; border: 1px dashed var(--gray-300); border-radius: var(--radius-md); padding: 14px; margin-bottom: 16px;">
            <h4 style="margin: 0 0 10px; font-size: 14px; color: var(--primary);"><i class="fas fa-id-card"></i> New Patient Registration</h4>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">First Name <span class="required">*</span></label>
                <input type="text" id="vci-new-fn" class="form-control" placeholder="First Name">
              </div>
              <div class="form-group">
                <label class="form-label">Last Name <span class="required">*</span></label>
                <input type="text" id="vci-new-ln" class="form-control" placeholder="Last Name">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Phone Number <span class="required">*</span></label>
                <input type="text" id="vci-new-phone" class="form-control" placeholder="+1-555-0000">
              </div>
              <div class="form-group">
                <label class="form-label">Gender</label>
                <select id="vci-new-gender" class="form-control">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Blood Group</label>
                <select id="vci-new-blood" class="form-control">
                  <option value="O+">O+</option>
                  <option value="A+">A+</option>
                  <option value="B+">B+</option>
                  <option value="AB+">AB+</option>
                  <option value="O-">O-</option>
                  <option value="A-">A-</option>
                  <option value="B-">B-</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Reason for Visit / Chief Complaint <span class="required">*</span></label>
            <textarea id="vci-reason" class="form-control" required rows="2" placeholder="e.g. Severe headache, persistent cough for 4 days, routine checkup..."></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Assign to Doctor <span class="required">*</span></label>
            <select id="vci-doctor-id" class="form-control" required>
              <option value="">Select attending physician...</option>
              ${doctors.map(d => `
                <option value="${d.id}">
                  ${d.profiles?.full_name || d.full_name || 'Dr. Doctor'} (${d.specialization}) - Consultation: $${d.consultation_fee || 75}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="card-footer" style="padding: 12px 0 0; background: transparent; display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="vci-submit-btn">
              <i class="fas fa-paper-plane"></i> Queue to Doctor
            </button>
          </div>
        </form>
      `, 'modal-md');

      // Submit listener
      document.getElementById('visit-checkin-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('vci-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        try {
          const isNew = document.getElementById('vci-new-patient-panel').style.display !== 'none';
          let payload = {
            doctor_id: document.getElementById('vci-doctor-id').value,
            reason_for_visit: document.getElementById('vci-reason').value
          };

          if (isNew) {
            payload.new_patient = {
              first_name: document.getElementById('vci-new-fn').value,
              last_name: document.getElementById('vci-new-ln').value,
              phone: document.getElementById('vci-new-phone').value,
              gender: document.getElementById('vci-new-gender').value,
              blood_group: document.getElementById('vci-new-blood').value
            };
          } else {
            payload.patient_id = document.getElementById('vci-patient-id').value;
          }

          const res = await API.visits.checkIn(payload);
          showToast('success', 'Patient Queued', `Visit ${res.visit_number} queued for doctor.`);
          closeModal();

          if (typeof DashboardPage !== 'undefined' && currentPage === 'dashboard') {
            DashboardPage.load();
          } else if (typeof VisitsPage !== 'undefined') {
            VisitsPage.load();
          }
        } catch (err) {
          showToast('error', 'Check-In Error', err.message);
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Queue to Doctor';
        }
      });
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  toggleNewPatientForm() {
    const panel = document.getElementById('vci-new-patient-panel');
    const patSelect = document.getElementById('vci-patient-id');
    const toggleBtn = document.getElementById('toggle-new-patient-btn');

    if (panel.style.display === 'none') {
      panel.style.display = 'block';
      patSelect.required = false;
      patSelect.disabled = true;
      document.getElementById('vci-new-fn').required = true;
      document.getElementById('vci-new-ln').required = true;
      toggleBtn.innerHTML = '<i class="fas fa-list"></i> Select Existing Patient';
    } else {
      panel.style.display = 'none';
      patSelect.required = true;
      patSelect.disabled = false;
      document.getElementById('vci-new-fn').required = false;
      document.getElementById('vci-new-ln').required = false;
      toggleBtn.innerHTML = '<i class="fas fa-user-plus"></i> Or Register New Patient';
    }
  },

  // ------------------------------------------------------------
  // STAGE 2: DOCTOR FIRST CONSULTATION
  // ------------------------------------------------------------
  async showFirstConsultModal(visitId) {
    try {
      const visit = await API.visits.get(visitId);
      const p = visit.patients || {};

      openModal(`First Consultation: ${p.first_name} ${p.last_name} (${p.patient_number || ''})`, `
        <div style="background:#f8fafc; border:1px solid var(--gray-200); border-radius:var(--radius-md); padding:12px; margin-bottom:16px;">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px; font-size:12px;">
            <div><span style="color:var(--gray-500);">Card / ID:</span> <strong>${p.patient_number || '-'}</strong></div>
            <div><span style="color:var(--gray-500);">Gender / Age:</span> <strong>${p.gender || '-'} (${typeof formatAge !== 'undefined' ? formatAge(p.date_of_birth) : '-'})</strong></div>
            <div><span style="color:var(--gray-500);">Blood Group:</span> <strong>${p.blood_group || p.blood_type || '-'}</strong></div>
            <div><span style="color:var(--gray-500);">Allergies:</span> <strong style="color:var(--danger);">${p.allergies || 'None recorded'}</strong></div>
          </div>
          <div style="margin-top:8px; padding-top:8px; border-top:1px solid var(--gray-200); font-size:13px;">
            <span style="color:var(--gray-500);">Reason for Visit:</span> <strong>${visit.reason_for_visit}</strong>
          </div>
        </div>

        <form id="first-consult-form">
          <div class="form-group">
            <label class="form-label">Reported Symptoms <span class="required">*</span></label>
            <textarea id="fc-symptoms" class="form-control" required rows="2" placeholder="e.g. Patient reports throbbing headache localized to forehead for 3 days...">${visit.symptoms || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Physical Examination Findings <span class="required">*</span></label>
            <textarea id="fc-exam" class="form-control" required rows="2" placeholder="e.g. BP 130/85, HR 78. HEENT normal. Chest clear to auscultation. Abdomen soft...">${visit.examination_findings || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Initial Assessment & Differential Diagnosis</label>
            <input type="text" id="fc-assessment" class="form-control" placeholder="e.g. Suspected tension headache vs early migraine" value="${visit.initial_assessment || ''}">
          </div>

          <!-- Laboratory Decision Panel -->
          <div style="border: 2px solid #e0e7ff; background: #faf5ff; border-radius: var(--radius-md); padding: 14px; margin-bottom: 16px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <label style="display:flex; align-items:center; gap:8px; font-weight:600; color:#4338ca; cursor:pointer; margin:0;">
                <input type="checkbox" id="fc-requires-lab" onchange="VisitsWorkflow.toggleLabOrderSection(this.checked)" style="width:18px;height:18px;">
                <span>🔬 Require Laboratory Diagnostic Testing for this Patient?</span>
              </label>
            </div>
            <p style="margin:4px 0 0 26px; font-size:12px; color:var(--gray-600);">
              Check this if patient needs blood, urine, or other lab investigations before final diagnosis.
            </p>

            <div id="fc-lab-panel" style="display:none; margin-top:12px; padding-top:12px; border-top:1px dashed #c7d2fe;">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Select Laboratory Test</label>
                  <select id="fc-lab-test-select" class="form-control">
                    <option value="Complete Blood Count (CBC)|Hematology|35.00">Complete Blood Count (CBC) - $35.00</option>
                    <option value="Lipid Profile & Serum Electrolytes|Biochemistry|45.00">Lipid Profile & Electrolytes - $45.00</option>
                    <option value="Fasting Blood Glucose & HbA1c|Biochemistry|30.00">Fasting Blood Glucose & HbA1c - $30.00</option>
                    <option value="Comprehensive Metabolic Panel|Biochemistry|55.00">Comprehensive Metabolic Panel - $55.00</option>
                    <option value="Urinalysis & Microscopy|Pathology|25.00">Urinalysis & Microscopy - $25.00</option>
                    <option value="Malaria Parasite & Rapid Diagnostic|Microbiology|20.00">Malaria Rapid Diagnostic - $20.00</option>
                    <option value="Liver Function Tests (LFT)|Biochemistry|40.00">Liver Function Tests (LFT) - $40.00</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Urgency</label>
                  <select id="fc-lab-urgency" class="form-control">
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent</option>
                    <option value="stat">STAT (Immediate)</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Clinical Indication / Lab Instructions</label>
                <input type="text" id="fc-lab-notes" class="form-control" placeholder="e.g. Check for infectious markers and electrolyte balance">
              </div>
            </div>
          </div>

          <div class="card-footer" style="padding: 12px 0 0; background: transparent; display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="fc-submit-btn">
              <i class="fas fa-check"></i> Save & Advance Workflow
            </button>
          </div>
        </form>
      `, 'modal-lg');

      document.getElementById('first-consult-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('fc-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
          const requiresLab = document.getElementById('fc-requires-lab').checked;
          const payload = {
            symptoms: document.getElementById('fc-symptoms').value,
            examination_findings: document.getElementById('fc-exam').value,
            initial_assessment: document.getElementById('fc-assessment').value,
            requires_lab: requiresLab
          };

          if (requiresLab) {
            const raw = document.getElementById('fc-lab-test-select').value.split('|');
            payload.lab_tests = [{
              test_name: raw[0],
              category: raw[1],
              price: parseFloat(raw[2]),
              urgency: document.getElementById('fc-lab-urgency').value,
              notes: document.getElementById('fc-lab-notes').value
            }];
          }

          const updated = await API.visits.firstConsultation(visitId, payload);
          showToast('success', 'First Consultation Saved', requiresLab ? 'Patient sent to Laboratory Queue.' : 'No lab needed. Patient ready for Final Consultation.');
          closeModal();

          if (typeof DashboardPage !== 'undefined' && currentPage === 'dashboard') {
            DashboardPage.load();
          } else if (typeof VisitsPage !== 'undefined') {
            VisitsPage.load();
          }
        } catch (err) {
          showToast('error', 'Consultation Error', err.message);
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-check"></i> Save & Advance Workflow';
        }
      });
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  toggleLabOrderSection(checked) {
    const panel = document.getElementById('fc-lab-panel');
    const submitBtn = document.getElementById('fc-submit-btn');
    if (checked) {
      panel.style.display = 'block';
      submitBtn.innerHTML = '<i class="fas fa-flask"></i> Order Tests & Send to Laboratory';
    } else {
      panel.style.display = 'none';
      submitBtn.innerHTML = '<i class="fas fa-arrow-right"></i> No Lab Needed -> Proceed to Final Consult';
    }
  },

  // ------------------------------------------------------------
  // STAGE 3: LABORATORY RESULTS ENTRY
  // ------------------------------------------------------------
  async showLabModal(visitId) {
    try {
      const visit = await API.visits.get(visitId);
      const p = visit.patients || {};

      openModal(`Laboratory Testing: ${p.first_name} ${p.last_name} (${p.patient_number || ''})`, `
        <div style="background:#ede9fe; border:1px solid #c7d2fe; border-radius:var(--radius-md); padding:12px; margin-bottom:16px;">
          <h4 style="margin:0 0 6px; font-size:14px; color:#4338ca;"><i class="fas fa-flask"></i> Diagnostic Request</h4>
          <p style="margin:0; font-size:13px; color:#3730a3;"><strong>Test:</strong> ${visit.lab_notes || 'Diagnostic Investigation Panel'}</p>
          <p style="margin:4px 0 0; font-size:12px; color:#5b21b6;"><strong>Doctor's Notes:</strong> ${visit.initial_assessment || visit.reason_for_visit}</p>
        </div>

        <form id="lab-results-form">
          <div class="form-group">
            <label class="form-label">Test Findings & Numerical / Qualitative Results <span class="required">*</span></label>
            <textarea id="lr-results" class="form-control" required rows="4" placeholder="e.g. Total Cholesterol: 215 mg/dL (Elevated), Triglycerides: 160 mg/dL, HDL: 42 mg/dL, LDL: 141 mg/dL. Serum Electrolytes within normal baseline.">${visit.lab_results || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Laboratory Scientist Notes / Impression</label>
            <input type="text" id="lr-notes" class="form-control" placeholder="e.g. Mild dyslipidemia noted. Sample hemolyzation absent." value="${visit.lab_notes || ''}">
          </div>

          <div class="card-footer" style="padding: 12px 0 0; background: transparent; display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="lr-submit-btn" style="background:#4338ca;">
              <i class="fas fa-paper-plane"></i> Submit Results to Doctor
            </button>
          </div>
        </form>
      `, 'modal-md');

      document.getElementById('lab-results-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('lr-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

        try {
          const payload = {
            results: document.getElementById('lr-results').value,
            lab_notes: document.getElementById('lr-notes').value
          };

          await API.visits.labComplete(visitId, payload);
          showToast('success', 'Lab Results Submitted', 'Patient status updated to "Lab Completed / Waiting for Doctor".');
          closeModal();

          if (typeof DashboardPage !== 'undefined' && currentPage === 'dashboard') {
            DashboardPage.load();
          } else if (typeof VisitsPage !== 'undefined') {
            VisitsPage.load();
          }
        } catch (err) {
          showToast('error', 'Lab Error', err.message);
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Results to Doctor';
        }
      });
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  // ------------------------------------------------------------
  // STAGE 4: DOCTOR FINAL CONSULTATION & PRESCRIPTION
  // ------------------------------------------------------------
  async showFinalConsultModal(visitId) {
    try {
      const [visit, medsRes] = await Promise.all([
        API.visits.get(visitId),
        API.medicines.list({ limit: 100 })
      ]);

      const p = visit.patients || {};
      const medicines = medsRes.data || medsRes || [];

      openModal(`Final Consultation: ${p.first_name} ${p.last_name}`, `
        <!-- Medical Context Summary -->
        <div style="background:#f8fafc; border:1px solid var(--gray-200); border-radius:var(--radius-md); padding:12px; margin-bottom:14px; font-size:13px;">
          <div style="margin-bottom:6px;"><strong>Symptoms:</strong> ${visit.symptoms || 'None recorded'}</div>
          <div style="margin-bottom:6px;"><strong>Exam Findings:</strong> ${visit.examination_findings || 'None recorded'}</div>
          ${visit.lab_results ? `
            <div style="background:#fef3c7; border:1px solid #fde68a; border-radius:var(--radius-sm); padding:8px 10px; margin-top:8px;">
              <strong style="color:#92400e;"><i class="fas fa-flask"></i> Laboratory Results:</strong>
              <p style="margin:4px 0 0; color:#78350f; font-family:monospace; font-size:12px;">${visit.lab_results}</p>
            </div>
          ` : '<div style="color:var(--gray-500); font-style:italic;">No laboratory tests were requested for this visit.</div>'}
        </div>

        <form id="final-consult-form">
          <div class="form-group">
            <label class="form-label">Final Clinical Diagnosis <span class="required">*</span></label>
            <input type="text" id="fn-diagnosis" class="form-control" required placeholder="e.g. Mixed Dyslipidemia & Stage 1 Essential Hypertension" value="${visit.final_diagnosis || ''}">
          </div>

          <div class="form-group">
            <label class="form-label">Treatment Plan / Patient Instructions</label>
            <textarea id="fn-treatment" class="form-control" rows="2" placeholder="e.g. Dietary lipid modification, increase daily aerobic exercise, take medication as instructed...">${visit.treatment_plan || ''}</textarea>
          </div>

          <!-- Pharmacy Decision Panel -->
          <div style="border: 2px solid #fdba74; background: #fff7ed; border-radius: var(--radius-md); padding: 14px; margin-bottom: 16px;">
            <label style="display:flex; align-items:center; gap:8px; font-weight:600; color:#c2410c; cursor:pointer; margin:0;">
              <input type="checkbox" id="fn-requires-pharmacy" checked onchange="VisitsWorkflow.togglePharmacyPrescriptionSection(this.checked)" style="width:18px;height:18px;">
              <span>💊 Prescribe Medications for Patient (Send to Pharmacy Queue)?</span>
            </label>
            <p style="margin:4px 0 0 26px; font-size:12px; color:var(--gray-600);">
              If unchecked, pharmacy will be skipped and the patient will be sent directly to Cashier for consultation/lab payment.
            </p>

            <div id="fn-pharmacy-panel" style="margin-top:12px; padding-top:12px; border-top:1px dashed #fed7aa;">
              <div class="form-row">
                <div class="form-group" style="flex:2;">
                  <label class="form-label">Select Medication</label>
                  <select id="fn-med-select" class="form-control">
                    ${medicines.map(m => `
                      <option value="${m.id}" data-name="${m.name}" data-price="${m.unit_price}">
                        ${m.name} (${m.strength || ''}) - Stock: ${m.stock_quantity} - $${m.unit_price}
                      </option>
                    `).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Quantity</label>
                  <input type="number" id="fn-med-qty" class="form-control" value="30" min="1">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Dosage & Frequency</label>
                  <input type="text" id="fn-med-dosage" class="form-control" value="1 tablet once daily" placeholder="e.g. 1 tab morning">
                </div>
                <div class="form-group">
                  <label class="form-label">Duration</label>
                  <input type="text" id="fn-med-duration" class="form-control" value="30 days" placeholder="e.g. 7 days">
                </div>
              </div>
            </div>
          </div>

          <div class="card-footer" style="padding: 12px 0 0; background: transparent; display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="fn-submit-btn">
              <i class="fas fa-check-double"></i> Complete Final Consultation
            </button>
          </div>
        </form>
      `, 'modal-lg');

      document.getElementById('final-consult-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('fn-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finalizing...';

        try {
          const requiresPharma = document.getElementById('fn-requires-pharmacy').checked;
          const payload = {
            final_diagnosis: document.getElementById('fn-diagnosis').value,
            treatment_plan: document.getElementById('fn-treatment').value,
            requires_pharmacy: requiresPharma
          };

          if (requiresPharma) {
            const medSelect = document.getElementById('fn-med-select');
            const selectedOpt = medSelect.options[medSelect.selectedIndex];
            payload.medicines = [{
              medicine_id: medSelect.value,
              medicine_name: selectedOpt.dataset.name,
              quantity: parseInt(document.getElementById('fn-med-qty').value) || 10,
              dosage: document.getElementById('fn-med-dosage').value,
              frequency: document.getElementById('fn-med-dosage').value,
              duration: document.getElementById('fn-med-duration').value,
              instructions: 'Take as directed'
            }];
          }

          await API.visits.finalConsultation(visitId, payload);
          showToast('success', 'Final Consultation Completed', requiresPharma ? 'Prescription sent to Pharmacy queue.' : 'No medication needed. Sent to Cashier queue.');
          closeModal();

          if (typeof DashboardPage !== 'undefined' && currentPage === 'dashboard') {
            DashboardPage.load();
          } else if (typeof VisitsPage !== 'undefined') {
            VisitsPage.load();
          }
        } catch (err) {
          showToast('error', 'Finalization Error', err.message);
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-check-double"></i> Complete Final Consultation';
        }
      });
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  togglePharmacyPrescriptionSection(checked) {
    const panel = document.getElementById('fn-pharmacy-panel');
    const submitBtn = document.getElementById('fn-submit-btn');
    if (checked) {
      panel.style.display = 'block';
      submitBtn.innerHTML = '<i class="fas fa-prescription-bottle"></i> Prescribe & Send to Pharmacy';
    } else {
      panel.style.display = 'none';
      submitBtn.innerHTML = '<i class="fas fa-file-invoice-dollar"></i> No Medicines -> Send to Cashier / Payment';
    }
  },

  // ------------------------------------------------------------
  // STAGE 5: PHARMACY DISPENSATION
  // ------------------------------------------------------------
  async showDispenseModal(visitId) {
    try {
      const visit = await API.visits.get(visitId);
      const p = visit.patients || {};
      const rx = visit.prescription_data || {};
      const items = rx.items || [];

      openModal(`Dispense Prescription: ${p.first_name} ${p.last_name}`, `
        <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:var(--radius-md); padding:12px; margin-bottom:16px;">
          <h4 style="margin:0 0 4px; color:#c2410c;"><i class="fas fa-pills"></i> ${rx.prescription_number || 'Prescription Order'}</h4>
          <p style="margin:0; font-size:13px; color:#9a3412;"><strong>Card #:</strong> ${p.patient_number} | <strong>Diagnosis:</strong> ${visit.final_diagnosis}</p>
        </div>

        <div class="table-wrapper" style="margin-bottom:16px;">
          <table class="table">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Dosage & Frequency</th>
                <th>Duration</th>
                <th>Quantity</th>
                <th>Est. Price</th>
              </tr>
            </thead>
            <tbody>
              ${items.length ? items.map(i => `
                <tr>
                  <td><strong>${i.medicine_name}</strong></td>
                  <td>${i.dosage} - ${i.frequency}</td>
                  <td>${i.duration}</td>
                  <td><span class="status-badge badge-scheduled">${i.quantity} units</span></td>
                  <td><strong>$${((i.unit_price || 5) * i.quantity).toFixed(2)}</strong></td>
                </tr>
              `).join('') : `
                <tr>
                  <td><strong>Standard Formulated Treatment</strong></td>
                  <td>1 tab QD</td>
                  <td>30 days</td>
                  <td>30 units</td>
                  <td><strong>$${(visit.pharmacy_fee || 17).toFixed(2)}</strong></td>
                </tr>
              `}
            </tbody>
          </table>
        </div>

        <div style="background:#f8fafc; border:1px dashed var(--gray-300); border-radius:var(--radius-md); padding:12px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span style="font-size:13px; color:var(--gray-600);">Total Medication Charges to Bill:</span>
          </div>
          <div style="font-size:18px; font-weight:700; color:var(--success);">
            $${(parseFloat(visit.pharmacy_fee) || 17.00).toFixed(2)}
          </div>
        </div>

        <div class="card-footer" style="padding: 12px 0 0; background: transparent; display: flex; justify-content: flex-end; gap: 8px;">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="button" class="btn btn-primary" id="dispense-submit-btn" onclick="VisitsWorkflow.executeDispense('${visitId}')" style="background:#c2410c;">
            <i class="fas fa-check-circle"></i> Dispense & Send to Cashier
          </button>
        </div>
      `, 'modal-md');
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  async executeDispense(visitId) {
    const btn = document.getElementById('dispense-submit-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Dispensing...';
    }

    try {
      await API.visits.pharmacyDispense(visitId);
      showToast('success', 'Medication Dispensed', 'Inventory deducted. Bill calculated and forwarded to Cashier.');
      closeModal();

      if (typeof DashboardPage !== 'undefined' && currentPage === 'dashboard') {
        DashboardPage.load();
      } else if (typeof VisitsPage !== 'undefined') {
        VisitsPage.load();
      }
    } catch (err) {
      showToast('error', 'Dispense Error', err.message);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Dispense & Send to Cashier';
      }
    }
  },

  // ------------------------------------------------------------
  // STAGE 6: PAYMENT / CASHIER & PATIENT EXIT
  // ------------------------------------------------------------
  async showPaymentModal(visitId) {
    try {
      const visit = await API.visits.get(visitId);
      const p = visit.patients || {};

      const consultFee = parseFloat(visit.consultation_fee) || 0;
      const labFee = parseFloat(visit.lab_fee) || 0;
      const pharmaFee = parseFloat(visit.pharmacy_fee) || 0;
      const totalFee = consultFee + labFee + pharmaFee;

      openModal(`Process Payment: ${p.first_name} ${p.last_name}`, `
        <div style="background:#fce7f3; border:1px solid #fbcfe8; border-radius:var(--radius-md); padding:12px; margin-bottom:16px;">
          <h4 style="margin:0 0 4px; color:#9d174d;"><i class="fas fa-cash-register"></i> Final Cashier Billing Checkout</h4>
          <p style="margin:0; font-size:13px; color:#831843;"><strong>Patient Card:</strong> ${p.patient_number} | <strong>Visit:</strong> ${visit.visit_number}</p>
        </div>

        <!-- Itemized Charge Breakdown -->
        <div class="table-wrapper" style="margin-bottom:16px;">
          <table class="table">
            <thead>
              <tr>
                <th>Service / Charge Description</th>
                <th style="text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <i class="fas fa-user-md" style="color:var(--primary); margin-right:6px;"></i>
                  <strong>Physician Consultation Fee</strong> (${visit.doctors?.profiles?.full_name || 'Attending Physician'})
                </td>
                <td style="text-align:right;"><strong>$${consultFee.toFixed(2)}</strong></td>
              </tr>
              ${labFee > 0 ? `
                <tr>
                  <td>
                    <i class="fas fa-flask" style="color:#7c3aed; margin-right:6px;"></i>
                    <strong>Diagnostic Laboratory Investigations</strong> (${visit.lab_notes || 'Lab Panel'})
                  </td>
                  <td style="text-align:right;"><strong>$${labFee.toFixed(2)}</strong></td>
                </tr>
              ` : ''}
              ${pharmaFee > 0 ? `
                <tr>
                  <td>
                    <i class="fas fa-pills" style="color:#ea580c; margin-right:6px;"></i>
                    <strong>Dispensed Pharmaceuticals & Medications</strong>
                  </td>
                  <td style="text-align:right;"><strong>$${pharmaFee.toFixed(2)}</strong></td>
                </tr>
              ` : ''}
              <tr style="background:#f8fafc; font-size:15px;">
                <td><strong>Total Balance Due</strong></td>
                <td style="text-align:right; font-weight:700; color:var(--success); font-size:18px;">$${totalFee.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <form id="cashier-pay-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Payment Method <span class="required">*</span></label>
              <select id="cp-method" class="form-control" required>
                <option value="cash">Cash Settlement</option>
                <option value="card">Credit / Debit Card</option>
                <option value="insurance">Health Insurance Claim</option>
                <option value="mobile_money">Mobile Money / Digital Transfer</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Amount Tendered <span class="required">*</span></label>
              <input type="number" step="0.01" id="cp-amount" class="form-control" value="${totalFee.toFixed(2)}" required>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Payment Reference / Authorization Code</label>
            <input type="text" id="cp-ref" class="form-control" placeholder="e.g. Card Auth #99214, Policy #INS-881, Cash Drawer #1">
          </div>

          <div class="card-footer" style="padding: 12px 0 0; background: transparent; display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="cp-submit-btn" style="background:#059669;">
              <i class="fas fa-receipt"></i> Record Payment & Complete Visit
            </button>
          </div>
        </form>
      `, 'modal-md');

      document.getElementById('cashier-pay-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('cp-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing Payment...';

        try {
          const payload = {
            payment_method: document.getElementById('cp-method').value,
            amount_paid: parseFloat(document.getElementById('cp-amount').value),
            payment_reference: document.getElementById('cp-ref').value
          };

          const res = await API.visits.processPayment(visitId, payload);
          showToast('success', 'Payment Settled', 'Visit marked COMPLETED. Patient free to exit.');
          closeModal();

          if (res.receipt) {
            VisitsWorkflow.showReceiptModal(res.receipt);
          }

          if (typeof DashboardPage !== 'undefined' && currentPage === 'dashboard') {
            DashboardPage.load();
          } else if (typeof VisitsPage !== 'undefined') {
            VisitsPage.load();
          }
        } catch (err) {
          showToast('error', 'Payment Error', err.message);
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-receipt"></i> Record Payment & Complete Visit';
        }
      });
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  showReceiptModal(r) {
    openModal('Official Clinic Payment Receipt', `
      <div id="printable-receipt" style="padding:16px; border:1px solid #e2e8f0; border-radius:var(--radius-md); font-family:monospace; background:#fff;">
        <div style="text-align:center; border-bottom:2px dashed #cbd5e1; padding-bottom:12px; margin-bottom:12px;">
          <h3 style="margin:0; font-size:18px; color:#1e293b;">🏥 CLINICCARE PRO MEDICAL CENTER</h3>
          <p style="margin:4px 0 0; font-size:12px; color:#64748b;">Outpatient Clinic Services & Diagnostics</p>
          <p style="margin:2px 0 0; font-size:12px; color:#64748b;">Date: ${r.payment_date} | Cashier: ${r.cashier_name}</p>
        </div>

        <div style="font-size:12px; margin-bottom:12px;">
          <div><strong>Receipt #:</strong> ${r.receipt_number}</div>
          <div><strong>Visit #:</strong> ${r.visit_number}</div>
          <div><strong>Patient:</strong> ${r.patient_name} (${r.patient_number})</div>
          <div><strong>Physician:</strong> ${r.doctor_name}</div>
        </div>

        <div style="border-top:1px dashed #cbd5e1; border-bottom:1px dashed #cbd5e1; padding:8px 0; margin-bottom:12px; font-size:12px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>Consultation Fee:</span>
            <span>$${parseFloat(r.consultation_fee || 0).toFixed(2)}</span>
          </div>
          ${r.lab_fee > 0 ? `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span>Laboratory Testing:</span>
              <span>$${parseFloat(r.lab_fee).toFixed(2)}</span>
            </div>
          ` : ''}
          ${r.pharmacy_fee > 0 ? `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span>Pharmaceuticals & Meds:</span>
              <span>$${parseFloat(r.pharmacy_fee).toFixed(2)}</span>
            </div>
          ` : ''}
          <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:14px; margin-top:6px; padding-top:6px; border-top:1px solid #e2e8f0;">
            <span>TOTAL AMOUNT PAID:</span>
            <span>$${parseFloat(r.amount_paid).toFixed(2)}</span>
          </div>
        </div>

        <div style="text-align:center; font-size:11px; color:#64748b;">
          <p style="margin:0;"><strong>STATUS: ${r.status}</strong></p>
          <p style="margin:2px 0 0;">Payment Method: ${r.payment_method}</p>
          <p style="margin:8px 0 0;">Thank you for trusting ClinicCare Pro! Get well soon.</p>
        </div>
      </div>

      <div class="card-footer" style="padding:12px 0 0; background:transparent; display:flex; justify-content:space-between;">
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        <button class="btn btn-primary" onclick="window.print()"><i class="fas fa-print"></i> Print Receipt</button>
      </div>
    `, 'modal-md');
  },

  // ------------------------------------------------------------
  // COMPLETE VISIT TIMELINE AUDIT INSPECTOR
  // ------------------------------------------------------------
  async showVisitTimelineModal(visitId) {
    try {
      const visit = await API.visits.get(visitId);
      const p = visit.patients || {};
      const d = visit.doctors || {};

      openModal(`Complete Visit History: ${visit.visit_number}`, `
        <div style="background:#f8fafc; border:1px solid var(--gray-200); border-radius:var(--radius-md); padding:12px; margin-bottom:16px;">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px; font-size:13px;">
            <div><span style="color:var(--gray-500);">Patient:</span> <strong>${p.first_name} ${p.last_name} (${p.patient_number})</strong></div>
            <div><span style="color:var(--gray-500);">Doctor:</span> <strong>${d.profiles?.full_name || 'Attending Physician'}</strong></div>
            <div><span style="color:var(--gray-500);">Check-In:</span> <strong>${formatDate(visit.created_at)}</strong></div>
            <div><span style="color:var(--gray-500);">Current Status:</span> ${getVisitStatusBadge(visit.status)}</div>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:12px; font-size:13px;">
          <!-- 1. Reception -->
          <div style="border-left:3px solid var(--primary); padding-left:12px;">
            <div style="font-weight:600; color:var(--primary);"><i class="fas fa-door-open"></i> 1. Reception Check-In</div>
            <div style="color:var(--gray-700); margin-top:2px;">Reason for visit: <em>"${visit.reason_for_visit}"</em></div>
          </div>

          <!-- 2. Doctor First Consultation -->
          <div style="border-left:3px solid ${visit.first_consultation_at ? 'var(--success)' : 'var(--gray-300)'}; padding-left:12px;">
            <div style="font-weight:600; color:${visit.first_consultation_at ? 'var(--gray-800)' : 'var(--gray-400)'};">
              <i class="fas fa-stethoscope"></i> 2. Doctor Initial Examination
            </div>
            ${visit.first_consultation_at ? `
              <div style="color:var(--gray-700); margin-top:2px;"><strong>Symptoms:</strong> ${visit.symptoms}</div>
              <div style="color:var(--gray-700); margin-top:2px;"><strong>Findings:</strong> ${visit.examination_findings}</div>
              <div style="color:var(--gray-700); margin-top:2px;"><strong>Initial Assessment:</strong> ${visit.initial_assessment || 'Recorded'}</div>
            ` : '<div style="color:var(--gray-400); font-style:italic;">Pending doctor examination.</div>'}
          </div>

          <!-- 3. Laboratory -->
          ${visit.requires_lab ? `
            <div style="border-left:3px solid ${visit.lab_completed_at ? 'var(--success)' : 'var(--warning)'}; padding-left:12px;">
              <div style="font-weight:600; color:${visit.lab_completed_at ? 'var(--gray-800)' : 'var(--gray-400)'};">
                <i class="fas fa-flask"></i> 3. Laboratory Diagnostic Testing
              </div>
              <div style="color:var(--gray-700); margin-top:2px;"><strong>Requested Test:</strong> ${visit.lab_notes || 'Lab Panel'}</div>
              ${visit.lab_results ? `
                <div style="background:#fef3c7; border-radius:4px; padding:6px 8px; margin-top:4px; font-family:monospace; font-size:12px;">${visit.lab_results}</div>
              ` : '<div style="color:var(--warning); font-style:italic;">Sample awaiting analysis in laboratory.</div>'}
            </div>
          ` : '<div style="border-left:3px solid var(--gray-300); padding-left:12px; color:var(--gray-400);"><i class="fas fa-forward"></i> 3. Laboratory Skipped (Not Required)</div>'}

          <!-- 4. Final Consultation -->
          <div style="border-left:3px solid ${visit.final_consultation_at ? 'var(--success)' : 'var(--gray-300)'}; padding-left:12px;">
            <div style="font-weight:600; color:${visit.final_consultation_at ? 'var(--gray-800)' : 'var(--gray-400)'};">
              <i class="fas fa-notes-medical"></i> 4. Final Diagnosis & Treatment Plan
            </div>
            ${visit.final_diagnosis ? `
              <div style="color:var(--gray-700); margin-top:2px;"><strong>Diagnosis:</strong> ${visit.final_diagnosis}</div>
              <div style="color:var(--gray-700); margin-top:2px;"><strong>Treatment:</strong> ${visit.treatment_plan || '-'}</div>
            ` : '<div style="color:var(--gray-400); font-style:italic;">Pending final doctor consultation.</div>'}
          </div>

          <!-- 5. Pharmacy -->
          ${visit.requires_pharmacy ? `
            <div style="border-left:3px solid ${visit.pharmacy_dispensed_at ? 'var(--success)' : 'var(--warning)'}; padding-left:12px;">
              <div style="font-weight:600; color:${visit.pharmacy_dispensed_at ? 'var(--gray-800)' : 'var(--gray-400)'};">
                <i class="fas fa-pills"></i> 5. Pharmacy Dispensation
              </div>
              ${visit.pharmacy_dispensed_at ? `
                <div style="color:var(--success); margin-top:2px;">Medications dispensed and inventory deducted.</div>
              ` : '<div style="color:var(--warning); font-style:italic;">Prescription pending in pharmacy queue.</div>'}
            </div>
          ` : '<div style="border-left:3px solid var(--gray-300); padding-left:12px; color:var(--gray-400);"><i class="fas fa-forward"></i> 5. Pharmacy Skipped (No Medication Prescribed)</div>'}

          <!-- 6. Payment & Exit -->
          <div style="border-left:3px solid ${visit.status === 'completed' ? 'var(--success)' : 'var(--gray-300)'}; padding-left:12px;">
            <div style="font-weight:600; color:${visit.status === 'completed' ? 'var(--gray-800)' : 'var(--gray-400)'};">
              <i class="fas fa-check-circle"></i> 6 & 7. Cashier Settlement & Patient Exit
            </div>
            ${visit.status === 'completed' ? `
              <div style="color:var(--success); margin-top:2px;">Paid: $${parseFloat(visit.total_fee || 0).toFixed(2)} via ${(visit.payment_method || 'cash').toUpperCase()}. Patient completed visit and exited.</div>
            ` : `<div style="color:var(--gray-500); margin-top:2px;">Total Pending: $${parseFloat(visit.total_fee || 0).toFixed(2)}</div>`}
          </div>
        </div>

        <div class="card-footer" style="padding:16px 0 0; background:transparent; display:flex; justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        </div>
      `, 'modal-lg');
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  }
};

// ============================================================
// VISITS PAGE (Full Clinic Queue & Lifecycle Directory)
// ============================================================
const VisitsPage = {
  currentTab: 'all',

  async load() {
    const content = document.getElementById('page-content');
    const userRole = Auth.getRole();

    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>Patient Visit Queue & Real-World Clinic Flow</h2>
          <p>End-to-end patient lifecycle: Reception &rarr; Doctor Initial &rarr; Laboratory &rarr; Doctor Final &rarr; Pharmacy &rarr; Cashier &rarr; Exit</p>
        </div>
        <div class="page-header-actions">
          ${Auth.hasRole('admin', 'receptionist') ? `
            <button class="btn btn-primary" onclick="VisitsWorkflow.showCheckInModal()">
              <i class="fas fa-user-plus"></i> New Patient Check-In
            </button>
          ` : ''}
          <button class="btn btn-secondary" onclick="VisitsPage.loadList()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
      </div>

      <!-- Quick Department Queue Filter Tabs -->
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:16px;">
        <button class="btn btn-sm ${this.currentTab === 'all' ? 'btn-primary' : 'btn-ghost'}" onclick="VisitsPage.switchTab('all')">
          All Active
        </button>
        <button class="btn btn-sm ${this.currentTab === 'waiting_doctor_initial' ? 'btn-primary' : 'btn-ghost'}" onclick="VisitsPage.switchTab('waiting_doctor_initial')">
          1. Doctor Initial Exam
        </button>
        <button class="btn btn-sm ${this.currentTab === 'waiting_laboratory' ? 'btn-primary' : 'btn-ghost'}" onclick="VisitsPage.switchTab('waiting_laboratory')">
          2. Laboratory Testing
        </button>
        <button class="btn btn-sm ${this.currentTab === 'waiting_doctor_final' ? 'btn-primary' : 'btn-ghost'}" onclick="VisitsPage.switchTab('waiting_doctor_final')">
          3. Doctor Final Consult
        </button>
        <button class="btn btn-sm ${this.currentTab === 'waiting_pharmacy' ? 'btn-primary' : 'btn-ghost'}" onclick="VisitsPage.switchTab('waiting_pharmacy')">
          4. Pharmacy Dispensing
        </button>
        <button class="btn btn-sm ${this.currentTab === 'waiting_payment' ? 'btn-primary' : 'btn-ghost'}" onclick="VisitsPage.switchTab('waiting_payment')">
          5. Cashier Payment
        </button>
        <button class="btn btn-sm ${this.currentTab === 'completed' ? 'btn-primary' : 'btn-ghost'}" onclick="VisitsPage.switchTab('completed')">
          6. Completed Visits
        </button>
      </div>

      <!-- Visits Table -->
      <div class="card">
        <div class="card-body" style="padding:0;" id="visits-table-container">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
      </div>
    `;

    await this.loadList();
  },

  switchTab(tab) {
    this.currentTab = tab;
    this.load();
  },

  async loadList() {
    const container = document.getElementById('visits-table-container');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
      const params = {};
      if (this.currentTab === 'all') {
        params.active_only = 'true';
      } else {
        params.status = this.currentTab;
      }

      const res = await API.visits.list(params);
      const visits = res.data || [];

      if (!visits.length) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-clipboard-check"></i>
            <h3>No Visits in this Queue</h3>
            <p>There are currently no patients in this stage of the clinic workflow.</p>
            ${Auth.hasRole('admin', 'receptionist') ? `
              <button class="btn btn-primary" onclick="VisitsWorkflow.showCheckInModal()"><i class="fas fa-user-plus"></i> Check In Patient</button>
            ` : ''}
          </div>
        `;
        return;
      }

      const role = Auth.getRole();

      container.innerHTML = `
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Visit #</th>
                <th>Patient / Card</th>
                <th>Doctor</th>
                <th>Current Workflow Stage</th>
                <th>Reason / Complaint</th>
                <th>Fee</th>
                <th style="text-align:right;">Department Action</th>
              </tr>
            </thead>
            <tbody>
              ${visits.map(v => {
                const p = v.patients || {};
                const d = v.doctors || {};

                // Determine action button based on visit status and user role
                let actionBtn = `
                  <button class="btn btn-sm btn-secondary" onclick="VisitsWorkflow.showVisitTimelineModal('${v.id}')">
                    <i class="fas fa-history"></i> History
                  </button>
                `;

                if (v.status === 'waiting_doctor_initial' && Auth.hasRole('doctor', 'admin')) {
                  actionBtn = `
                    <button class="btn btn-sm btn-primary" onclick="VisitsWorkflow.showFirstConsultModal('${v.id}')">
                      <i class="fas fa-stethoscope"></i> Start Exam
                    </button>
                  `;
                } else if (v.status === 'waiting_laboratory' && Auth.hasRole('laboratorist', 'nurse', 'doctor', 'admin')) {
                  actionBtn = `
                    <button class="btn btn-sm btn-primary" onclick="VisitsWorkflow.showLabModal('${v.id}')" style="background:#4338ca;">
                      <i class="fas fa-flask"></i> Process Lab
                    </button>
                  `;
                } else if (v.status === 'waiting_doctor_final' && Auth.hasRole('doctor', 'admin')) {
                  actionBtn = `
                    <button class="btn btn-sm btn-primary" onclick="VisitsWorkflow.showFinalConsultModal('${v.id}')" style="background:#b45309;">
                      <i class="fas fa-notes-medical"></i> Final Consult
                    </button>
                  `;
                } else if (v.status === 'waiting_pharmacy' && Auth.hasRole('pharmacist', 'admin')) {
                  actionBtn = `
                    <button class="btn btn-sm btn-primary" onclick="VisitsWorkflow.showDispenseModal('${v.id}')" style="background:#c2410c;">
                      <i class="fas fa-pills"></i> Dispense
                    </button>
                  `;
                } else if (v.status === 'waiting_payment' && Auth.hasRole('cashier', 'receptionist', 'admin')) {
                  actionBtn = `
                    <button class="btn btn-sm btn-primary" onclick="VisitsWorkflow.showPaymentModal('${v.id}')" style="background:#059669;">
                      <i class="fas fa-cash-register"></i> Collect Pay
                    </button>
                  `;
                }

                return `
                  <tr>
                    <td><strong>${v.visit_number}</strong></td>
                    <td>
                      <div><strong>${p.first_name} ${p.last_name}</strong></div>
                      <div style="font-size:11px; color:var(--gray-500); font-family:monospace;">${p.patient_number || '-'} &bull; ${p.phone || ''}</div>
                    </td>
                    <td>${d.profiles?.full_name || 'Dr. Physician'}</td>
                    <td>${getVisitStatusBadge(v.status)}</td>
                    <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                      ${v.final_diagnosis || v.reason_for_visit}
                    </td>
                    <td><strong>$${parseFloat(v.total_fee || 75).toFixed(2)}</strong></td>
                    <td style="text-align:right;">
                      <div style="display:inline-flex; gap:6px;">
                        ${actionBtn}
                        <button class="btn btn-sm btn-ghost" title="View Timeline" onclick="VisitsWorkflow.showVisitTimelineModal('${v.id}')">
                          <i class="fas fa-eye"></i>
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
      showToast('error', 'Error', err.message);
    }
  }
};

window.VisitsWorkflow = VisitsWorkflow;
window.VisitsPage = VisitsPage;
window.getVisitStatusBadge = getVisitStatusBadge;
