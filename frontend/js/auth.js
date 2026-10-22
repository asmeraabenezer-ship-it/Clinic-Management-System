/* ============================================================
   AUTH.JS - Authentication Logic
   ============================================================ */

const Auth = {
  user: null,
  token: null,

  init() {
    this.token = localStorage.getItem('clinic_token');
    const userStr = localStorage.getItem('clinic_user');
    if (userStr) {
      try { this.user = JSON.parse(userStr); } catch(e) {}
    }
    this.checkAssumedBanner();
  },

  isAuthenticated() {
    return !!(this.token && this.user);
  },

  getUser() {
    return this.user;
  },

  getRole() {
    return this.user?.role || '';
  },

  hasRole(...roles) {
    return roles.includes(this.getRole());
  },

  isAssumed() {
    return sessionStorage.getItem('clinic_is_assumed') === 'true';
  },

  setSession(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('clinic_token', token);
    localStorage.setItem('clinic_user', JSON.stringify(user));
  },

  clearSession() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('clinic_token');
    localStorage.removeItem('clinic_user');
    sessionStorage.removeItem('clinic_assumed_original');
    sessionStorage.removeItem('clinic_is_assumed');
  },

  async login(email, password) {
    const data = await API.auth.login(email, password);
    this.setSession(data.token, data.user);
    return data.user;
  },

  async logout() {
    try { await API.auth.logout(); } catch(e) {}
    this.clearSession();
    window.location.reload();
  },

  async assumeUser(targetId, targetName) {
    try {
      if (!sessionStorage.getItem('clinic_assumed_original')) {
        sessionStorage.setItem('clinic_assumed_original', JSON.stringify({
          token: this.token,
          user: this.user
        }));
      }
      const data = await API.auth.assumeUser(targetId);
      this.setSession(data.token, data.user);
      sessionStorage.setItem('clinic_is_assumed', 'true');
      showToast('success', 'Assumed Role', `Operating as ${data.user.full_name} (${data.user.role})`);
      this.checkAssumedBanner();
      window.location.reload();
    } catch (err) {
      showToast('error', 'Assume Failed', err.message);
    }
  },

  revertAdmin() {
    const original = sessionStorage.getItem('clinic_assumed_original');
    if (original) {
      try {
        const { token, user } = JSON.parse(original);
        this.setSession(token, user);
        sessionStorage.removeItem('clinic_assumed_original');
        sessionStorage.removeItem('clinic_is_assumed');
        showToast('info', 'Admin Restored', 'Returned to System Administrator session.');
        window.location.reload();
      } catch (e) {
        sessionStorage.removeItem('clinic_assumed_original');
        sessionStorage.removeItem('clinic_is_assumed');
        window.location.reload();
      }
    }
  },

  checkAssumedBanner() {
    const banner = document.getElementById('assumed-session-banner');
    if (!banner) return;
    const isAssumed = sessionStorage.getItem('clinic_is_assumed') === 'true';
    if (isAssumed && this.user) {
      banner.style.display = 'flex';
      const nameEl = document.getElementById('assumed-user-name');
      const roleEl = document.getElementById('assumed-user-role');
      if (nameEl) nameEl.textContent = this.user.full_name;
      if (roleEl) roleEl.textContent = this.user.role;
    } else {
      banner.style.display = 'none';
    }
  },

  async verifyAndRefresh() {
    if (!this.token) return false;
    try {
      const user = await API.auth.me();
      this.user = user;
      localStorage.setItem('clinic_user', JSON.stringify(user));
      this.checkAssumedBanner();
      return true;
    } catch(e) {
      this.clearSession();
      return false;
    }
  }
};

// Login form handler
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  const btnText = btn.querySelector('.btn-text');
  const btnSpinner = btn.querySelector('.btn-spinner');

  errorEl.style.display = 'none';
  btn.disabled = true;
  btnText.style.display = 'none';
  btnSpinner.style.display = '';

  try {
    await Auth.login(email, password);
    showApp();
  } catch(err) {
    errorEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message}`;
    errorEl.style.display = 'flex';
  } finally {
    btn.disabled = false;
    btnText.style.display = '';
    btnSpinner.style.display = 'none';
  }
});

// Change password modal
function showChangePassword() {
  closeDropdowns();
  openModal('Change Password', `
    <form id="change-pwd-form">
      <div class="form-group">
        <label class="form-label">New Password <span class="required">*</span></label>
        <div class="input-wrapper">
          <input type="password" id="new-password" class="form-control" placeholder="At least 6 characters" required>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Confirm Password <span class="required">*</span></label>
        <div class="input-wrapper">
          <input type="password" id="confirm-password" class="form-control" placeholder="Repeat new password" required>
        </div>
      </div>
      <div class="card-footer">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Change Password</button>
      </div>
    </form>
  `);

  document.getElementById('change-pwd-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPwd = document.getElementById('new-password').value;
    const confirmPwd = document.getElementById('confirm-password').value;

    if (newPwd !== confirmPwd) {
      showToast('error', 'Error', 'Passwords do not match');
      return;
    }
    if (newPwd.length < 6) {
      showToast('error', 'Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      await API.auth.changePassword(newPwd);
      showToast('success', 'Success', 'Password changed successfully');
      closeModal();
    } catch(err) {
      showToast('error', 'Error', err.message);
    }
  });
}

function logout() {
  confirmAction('Are you sure you want to sign out?', () => Auth.logout(), 'Sign Out');
}

window.Auth = Auth;
window.logout = logout;
window.showChangePassword = showChangePassword;
