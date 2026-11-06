import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { config } from './config.js';

// Ensure data directory exists
const dataDir = path.dirname(config.DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new DatabaseSync(config.DB_PATH);

// Initialize Tables
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      employee_code TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('EMPLOYEE', 'HR_ADMIN')),
      department TEXT,
      designation TEXT,
      phone TEXT,
      base_salary REAL DEFAULT 0,
      hra REAL DEFAULT 0,
      allowances REAL DEFAULT 0,
      pf_deduction REAL DEFAULT 0,
      tax_deduction REAL DEFAULT 0,
      joining_date TEXT,
      status TEXT DEFAULT 'ACTIVE',
      must_change_password INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS office_locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius_meters REAL NOT NULL DEFAULT 150,
      address TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      check_in_time TEXT,
      check_out_time TEXT,
      check_in_lat REAL,
      check_in_lng REAL,
      check_in_photo TEXT,
      check_out_lat REAL,
      check_out_lng REAL,
      status TEXT DEFAULT 'PRESENT',
      working_hours REAL DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      verification_method TEXT DEFAULT 'GPS_BIOMETRIC',
      distance_meters REAL DEFAULT 0,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS leaves (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      leave_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_days REAL NOT NULL DEFAULT 1,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      approved_by TEXT,
      action_at TEXT,
      comments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS payroll (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      month_year TEXT NOT NULL,
      total_working_days INTEGER NOT NULL,
      present_days REAL NOT NULL,
      paid_leave_days REAL NOT NULL,
      unpaid_leave_days REAL NOT NULL,
      overtime_hours REAL NOT NULL,
      base_salary REAL NOT NULL,
      hra REAL NOT NULL,
      allowances REAL NOT NULL,
      overtime_pay REAL NOT NULL,
      gross_salary REAL NOT NULL,
      lop_deduction REAL NOT NULL,
      pf_deduction REAL NOT NULL,
      tax_deduction REAL NOT NULL,
      net_salary REAL NOT NULL,
      status TEXT DEFAULT 'PROCESSED',
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, month_year)
    );

    CREATE TABLE IF NOT EXISTS login_security_logs (
      log_id TEXT PRIMARY KEY,
      employee_id TEXT,
      employee_code TEXT,
      user_type TEXT NOT NULL,
      login_status TEXT NOT NULL,
      verification_status TEXT NOT NULL,
      device_id TEXT,
      ip_address TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      failure_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_impersonation_logs (
      log_id TEXT PRIMARY KEY,
      hr_id TEXT NOT NULL,
      hr_name TEXT,
      employee_id TEXT NOT NULL,
      employee_code TEXT,
      employee_name TEXT,
      action TEXT DEFAULT 'HR_IMPERSONATION',
      reason TEXT,
      ip_address TEXT,
      device_info TEXT,
      session_id TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      duration TEXT,
      ended_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS live_tracking (
      user_id TEXT PRIMARY KEY,
      employee_code TEXT,
      employee_name TEXT,
      department TEXT,
      role TEXT,
      latitude REAL,
      longitude REAL,
      accuracy REAL,
      address TEXT,
      camera_frame TEXT,
      camera_timestamp DATETIME,
      camera_status TEXT DEFAULT 'INACTIVE',
      is_checked_in INTEGER DEFAULT 0,
      check_in_time TEXT,
      attendance_id TEXT,
      battery_level INTEGER,
      is_charging INTEGER,
      last_location_time DATETIME,
      last_ping_time DATETIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS live_tracking_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      employee_code TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS outside_shift_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      staff_name TEXT NOT NULL,
      employee_code TEXT,
      department TEXT NOT NULL,
      college_name TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      working_hours REAL DEFAULT 8.0,
      work_description TEXT,
      status TEXT DEFAULT 'RECORDED',
      created_by TEXT NOT NULL,
      created_by_role TEXT NOT NULL,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS leave_approval_logs (
      id TEXT PRIMARY KEY,
      leave_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leave_id) REFERENCES leaves(id)
    );

    CREATE TABLE IF NOT EXISTS user_notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'LEAVE_UPDATE',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Migrate users table to allow TL, HR, ADMIN roles if currently restricted
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (tableInfo && tableInfo.sql && !tableInfo.sql.includes("'TL'")) {
      console.log('Migrating users table to support TL, HR, and ADMIN roles...');
      db.exec('PRAGMA foreign_keys = OFF');
      db.exec(`
        CREATE TABLE users_migrated (
          id TEXT PRIMARY KEY,
          employee_code TEXT UNIQUE NOT NULL,
          full_name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('EMPLOYEE', 'TL', 'HR', 'ADMIN', 'HR_ADMIN')),
          department TEXT,
          designation TEXT,
          phone TEXT,
          base_salary REAL DEFAULT 0,
          hra REAL DEFAULT 0,
          allowances REAL DEFAULT 0,
          pf_deduction REAL DEFAULT 0,
          tax_deduction REAL DEFAULT 0,
          joining_date TEXT,
          status TEXT DEFAULT 'ACTIVE',
          must_change_password INTEGER DEFAULT 0,
          device_registered INTEGER DEFAULT 0,
          device_public_key TEXT,
          device_id TEXT,
          device_registered_at DATETIME,
          account_status TEXT DEFAULT 'ACTIVE',
          hr_verification_code TEXT,
          hr_verification_expiry DATETIME,
          team_leader_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (team_leader_id) REFERENCES users(id)
        );
      `);
      db.exec(`
        INSERT INTO users_migrated (
          id, employee_code, full_name, email, password_hash, role,
          department, designation, phone, base_salary, hra, allowances,
          pf_deduction, tax_deduction, joining_date, status, must_change_password,
          device_registered, device_public_key, device_id, device_registered_at,
          account_status, hr_verification_code, hr_verification_expiry, created_at
        )
        SELECT
          id, employee_code, full_name, email, password_hash, role,
          department, designation, phone, base_salary, hra, allowances,
          pf_deduction, tax_deduction, joining_date, status, must_change_password,
          device_registered, device_public_key, device_id, device_registered_at,
          account_status, hr_verification_code, hr_verification_expiry, created_at
        FROM users;
      `);
      db.exec('DROP TABLE users');
      db.exec('ALTER TABLE users_migrated RENAME TO users');
      db.exec('PRAGMA foreign_keys = ON');
      console.log('Users table role migration successful.');
    }
  } catch (migErr) {
    console.warn('[Users Migration Warning]', migErr.message);
  }

  // Migration columns for employee device & mobile verification
  try { db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0'); } catch (e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN device_registered INTEGER DEFAULT 0'); } catch (e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN device_public_key TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN device_id TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN device_registered_at DATETIME'); } catch (e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN account_status TEXT DEFAULT "ACTIVE"'); } catch (e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN hr_verification_code TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN hr_verification_expiry DATETIME'); } catch (e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN team_leader_id TEXT'); } catch (e) {}

  // Migration columns for office_locations (Wi-Fi / Network validation)
  try { db.exec('ALTER TABLE office_locations ADD COLUMN wifi_validation_enabled INTEGER DEFAULT 0'); } catch (e) {}
  try { db.exec('ALTER TABLE office_locations ADD COLUMN allowed_wifi_ssids TEXT DEFAULT "UnitedSoft-WiFi,UnitedSoft-Corp,Office-WiFi"'); } catch (e) {}
  try { db.exec('ALTER TABLE office_locations ADD COLUMN allowed_ip_ranges TEXT DEFAULT ""'); } catch (e) {}

  // Migration columns for leaves (Multi-tier TL -> HR Approval workflow)
  try { db.exec('ALTER TABLE leaves ADD COLUMN tl_id TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE leaves ADD COLUMN tl_status TEXT DEFAULT "PENDING"'); } catch (e) {}
  try { db.exec('ALTER TABLE leaves ADD COLUMN tl_action_at TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE leaves ADD COLUMN tl_remarks TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE leaves ADD COLUMN hr_id TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE leaves ADD COLUMN hr_status TEXT DEFAULT "PENDING"'); } catch (e) {}
  try { db.exec('ALTER TABLE leaves ADD COLUMN hr_action_at TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE leaves ADD COLUMN hr_remarks TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE leaves ADD COLUMN resubmitted_at TEXT'); } catch (e) {}

  seedInitialData();
}

