/* ============================================================
   APPOINTMENTS.JS - Booking, Rescheduling, Double-Booking Prevention & Status
   ============================================================ */

const AppointmentsPage = {
  currentPage: 1,
  limit: 10,
  filterStatus: '',
  filterDoctor: '',
  filterDate: '',

  async load() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>Appointments</h2>
          <p>Schedule, manage, reschedule and track clinic appointments</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary" onclick="AppointmentsPage.filterToday()">
            <i class="fas fa-calendar-day"></i> Today's Schedule
          </button>
          ${Auth.hasRole('admin', 'receptionist', 'doctor') ? `
            <button class="btn btn-primary" onclick="AppointmentsPage.showCreate()">
              <i class="fas fa-plus"></i> Book Appointment
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Filters Bar -->
      <div class="search-filter-bar">
        <div class="search-input-wrapper">
          <i class="fas fa-calendar-alt"></i>
          <input type="date" id="appt-filter-date" onchange="AppointmentsPage.onDateFilter(this.value)">
        </div>

        <select class="filter-select" id="appt-filter-status" onchange="AppointmentsPage.onStatusFilter(this.value)">
          <option value="">All Statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="confirmed">Confirmed</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
        </select>

        <select class="filter-select" id="appt-filter-doctor" onchange="AppointmentsPage.onDoctorFilter(this.value)">
          <option value="">All Doctors</option>
        </select>

        <button class="btn btn-secondary" onclick="AppointmentsPage.resetFilters()" title="Reset Filters">
          <i class="fas fa-undo"></i>
        </button>
      </div>

      <!-- Appointments List Card -->
      <div class="card">
        <div class="card-body" style="padding: 0;" id="appointments-table-container">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
        <div id="appointments-pagination"></div>
      </div>
    `;

    await this.populateDoctorFilter();
    await this.loadList();
  },

  filterToday() {
    this.filterDate = today();
    const dateInput = document.getElementById('appt-filter-date');
    if (dateInput) dateInput.value = this.filterDate;
    this.currentPage = 1;
    this.loadList();
  },

  onDateFilter(val) {
    this.filterDate = val;
    this.currentPage = 1;
    this.loadList();
  },

  onStatusFilter(val) {
    this.filterStatus = val;
    this.currentPage = 1;
    this.loadList();
  },

  onDoctorFilter(val) {
    this.filterDoctor = val;
    this.currentPage = 1;
    this.loadList();
  },

  resetFilters() {
    this.filterDate = '';
    this.filterStatus = '';
    this.filterDoctor = '';
    const dateInput = document.getElementById('appt-filter-date');
    if (dateInput) dateInput.value = '';
    const statusSelect = document.getElementById('appt-filter-status');
    if (statusSelect) statusSelect.value = '';
    const docSelect = document.getElementById('appt-filter-doctor');
    if (docSelect) docSelect.value = '';
    this.currentPage = 1;
    this.loadList();
  },

  async populateDoctorFilter() {
    try {
      const res = await API.doctors.list();
      const docs = res.data || res.doctors || [];
      const select = document.getElementById('appt-filter-doctor');
      if (select) {
        docs.forEach(d => {
          const name = d.profiles ? d.profiles.full_name : d.full_name;
          select.innerHTML += `<option value="${d.id}">Dr. ${name} (${d.specialization})</option>`;
        });
      }
    } catch (err) {
      console.error(err);
    }
  },

  async loadList() {
    const container = document.getElementById('appointments-table-container');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
      const params = {
        page: this.currentPage,
        limit: this.limit,
        status: this.filterStatus,
        doctor_id: this.filterDoctor,
        date: this.filterDate
      };

      const res = await API.appointments.list(params);
      const appts = res.data || res.appointments || [];
      const pagination = res.pagination;

      if (!appts.length) {
        showEmptyState(
          'appointments-table-container',
          'fas fa-calendar-times',
          'No Appointments Found',
          'No appointment bookings match the selected criteria.',
          `<button class="btn btn-primary" onclick="AppointmentsPage.showCreate()"><i class="fas fa-plus"></i> Book Appointment</button>`
        );
        document.getElementById('appointments-pagination').innerHTML = '';
        return;
      }

      container.innerHTML = `
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Type</th>
                <th>Reason</th>
                <th>Status</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${appts.map(a => {
                const patientName = a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : 'Patient';
                const docName = a.doctors?.profiles ? a.doctors.profiles.full_name : 'Doctor';
                return `
                  <tr>
                    <td>
                      <div style="font-weight: 700; color: var(--gray-900);">${formatDate(a.appointment_date)}</div>
                      <div style="font-size: 12px; color: var(--primary); font-weight: 600;"><i class="far fa-clock"></i> ${formatTime(a.appointment_time)}</div>
                    </td>
                    <td>
                      <div style="font-weight: 600; color: var(--gray-800);">${patientName}</div>
                      <div style="font-size: 11px; color: var(--gray-400);">${a.patients?.phone || ''}</div>
                    </td>
                    <td>
                      <div style="font-weight: 600; color: var(--gray-800);">Dr. ${docName}</div>
                      <div style="font-size: 11px; color: var(--gray-500);">${a.doctors?.specialization || 'General'}</div>
                    </td>
                    <td><span style="font-size: 12px; font-weight: 600; text-transform: capitalize; background: var(--gray-100); padding: 2px 8px; border-radius: var(--radius-sm);">${a.type || 'General'}</span></td>
                    <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px;" title="${a.reason || ''}">${a.reason || '-'}</td>
                    <td>${getStatusBadge(a.status)}</td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 4px;">
                        <button class="btn btn-sm btn-secondary" title="View Details" onclick="AppointmentsPage.viewDetails('${a.id}')">
                          <i class="fas fa-eye"></i>
                        </button>
                        ${a.status === 'scheduled' ? `
                          <button class="btn btn-sm btn-success" title="Confirm" onclick="AppointmentsPage.updateStatus('${a.id}', 'confirmed')">
                            <i class="fas fa-check"></i>
                          </button>
                        ` : ''}
                        ${a.status === 'confirmed' ? `
                          <button class="btn btn-sm btn-primary" title="Start Consultation / Check-in" onclick="AppointmentsPage.updateStatus('${a.id}', 'in_progress')">
                            <i class="fas fa-play"></i>
                          </button>
                        ` : ''}
                        ${a.status === 'in_progress' ? `
                          <button class="btn btn-sm btn-success" title="Complete Appointment" onclick="AppointmentsPage.updateStatus('${a.id}', 'completed')">
                            <i class="fas fa-check-double"></i>
                          </button>
                        ` : ''}
                        ${['scheduled', 'confirmed'].includes(a.status) ? `
                          <button class="btn btn-sm btn-outline" title="Reschedule" onclick="AppointmentsPage.showReschedule('${a.id}')">
                            <i class="fas fa-calendar-alt"></i>
                          </button>
                          <button class="btn btn-sm btn-danger" title="Cancel Appointment" onclick="AppointmentsPage.showCancel('${a.id}')">
                            <i class="fas fa-times"></i>
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

      renderPagination('appointments-pagination', pagination, 'AppointmentsPage.goToPage');
    } catch (err) {
      container.innerHTML = `<div class="p-4 text-center text-danger">${err.message}</div>`;
    }
  },

  goToPage(page) {
    this.currentPage = page;
    this.loadList();
  },

  async showCreate(preselectedPatientId = null) {
    try {
      const [patientsRes, doctorsRes] = await Promise.all([
        API.patients.list({ limit: 100 }),
        API.doctors.list({ limit: 100 })
      ]);

      const patients = patientsRes.data || patientsRes.patients || [];
      const doctors = doctorsRes.data || doctorsRes.doctors || [];

      openModal('Book New Appointment', `
        <form id="create-appointment-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Patient <span class="required">*</span></label>
              <select id="ca-patient" class="form-control" required>
                <option value="">Select patient...</option>
                ${patients.map(p => `
                  <option value="${p.id}" ${preselectedPatientId === p.id ? 'selected' : ''}>
                    ${p.first_name} ${p.last_name} (${p.patient_number || p.phone})
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Doctor <span class="required">*</span></label>
              <select id="ca-doctor" class="form-control" required onchange="AppointmentsPage.onBookingDoctorOrDateChange()">
                <option value="">Select doctor...</option>
                ${doctors.map(d => {
                  const name = d.profiles ? d.profiles.full_name : d.full_name;
                  return `<option value="${d.id}">Dr. ${name} - ${d.specialization}</option>`;
                }).join('')}
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Appointment Date <span class="required">*</span></label>
              <input type="date" id="ca-date" class="form-control" required min="${today()}" value="${today()}" onchange="AppointmentsPage.onBookingDoctorOrDateChange()">
            </div>
            <div class="form-group">
              <label class="form-label">Appointment Time <span class="required">*</span></label>
              <select id="ca-time" class="form-control" required>
                <option value="">Select doctor & date first</option>
              </select>
              <div class="form-hint" id="ca-slots-hint">Double-booking prevention is actively checked.</div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Type <span class="required">*</span></label>
              <select id="ca-type" class="form-control" required>
                <option value="consultation">General Consultation</option>
                <option value="follow_up">Follow-up Visit</option>
                <option value="checkup">Routine Checkup</option>
                <option value="emergency">Emergency / Urgent</option>
                <option value="vaccination">Vaccination</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Reason / Symptoms</label>
              <input type="text" id="ca-reason" class="form-control" placeholder="e.g. Persistent cough, fever for 3 days">
            </div>
          </div>

          <div class="card-footer" style="padding: 12px 0 0; background: transparent;">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-save-appointment">Confirm Booking</button>
          </div>
        </form>
      `, 'modal-md');

      // Trigger time slots if doctor selected
      this.onBookingDoctorOrDateChange();

      document.getElementById('create-appointment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading('#btn-save-appointment', true);

        const payload = {
          patient_id: document.getElementById('ca-patient').value,
          doctor_id: document.getElementById('ca-doctor').value,
          appointment_date: document.getElementById('ca-date').value,
          appointment_time: document.getElementById('ca-time').value,
          type: document.getElementById('ca-type').value,
          reason: document.getElementById('ca-reason').value.trim() || null
        };

        try {
          await API.appointments.create(payload);
          showToast('success', 'Booked', 'Appointment successfully scheduled.');
          closeModal();
          AppointmentsPage.loadList();
        } catch (err) {
          showToast('error', 'Booking Conflict', err.message);
        } finally {
          setLoading('#btn-save-appointment', false);
        }
      });
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  async onBookingDoctorOrDateChange() {
    const docId = document.getElementById('ca-doctor')?.value;
    const date = document.getElementById('ca-date')?.value;
    const timeSelect = document.getElementById('ca-time');
    const hint = document.getElementById('ca-slots-hint');
    if (!timeSelect) return;

    if (!docId || !date) {
      timeSelect.innerHTML = '<option value="">Select doctor & date first</option>';
      return;
    }

    timeSelect.innerHTML = '<option value="">Loading available slots...</option>';

    try {
      const res = await API.doctors.getAvailability(docId, date);
      const slots = res.available_slots || [];

      if (!slots.length) {
        timeSelect.innerHTML = '<option value="">No available slots for this date</option>';
        if (hint) hint.innerHTML = '<span style="color:var(--danger); font-weight:600;"><i class="fas fa-ban"></i> Doctor is fully booked or not working on this date.</span>';
        return;
      }

      timeSelect.innerHTML = `
        <option value="">Select available time...</option>
        ${slots.map(s => `<option value="${s}">${formatTime(s)}</option>`).join('')}
      `;
      if (hint) hint.innerHTML = `<span style="color:var(--success); font-weight:600;"><i class="fas fa-check-circle"></i> ${slots.length} available slots found (Double-booking protected)</span>`;
    } catch (err) {
      // Fallback default slots
      const defaultSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
      timeSelect.innerHTML = `
        <option value="">Select time...</option>
        ${defaultSlots.map(s => `<option value="${s}">${formatTime(s)}</option>`).join('')}
      `;
    }
  },

  async showReschedule(id) {
    try {
      const appt = await API.appointments.get(id);
      openModal('Reschedule Appointment', `
        <form id="reschedule-form">
          <div class="alert alert-info" style="margin-bottom: 16px;">
            <i class="fas fa-info-circle"></i>
            <div>Rescheduling appointment for <strong>${appt.patients?.first_name} ${appt.patients?.last_name}</strong> with <strong>Dr. ${appt.doctors?.profiles?.full_name || ''}</strong></div>
          </div>
          <div class="form-group">
            <label class="form-label">New Appointment Date <span class="required">*</span></label>
            <input type="date" id="resched-date" class="form-control" required min="${today()}" value="${appt.appointment_date}" onchange="AppointmentsPage.onRescheduleDateChange('${appt.doctor_id}')">
          </div>
          <div class="form-group">
            <label class="form-label">New Appointment Time <span class="required">*</span></label>
            <select id="resched-time" class="form-control" required>
              <option value="${appt.appointment_time}">${formatTime(appt.appointment_time)} (Current)</option>
            </select>
          </div>
          <div class="card-footer" style="padding: 12px 0 0; background: transparent;">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-save-resched">Save Reschedule</button>
          </div>
        </form>
      `);

      this.onRescheduleDateChange(appt.doctor_id);

      document.getElementById('reschedule-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading('#btn-save-resched', true);
        try {
          await API.appointments.update(id, {
            appointment_date: document.getElementById('resched-date').value,
            appointment_time: document.getElementById('resched-time').value,
            status: 'scheduled'
          });
          showToast('success', 'Rescheduled', 'Appointment updated successfully.');
          closeModal();
          AppointmentsPage.loadList();
        } catch (err) {
          showToast('error', 'Conflict', err.message);
        } finally {
          setLoading('#btn-save-resched', false);
        }
      });
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  async onRescheduleDateChange(doctorId) {
    const date = document.getElementById('resched-date')?.value;
    const timeSelect = document.getElementById('resched-time');
    if (!timeSelect || !date || !doctorId) return;

    try {
      const res = await API.doctors.getAvailability(doctorId, date);
      const slots = res.available_slots || [];
      timeSelect.innerHTML = slots.map(s => `<option value="${s}">${formatTime(s)}</option>`).join('');
    } catch (err) {
      console.error(err);
    }
  },

  showCancel(id) {
    openModal('Cancel Appointment', `
      <form id="cancel-appt-form">
        <div style="font-size: 14px; color: var(--gray-700); margin-bottom: 16px;">
          Are you sure you want to cancel this appointment? Please state the reason below:
        </div>
        <div class="form-group">
          <label class="form-label">Cancellation Reason <span class="required">*</span></label>
          <textarea id="cancel-reason" class="form-control" required rows="3" placeholder="e.g. Patient requested cancellation, doctor emergency..."></textarea>
        </div>
        <div class="card-footer" style="padding: 12px 0 0; background: transparent;">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Back</button>
          <button type="submit" class="btn btn-danger" id="btn-confirm-cancel">Cancel Appointment</button>
        </div>
      </form>
    `);

    document.getElementById('cancel-appt-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const reason = document.getElementById('cancel-reason').value.trim();
      setLoading('#btn-confirm-cancel', true);
      try {
        await API.appointments.cancel(id, reason);
        showToast('warning', 'Appointment Cancelled', 'The appointment was marked as cancelled.');
        closeModal();
        AppointmentsPage.loadList();
      } catch (err) {
        showToast('error', 'Error', err.message);
      } finally {
        setLoading('#btn-confirm-cancel', false);
      }
    });
  },

  async updateStatus(id, newStatus) {
    try {
      await API.appointments.update(id, { status: newStatus });
      showToast('success', 'Status Updated', `Appointment marked as ${newStatus.replace('_', ' ')}.`);
      AppointmentsPage.loadList();
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  async viewDetails(id) {
    try {
      const a = await API.appointments.get(id);
      const patientName = a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : 'Unknown';
      const docName = a.doctors?.profiles ? a.doctors.profiles.full_name : 'Unknown';

      openModal(`Appointment Details`, `
        <div style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div style="font-size: 18px; font-weight: 800; color: var(--gray-900);">
              ${formatDate(a.appointment_date)} at ${formatTime(a.appointment_time)}
            </div>
            <div>${getStatusBadge(a.status)}</div>
          </div>

          <div class="detail-grid" style="margin-bottom: 20px;">
            <div class="detail-item"><label>Patient</label><p><strong>${patientName}</strong> (${a.patients?.patient_number || '-'})</p></div>
            <div class="detail-item"><label>Doctor</label><p>Dr. <strong>${docName}</strong> (${a.doctors?.specialization || 'General'})</p></div>
            <div class="detail-item"><label>Appointment Type</label><p style="text-transform: capitalize;">${a.type || 'Consultation'}</p></div>
            <div class="detail-item"><label>Contact Phone</label><p>${a.patients?.phone || '-'}</p></div>
            <div class="detail-item" style="grid-column: 1/-1;"><label>Reason for Visit</label><p>${a.reason || 'None specified'}</p></div>
            ${a.cancellation_reason ? `<div class="detail-item" style="grid-column: 1/-1;"><label style="color:var(--danger);">Cancellation Reason</label><p style="color:var(--danger);">${a.cancellation_reason}</p></div>` : ''}
          </div>

          <!-- Quick Actions related to this consultation -->
          <div style="background: var(--gray-50); border: 1px solid var(--gray-100); border-radius: var(--radius); padding: 16px; margin-top: 20px;">
            <div style="font-size: 12px; font-weight: 700; color: var(--gray-600); text-transform: uppercase; margin-bottom: 10px;">Clinical Quick Actions</div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${Auth.hasRole('doctor', 'admin') ? `
                <button class="btn btn-sm btn-primary" onclick="closeModal(); MedicalRecordsPage.showCreate('${a.patient_id}', '${a.id}')">
                  <i class="fas fa-stethoscope"></i> Clinical Notes
                </button>
                <button class="btn btn-sm btn-secondary" onclick="closeModal(); PrescriptionsPage.showCreate('${a.patient_id}', '${a.doctor_id}', '${a.id}')">
                  <i class="fas fa-prescription"></i> Write Rx
                </button>
                <button class="btn btn-sm btn-secondary" onclick="closeModal(); LabTestsPage.showCreate('${a.patient_id}', '${a.doctor_id}')">
                  <i class="fas fa-flask"></i> Request Lab
                </button>
              ` : ''}
              ${Auth.hasRole('nurse', 'admin') ? `
                <button class="btn btn-sm btn-outline" onclick="closeModal(); VitalSignsPage.showCreate('${a.patient_id}', '${a.id}')">
                  <i class="fas fa-heartbeat"></i> Take Vitals
                </button>
              ` : ''}
              ${Auth.hasRole('receptionist', 'admin') ? `
                <button class="btn btn-sm btn-outline" onclick="closeModal(); InvoicesPage.showCreate('${a.patient_id}', '${a.id}')">
                  <i class="fas fa-file-invoice-dollar"></i> Generate Invoice
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `);
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  }
};

window.AppointmentsPage = AppointmentsPage;
