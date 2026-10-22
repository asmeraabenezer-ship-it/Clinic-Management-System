/* ============================================================
   NOTIFICATIONS.JS - Notifications Management
   ============================================================ */

const Notifications = {
  unreadCount: 0,

  async init() {
    await this.updateUnreadCount();
    // Poll every 30 seconds
    setInterval(() => this.updateUnreadCount(), 30000);
  },

  async updateUnreadCount() {
    if (!Auth.isAuthenticated()) return;
    try {
      const res = await API.notifications.unreadCount();
      this.unreadCount = res.count || 0;
      const badge = document.getElementById('notif-badge') || document.getElementById('notif-count');
      if (badge) {
        if (this.unreadCount > 0) {
          badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
          badge.style.display = 'block';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (err) {
      console.error('Error fetching unread notification count:', err);
    }
  },

  async loadDropdown() {
    const listEl = document.getElementById('notifications-list') || document.getElementById('notif-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
      const res = await API.notifications.list({ limit: 10 });
      const items = res.notifications || res.data || [];
      if (!items.length) {
        listEl.innerHTML = `
          <div class="empty-state" style="padding: 24px 16px;">
            <i class="fas fa-bell-slash" style="font-size: 28px;"></i>
            <h3 style="font-size: 14px;">No notifications</h3>
            <p style="font-size: 12px; margin-bottom: 0;">You're all caught up!</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = items.map(n => `
        <div class="notif-item ${n.is_read ? 'read' : 'unread'}" onclick="Notifications.handleClick('${n.id}', '${n.link || ''}')">
          <div class="notif-icon ${n.type || 'info'}">
            <i class="fas ${this.getIcon(n.type)}"></i>
          </div>
          <div class="notif-body">
            <div class="notif-title">${n.title}</div>
            <div class="notif-text">${n.message}</div>
            <div class="notif-time">${timeAgo(n.created_at)}</div>
          </div>
        </div>
      `).join('');
    } catch (err) {
      listEl.innerHTML = `<div class="p-3 text-center text-danger" style="font-size: 13px;">Failed to load notifications</div>`;
    }
  },

  getIcon(type) {
    switch (type) {
      case 'appointment': return 'fa-calendar-check';
      case 'lab': return 'fa-flask';
      case 'stock': return 'fa-pills';
      case 'payment': return 'fa-credit-card';
      case 'warning': return 'fa-exclamation-triangle';
      default: return 'fa-info-circle';
    }
  },

  async handleClick(id, link) {
    try {
      await API.notifications.markRead(id);
      await this.updateUnreadCount();
      if (link) {
        closeDropdowns();
        showPage(link);
      } else {
        await this.loadDropdown();
      }
    } catch (err) {
      console.error(err);
    }
  },

  async markAllAsRead() {
    try {
      await API.notifications.markAllRead();
      this.unreadCount = 0;
      const badge = document.getElementById('notif-badge') || document.getElementById('notif-count');
      if (badge) badge.style.display = 'none';
      await this.loadDropdown();
      showToast('success', 'Notifications', 'All notifications marked as read');
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  }
};

window.markAllRead = () => Notifications.markAllAsRead();
window.Notifications = Notifications;
