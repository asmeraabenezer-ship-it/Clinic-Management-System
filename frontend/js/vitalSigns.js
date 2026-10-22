/* ============================================================
   VITALSIGNS.JS - Patient Vitals Recording & Physiological Tracking
   ============================================================ */

const VitalSignsPage = {
  currentPage: 1,
  limit: 10,

  async load() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>Vital Signs</h2>
          <p>Triage, physiological monitoring, BMI calculations, and vital records</p>
        </div>
        <div class="page-header-actions">
          ${Auth.hasRole('nurse', 'doctor', 'admin') ? `
            <button class="btn btn-primary" onclick="VitalSignsPage.showCreate()">
              <i class="fas fa-heartbeat"></i> Record Vitals
            </button>
          ` : ''}
        </div>
      </div>

      <div class="search-filter-bar">
        <div class="search-input-wrapper">
          <i class="fas fa-search"></i>
          <input type="text" id="vitals-search" placeholder="Search by patient name..." oninput="VitalSignsPage.onSearch(this.value)">
        </div>
        <button class="btn btn-secondary" onclick="VitalSignsPage.loadList()"><i class="fas fa-sync-alt"></i></button>
      </div>

      <div class="card">
        <div class="card-body" style="padding: 0;" id="vitals-table-container">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
        <div id="vitals-pagination"></div>
      </div>
    `;

    await this.loadList();
  },

  onSearch: debounce(function(val) {
    VitalSignsPage.loadList(val.trim());
  }, 350),

  async loadList(query = '') {
    const container = document.getElementById('vitals-table-container');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
      const res = await API.vitalSigns.list({
        page: this.currentPage,
        limit: this.limit,
        search: query
      });

      const vitals = res.data || res.vitals || [];
      const pagination = res.pagination;

      if (!vitals.length) {
        showEmptyState(
          'vitals-table-container',
          'fas fa-heartbeat',
          'No Vital Signs Recorded',
          'Triage records will appear here once recorded.',
          Auth.hasRole('nurse', 'doctor', 'admin') ? `<button class="btn btn-primary" onclick="VitalSignsPage.showCreate()"><i class="fas fa-heartbeat"></i> Record Vitals</button>` : ''
        );
        document.getElementById('vitals-pagination').innerHTML = '';
        return;
      }

      container.innerHTML = `
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Patient</th>
                <th>Blood Pressure</th>
                <th>Pulse</th>
                <th>Temp</th>
                <th>SpO2</th>
                <th>BMI</th>
                <th>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              ${vitals.map(v => {
                const pName = v.patients ? `${v.patients.first_name} ${v.patients.last_name}` : 'Unknown';
                const isBpHigh = v.blood_pressure_systolic >= 140 || v.blood_pressure_diastolic >= 90;
                const isSpo2Low = v.oxygen_saturation && v.oxygen_saturation < 95;
                const isTempHigh = v.temperature && v.temperature >= 38.0;

                return `
                  <tr>
                    <td>${formatDateTime(v.recorded_at || v.created_at)}</td>
                    <td><strong>${pName}</strong> <span style="font-size:11px;color:var(--gray-400);">(${v.patients?.patient_number || ''})</span></td>
                    <td>
                      <span class="${isBpHigh ? 'text-danger font-bold' : ''}">
                        ${v.blood_pressure_systolic && v.blood_pressure_diastolic ? `${v.blood_pressure_systolic}/${v.blood_pressure_diastolic}` : '-'}
                      </span>
                      <span style="font-size:11px;color:var(--gray-400);"> mmHg</span>
                    </td>
                    <td>${(v.heart_rate || v.pulse_rate) ? `${v.heart_rate || v.pulse_rate} bpm` : '-'}</td>
                    <td>
                      <span class="${isTempHigh ? 'text-danger font-bold' : ''}">
                        ${v.temperature ? `${v.temperature}°C` : '-'}
                      </span>
                    </td>
                    <td>
                      <span class="${isSpo2Low ? 'text-danger font-bold' : ''}">
                        ${v.oxygen_saturation ? `${v.oxygen_saturation}%` : '-'}
                      </span>
                    </td>
                    <td>
                      ${v.bmi ? `<span style="font-weight:700;">${v.bmi}</span> <span style="font-size:11px;color:var(--gray-500);">(${v.weight || v.weight_kg || '-'}kg / ${v.height || v.height_cm || '-'}cm)</span>` : '-'}
                    </td>
                    <td>${v.profiles?.full_name || 'Staff'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      renderPagination('vitals-pagination', pagination, 'VitalSignsPage.goToPage');
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
      const res = await API.patients.list({ limit: 100 });
      const patients = res.data || res.patients || [];

      openModal('Record Vital Signs', `
        <form id="record-vitals-form">
          <div class="form-group">
            <label class="form-label">Patient <span class="required">*</span></label>
            <select id="rv-patient" class="form-control" required>
              <option value="">Select patient...</option>
              ${patients.map(p => `<option value="${p.id}" ${preselectedPatientId === p.id ? 'selected' : ''}>${p.first_name} ${p.last_name} (${p.patient_number || p.phone})</option>`).join('')}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Systolic BP (mmHg)</label>
              <input type="number" id="rv-systolic" class="form-control" placeholder="e.g. 120" min="50" max="260">
            </div>
            <div class="form-group">
              <label class="form-label">Diastolic BP (mmHg)</label>
              <input type="number" id="rv-diastolic" class="form-control" placeholder="e.g. 80" min="30" max="160">
            </div>
          </div>

          <div class="form-row-3">
            <div class="form-group">
              <label class="form-label">Heart Rate (bpm)</label>
              <input type="number" id="rv-pulse" class="form-control" placeholder="e.g. 72" min="30" max="220">
            </div>
            <div class="form-group">
              <label class="form-label">Temperature (°C)</label>
              <input type="number" id="rv-temp" class="form-control" placeholder="e.g. 36.6" step="0.1" min="30" max="45">
            </div>
            <div class="form-group">
              <label class="form-label">Oxygen SpO2 (%)</label>
              <input type="number" id="rv-spo2" class="form-control" placeholder="e.g. 98" min="50" max="100">
            </div>
          </div>

          <div class="form-row-3">
            <div class="form-group">
              <label class="form-label">Respiratory Rate (/min)</label>
              <input type="number" id="rv-resp" class="form-control" placeholder="e.g. 16" min="8" max="60">
            </div>
            <div class="form-group">
              <label class="form-label">Weight (kg)</label>
              <input type="number" id="rv-weight" class="form-control" placeholder="e.g. 70" step="0.1" oninput="VitalSignsPage.calcBmi()">
            </div>
            <div class="form-group">
              <label class="form-label">Height (cm)</label>
              <input type="number" id="rv-height" class="form-control" placeholder="e.g. 175" step="0.5" oninput="VitalSignsPage.calcBmi()">
            </div>
          </div>

          <div style="background: var(--gray-50); border-radius: var(--radius); padding: 12px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 13px; font-weight: 600; color: var(--gray-700);">Calculated Body Mass Index (BMI):</span>
            <span id="rv-bmi-display" style="font-size: 16px; font-weight: 800; color: var(--primary);">-</span>
          </div>

          <div class="form-group">
            <label class="form-label">Clinical Observations</label>
            <input type="text" id="rv-notes" class="form-control" placeholder="e.g. Patient appears alert and oriented, mild distress...">
          </div>

          <div class="card-footer" style="padding: 12px 0 0; background: transparent;">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-save-vitals">Record Vitals</button>
          </div>
        </form>
      `);

      document.getElementById('record-vitals-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading('#btn-save-vitals', true);

        const weight = parseFloat(document.getElementById('rv-weight').value) || null;
        const height = parseFloat(document.getElementById('rv-height').value) || null;
        let bmi = null;
        if (weight && height) {
          bmi = parseFloat((weight / Math.pow(height / 100, 2)).toFixed(1));
        }

        const payload = {
          patient_id: document.getElementById('rv-patient').value,
          appointment_id: preselectedAppointmentId || null,
          blood_pressure_systolic: parseInt(document.getElementById('rv-systolic').value) || null,
          blood_pressure_diastolic: parseInt(document.getElementById('rv-diastolic').value) || null,
          temperature: parseFloat(document.getElementById('rv-temp').value) || null,
          heart_rate: parseInt(document.getElementById('rv-pulse').value) || null,
          pulse_rate: parseInt(document.getElementById('rv-pulse').value) || null,
          respiratory_rate: parseInt(document.getElementById('rv-resp').value) || null,
          oxygen_saturation: parseInt(document.getElementById('rv-spo2').value) || null,
          weight: weight,
          weight_kg: weight,
          height: height,
          height_cm: height,
          bmi: bmi,
          notes: document.getElementById('rv-notes').value.trim() || null
        };

        try {
          await API.vitalSigns.create(payload);
          showToast('success', 'Vitals Recorded', 'Triage information saved.');
          closeModal();
          VitalSignsPage.loadList();
        } catch (err) {
          showToast('error', 'Error', err.message);
        } finally {
          setLoading('#btn-save-vitals', false);
        }
      });
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  calcBmi() {
    const w = parseFloat(document.getElementById('rv-weight')?.value);
    const h = parseFloat(document.getElementById('rv-height')?.value);
    const display = document.getElementById('rv-bmi-display');
    if (!display) return;

    if (w > 0 && h > 0) {
      const bmi = (w / Math.pow(h / 100, 2)).toFixed(1);
      let cat = 'Normal';
      let color = 'var(--success)';
      if (bmi < 18.5) { cat = 'Underweight'; color = 'var(--warning)'; }
      else if (bmi >= 25 && bmi < 30) { cat = 'Overweight'; color = 'var(--warning)'; }
      else if (bmi >= 30) { cat = 'Obese'; color = 'var(--danger)'; }

      display.innerHTML = `${bmi} <span style="font-size:12px;font-weight:600;color:${color}">(${cat})</span>`;
    } else {
      display.textContent = '-';
    }
  }
};

window.VitalSignsPage = VitalSignsPage;
