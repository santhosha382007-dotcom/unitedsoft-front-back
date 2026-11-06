import crypto from 'crypto';
import { db } from '../db.js';

const DEFAULT_COLLEGES = [
  'St. Joseph Engineering College',
  'BMS College of Engineering',
  'RV College of Engineering',
  'PES University',
  'Ramaiah Institute of Technology',
  'Dayananda Sagar College of Engineering',
  'MS Ramaiah University',
  'Bangalore Institute of Technology'
];

/**
 * Get distinct list of colleges (combining predefined + previously entered)
 */
export function getColleges(req, res) {
  try {
    const recorded = db.prepare('SELECT DISTINCT college_name FROM outside_shift_entries WHERE college_name IS NOT NULL').all();
    const recordedNames = recorded.map(r => r.college_name.trim());
    const combined = Array.from(new Set([...DEFAULT_COLLEGES, ...recordedNames])).sort();
    res.json({ colleges: combined });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch colleges', details: err.message });
  }
}

/**
 * Get Outside-Shift / External Work Entries with RBAC filtering
 */
export function getOutsideShiftEntries(req, res) {
  const { department, month, college, userId } = req.query;
  const user = req.user;

  let query = `
    SELECT o.*, u.designation, u.employee_code as code
    FROM outside_shift_entries o
    JOIN users u ON o.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  const isHrOrAdmin = ['ADMIN', 'HR', 'HR_ADMIN'].includes(user.role);
  const isTL = user.role === 'TL';

  if (isHrOrAdmin) {
    // HR/Admin can see all records, filterable
    if (department) {
      query += ' AND o.department = ?';
      params.push(department);
    }
  } else if (isTL) {
    // TL can only see entries for their team members and themselves
    query += ` AND (o.user_id = ? OR o.user_id IN (
      SELECT id FROM users WHERE team_leader_id = ? OR (team_leader_id IS NULL AND department = ? AND id != ?)
    ))`;
    params.push(user.id, user.id, user.department, user.id);
  } else {
    // Regular employee can only see their own
    query += ' AND o.user_id = ?';
    params.push(user.id);
  }

  if (userId) {
    query += ' AND o.user_id = ?';
    params.push(userId);
  }
  if (month) {
    query += ' AND o.date LIKE ?';
    params.push(`${month}%`);
  }
  if (college) {
    query += ' AND o.college_name LIKE ?';
    params.push(`%${college}%`);
  }

  query += ' ORDER BY o.date DESC, o.created_at DESC LIMIT 100';

  const entries = db.prepare(query).all(...params);
  res.json({ entries });
}

/**
 * Record an Outside-Shift / External Work Entry
 */
export function createOutsideShiftEntry(req, res) {
  const currentUser = req.user;
  const isHrOrAdmin = ['ADMIN', 'HR', 'HR_ADMIN'].includes(currentUser.role);

  const {
    user_id,
    staff_name,
    department,
    college_name,
    date,
    start_time,
    end_time,
    working_hours = 8.0,
    work_description,
    remarks
  } = req.body;

  if (!college_name || !college_name.trim()) {
    return res.status(400).json({ error: 'College Name is required for outside-shift entry' });
  }

  let targetUserId = currentUser.id;
  let targetStaffName = currentUser.full_name;
  let targetDept = currentUser.department || 'General';
  let targetCode = currentUser.employee_code || '';

  if (isHrOrAdmin && user_id) {
    const targetUser = db.prepare('SELECT id, full_name, department, employee_code FROM users WHERE id = ?').get(user_id);
    if (targetUser) {
      targetUserId = targetUser.id;
      targetStaffName = targetUser.full_name;
      targetDept = targetUser.department || department || 'General';
      targetCode = targetUser.employee_code;
    }
  } else {
    if (staff_name && staff_name.trim()) targetStaffName = staff_name.trim();
    if (department && department.trim()) targetDept = department.trim();
  }

  const targetDate = date || new Date().toISOString().split('T')[0];
  const id = `ose-${crypto.randomUUID()}`;

  db.prepare(`
    INSERT INTO outside_shift_entries (
      id, user_id, staff_name, employee_code, department, college_name,
      date, start_time, end_time, working_hours, work_description,
      status, created_by, created_by_role, remarks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECORDED', ?, ?, ?)
  `).run(
    id,
    targetUserId,
    targetStaffName,
    targetCode,
    targetDept,
    college_name.trim(),
    targetDate,
    start_time || '09:00 AM',
    end_time || '05:30 PM',
    parseFloat(working_hours) || 8.0,
    work_description || null,
    currentUser.id,
    currentUser.role,
    remarks || null
  );

  // Automatically record / update corresponding attendance record so attendance is counted!
  const attRemarks = `Outside-Shift / College Work: ${college_name.trim()}${work_description ? ' - ' + work_description.trim() : ''}`;
  const existingAtt = db.prepare('SELECT id FROM attendance WHERE user_id = ? AND date = ?').get(targetUserId, targetDate);

  const checkInIso = `${targetDate}T09:00:00.000Z`;
  const checkOutIso = `${targetDate}T17:30:00.000Z`;

  if (existingAtt) {
    db.prepare(`
      UPDATE attendance SET
        status = 'PRESENT',
        check_in_time = COALESCE(check_in_time, ?),
        check_out_time = COALESCE(check_out_time, ?),
        working_hours = MAX(working_hours, ?),
        verification_method = 'OUTSIDE_SHIFT_EXTERNAL',
        remarks = ?
      WHERE id = ?
    `).run(checkInIso, checkOutIso, parseFloat(working_hours) || 8.0, attRemarks, existingAtt.id);
  } else {
    const attId = `att-ose-${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO attendance (
        id, user_id, date, check_in_time, check_out_time,
        status, working_hours, verification_method, remarks
      ) VALUES (?, ?, ?, ?, ?, 'PRESENT', ?, 'OUTSIDE_SHIFT_EXTERNAL', ?)
    `).run(attId, targetUserId, targetDate, checkInIso, checkOutIso, parseFloat(working_hours) || 8.0, attRemarks);
  }

  const created = db.prepare('SELECT * FROM outside_shift_entries WHERE id = ?').get(id);

  res.status(201).json({
    message: `Outside-shift attendance recorded successfully for ${targetStaffName} at ${college_name.trim()}`,
    entry: created
  });
}