/**
 * Record a login / security audit event
 */
export function recordLoginSecurityLog({
  employee_id = null,
  employee_code = null,
  user_type = 'EMPLOYEE',
  login_status = 'SUCCESS',
  verification_status = 'VERIFIED_SUCCESS',
  device_id = null,
  ip_address = null,
  failure_reason = null
}) {
  try {
    const logId = 'sec-' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const stmt = db.prepare(`
      INSERT INTO login_security_logs (
        log_id, employee_id, employee_code, user_type, login_status,
        verification_status, device_id, ip_address, failure_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      logId,
      employee_id,
      employee_code,
      user_type,
      login_status,
      verification_status,
      device_id,
      ip_address,
      failure_reason
    );
  } catch (err) {
    console.warn('[Security Log Error]', err.message);
  }
}

/**
 * Record an HR Impersonation session event
 */
export function recordHrImpersonationLog({
  hr_id,
  hr_name,
  employee_id,
  employee_code,
  employee_name,
  reason,
  ip_address,
  device_info,
  session_id
}) {
  try {
    const logId = 'imp-' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const stmt = db.prepare(`
      INSERT INTO hr_impersonation_logs (
        log_id, hr_id, hr_name, employee_id, employee_code, employee_name,
        action, reason, ip_address, device_info, session_id
      ) VALUES (?, ?, ?, ?, ?, ?, 'HR_IMPERSONATION', ?, ?, ?, ?)
    `);
    stmt.run(
      logId,
      hr_id,
      hr_name,
      employee_id,
      employee_code,
      employee_name,
      reason || 'HR Authorized Employee View',
      ip_address,
      device_info,
      session_id
    );
  } catch (err) {
    console.warn('[Impersonation Log Error]', err.message);
  }
}

/**
 * Close HR Impersonation session
 */
export function endHrImpersonationSession(session_id) {
  try {
    const log = db.prepare('SELECT timestamp FROM hr_impersonation_logs WHERE session_id = ?').get(session_id);
    let duration = 'N/A';
    if (log && log.timestamp) {
      const ms = Date.now() - new Date(log.timestamp).getTime();
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      duration = `${mins}m ${secs}s`;
    }

    db.prepare(`
      UPDATE hr_impersonation_logs
      SET ended_at = CURRENT_TIMESTAMP, duration = ?
      WHERE session_id = ?
    `).run(duration, session_id);
  } catch (err) {
    console.warn('[End Impersonation Log Error]', err.message);
  }
}

/**
 * Record a Leave Approval Audit event
 */
export function recordLeaveApprovalLog({
  leave_id,
  actor_id,
  actor_name,
  actor_role,
  action,
  previous_status,
  new_status,
  remarks
}) {
  try {
    const id = 'log-' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    db.prepare(`
      INSERT INTO leave_approval_logs (
        id, leave_id, actor_id, actor_name, actor_role, action,
        previous_status, new_status, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, leave_id, actor_id, actor_name, actor_role, action, previous_status, new_status, remarks || null);
  } catch (err) {
    console.warn('[Leave Log Error]', err.message);
  }
}

/**
 * Record an in-app user notification
 */
export function createNotification({ user_id, title, message, type = 'LEAVE_UPDATE' }) {
  try {
    const id = 'notif-' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    db.prepare(`
      INSERT INTO user_notifications (id, user_id, title, message, type)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, user_id, title, message, type);
  } catch (err) {
    console.warn('[Notification Error]', err.message);
  }
}

function seedInitialData() {
  const salt = bcrypt.genSaltSync(10);
  const adminPass = bcrypt.hashSync('admin123', salt);
  const hrPass = bcrypt.hashSync('hr123', salt);
  const tlPass = bcrypt.hashSync('tl123', salt);
  const empPass = bcrypt.hashSync('emp123', salt);

  // Check Office Location
  const officeCount = db.prepare('SELECT COUNT(*) as count FROM office_locations').get();
  if (officeCount.count === 0) {
    const insertOffice = db.prepare(`
      INSERT INTO office_locations (id, name, latitude, longitude, radius_meters, address, is_active, wifi_validation_enabled, allowed_wifi_ssids)
      VALUES (?, ?, ?, ?, ?, ?, 1, 0, 'UnitedSoft-WiFi,UnitedSoft-Corp,Office-WiFi')
    `);
    insertOffice.run(
      config.DEFAULT_OFFICE.id,
      config.DEFAULT_OFFICE.name,
      config.DEFAULT_OFFICE.latitude,
      config.DEFAULT_OFFICE.longitude,
      config.DEFAULT_OFFICE.radius_meters,
      config.DEFAULT_OFFICE.address
    );
  }

  // Ensure Admin User
  const adminUser = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@unitedsoft.com');
  if (!adminUser) {
    db.prepare(`
      INSERT INTO users (
        id, employee_code, full_name, email, password_hash, role,
        department, designation, phone, base_salary, hra, allowances,
        pf_deduction, tax_deduction, joining_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `).run(
      'usr-admin-01', 'US-ADM-001', 'Sarah Jenkins', 'admin@unitedsoft.com', adminPass,
      'ADMIN', 'Human Resources', 'HR Director & Admin', '+1-555-0100',
      95000, 25000, 10000, 4000, 12000, '2022-01-15'
    );
  }

  // Ensure HR Officer User
  const hrUser = db.prepare('SELECT id FROM users WHERE email = ?').get('hr@unitedsoft.com');
  if (!hrUser) {
    db.prepare(`
      INSERT INTO users (
        id, employee_code, full_name, email, password_hash, role,
        department, designation, phone, base_salary, hra, allowances,
        pf_deduction, tax_deduction, joining_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `).run(
      'usr-hr-01', 'US-HR-002', 'Priya Sharma', 'hr@unitedsoft.com', hrPass,
      'HR', 'Human Resources', 'HR Executive', '+91-9876500001',
      65000, 18000, 7000, 3000, 7000, '2023-03-01'
    );
  }

  // Ensure Team Leader (TL) User
  const tlUser = db.prepare('SELECT id FROM users WHERE email = ?').get('tl@unitedsoft.com');
  if (!tlUser) {
    db.prepare(`
      INSERT INTO users (
        id, employee_code, full_name, email, password_hash, role,
        department, designation, phone, base_salary, hra, allowances,
        pf_deduction, tax_deduction, joining_date, status, device_registered
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0)
    `).run(
      'usr-tl-01', 'US-TL-001', 'Arun Kumar', 'tl@unitedsoft.com', tlPass,
      'TL', 'Engineering', 'Team Leader / Technical Lead', '+91-9876500002',
      85000, 22000, 9000, 3500, 10000, '2022-06-10'
    );
  }

  // Ensure Employee 1 (Assigned to TL Arun Kumar)
  const emp1User = db.prepare('SELECT id FROM users WHERE email = ?').get('emp@unitedsoft.com');
  if (!emp1User) {
    db.prepare(`
      INSERT INTO users (
        id, employee_code, full_name, email, password_hash, role,
        department, designation, phone, base_salary, hra, allowances,
        pf_deduction, tax_deduction, joining_date, status, team_leader_id, device_registered
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'usr-tl-01', 0)
    `).run(
      'usr-emp-01', 'US-ENG-001', 'Rajesh Patel', 'emp@unitedsoft.com', empPass,
      'EMPLOYEE', 'Engineering', 'Senior Software Engineer', '+91-9876543210',
      60000, 15000, 5000, 2500, 6000, '2023-01-10'
    );
  }

  // Ensure Employee 2 (Assigned to TL Arun Kumar)
  const emp2User = db.prepare('SELECT id FROM users WHERE email = ?').get('sneha@unitedsoft.com');
  if (!emp2User) {
    db.prepare(`
      INSERT INTO users (
        id, employee_code, full_name, email, password_hash, role,
        department, designation, phone, base_salary, hra, allowances,
        pf_deduction, tax_deduction, joining_date, status, team_leader_id, device_registered
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'usr-tl-01', 0)
    `).run(
      'usr-emp-02', 'US-ENG-002', 'Sneha Reddy', 'sneha@unitedsoft.com', empPass,
      'EMPLOYEE', 'Engineering', 'Frontend Engineer', '+91-9876543211',
      55000, 14000, 5000, 2200, 5000, '2023-05-15'
    );
  }

  // Ensure Employee 3 (Operations department)
  const emp3User = db.prepare('SELECT id FROM users WHERE email = ?').get('ops@unitedsoft.com');
  if (!emp3User) {
    db.prepare(`
      INSERT INTO users (
        id, employee_code, full_name, email, password_hash, role,
        department, designation, phone, base_salary, hra, allowances,
        pf_deduction, tax_deduction, joining_date, status, device_registered
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0)
    `).run(
      'usr-emp-03', 'US-OPS-001', 'Karan Verma', 'ops@unitedsoft.com', empPass,
      'EMPLOYEE', 'Operations', 'Operations Specialist', '+91-9876543212',
      48000, 12000, 4000, 2000, 4000, '2023-08-20'
    );
  }

  // Seed sample Outside-Shift Entries if table is empty
  const outsideCount = db.prepare('SELECT COUNT(*) as count FROM outside_shift_entries').get();
  if (outsideCount.count === 0) {
    const insertOutside = db.prepare(`
      INSERT INTO outside_shift_entries (
        id, user_id, staff_name, employee_code, department, college_name,
        date, start_time, end_time, working_hours, work_description,
        status, created_by, created_by_role, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertOutside.run(
      'ose-001', 'usr-emp-01', 'Rajesh Patel', 'US-ENG-001', 'Engineering',
      'St. Joseph Engineering College', '2026-10-04', '09:30 AM', '05:30 PM', 8.0,
      'Campus Recruitment Drive & Technical Presentation',
      'RECORDED', 'usr-emp-01', 'EMPLOYEE', 'Conducted student technical interviews'
    );

    insertOutside.run(
      'ose-002', 'usr-emp-02', 'Sneha Reddy', 'US-ENG-002', 'Engineering',
      'BMS College of Engineering', '2026-09-22', '10:00 AM', '06:00 PM', 8.0,
      'Industry Seminar & IoT Hackathon Mentorship',
      'RECORDED', 'usr-admin-01', 'ADMIN', 'Official college partnership assignment'
    );
  }

  // Seed sample attendance across months (Oct 2026, Sep 2026, Aug 2026) for testing month and department filtering
  const attCount = db.prepare('SELECT COUNT(*) as count FROM attendance').get();
  if (attCount.count === 0) {
    const insertAtt = db.prepare(`
      INSERT INTO attendance (
        id, user_id, date, check_in_time, check_out_time,
        status, working_hours, overtime_hours, verification_method, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Rajesh (Engineering) in Oct 2026
    insertAtt.run('att-seed-01', 'usr-emp-01', '2026-10-01', '2026-10-01T09:05:00.000Z', '2026-10-01T18:10:00.000Z', 'PRESENT', 9.08, 1.08, 'GPS_BIOMETRIC', 'Normal office shift');
    insertAtt.run('att-seed-02', 'usr-emp-01', '2026-10-02', '2026-10-02T09:25:00.000Z', '2026-10-02T18:00:00.000Z', 'LATE', 8.58, 0.58, 'GPS_BIOMETRIC', 'Arrived 09:25 AM');
    // Rajesh in Sep 2026
    insertAtt.run('att-seed-03', 'usr-emp-01', '2026-09-15', '2026-09-15T09:00:00.000Z', '2026-09-15T17:30:00.000Z', 'PRESENT', 8.5, 0.5, 'GPS_BIOMETRIC', 'Normal office shift');
    insertAtt.run('att-seed-04', 'usr-emp-01', '2026-09-16', '2026-09-16T09:10:00.000Z', '2026-09-16T18:00:00.000Z', 'PRESENT', 8.83, 0.83, 'GPS_BIOMETRIC', 'Normal office shift');
    // Rajesh in Aug 2026
    insertAtt.run('att-seed-05', 'usr-emp-01', '2026-08-20', '2026-08-20T09:00:00.000Z', '2026-08-20T18:00:00.000Z', 'PRESENT', 9.0, 1.0, 'GPS_BIOMETRIC', 'Normal office shift');

    // Sneha (Engineering) in Oct 2026
    insertAtt.run('att-seed-06', 'usr-emp-02', '2026-10-01', '2026-10-01T08:58:00.000Z', '2026-10-01T18:05:00.000Z', 'PRESENT', 9.12, 1.12, 'GPS_BIOMETRIC', 'Normal office shift');
    insertAtt.run('att-seed-07', 'usr-emp-02', '2026-09-10', '2026-09-10T09:00:00.000Z', '2026-09-10T18:00:00.000Z', 'PRESENT', 9.0, 1.0, 'GPS_BIOMETRIC', 'Normal office shift');

    // Karan (Operations) in Oct 2026 and Sep 2026
    insertAtt.run('att-seed-08', 'usr-emp-03', '2026-10-01', '2026-10-01T09:00:00.000Z', '2026-10-01T17:00:00.000Z', 'PRESENT', 8.0, 0, 'GPS_BIOMETRIC', 'Operations shift');
    insertAtt.run('att-seed-09', 'usr-emp-03', '2026-09-25', '2026-09-25T09:00:00.000Z', '2026-09-25T17:00:00.000Z', 'PRESENT', 8.0, 0, 'GPS_BIOMETRIC', 'Operations shift');

    // TL Arun in Oct 2026
    insertAtt.run('att-seed-10', 'usr-tl-01', '2026-10-01', '2026-10-01T08:50:00.000Z', '2026-10-01T18:30:00.000Z', 'PRESENT', 9.67, 1.67, 'GPS_BIOMETRIC', 'TL Duty');
  }

  // Seed sample leave request in PENDING_TL stage for testing
  const leaveCount = db.prepare('SELECT COUNT(*) as count FROM leaves').get();
  if (leaveCount.count === 0) {
    db.prepare(`
      INSERT INTO leaves (
        id, user_id, leave_type, start_date, end_date, total_days, reason,
        status, tl_id, tl_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'lv-seed-01', 'usr-emp-01', 'CASUAL', '2026-10-15', '2026-10-16', 2,
      'Attending family wedding in hometown',
      'PENDING_TL', 'usr-tl-01', 'PENDING'
    );
  }

  console.log('Database initialized with test accounts (Admin, HR, TL, Employees) successfully.');
}
