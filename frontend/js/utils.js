/* ============================================================
   UTILS.JS - Utility Functions
   ============================================================ */

// Toast notification system
let toastCount = 0;
function showToast(type, title, message, duration = 4000) {
  const container = document.getElementById('toast-container');
  const id = `toast-${++toastCount}`;

  const icons = { success: 'fa-check', error: 'fa-times', warning: 'fa-exclamation', info: 'fa-info' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.id = id;
  toast.innerHTML = `
    <div class="toast-icon"><i class="fas ${icons[type] || 'fa-info'}"></i></div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close" onclick="removeToast('${id}')"><i class="fas fa-times"></i></button>
  `;

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => removeToast(id), duration);
  }

  return id;
}

function removeToast(id) {
  const toast = document.getElementById(id);
  if (toast) {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }
}

// Modal system
function openModal(title, content, size = '') {
  const overlay = document.getElementById('modal-overlay');
  const container = document.getElementById('modal-container');
  const titleEl = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  titleEl.textContent = title;
  body.innerHTML = content;
  container.className = `modal ${size}`;
  overlay.style.display = 'flex';

  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

function closeModalAndRefresh(refreshFn) {
  closeModal();
  if (typeof refreshFn === 'function') refreshFn();
}

// Confirm dialog
function confirmAction(message, onConfirm, title = 'Confirm Action') {
  openModal(title, `
    <div style="text-align:center;padding:10px 0;">
      <div style="font-size:48px;color:var(--warning);margin-bottom:16px;"><i class="fas fa-exclamation-triangle"></i></div>
      <p style="font-size:16px;color:var(--gray-700);margin-bottom:24px;">${message}</p>
      <div style="display:flex;gap:12px;justify-content:center;">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" id="confirm-action-btn">Yes, Proceed</button>
      </div>
    </div>
  `);

  document.getElementById('confirm-action-btn').onclick = () => {
    closeModal();
    onConfirm();
  };
}

// Format functions
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatTime(timeStr) {
  if (!timeStr) return '-';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
}

function formatAge(dob) {
  if (!dob) return '-';
  const today = new Date();
  const birth = new Date(dob);
  const age = Math.floor((today - birth) / (365.25 * 24 * 60 * 60 * 1000));
  return `${age} years`;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

function getStatusBadge(status) {
  const labels = {
    scheduled: 'Scheduled', confirmed: 'Confirmed', in_progress: 'In Progress',
    completed: 'Completed', cancelled: 'Cancelled', no_show: 'No Show',
    unpaid: 'Unpaid', partial: 'Partial', paid: 'Paid', refunded: 'Refunded',
    requested: 'Requested', sample_collected: 'Sample Collected', processing: 'Processing',
    pending: 'Pending', dispensed: 'Dispensed', partially_dispensed: 'Partial',
    routine: 'Routine', urgent: 'Urgent', stat: 'STAT'
  };
  return `<span class="status-badge badge-${status}">${labels[status] || status}</span>`;
}

function getRoleBadge(role) {
  return `<span class="role-badge role-${role}">${role.charAt(0).toUpperCase() + role.slice(1)}</span>`;
}

function getStockLevel(quantity, minimum) {
  const pct = minimum > 0 ? (quantity / minimum) * 100 : 100;
  const cls = pct <= 50 ? 'low' : pct <= 100 ? 'medium' : 'good';
  const barPct = Math.min(100, pct);
  return `
    <div class="stock-level">
      <div class="stock-bar-container">
        <div class="stock-bar-fill ${cls}" style="width:${barPct}%;"></div>
      </div>
      <span class="stock-number ${cls}">${quantity}</span>
    </div>
  `;
}

// Pagination renderer
function renderPagination(containerId, pagination, onPage) {
  const container = document.getElementById(containerId);
  if (!container || !pagination) return;

  const { page, pages, total, limit } = pagination;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  if (total === 0) {
    container.innerHTML = '';
    return;
  }

  let pageButtons = '';
  const maxButtons = 5;
  let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
  let endPage = Math.min(pages, startPage + maxButtons - 1);
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pageButtons += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="${onPage}(${i})" ${i === page ? 'disabled' : ''}>${i}</button>`;
  }

  container.innerHTML = `
    <div class="pagination">
      <div class="pagination-info">Showing ${start}–${end} of ${total} records</div>
      <div class="pagination-controls">
        <button class="page-btn" onclick="${onPage}(1)" ${page === 1 ? 'disabled' : ''}><i class="fas fa-angle-double-left"></i></button>
        <button class="page-btn" onclick="${onPage}(${page - 1})" ${page === 1 ? 'disabled' : ''}><i class="fas fa-angle-left"></i></button>
        ${pageButtons}
        <button class="page-btn" onclick="${onPage}(${page + 1})" ${page === pages ? 'disabled' : ''}><i class="fas fa-angle-right"></i></button>
        <button class="page-btn" onclick="${onPage}(${pages})" ${page === pages ? 'disabled' : ''}><i class="fas fa-angle-double-right"></i></button>
      </div>
    </div>
  `;
}

// Loading state helpers
function setLoading(selector, loading) {
  const btn = document.querySelector(selector);
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  btn.disabled = loading;
  if (text) text.style.display = loading ? 'none' : '';
  if (spinner) spinner.style.display = loading ? '' : 'none';
}

function showLoading(containerId, message = 'Loading...') {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;
}

function showEmptyState(containerId, icon, title, subtitle, action = '') {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `
    <div class="empty-state">
      <i class="${icon}"></i>
      <h3>${title}</h3>
      <p>${subtitle}</p>
      ${action}
    </div>
  `;
}

// Toggle password visibility
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  const btn = input?.nextElementSibling || input?.parentElement.querySelector('.toggle-password');
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
    if (btn) {
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = `fas ${input.type === 'password' ? 'fa-eye' : 'fa-eye-slash'}`;
      }
    }
  }
}

// Fill demo credentials
function fillDemo(email, password) {
  document.getElementById('login-email').value = email;
  document.getElementById('login-password').value = password;
}

// Print
function printContent(html) {
  const frame = document.getElementById('print-frame');
  const doc = frame.contentDocument || frame.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>ClinicCare Pro - Print</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Times New Roman', serif; padding: 20px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>${html}</body>
    </html>
  `);
  doc.close();
  frame.contentWindow.print();
}

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.notification-btn-wrapper')) {
    const dd = document.getElementById('notifications-dropdown');
    if (dd) dd.style.display = 'none';
  }
  if (!e.target.closest('.user-menu-wrapper')) {
    const dd = document.getElementById('user-dropdown');
    if (dd) dd.style.display = 'none';
  }
});

// Debounce
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Generate local IDs
function generateTempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Date helpers
function today() {
  return new Date().toISOString().split('T')[0];
}

function formatDateForInput(dateStr) {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
}

// Number format
function formatNumber(n) {
  return new Intl.NumberFormat('en-US').format(n || 0);
}

window.openModal = openModal;
window.closeModal = closeModal;
window.confirmAction = confirmAction;
window.showToast = showToast;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.formatTime = formatTime;
window.formatCurrency = formatCurrency;
window.formatAge = formatAge;
window.getInitials = getInitials;
window.timeAgo = timeAgo;
window.getStatusBadge = getStatusBadge;
window.getRoleBadge = getRoleBadge;
window.getStockLevel = getStockLevel;
window.renderPagination = renderPagination;
window.setLoading = setLoading;
window.showLoading = showLoading;
window.showEmptyState = showEmptyState;
window.togglePassword = togglePassword;
window.fillDemo = fillDemo;
window.printContent = printContent;
window.debounce = debounce;
window.generateTempId = generateTempId;
window.today = today;
window.formatDateForInput = formatDateForInput;
window.formatNumber = formatNumber;
