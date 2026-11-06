import crypto from 'crypto';
import { db, recordLeaveApprovalLog, createNotification } from '../db.js';

function calculateDaysBetween(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays > 0 ? diffDays : 1;
}

/**
 * Apply Leave - Starts the multi-tier workflow:
 * Step 1: Employee submits leave request.
 * Sent to Employee's assigned TL for first-level approval (status: PENDING_TL).
 * If applicant is already a TL or has no TL, forwarded directly to HR (status: PENDING_HR).
 */
export function applyLeave(req, res) {
  const user = req.user;
  const userId = user.id;
  const { leave_type, start_date, end_date, reason } = req.body;

  if (!leave_type || !start_date || !end_date || !reason) {
    return res.status(400).json({ error: 'Leave type, start date, end date, and reason are required' });
  }

  const validTypes = ['CASUAL', 'SICK', 'PAID', 'UNPAID'];
  if (!validTypes.includes(leave_type)) {
    return res.status(400).json({ error: `Invalid leave type. Must be one of: ${validTypes.join(', ')}` });
  }

  const totalDays = calculateDaysBetween(start_date, end_date);
  const id = `lv-${crypto.randomUUID()}`;

  // Find assigned TL for this employee
  let assignedTl = null;
  if (user.role === 'EMPLOYEE') {
    if (user.team_leader_id) {
      assignedTl = db.prepare('SELECT id, full_name, email FROM users WHERE id = ?').get(user.team_leader_id);
    }
    if (!assignedTl && user.department) {
      assignedTl = db.prepare("SELECT id, full_name, email FROM users WHERE role = 'TL' AND department = ? AND status = 'ACTIVE' LIMIT 1").get(user.department);
    }
  }

  const initialStatus = assignedTl ? 'PENDING_TL' : 'PENDING_HR';
  const initialTlStatus = assignedTl ? 'PENDING' : 'N/A';

  db.prepare(`
    INSERT INTO leaves (
      id, user_id, leave_type, start_date, end_date, total_days, reason,
      status, tl_id, tl_status, hr_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
  `).run(
    id,
    userId,
    leave_type,
    start_date,
    end_date,
    totalDays,
    reason.trim(),
    initialStatus,
    assignedTl ? assignedTl.id : null,
    initialTlStatus
  );

  // Record audit log
  recordLeaveApprovalLog({
    leave_id: id,
    actor_id: userId,
    actor_name: user.full_name,
    actor_role: user.role,
    action: 'SUBMITTED',
    previous_status: null,
    new_status: initialStatus,
    remarks: reason.trim()
  });

  // Notify TL if assigned
  if (assignedTl) {
    createNotification({
      user_id: assignedTl.id,
      title: 'New Leave Request for TL Approval',
      message: `${user.full_name} has requested ${totalDays} day(s) ${leave_type} leave from ${start_date} to ${end_date}.`,
      type: 'LEAVE_TL_PENDING'
    });
  }

  createNotification({
    user_id: userId,
    title: 'Leave Request Submitted',
    message: assignedTl
      ? `Your leave request was sent to Team Leader ${assignedTl.full_name} for first-level review.`
      : 'Your leave request has been submitted to HR for approval.',
    type: 'LEAVE_SUBMITTED'
  });

  const created = db.prepare('SELECT * FROM leaves WHERE id = ?').get(id);

  res.status(201).json({
    message: assignedTl
      ? 'Leave application submitted for Team Leader approval'
      : 'Leave application submitted for HR approval',
    leave: created,
    assignedTL: assignedTl ? assignedTl.full_name : null
  });
}

/**
 * Resubmit a previously rejected leave request
 */
