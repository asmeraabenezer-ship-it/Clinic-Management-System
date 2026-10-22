/* ============================================================
   DOCTORS.JS - Doctor Profiles, Specializations & Weekly Schedules
   Admin Controls: Full CRUD (Add, Edit, Remove, Toggle) & Assume Role
   ============================================================ */

const DoctorsPage = {
  async load() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>Medical Staff & Doctors</h2>
          <p>Manage clinic doctors, clinical specializations, weekly working schedules, and role administration</p>
        </div>
        <div class="page-header-actions">
          ${Auth.hasRole('admin') ? `
            <button class="btn btn-primary" onclick="DoctorsPage.showCreate()">
              <i class="fas fa-user-plus"></i> Add Doctor
            </button>
          ` : ''}
        </div>
      </div>

      <div class="search-filter-bar">
        <div class="search-input-wrapper">
          <i class="fas fa-search"></i>
          <input type="text" id="doctors-search" placeholder="Search doctor by name, specialty, or license..." oninput="DoctorsPage.onSearch(this.value)">
        </div>
        <button class="btn btn-secondary" onclick="DoctorsPage.loadList()"><i class="fas fa-sync-alt"></i> Refresh</button>
      </div>

      <div id="doctors-grid-container">
        <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
      </div>
    `;

    await this.loadList();
  },

  onSearch: debounce(function(val) {
    DoctorsPage.loadList(val.trim());
  }, 300),

  async loadList(query = '') {
    const container = document.getElementById('doctors-grid-container');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
      const res = await API.doctors.list({ search: query });
      const doctors = res.data || res.doctors || [];

      if (!doctors.length) {
        showEmptyState(
          'doctors-grid-container',
          'fas fa-user-md',
          'No Doctors Found',
          query ? `No doctors matching "${query}"` : 'Add your first clinic physician.',
          Auth.hasRole('admin') ? `<button class="btn btn-primary" onclick="DoctorsPage.showCreate()"><i class="fas fa-user-plus"></i> Add Doctor</button>` : ''
        );
        return;
      }

      container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px;">
          ${doctors.map(d => {
            const name = d.profiles ? d.profiles.full_name : d.full_name || 'Dr.';
            const email = d.profiles ? d.profiles.email : d.email || '';
            const phone = d.profiles ? d.profiles.phone : d.phone || '';
            const isAvail = d.is_available !== false;
            return `
              <div class="card" style="display: flex; flex-direction: column; position: relative;">
                <div class="card-body" style="flex: 1;">
                  <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px;">
                    <div class="avatar avatar-lg">${getInitials(name)}</div>
                    <div style="flex: 1;">
                      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                        <h3 style="font-size: 16px; font-weight: 700; margin: 0; color: var(--gray-900);">${name.startsWith('Dr.') ? name : 'Dr. ' + name}</h3>
                        <span class="status-badge ${isAvail ? 'badge-completed' : 'badge-cancelled'}" style="font-size: 11px;">
                          ${isAvail ? 'Available' : 'Off-Duty'}
                        </span>
                      </div>
                      <span class="role-badge role-doctor" style="margin-bottom: 6px;">${d.specialization}</span>
                      <div style="font-size: 12px; color: var(--gray-500); display: flex; gap: 12px;">
                        <span><i class="fas fa-id-badge"></i> ${d.doctor_number || d.id}</span>
                        <span><i class="fas fa-certificate"></i> ${d.license_number || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div class="detail-grid" style="font-size: 13px; margin-bottom: 16px;">
                    <div class="detail-item"><label>Fee</label><p style="color:var(--success-dark); font-weight:700;">${formatCurrency(d.consultation_fee)}</p></div>
                    <div class="detail-item"><label>Room</label><p>${d.room_number || 'Not assigned'}</p></div>
                    <div class="detail-item"><label>Phone</label><p>${phone || '-'}</p></div>
                    <div class="detail-item"><label>Email</label><p style="word-break: break-all;">${email || '-'}</p></div>
                  </div>

                  ${d.bio ? `<p style="font-size: 12px; color: var(--gray-600); margin: 0; line-height: 1.4; border-top: 1px solid var(--gray-100); padding-top: 10px;">${d.bio}</p>` : ''}
                </div>

                <div class="card-footer" style="display: flex; flex-direction: column; gap: 8px; background: var(--gray-50);">
                  <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <button class="btn btn-sm btn-outline" onclick="DoctorsPage.viewSchedule('${d.id}', '${name.replace(/'/g, "\\'")}')">
                      <i class="fas fa-clock"></i> Schedule
                    </button>
                    <div style="display: flex; gap: 6px;">
                      <button class="btn btn-sm btn-primary" onclick="AppointmentsPage.showCreate(null)">
                        <i class="fas fa-calendar-plus"></i> Book
                      </button>
                      ${Auth.hasRole('admin') ? `
                        <button class="btn btn-sm btn-secondary" title="Edit Doctor" onclick="DoctorsPage.showEdit('${d.id}')">
                          <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" title="Remove Doctor" onclick="DoctorsPage.confirmDelete('${d.id}', '${name.replace(/'/g, "\\'")}')">
                          <i class="fas fa-trash-alt"></i>
                        </button>
                      ` : ''}
                    </div>
                  </div>

                  ${Auth.hasRole('admin') ? `
                    <div style="border-top: 1px dashed var(--gray-200); padding-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                      <button class="btn btn-xs ${isAvail ? 'btn-secondary' : 'btn-success'}" onclick="DoctorsPage.toggleAvailability('${d.id}', ${isAvail})">
                        <i class="fas ${isAvail ? 'fa-pause' : 'fa-play'}"></i> ${isAvail ? 'Mark Off-Duty' : 'Mark Available'}
                      </button>
                      <button class="btn btn-xs btn-outline" style="color: #b45309; border-color: #f59e0b;" title="Assume Doctor perspective" onclick="Auth.assumeUser('${d.user_id || d.id}', '${name.replace(/'/g, "\\'")}')">
                        <i class="fas fa-user-secret"></i> Assume Doctor
                      </button>
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="p-4 text-center text-danger">${err.message}</div>`;
    }
  },

  async toggleAvailability(id, currentStatus) {
    try {
      await API.doctors.update(id, { is_available: !currentStatus });
      showToast('success', 'Status Updated', `Doctor status set to ${!currentStatus ? 'Available' : 'Off-Duty'}`);
      this.loadList();
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  confirmDelete(id, name) {
    confirmAction(
      `Are you sure you want to remove Dr. ${name} from the medical staff? This will archive their doctor profile.`,
      async () => {
        try {
          await API.doctors.delete(id);
          showToast('success', 'Doctor Removed', `Dr. ${name} has been removed from active staff.`);
          DoctorsPage.loadList();
        } catch (err) {
          showToast('error', 'Removal Failed', err.message);
        }
      },
      'Remove Doctor'
    );
  },

  async showCreate() {
    try {
      openModal('Register Medical Doctor', `
        <form id="create-doctor-form">
          <div style="background: var(--primary-light); padding: 10px 14px; border-radius: 6px; margin-bottom: 16px; font-size: 13px; color: var(--primary-dark);">
            <i class="fas fa-info-circle"></i> This form creates both the Doctor profile and their system login credentials.
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Doctor Full Name <span class="required">*</span></label>
              <input type="text" id="cd-name" class="form-control" required placeholder="e.g. Sarah Smith">
            </div>
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input type="text" id="cd-phone" class="form-control" placeholder="+1-555-0105">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Email Address (Login Username) <span class="required">*</span></label>
              <input type="email" id="cd-email" class="form-control" required placeholder="dr.smith@clinic.com">
            </div>
            <div class="form-group">
              <label class="form-label">Set Login Password <span class="required">*</span></label>
              <div style="position:relative;">
                <input type="password" id="cd-password" class="form-control" required minlength="6" placeholder="Set password (min 6 chars)">
                <button type="button" class="toggle-password" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:var(--gray-500);" onclick="togglePassword('cd-password')">
                  <i class="fas fa-eye"></i>
                </button>
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Specialization <span class="required">*</span></label>
              <input type="text" id="cd-spec" class="form-control" required placeholder="e.g. Cardiology, Pediatrics, General Medicine">
            </div>
            <div class="form-group">
              <label class="form-label">License Number <span class="required">*</span></label>
              <input type="text" id="cd-license" class="form-control" required placeholder="e.g. MED-882910">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Consultation Fee ($) <span class="required">*</span></label>
              <input type="number" id="cd-fee" class="form-control" required min="0" step="0.01" value="75.00">
            </div>
            <div class="form-group">
              <label class="form-label">Consultation Room / Office</label>
              <input type="text" id="cd-room" class="form-control" placeholder="e.g. Suite 204">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Biography & Credentials</label>
            <textarea id="cd-bio" class="form-control" rows="3" placeholder="Brief clinical background, qualifications, board certifications..."></textarea>
          </div>

          <div class="card-footer" style="padding: 12px 0 0; background: transparent;">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-save-doctor">Save & Add Doctor</button>
          </div>
        </form>
      `);

      document.getElementById('create-doctor-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading('#btn-save-doctor', true);

        const fullNameInput = document.getElementById('cd-name').value.trim();
        const fullName = fullNameInput.startsWith('Dr.') ? fullNameInput : `Dr. ${fullNameInput}`;
        const pwd = document.getElementById('cd-password').value;

        if (pwd.length < 6) {
          showToast('error', 'Error', 'Password must be at least 6 characters');
          setLoading('#btn-save-doctor', false);
          return;
        }

        const payload = {
          full_name: fullName,
          email: document.getElementById('cd-email').value.trim(),
          password: pwd,
          phone: document.getElementById('cd-phone').value.trim() || null,
          specialization: document.getElementById('cd-spec').value.trim(),
          license_number: document.getElementById('cd-license').value.trim(),
          consultation_fee: parseFloat(document.getElementById('cd-fee').value),
          room_number: document.getElementById('cd-room').value.trim() || null,
          bio: document.getElementById('cd-bio').value.trim() || null
        };

        try {
          await API.doctors.create(payload);
          showToast('success', 'Doctor Added', 'Physician profile and login credentials created successfully.');
          closeModal();
          DoctorsPage.loadList();
        } catch (err) {
          showToast('error', 'Error', err.message);
        } finally {
          setLoading('#btn-save-doctor', false);
        }
      });
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  async showEdit(id) {
    try {
      const d = await API.doctors.get(id);
      const name = d.profiles?.full_name || d.full_name || '';
      const email = d.profiles?.email || d.email || '';
      const phone = d.profiles?.phone || d.phone || '';

      openModal('Edit Doctor Profile', `
        <form id="edit-doctor-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Full Name <span class="required">*</span></label>
              <input type="text" id="ed-name" class="form-control" value="${name}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Specialization <span class="required">*</span></label>
              <input type="text" id="ed-spec" class="form-control" value="${d.specialization || ''}" required>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" id="ed-email" class="form-control" value="${email}">
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input type="text" id="ed-phone" class="form-control" value="${phone}">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Reset Password</label>
              <div style="position:relative;">
                <input type="password" id="ed-password" class="form-control" placeholder="Leave empty to keep current password" minlength="6">
                <button type="button" class="toggle-password" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:var(--gray-500);" onclick="togglePassword('ed-password')">
                  <i class="fas fa-eye"></i>
                </button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Duty Status</label>
              <select id="ed-status" class="form-control">
                <option value="true" ${d.is_available !== false ? 'selected' : ''}>Available / On-Duty</option>
                <option value="false" ${d.is_available === false ? 'selected' : ''}>Off-Duty</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">License Number <span class="required">*</span></label>
              <input type="text" id="ed-license" class="form-control" value="${d.license_number || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Consultation Fee ($) <span class="required">*</span></label>
              <input type="number" id="ed-fee" class="form-control" value="${d.consultation_fee || 50}" required min="0" step="0.01">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Room Number</label>
            <input type="text" id="ed-room" class="form-control" value="${d.room_number || ''}">
          </div>

          <div class="form-group">
            <label class="form-label">Biography</label>
            <textarea id="ed-bio" class="form-control" rows="3">${d.bio || ''}</textarea>
          </div>

          <div class="card-footer" style="padding: 12px 0 0; background: transparent;">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-update-doctor">Save Changes</button>
          </div>
        </form>
      `);

      document.getElementById('edit-doctor-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading('#btn-update-doctor', true);
        try {
          const updatePayload = {
            full_name: document.getElementById('ed-name').value.trim(),
            email: document.getElementById('ed-email').value.trim(),
            phone: document.getElementById('ed-phone').value.trim(),
            specialization: document.getElementById('ed-spec').value.trim(),
            license_number: document.getElementById('ed-license').value.trim(),
            consultation_fee: parseFloat(document.getElementById('ed-fee').value),
            room_number: document.getElementById('ed-room').value.trim() || null,
            is_available: document.getElementById('ed-status').value === 'true',
            bio: document.getElementById('ed-bio').value.trim() || null
          };
          const newPwd = document.getElementById('ed-password').value;
          if (newPwd) {
            updatePayload.password = newPwd;
          }
          await API.doctors.update(id, updatePayload);
          showToast('success', 'Updated', 'Doctor information saved.');
          closeModal();
          DoctorsPage.loadList();
        } catch (err) {
          showToast('error', 'Update Error', err.message);
        } finally {
          setLoading('#btn-update-doctor', false);
        }
      });
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  },

  async viewSchedule(doctorId, doctorName) {
    try {
      const res = await API.doctors.getSchedule(doctorId);
      const schedule = res.schedule || res.data || [];
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

      openModal(`Weekly Schedule: Dr. ${doctorName}`, `
        <div style="margin-bottom: 16px;">
          <p style="font-size: 13px; color: var(--gray-600);">Define operational working hours and consultation appointment slot durations.</p>
        </div>

        <form id="schedule-form">
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Available</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Slot (mins)</th>
                </tr>
              </thead>
              <tbody>
                ${days.map(day => {
                  const s = schedule.find(x => x.day_of_week?.toLowerCase() === day.toLowerCase()) || {};
                  const isAvailable = s.is_available !== false;
                  return `
                    <tr>
                      <td><strong>${day}</strong></td>
                      <td>
                        <input type="checkbox" id="sch-avail-${day}" ${isAvailable ? 'checked' : ''} style="width:18px;height:18px;">
                      </td>
                      <td>
                        <input type="time" id="sch-start-${day}" class="form-control" style="width:120px;" value="${s.start_time || '09:00'}">
                      </td>
                      <td>
                        <input type="time" id="sch-end-${day}" class="form-control" style="width:120px;" value="${s.end_time || '17:00'}">
                      </td>
                      <td>
                        <input type="number" id="sch-dur-${day}" class="form-control" style="width:80px;" value="${s.slot_duration_minutes || 30}" min="10" step="5">
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div class="card-footer" style="padding: 16px 0 0; background: transparent;">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>
            <button type="submit" class="btn btn-primary" id="btn-save-schedule">Save Weekly Schedule</button>
          </div>
        </form>
      `, 'modal-lg');

      document.getElementById('schedule-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading('#btn-save-schedule', true);

        const slots = days.map(day => ({
          day_of_week: day.toLowerCase(),
          is_available: document.getElementById(`sch-avail-${day}`).checked,
          start_time: document.getElementById(`sch-start-${day}`).value,
          end_time: document.getElementById(`sch-end-${day}`).value,
          slot_duration_minutes: parseInt(document.getElementById(`sch-dur-${day}`).value) || 30
        }));

        try {
          await API.doctors.setSchedule(doctorId, { schedule: slots });
          showToast('success', 'Schedule Saved', 'Working hours updated.');
          closeModal();
        } catch (err) {
          showToast('error', 'Error', err.message);
        } finally {
          setLoading('#btn-save-schedule', false);
        }
      });
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  }
};

window.DoctorsPage = DoctorsPage;
