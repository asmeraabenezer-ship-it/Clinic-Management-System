/* ============================================================
   SETTINGS.JS - Clinic System Configuration & Preferences
   ============================================================ */

const SettingsPage = {
  currentSettings: null,

  async load() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-info">
          <h2>System Settings</h2>
          <p>Configure clinic profile, appointment parameters, queue thresholds, and system notifications</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary" onclick="SettingsPage.load()">
            <i class="fas fa-sync-alt"></i> Refresh
          </button>
        </div>
      </div>

      <div id="settings-container">
        <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
      </div>
    `;

    try {
      const settings = await API.settings.get();
      this.currentSettings = settings;
      this.render(settings);
    } catch (err) {
      document.getElementById('settings-container').innerHTML = `
        <div class="card p-4 text-center">
          <i class="fas fa-exclamation-triangle text-danger" style="font-size:36px;margin-bottom:12px;"></i>
          <h3>Failed to load settings</h3>
          <p class="text-muted">${err.message}</p>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="SettingsPage.load()">Retry</button>
        </div>
      `;
    }
  },

  render(s) {
    const container = document.getElementById('settings-container');
    if (!container) return;

    container.innerHTML = `
      <form id="clinic-settings-form">
        <div class="grid-2" style="gap:24px;margin-bottom:24px;">
          <!-- Clinic Profile -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><i class="fas fa-hospital-alt"></i> Clinic Profile</h3>
            </div>
            <div class="card-body">
              <div class="form-group">
                <label class="form-label">Clinic Name <span class="required">*</span></label>
                <input type="text" id="set-clinic-name" class="form-control" value="${s.clinic_name || 'ClinicCare Pro'}" required>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Clinic Phone</label>
                  <input type="text" id="set-clinic-phone" class="form-control" value="${s.clinic_phone || '+1-555-0100'}">
                </div>
                <div class="form-group">
                  <label class="form-label">Clinic Email</label>
                  <input type="email" id="set-clinic-email" class="form-control" value="${s.clinic_email || 'contact@cliniccare.com'}">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Clinic Address</label>
                <input type="text" id="set-clinic-address" class="form-control" value="${s.clinic_address || '123 Medical Center Blvd, Suite 400'}">
              </div>
              <div class="form-group">
                <label class="form-label">Logo URL</label>
                <input type="text" id="set-clinic-logo" class="form-control" placeholder="https://..." value="${s.clinic_logo || ''}">
              </div>
            </div>
          </div>

          <!-- Clinical & Operational Defaults -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><i class="fas fa-sliders-h"></i> Operational Defaults</h3>
            </div>
            <div class="card-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Default Consultation Fee ($) <span class="required">*</span></label>
                  <input type="number" id="set-consultation-fee" class="form-control" step="0.01" min="0" value="${s.consultation_fee ?? 50.00}" required>
                  <small style="color:var(--gray-500);font-size:11px;">Default base fee for patient invoices</small>
                </div>
                <div class="form-group">
                  <label class="form-label">Appointment Slot Duration (Minutes)</label>
                  <input type="number" id="set-slot-duration" class="form-control" min="5" max="180" value="${s.appointment_slot_duration ?? 30}">
                  <small style="color:var(--gray-500);font-size:11px;">Default length per booking slot</small>
                </div>
              </div>

              <div class="form-group" style="margin-top:12px;">
                <label class="form-label">Queue Waiting Alert Threshold (Minutes) <span class="required">*</span></label>
                <input type="number" id="set-queue-threshold" class="form-control" min="5" max="300" value="${s.queue_threshold_minutes ?? 30}" required>
                <small style="color:var(--gray-500);font-size:11px;">Visits exceeding this wait time are flagged in amber/red on the live queue</small>
              </div>
            </div>
          </div>
        </div>

        <!-- Notification Preferences -->
        <div class="card" style="margin-bottom:24px;">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-bell"></i> Notification Preferences</h3>
          </div>
          <div class="card-body">
            <div style="display:flex;flex-direction:column;gap:14px;">
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                <input type="checkbox" id="set-notif-appts" ${s.notification_preferences?.appointment_alerts !== false ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary);">
                <div>
                  <strong>Appointment Reminders & Cancellations</strong>
                  <div style="font-size:12px;color:var(--gray-500);">Notify staff on booking, reschedule, or patient cancellation</div>
                </div>
              </label>

              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                <input type="checkbox" id="set-notif-stock" ${s.notification_preferences?.low_stock_alerts !== false ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary);">
                <div>
                  <strong>Pharmacy Low-Stock Alerts</strong>
                  <div style="font-size:12px;color:var(--gray-500);">Alert pharmacists and administrators when medicines fall below minimum stock</div>
                </div>
              </label>

              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                <input type="checkbox" id="set-notif-lab" ${s.notification_preferences?.urgent_lab_alerts !== false ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary);">
                <div>
                  <strong>Urgent Laboratory Test Broadcasts</strong>
                  <div style="font-size:12px;color:var(--gray-500);">High-priority alerts for STAT diagnostic and pathology requests</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:12px;">
          <button type="submit" class="btn btn-primary" id="save-settings-btn" style="min-width:160px;">
            <i class="fas fa-save"></i> Save Settings
          </button>
        </div>
      </form>
    `;

    document.getElementById('clinic-settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.save();
    });
  },

  async save() {
    const btn = document.getElementById('save-settings-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
      const payload = {
        clinic_name: document.getElementById('set-clinic-name').value.trim(),
        clinic_phone: document.getElementById('set-clinic-phone').value.trim(),
        clinic_email: document.getElementById('set-clinic-email').value.trim(),
        clinic_address: document.getElementById('set-clinic-address').value.trim(),
        clinic_logo: document.getElementById('set-clinic-logo').value.trim(),
        consultation_fee: parseFloat(document.getElementById('set-consultation-fee').value) || 0,
        appointment_slot_duration: parseInt(document.getElementById('set-slot-duration').value) || 30,
        queue_threshold_minutes: parseInt(document.getElementById('set-queue-threshold').value) || 30,
        notification_preferences: {
          appointment_alerts: document.getElementById('set-notif-appts').checked,
          low_stock_alerts: document.getElementById('set-notif-stock').checked,
          urgent_lab_alerts: document.getElementById('set-notif-lab').checked
        }
      };

      const updated = await API.settings.update(payload);
      this.currentSettings = updated;
      showToast('success', 'Settings Saved', 'Clinic system configuration updated successfully.');
    } catch (err) {
      showToast('error', 'Update Failed', err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Save Settings';
      }
    }
  }
};

window.SettingsPage = SettingsPage;