export function resubmitLeave(req, res) {
  const { id } = req.params;
  const user = req.user;
  const { start_date, end_date, reason, leave_type } = req.body;

  const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(id);
  if (!leave) {
    return res.status(404).json({ error: 'Leave request not found' });
  }

  if (leave.user_id !== user.id) {
    return res.status(403).json({ error: 'You can only resubmit your own leave requests' });
  }

  if (leave.status !== 'REJECTED') {
    return res.status(400).json({ error: 'Only rejected leaves can be resubmitted' });
  }

  const updatedStartDate = start_date || leave.start_date;
  const updatedEndDate = end_date || leave.end_date;
  const updatedReason = reason ? reason.trim() : leave.reason;
  const updatedType = leave_type || leave.leave_type;
  const totalDays = calculateDaysBetween(updatedStartDate, updatedEndDate);

  // If applicant is EMPLOYEE, send back to TL
  const isEmployee = user.role === 'EMPLOYEE';
  const newStatus = isEmployee && leave.tl_id ? 'PENDING_TL' : 'PENDING_HR';

  db.prepare(`
    UPDATE leaves SET
      leave_type = ?,
      start_date = ?,
      end_date = ?,
      total_days = ?,
      reason = ?,
      status = ?,
      tl_status = ?,
      hr_status = 'PENDING',
      resubmitted_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    updatedType,
    updatedStartDate,
    updatedEndDate,
    totalDays,
    updatedReason,
    newStatus,
    isEmployee && leave.tl_id ? 'PENDING' : 'N/A',
    id
  );

  recordLeaveApprovalLog({
    leave_id: id,
    actor_id: user.id,
    actor_name: user.full_name,
    actor_role: user.role,
    action: 'RESUBMITTED',
    previous_status: 'REJECTED',
    new_status: newStatus,
    remarks: updatedReason
  });

  if (leave.tl_id) {
    createNotification({
      user_id: leave.tl_id,
      title: 'Resubmitted Leave Request',
      message: `${user.full_name} has resubmitted their leave request for your review.`,
      type: 'LEAVE_RESUBMITTED'
    });
  }

  const updated = db.prepare('SELECT * FROM leaves WHERE id = ?').get(id);
  res.json({
    message: 'Leave request has been resubmitted for approval',
    leave: updated
  });
}

/**
 * Get logged in user's leave requests with approver details
 */
export function getMyLeaves(req, res) {
  const userId = req.user.id;

  const leaves = db.prepare(`
    SELECT l.*,
           tl.full_name as tl_name,
           hr.full_name as hr_name,
           app.full_name as approver_name
    FROM leaves l
    LEFT JOIN users tl ON l.tl_id = tl.id
    LEFT JOIN users hr ON l.hr_id = hr.id
    LEFT JOIN users app ON l.approved_by = app.id
    WHERE l.user_id = ?
    ORDER BY l.created_at DESC
  `).all(userId);

  const approvedLeaves = leaves.filter(l => l.status === 'APPROVED');
  const usedCasual = approvedLeaves.filter(l => l.leave_type === 'CASUAL').reduce((a, b) => a + b.total_days, 0);
  const usedSick = approvedLeaves.filter(l => l.leave_type === 'SICK').reduce((a, b) => a + b.total_days, 0);
  const usedPaid = approvedLeaves.filter(l => l.leave_type === 'PAID').reduce((a, b) => a + b.total_days, 0);
  const usedUnpaid = approvedLeaves.filter(l => l.leave_type === 'UNPAID').reduce((a, b) => a + b.total_days, 0);

  const balances = {
    casual: { quota: 12, used: usedCasual, remaining: Math.max(0, 12 - usedCasual) },
    sick: { quota: 10, used: usedSick, remaining: Math.max(0, 10 - usedSick) },
    paid: { quota: 15, used: usedPaid, remaining: Math.max(0, 15 - usedPaid) },
    unpaidUsed: usedUnpaid
  };

  res.json({ leaves, balances });
}

/**
 * Team Leader (TL) Leaves Retrieval
 * Requirement 5: TL sees leave requests for assigned team members
 */
export function getTeamLeaves(req, res) {
  const tlId = req.user.id;
  const isTL = req.user.role === 'TL';
  const isHrOrAdmin = ['ADMIN', 'HR', 'HR_ADMIN'].includes(req.user.role);

  if (!isTL && !isHrOrAdmin) {
    return res.status(403).json({ error: 'Forbidden: Only Team Leaders can access team leaves' });
  }

  const { status } = req.query;

  let query = `
    SELECT l.*, u.full_name, u.employee_code, u.department, u.designation,
           tl.full_name as tl_name,
           hr.full_name as hr_name
    FROM leaves l
    JOIN users u ON l.user_id = u.id
    LEFT JOIN users tl ON l.tl_id = tl.id
    LEFT JOIN users hr ON l.hr_id = hr.id
    WHERE (u.team_leader_id = ? OR (u.team_leader_id IS NULL AND u.department = ? AND u.id != ?))
  `;
  const params = [tlId, req.user.department, tlId];

  if (status) {
    query += ' AND l.status = ?';
    params.push(status);
  }

  query += ' ORDER BY l.created_at DESC LIMIT 100';

  const leaves = db.prepare(query).all(...params);

  const pendingTlCount = db.prepare(`
    SELECT COUNT(*) as count FROM leaves l
    JOIN users u ON l.user_id = u.id
    WHERE (u.team_leader_id = ? OR (u.team_leader_id IS NULL AND u.department = ? AND u.id != ?))
      AND l.status = 'PENDING_TL'
  `).get(tlId, req.user.department, tlId).count;

  res.json({ leaves, pendingTlCount });
}

/**
 * Team Leader First-Level Approval / Rejection
 * Flow: Employee -> TL -> HR
 * If TL approves: status becomes PENDING_HR
 * If TL rejects: status becomes REJECTED (stops, unless resubmitted)
 */
export function tlActionLeave(req, res) {
  const { id } = req.params;
  const { action, comments } = req.body; // action: 'APPROVE' or 'REJECT'
  const tlUser = req.user;

  const isTL = tlUser.role === 'TL';
  const isHrOrAdmin = ['ADMIN', 'HR', 'HR_ADMIN'].includes(tlUser.role);

  if (!isTL && !isHrOrAdmin) {
    return res.status(403).json({ error: 'Forbidden: Only Team Leaders can take TL approval action' });
  }

  if (!['APPROVE', 'REJECT'].includes(action)) {
    return res.status(400).json({ error: "Action must be either 'APPROVE' or 'REJECT'" });
  }

  const leave = db.prepare(`
    SELECT l.*, u.full_name, u.team_leader_id, u.department
    FROM leaves l
    JOIN users u ON l.user_id = u.id
    WHERE l.id = ?
  `).get(id);

  if (!leave) {
    return res.status(404).json({ error: 'Leave request not found' });
  }

  // Authorization check: Is this employee on this TL's team?
  if (isTL) {
    const isAssigned = (leave.team_leader_id === tlUser.id) ||
      (!leave.team_leader_id && leave.department === tlUser.department && leave.user_id !== tlUser.id);

    if (!isAssigned) {
      return res.status(403).json({ error: 'Forbidden: You cannot review leave for employees outside your team' });
    }
  }

  if (leave.status !== 'PENDING_TL') {
    return res.status(400).json({ error: `Cannot process leave in current status: ${leave.status}` });
  }

  const now = new Date().toISOString();
  const isApproved = action === 'APPROVE';
  const newStatus = isApproved ? 'PENDING_HR' : 'REJECTED';
  const tlStatus = isApproved ? 'APPROVED' : 'REJECTED';

  db.prepare(`
    UPDATE leaves SET
      status = ?,
      tl_status = ?,
      tl_id = ?,
      tl_action_at = ?,
      tl_remarks = ?
    WHERE id = ?
  `).run(newStatus, tlStatus, tlUser.id, now, comments || null, id);

  // Record audit log
  recordLeaveApprovalLog({
    leave_id: id,
    actor_id: tlUser.id,
    actor_name: tlUser.full_name,
    actor_role: 'TL',
    action: isApproved ? 'TL_APPROVED' : 'TL_REJECTED',
    previous_status: 'PENDING_TL',
    new_status: newStatus,
    remarks: comments || (isApproved ? 'Approved by Team Leader' : 'Rejected by Team Leader')
  });

  // Notify Employee
  createNotification({
    user_id: leave.user_id,
    title: isApproved ? 'Leave Approved by Team Leader' : 'Leave Rejected by Team Leader',
    message: isApproved
      ? `Your Team Leader ${tlUser.full_name} approved your leave request. It is now with HR for final approval.`
      : `Your Team Leader ${tlUser.full_name} declined your leave request. Remarks: ${comments || 'No remarks provided'}.`,
    type: isApproved ? 'LEAVE_TL_APPROVED' : 'LEAVE_TL_REJECTED'
  });

  const updated = db.prepare(`
    SELECT l.*, u.full_name, tl.full_name as tl_name
    FROM leaves l
    JOIN users u ON l.user_id = u.id
    LEFT JOIN users tl ON l.tl_id = tl.id
    WHERE l.id = ?
  `).get(id);

  res.json({
    message: isApproved
      ? 'Leave request approved by TL and forwarded to HR for final approval'
      : 'Leave request rejected by TL',
    leave: updated
  });
}

/**
 * HR / Admin All Leaves Retrieval
 * Requirement 7: HR can view complete approval history, department filter, and status filter
 */
export function getAllLeaves(req, res) {
  const { status, department } = req.query;

  let query = `
    SELECT l.*, u.full_name, u.employee_code, u.department, u.designation,
           tl.full_name as tl_name,
           hr.full_name as hr_name,
           app.full_name as approver_name
    FROM leaves l
    JOIN users u ON l.user_id = u.id
    LEFT JOIN users tl ON l.tl_id = tl.id
    LEFT JOIN users hr ON l.hr_id = hr.id
    LEFT JOIN users app ON l.approved_by = app.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    if (status === 'PENDING') {
      // Pending either at TL or HR
      query += " AND l.status IN ('PENDING', 'PENDING_TL', 'PENDING_HR')";
    } else {
      query += ' AND l.status = ?';
      params.push(status);
    }
  }

  if (department) {
    query += ' AND u.department = ?';
    params.push(department);
  }

  query += ' ORDER BY l.created_at DESC LIMIT 150';

  const leaves = db.prepare(query).all(...params);

  const pendingHrCount = db.prepare("SELECT COUNT(*) as count FROM leaves WHERE status = 'PENDING_HR'").get().count;
  const pendingTlCount = db.prepare("SELECT COUNT(*) as count FROM leaves WHERE status = 'PENDING_TL'").get().count;
  const totalApproved = db.prepare("SELECT COUNT(*) as count FROM leaves WHERE status = 'APPROVED'").get().count;
  const totalRejected = db.prepare("SELECT COUNT(*) as count FROM leaves WHERE status = 'REJECTED'").get().count;

  res.json({
    leaves,
    counts: {
      pendingHr: pendingHrCount,
      pendingTl: pendingTlCount,
      approved: totalApproved,
      rejected: totalRejected
    }
  });
}

