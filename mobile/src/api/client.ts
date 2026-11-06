import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const TOKEN_KEY = '@unitedsoft_auth_token';
const API_URL_KEY = '@unitedsoft_api_url';

// Extract valid IP address from a host string (e.g. "10.227.109.116:8081" or "exp://10.227.109.116:8081")
function extractIp(host?: string | null): string | null {
  if (!host || typeof host !== 'string') return null;
  const clean = host.replace(/^[a-z]+:\/\//, '');
  const ip = clean.split(':')[0].split('/')[0];
  if (
    ip &&
    ip !== 'localhost' &&
    ip !== '127.0.0.1' &&
    !ip.startsWith('169.254.') &&
    !ip.includes('exp.direct') &&
    !ip.includes('ngrok')
  ) {
    return ip;
  }
  return null;
}

export function getDevHostIp(): string | null {
  const candidates = [
    Constants.expoConfig?.hostUri,
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost,
    (Constants as any)?.manifest?.debuggerHost,
    (Constants as any)?.manifest?.hostUri,
    (Constants as any)?.expoGoConfig?.debuggerHost,
    (Constants as any)?.experienceUrl,
    Constants.linkingUri
  ];

  for (const c of candidates) {
    const ip = extractIp(c);
    if (ip) return ip;
  }
  return null;
}

export const CLOUD_API_URL = 'https://unistaff-management-backend-1.onrender.com/api';
export const FALLBACK_CLOUD_API_URL = 'https://unistaff-management-backend.onrender.com/api';
export const LOCAL_API_URL = 'http://10.227.109.116:5000/api';

export function getDefaultApiUrl(): string {
  // Always default to Global Cloud URL so mobile users on ANY network
  // (Cellular 4G/5G, foreign networks, remote home, any Wi-Fi) connect worldwide.
  return CLOUD_API_URL;
}

let currentApiUrl = getDefaultApiUrl();

const memoryStore: Record<string, string> = {};

async function storageGet(key: string): Promise<string | null> {
  try {
    const val = await AsyncStorage.getItem(key);
    return val ?? memoryStore[key] ?? null;
  } catch {
    return memoryStore[key] ?? null;
  }
}

async function storageSet(key: string, val: string): Promise<void> {
  memoryStore[key] = val;
  try {
    await AsyncStorage.setItem(key, val);
  } catch {}
}

async function storageRemove(key: string): Promise<void> {
  delete memoryStore[key];
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

export async function initApiClient() {
  try {
    const savedUrl = await storageGet(API_URL_KEY);
    if (savedUrl) {
      // Auto-migrate mobile devices away from private Wi-Fi IPs, localhost, or outdated hosts
      const isLocalOrOutdated =
        savedUrl.includes('trycloudflare.com') ||
        savedUrl.includes('10.227.') ||
        savedUrl.includes('192.168.') ||
        savedUrl.includes('10.0.2.2') ||
        savedUrl.includes('localhost') ||
        savedUrl.includes('127.0.0.1') ||
        savedUrl.includes('unitedsoft-backend.onrender.com') ||
        savedUrl.includes('unistaff-management-system.onrender.com') ||
        (savedUrl.includes('unistaff-management-backend.onrender.com') && !savedUrl.includes('unistaff-management-backend-1.onrender.com'));

      if (isLocalOrOutdated) {
        currentApiUrl = CLOUD_API_URL;
        await storageSet(API_URL_KEY, CLOUD_API_URL);
      } else {
        currentApiUrl = savedUrl;
      }
    } else {
      currentApiUrl = getDefaultApiUrl();
    }
  } catch (e) {
    currentApiUrl = getDefaultApiUrl();
  }
}

export function getApiBaseUrl() {
  return currentApiUrl;
}

export async function setApiBaseUrl(url: string) {
  currentApiUrl = url;
  await storageSet(API_URL_KEY, url);
}

export async function getToken(): Promise<string | null> {
  return await storageGet(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await storageSet(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  await storageRemove(TOKEN_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${currentApiUrl}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }
    return data as T;
  } catch (err: any) {
    // If primary cloud endpoint encounters network error, try fallback cloud
    if (
      currentApiUrl === CLOUD_API_URL &&
      err.message &&
      err.message.includes('Network request failed')
    ) {
      try {
        console.warn(`[Network] Retrying on backup cloud: ${FALLBACK_CLOUD_API_URL}`);
        const fallbackUrl = `${FALLBACK_CLOUD_API_URL}${endpoint}`;
        const fbRes = await fetch(fallbackUrl, {
          ...options,
          headers
        });
        const fbData = await fbRes.json().catch(() => ({}));
        if (fbRes.ok) {
          return fbData as T;
        }
      } catch (fbErr) {
        // Fall back to original error description
      }
    }

    if (err.message && err.message.includes('Network request failed')) {
      throw new Error(
        `Cannot connect to UnitedSoft Cloud API (${currentApiUrl}). Please ensure you have an active internet connection (4G/5G/Wi-Fi). If the cloud server is waking up, please wait a few seconds and try again.`
      );
    }
    throw err;
  }
}

export const api = {
  // Auth
  login: (credentials: {
    email?: string;
    loginId?: string;
    password: string;
    userType?: 'EMPLOYEE' | 'HR' | string;
    deviceId?: string;
    deviceKey?: string;
    detectedMobileNumbers?: string[];
    verificationCode?: string;
  }) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),

  forgotPassword: (email: string) =>
    request<any>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (payload: { email: string; code: string; newPassword: string }) =>
    request<any>('/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) }),

  getMe: () => request<any>('/auth/me'),

  changePassword: (payload: { currentPassword?: string; newPassword: string }) =>
    request<any>('/auth/change-password', { method: 'POST', body: JSON.stringify(payload) }),

  getDemoAccounts: () => request<any>('/auth/demo-accounts'),

  // Attendance
  checkIn: (payload: {
    latitude: number;
    longitude: number;
    photo?: string;
    verificationMethod?: string;
    remarks?: string;
    bypassGeofence?: boolean;
    wifiSsid?: string;
    networkType?: string;
    ipAddress?: string;
  }) => request<any>('/attendance/check-in', { method: 'POST', body: JSON.stringify(payload) }),

  checkOut: (payload: { latitude?: number; longitude?: number; remarks?: string }) =>
    request<any>('/attendance/check-out', { method: 'POST', body: JSON.stringify(payload) }),

  getTodayStatus: () => request<any>('/attendance/today'),

  getMyHistory: (month?: string) =>
    request<any>(`/attendance/my-history${month ? `?month=${month}` : ''}`),

  getAllAttendance: (params?: { date?: string; month?: string; department?: string; status?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request<any>(`/attendance/all${q ? `?${q}` : ''}`);
  },

  overrideAttendance: (id: string, payload: any) =>
    request<any>(`/attendance/${id}/override`, { method: 'PUT', body: JSON.stringify(payload) }),

  manualAttendanceEntry: (payload: {
    user_id: string;
    date?: string;
    status?: string;
    check_in_time?: string;
    check_out_time?: string;
    working_hours?: number;
    remarks?: string;
  }) =>
    request<any>('/attendance/manual-entry', { method: 'POST', body: JSON.stringify(payload) }),

  // Outside-Shift / External Work Entries
  getColleges: () => request<{ colleges: string[] }>('/outside-shift/colleges'),
  getOutsideColleges: () => request<{ colleges: string[] }>('/outside-shift/colleges'),

  getOutsideShiftEntries: (params?: { department?: string; month?: string; college?: string; userId?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request<{ entries: any[] }>(`/outside-shift/entries${q ? `?${q}` : ''}`);
  },

  createOutsideShiftEntry: (payload: {
    college_name: string;
    department?: string;
    staff_name?: string;
    user_id?: string;
    date?: string;
    start_time?: string;
    end_time?: string;
    working_hours?: number;
    work_description?: string;
    purpose?: string;
    latitude?: number;
    longitude?: number;
    remarks?: string;
  }) => request<any>('/outside-shift/entries', { method: 'POST', body: JSON.stringify(payload) }),

  // Team Leader (TL) Management
  getTeamAttendance: (params?: { month?: string; date?: string; status?: string; employeeId?: string; employee_id?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request<any>(`/tl/attendance${q ? `?${q}` : ''}`);
  },

  getTeamMembers: () => request<{ members: any[] }>('/tl/team-members'),

  getTeamLeaves: (status?: string) =>
    request<any>(`/tl/leaves${status ? `?status=${status}` : ''}`),

  tlActionLeave: (id: string, payload: { action: 'APPROVE' | 'REJECT'; comments?: string; remarks?: string }) =>
    request<any>(`/tl/leaves/${id}/action`, { method: 'PATCH', body: JSON.stringify(payload) }),

  // Leaves
  applyLeave: (payload: {
    leave_type: string;
    start_date: string;
    end_date: string;
    reason: string;
  }) => request<any>('/leaves/apply', { method: 'POST', body: JSON.stringify(payload) }),

  resubmitLeave: (id: string, payload: { start_date?: string; end_date?: string; reason?: string; leave_type?: string }) =>
    request<any>(`/leaves/${id}/resubmit`, { method: 'POST', body: JSON.stringify(payload) }),

  getMyLeaves: () => request<any>('/leaves/my-leaves'),

  getAllLeaves: (params?: string | { status?: string; department?: string }) => {
    if (typeof params === 'string') {
      return request<any>(`/leaves/all${params ? `?status=${params}` : ''}`);
    }
    const q = new URLSearchParams(params as any).toString();
    return request<any>(`/leaves/all${q ? `?${q}` : ''}`);
  },

  updateLeaveStatus: (id: string, payload: { status: 'APPROVED' | 'REJECTED'; comments?: string }) =>
    request<any>(`/leaves/${id}/status`, { method: 'PATCH', body: JSON.stringify(payload) }),

  getLeaveHistoryLogs: (id: string) =>
    request<{ logs: any[] }>(`/leaves/${id}/history`),

  getLeaveHistory: (id: string) =>
    request<{ logs: any[] }>(`/leaves/${id}/history`),

  // Network Settings (Wi-Fi Validation)
  getNetworkSettings: () =>
    request<{ settings: { wifi_validation_enabled: boolean; allowed_wifi_ssids: string; allowed_ip_ranges: string } }>('/settings/network'),

  updateNetworkSettings: (payload: { wifi_validation_enabled?: boolean; allowed_wifi_ssids?: string; allowed_ip_ranges?: string }) =>
    request<any>('/settings/network', { method: 'PUT', body: JSON.stringify(payload) }),

  // Notifications
  getMyNotifications: () => request<{ notifications: any[]; unreadCount: number }>('/notifications'),

  markNotificationRead: (id: string) => request<any>(`/notifications/${id}/read`, { method: 'PATCH' }),

  // Departments & Directory Info
  getDepartments: () => request<{ departments: string[] }>('/departments'),

  getTeamLeaders: () => request<{ teamLeaders: any[]; team_leaders?: any[] }>('/team-leaders'),

  // Payroll
  generatePayroll: (month_year?: string) =>
    request<any>('/payroll/generate', { method: 'POST', body: JSON.stringify({ month_year }) }),

  getPayrollRecords: (month_year?: string) =>
    request<any>(`/payroll/records${month_year ? `?month_year=${month_year}` : ''}`),

  updatePayrollStatus: (id: string, status: string) =>
    request<any>(`/payroll/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  getMySlips: () => request<any>('/payroll/my-slips'),

  getPayslipDetails: (id: string) => request<any>(`/payroll/slips/${id}`),

  getPayslipPdfUrl: (id: string) => `${currentApiUrl}/payroll/slips/${id}/pdf`,

  // Employees
  getEmployees: (params?: string | { search?: string; department?: string; status?: string; role?: string }) => {
    if (typeof params === 'string') {
      return request<{ employees: any[] }>(`/employees${params ? `?search=${encodeURIComponent(params)}` : ''}`);
    }
    const q = new URLSearchParams(params as any).toString();
    return request<{ employees: any[] }>(`/employees${q ? `?${q}` : ''}`);
  },

  getEmployeeById: (id: string) => request<any>(`/employees/${id}`),

  createEmployee: (data: any) =>
    request<any>('/employees', { method: 'POST', body: JSON.stringify(data) }),

  updateEmployee: (id: string, data: any) =>
    request<any>(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteEmployee: (id: string) =>
    request<any>(`/employees/${id}`, { method: 'DELETE' }),

  // Office & Geofence
  getOfficeLocations: () => request<any>('/office/locations'),

  updateOfficeLocation: (id: string, data: any) =>
    request<any>(`/office/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  syncOfficeLocation: (coords: { latitude: number; longitude: number; radius_meters?: number }) =>
    request<any>('/office/sync-current', { method: 'POST', body: JSON.stringify(coords) }),

  // Reports
  getAttendanceReportUrl: (month?: string) =>
    `${currentApiUrl}/reports/attendance?format=csv${month ? `&month=${month}` : ''}`,

  getPayrollReportUrl: (month_year?: string) =>
    `${currentApiUrl}/reports/payroll?format=csv${month_year ? `&month_year=${month_year}` : ''}`,

  // HR Impersonation & Security Verification (Flowchart Section 2, 3, 5, 6)
  hrImpersonate: (payload: { employeeId: string; reason?: string }) =>
    request<any>('/hr/impersonate', { method: 'POST', body: JSON.stringify(payload) }),

  exitHrImpersonation: (payload: { sessionId?: string }) =>
    request<any>('/hr/impersonate/exit', { method: 'POST', body: JSON.stringify(payload) }),

  resetEmployeeDevice: (employeeId: string) =>
    request<any>(`/employees/${employeeId}/reset-device`, { method: 'POST' }),

  generateHrVerificationCode: (employeeId: string) =>
    request<any>(`/employees/${employeeId}/generate-verification-code`, { method: 'POST' }),

  getLoginSecurityLogs: () => request<any>('/security/login-logs'),

  getHrImpersonationLogs: () => request<any>('/security/impersonation-logs'),

  // Live Location & Camera Monitoring (Shift Work Hours)
  updateLiveLocation: (payload: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
    batteryLevel?: number;
    isCharging?: boolean;
  }) => request<any>('/tracking/live-location', { method: 'POST', body: JSON.stringify(payload) }),

  updateCameraFeed: (payload: {
    cameraFrame?: string;
    cameraStatus?: string;
    facingMode?: string;
  }) => request<any>('/tracking/camera-feed', { method: 'POST', body: JSON.stringify(payload) }),

  getLiveEmployees: () => request<any>('/tracking/live-employees'),

  getEmployeeTrackingHistory: (userId: string) => request<any>(`/tracking/history/${userId}`),

  stopTrackingSession: () => request<any>('/tracking/stop-session', { method: 'POST' })
};
