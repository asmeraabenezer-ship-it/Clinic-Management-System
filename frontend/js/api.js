/* ============================================================
   API.JS - Centralized API Client
   ============================================================ */

const API = (() => {
  const BASE_URL = (window.location.port !== '3000' && window.location.port !== '') || window.location.protocol === 'file:'
    ? 'http://localhost:3000/api'
    : '/api';

  const getHeaders = () => {
    const token = localStorage.getItem('clinic_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  const handleResponse = async (response) => {
    const contentType = response.headers.get('content-type');
    const data = contentType && contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const error = data?.error || data?.message || `HTTP ${response.status}`;
      if (response.status === 401) {
        // Token expired - clear and redirect to login
        localStorage.removeItem('clinic_token');
        localStorage.removeItem('clinic_user');
        window.location.reload();
      }
      throw new Error(error);
    }

    return data;
  };

  const request = async (method, endpoint, body = null, options = {}) => {
    const config = {
      method,
      headers: getHeaders(),
      ...options
    };

    if (body && !(body instanceof FormData)) {
      config.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      // Let browser set Content-Type for FormData
      const headers = { ...config.headers };
      delete headers['Content-Type'];
      config.headers = headers;
      config.body = body;
    }

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, config);
      return await handleResponse(response);
    } catch (err) {
      if (err.message !== 'Failed to fetch') {
        throw err;
      }
      throw new Error('Network error. Please check your connection.');
    }
  };

  return {
    get: (endpoint, params = {}) => {
      const query = Object.keys(params).filter(k => params[k] !== undefined && params[k] !== '').map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
      return request('GET', query ? `${endpoint}?${query}` : endpoint);
    },
    post: (endpoint, body) => request('POST', endpoint, body),
    put: (endpoint, body) => request('PUT', endpoint, body),
    delete: (endpoint) => request('DELETE', endpoint),
    upload: (endpoint, formData) => request('POST', endpoint, formData),

    // Auth
    auth: {
      login: (email, password) => request('POST', '/auth/login', { email, password }),
      logout: () => request('POST', '/auth/logout'),
      me: () => request('GET', '/auth/me'),
      refresh: (refresh_token) => request('POST', '/auth/refresh', { refresh_token }),
      createUser: (data) => request('POST', '/auth/create-user', data),
      getUsers: (params = {}) => request('GET', `/auth/users?${new URLSearchParams(params)}`),
      updateUser: (id, data) => request('PUT', `/auth/users/${id}`, data),
      deleteUser: (id) => request('DELETE', `/auth/users/${id}`),
      assumeUser: (id) => request('POST', `/auth/assume/${id}`),
      changePassword: (new_password) => request('PUT', '/auth/change-password', { new_password })
    },

    // Dashboard
    dashboard: {
      stats: () => request('GET', '/dashboard/stats'),
      analytics: (params = {}) => request('GET', `/dashboard/admin-analytics?${new URLSearchParams(params)}`),
      recentFeeds: () => request('GET', '/dashboard/recent-feeds'),
      recentAppointments: () => request('GET', '/dashboard/recent-appointments'),
      revenueChart: () => request('GET', '/dashboard/revenue-chart'),
      alerts: () => request('GET', '/dashboard/alerts')
    },

    // Patients
    patients: {
      list: (params) => request('GET', `/patients?${new URLSearchParams(params)}`),
      get: (id) => request('GET', `/patients/${id}`),
      create: (data) => request('POST', '/patients', data),
      update: (id, data) => request('PUT', `/patients/${id}`, data),
      delete: (id) => request('DELETE', `/patients/${id}`),
      history: (id) => request('GET', `/patients/${id}/history`)
    },

    // Doctors
    doctors: {
      list: (params = {}) => request('GET', `/doctors?${new URLSearchParams(params)}`),
      get: (id) => request('GET', `/doctors/${id}`),
      create: (data) => request('POST', '/doctors', data),
      update: (id, data) => request('PUT', `/doctors/${id}`, data),
      delete: (id) => request('DELETE', `/doctors/${id}`),
      getSchedule: (id) => request('GET', `/doctors/${id}/schedule`),
      setSchedule: (id, data) => request('POST', `/doctors/${id}/schedule`, data),
      getAvailability: (id, date) => request('GET', `/doctors/${id}/availability?date=${date}`),
      specializations: () => request('GET', '/doctors/meta/specializations')
    },

    // Appointments
    appointments: {
      list: (params = {}) => request('GET', `/appointments?${new URLSearchParams(params)}`),
      get: (id) => request('GET', `/appointments/${id}`),
      create: (data) => request('POST', '/appointments', data),
      update: (id, data) => request('PUT', `/appointments/${id}`, data),
      cancel: (id, reason) => request('POST', `/appointments/${id}/cancel`, { reason }),
      today: () => request('GET', '/appointments/today/list')
    },

    // Medical Records
    medicalRecords: {
      list: (params = {}) => request('GET', `/medical-records?${new URLSearchParams(params)}`),
      get: (id) => request('GET', `/medical-records/${id}`),
      create: (data) => request('POST', '/medical-records', data),
      update: (id, data) => request('PUT', `/medical-records/${id}`, data)
    },

    // Vital Signs
    vitalSigns: {
      list: (params = {}) => request('GET', `/vital-signs?${new URLSearchParams(params)}`),
      create: (data) => request('POST', '/vital-signs', data),
      update: (id, data) => request('PUT', `/vital-signs/${id}`, data)
    },

    // Prescriptions
    prescriptions: {
      list: (params = {}) => request('GET', `/prescriptions?${new URLSearchParams(params)}`),
      get: (id) => request('GET', `/prescriptions/${id}`),
      create: (data) => request('POST', '/prescriptions', data),
      dispense: (id, items) => request('POST', `/prescriptions/${id}/dispense`, { items })
    },

    // Medicines
    medicines: {
      list: (params = {}) => request('GET', `/medicines?${new URLSearchParams(params)}`),
      get: (id) => request('GET', `/medicines/${id}`),
      create: (data) => request('POST', '/medicines', data),
      update: (id, data) => request('PUT', `/medicines/${id}`, data),
      delete: (id) => request('DELETE', `/medicines/${id}`),
      restock: (id, data) => request('POST', `/medicines/${id}/restock`, data),
      adjustStock: (id, data) => request('POST', `/medicines/${id}/adjust-stock`, data),
      movements: (params = {}) => request('GET', `/medicines/movements/history?${new URLSearchParams(params)}`),
      alerts: () => request('GET', '/medicines/alerts'),
      categories: () => request('GET', '/medicines/categories')
    },

    // Lab Tests
    labTests: {
      list: (params = {}) => request('GET', `/lab-tests?${new URLSearchParams(params)}`),
      get: (id) => request('GET', `/lab-tests/${id}`),
      create: (data) => request('POST', '/lab-tests', data),
      update: (id, data) => request('PUT', `/lab-tests/${id}`, data),
      collect: (id) => request('POST', `/lab-tests/${id}/collect`),
      submitResults: (id, data) => request('POST', `/lab-tests/${id}/results`, data)
    },

    // Invoices
    invoices: {
      list: (params = {}) => request('GET', `/invoices?${new URLSearchParams(params)}`),
      get: (id) => request('GET', `/invoices/${id}`),
      create: (data) => request('POST', '/invoices', data),
      update: (id, data) => request('PUT', `/invoices/${id}`, data)
    },

    // Payments
    payments: {
      list: (params = {}) => request('GET', `/payments?${new URLSearchParams(params)}`),
      create: (data) => request('POST', '/payments', data),
      receipt: (id) => request('GET', `/payments/${id}/receipt`)
    },

    // Notifications
    notifications: {
      list: (params = {}) => request('GET', `/notifications?${new URLSearchParams(params)}`),
      markRead: (id) => request('PUT', `/notifications/${id}/read`),
      markAllRead: () => request('PUT', '/notifications/read-all/mark'),
      unreadCount: () => request('GET', '/notifications/unread/count')
    },

    // Files
    files: {
      upload: (formData) => request('POST', '/files/upload', formData),
      getByPatient: (patientId) => request('GET', `/files/patient/${patientId}`),
      getUrl: (id) => request('GET', `/files/${id}/url`),
      delete: (id) => request('DELETE', `/files/${id}`)
    },

    // Reports
    reports: {
      summary: (params = {}) => request('GET', `/reports/summary?${new URLSearchParams(params)}`),
      detailed: (params = {}) => request('GET', `/reports/detailed?${new URLSearchParams(params)}`),
      revenue: (params = {}) => request('GET', `/reports/revenue?${new URLSearchParams(params)}`),
      appointments: (params = {}) => request('GET', `/reports/appointments?${new URLSearchParams(params)}`),
      inventory: () => request('GET', '/reports/inventory')
    },

    // System Settings
    settings: {
      get: () => request('GET', '/settings'),
      update: (data) => request('PUT', '/settings', data)
    },

    // Audit Logs
    auditLogs: {
      list: (params = {}) => request('GET', `/audit-logs?${new URLSearchParams(params)}`)
    },

    // Patient Visits (End-to-End Real-World Workflow)
    visits: {
      list: (params = {}) => request('GET', `/visits?${new URLSearchParams(params)}`),
      get: (id) => request('GET', `/visits/${id}`),
      checkIn: (data) => request('POST', '/visits/check-in', data),
      firstConsultation: (id, data) => request('POST', `/visits/${id}/first-consultation`, data),
      labComplete: (id, data) => request('POST', `/visits/${id}/lab-complete`, data),
      finalConsultation: (id, data) => request('POST', `/visits/${id}/final-consultation`, data),
      pharmacyDispense: (id, data = {}) => request('POST', `/visits/${id}/pharmacy-dispense`, data),
      processPayment: (id, data) => request('POST', `/visits/${id}/process-payment`, data)
    }
  };
})();

window.API = API;
