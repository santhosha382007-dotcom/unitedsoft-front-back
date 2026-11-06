export type UserRole = 'EMPLOYEE' | 'TL' | 'HR' | 'ADMIN' | 'HR_ADMIN';

export interface User {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  role: UserRole;
  department: string;
  designation: string;
  phone?: string;
  base_salary: number;
  hra: number;
  allowances: number;
  pf_deduction: number;
  tax_deduction: number;
  joining_date?: string;
  status: 'ACTIVE' | 'INACTIVE';
  must_change_password?: boolean | number;
  device_registered?: number | boolean;
  device_id?: string;
  device_registered_at?: string;
  team_leader_id?: string;
  team_leader_name?: string;
}

export interface OfficeLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  address: string;
  is_active: number;
  wifi_validation_enabled?: number | boolean;
  allowed_wifi_ssids?: string;
  allowed_ip_ranges?: string;
}

export interface NetworkSettings {
  wifi_validation_enabled: boolean;
  allowed_wifi_ssids: string;
  allowed_ip_ranges?: string;
}

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT';

export interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  check_in_lat?: number;
  check_in_lng?: number;
  check_in_photo?: string;
  check_out_lat?: number;
  check_out_lng?: number;
  status: AttendanceStatus;
  working_hours: number;
  overtime_hours: number;
  verification_method: string;
  distance_meters: number;
  remarks?: string;
  full_name?: string;
  employee_name?: string;
  employee_code?: string;
  department?: string;
  designation?: string;
}

export interface OutsideShiftEntry {
  id: string;
  user_id: string;
  staff_name: string;
  employee_code?: string;
  department: string;
  college_name: string;
  date: string;
  start_time?: string;
  end_time?: string;
  working_hours: number;
  work_description?: string;
  status: string;
  created_by: string;
  created_by_role: string;
  remarks?: string;
  created_at?: string;
}

export type LeaveType = 'CASUAL' | 'SICK' | 'PAID' | 'UNPAID';
export type LeaveStatus = 'PENDING' | 'PENDING_TL' | 'TL_APPROVED' | 'PENDING_HR' | 'APPROVED' | 'REJECTED' | 'RESUBMITTED';

export interface LeaveRecord {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: LeaveStatus;
  tl_id?: string;
  tl_name?: string;
  tl_status?: string;
  tl_action_at?: string;
  tl_approved_at?: string;
  tl_remarks?: string;
  hr_id?: string;
  hr_name?: string;
  hr_status?: string;
  hr_action_at?: string;
  hr_approved_at?: string;
  hr_remarks?: string;
  approved_by?: string;
  approver_name?: string;
  action_at?: string;
  comments?: string;
  resubmitted_at?: string;
  full_name?: string;
  employee_code?: string;
  department?: string;
}

export interface LeaveBalances {
  casual: { quota: number; used: number; remaining: number };
  sick: { quota: number; used: number; remaining: number };
  paid: { quota: number; used: number; remaining: number };
  unpaidUsed: number;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: number;
  created_at: string;
}

export type PayrollStatus = 'DRAFT' | 'PROCESSED' | 'PAID';

export interface PayrollRecord {
  id: string;
  user_id: string;
  month_year: string;
  total_working_days: number;
  present_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  overtime_hours: number;
  base_salary: number;
  hra: number;
  allowances: number;
  overtime_pay: number;
  gross_salary: number;
  lop_deduction: number;
  pf_deduction: number;
  tax_deduction: number;
  net_salary: number;
  status: PayrollStatus;
  generated_at?: string;
  full_name?: string;
  employee_code?: string;
  department?: string;
  designation?: string;
  email?: string;
}