/**
 * HR Final Stage Approval / Rejection
 * Flow: Employee -> TL -> HR (Final Action)
 */
export function updateLeaveStatus(req, res) {
  const { id } = req.params;
  const { status, comments } = req.body;
  const hrUser = req.user;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Status must be either APPROVED or REJECTED' });
  }

  const existing = db.prepare(`
    SELECT l.*, u.full_name, u.email
    FROM leaves l
    JOIN users u ON l.user_id = u.id
    WHERE l.id = ?
  `).get(id);

  if (!existing) {
    return res.status(404).json({ error: 'Leave request not found' });
  }

  const now = new Date().toISOString();
  const isApproved = status === 'APPROVED';

  db.prepare(`
    UPDATE leaves SET
      status = ?,
      hr_status = ?,
      approved_by = ?,
      hr_id = ?,
      hr_action_at = ?,
      hr_remarks = ?,
      action_at = ?,
      comments = ?
    WHERE id = ?
  `).run(
    status,
    status,
    hrUser.id,
    hrUser.id,
    now,
    comments || null,
    now,
    comments || null,
    id
  );

  // Record audit log
  recordLeaveApprovalLog({
    leave_id: id,
    actor_id: hrUser.id,
    actor_name: hrUser.full_name,
    actor_role: 'HR',
    action: isApproved ? 'HR_APPROVED' : 'HR_REJECTED',
    previous_status: existing.status,
    new_status: status,
    remarks: comments || (isApproved ? 'Approved by HR Director' : 'Rejected by HR Director')
  });

  // Notify Employee of HR final action
  createNotification({
    user_id: existing.user_id,
    title: isApproved ? 'Leave Approved by HR!' : 'Leave Rejected by HR',
    message: isApproved
      ? `Your leave request (${existing.start_date} to ${existing.end_date}) received final approval from HR.`
      : `Your leave request was rejected by HR. Remarks: ${comments || 'No remarks provided'}.`,
    type: isApproved ? 'LEAVE_HR_APPROVED' : 'LEAVE_HR_REJECTED'
  });

  const updated = db.prepare(`
    SELECT l.*, u.full_name, tl.full_name as tl_name, hr.full_name as hr_name, app.full_name as approver_name
    FROM leaves l
    JOIN users u ON l.user_id = u.id
    LEFT JOIN users tl ON l.tl_id = tl.id
    LEFT JOIN users hr ON l.hr_id = hr.id
    LEFT JOIN users app ON l.approved_by = app.id
    WHERE l.id = ?
  `).get(id);

  res.json({
    message: `Leave application marked as ${status} by HR`,
    leave: updated
  });
}

/**
 * Get complete approval history / audit logs for a specific leave request
 */
export function getLeaveHistoryLogs(req, res) {
  const { id } = req.params;

  const logs = db.prepare(`
    SELECT * FROM leave_approval_logs
    WHERE leave_id = ?
    ORDER BY created_at ASC
  `).all(id);

  res.json({ logs });
}
