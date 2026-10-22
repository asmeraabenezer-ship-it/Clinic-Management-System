/* ============================================================
   APP.JS - Main Application Bootstrap & Entry Point
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  Auth.init();

  if (Auth.isAuthenticated()) {
    // Validate session in background
    const valid = await Auth.verifyAndRefresh();
    if (valid) {
      showApp();
    } else {
      showLogin();
    }
  } else {
    showLogin();
  }
});

function showLogin() {
  const authScreen = document.getElementById('auth-screen') || document.getElementById('login-page');
  const app = document.getElementById('app') || document.getElementById('app-shell');
  if (authScreen) authScreen.style.display = 'flex';
  if (app) app.style.display = 'none';
}

function showApp() {
  const authScreen = document.getElementById('auth-screen') || document.getElementById('login-page');
  const app = document.getElementById('app') || document.getElementById('app-shell');
  if (authScreen) authScreen.style.display = 'none';
  if (app) app.style.display = 'flex';

  const user = Auth.getUser();

  // Populate User Info in Topbar and Sidebar
  const userNameEl = document.getElementById('topbar-user-name') || document.getElementById('topbar-name');
  const userRoleEl = document.getElementById('topbar-user-role');
  const userAvatarEl = document.getElementById('topbar-user-avatar') || document.getElementById('topbar-avatar');

  const sidebarNameEl = document.getElementById('sidebar-name');
  const sidebarRoleEl = document.getElementById('sidebar-role');
  const sidebarAvatarEl = document.getElementById('sidebar-avatar');

  const fullName = user?.full_name || 'Staff User';
  const roleCapitalized = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Staff';
  const initials = getInitials(fullName);

  if (userNameEl) userNameEl.textContent = fullName;
  if (userRoleEl) userRoleEl.textContent = roleCapitalized;
  if (userAvatarEl) userAvatarEl.textContent = initials;

  if (sidebarNameEl) sidebarNameEl.textContent = fullName;
  if (sidebarRoleEl) sidebarRoleEl.textContent = roleCapitalized;
  if (sidebarAvatarEl) sidebarAvatarEl.textContent = initials;

  // Construct Role-based Navigation
  buildNav();

  // Start Background Notifications
  Notifications.init();

  // Load Initial Page (Restore active route on page refresh)
  const hashPage = window.location.hash ? window.location.hash.replace('#', '').trim() : null;
  const savedPage = localStorage.getItem('clinic_current_page');
  const initialPage = hashPage || savedPage || 'dashboard';
  showPage(initialPage);
}

// Handle browser Back / Forward and URL Hash changes
window.addEventListener('hashchange', () => {
  const hash = window.location.hash ? window.location.hash.replace('#', '').trim() : '';
  if (hash && typeof showPage === 'function') {
    showPage(hash);
  }
});
