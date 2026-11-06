import assert from 'node:assert/strict';
import { db, initDatabase } from '../src/db.js';
import * as authController from '../src/controllers/authController.js';
import * as attendanceController from '../src/controllers/attendanceController.js';
import * as leaveController from '../src/controllers/leaveController.js';
import * as outsideShiftController from '../src/controllers/outsideShiftController.js';
import * as employeeController from '../src/controllers/employeeController.js';
import * as officeController from '../src/controllers/officeController.js';

// Helper to mock express req/res
function mockReqRes(body = {}, query = {}, params = {}, user = null, headers = {}) {
  let statusCode = 200;
  let responseData = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };
  const req = {
    body,
    query,
    params,
    user,
    headers,
    socket: { remoteAddress: '127.0.0.1' }
  };
  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData
  };
}

async function runTests() {
  console.log('--- STARTING COMPREHENSIVE REQUIREMENTS VERIFICATION TESTS ---');

  // Initialize DB
  initDatabase();

  // =========================================================================
  // 1. Authentication and Single Login System (Requirement 1 & RBAC)
  // =========================================================================
  console.log('\n[Test 1] Testing Unified Single Login for all roles...');

  // 1.1 Admin Login
  {
    const { req, res, getStatus, getData } = mockReqRes({ loginId: 'admin@unitedsoft.com', password: 'admin123' });
    authController.login(req, res);
    assert.equal(getStatus(), 200);
    assert.ok(getData().token, 'Token must be present');
    assert.ok(['ADMIN', 'HR_ADMIN'].includes(getData().user.role), 'Admin role must match');
    console.log('✓ Admin login successful. Role:', getData().user.role);
  }

  // 1.2 HR Login
  {
    const { req, res, getStatus, getData } = mockReqRes({ loginId: 'hr@unitedsoft.com', password: 'hr123' });
    authController.login(req, res);
    assert.equal(getStatus(), 200);
    assert.ok(getData().token);
    assert.equal(getData().user.role, 'HR');
    console.log('✓ HR login successful. Role:', getData().user.role);
  }

  // 1.3 Team Leader (TL) Login
  {
    const { req, res, getStatus, getData } = mockReqRes({
      loginId: 'tl@unitedsoft.com',
      password: 'tl123',
      deviceId: 'dev-tl-01',
      deviceKey: 'key-tl-01',
      detectedMobileNumbers: ['+91-9876500002']
    });
    authController.login(req, res);
    assert.equal(getStatus(), 200);
    assert.equal(getData().user.role, 'TL');
    console.log('✓ Team Leader (TL) login successful. Role:', getData().user.role);
  }

  // 1.4 Employee Login
  {
    const { req, res, getStatus, getData } = mockReqRes({
      loginId: 'emp@unitedsoft.com',
      password: 'emp123',
      deviceId: 'dev-emp-01',
      deviceKey: 'key-emp-01',
      detectedMobileNumbers: ['+91-9876543210']
    });
    authController.login(req, res);
    assert.equal(getStatus(), 200);
    assert.equal(getData().user.role, 'EMPLOYEE');
    console.log('✓ Employee login successful. Role:', getData().user.role);
  }

  // =========================================================================
  // 2. Wi-Fi / Network Validation for Attendance Check-In (Requirement 2)
  // =========================================================================
  console.log('\n[Test 2] Testing Wi-Fi Validation for Attendance Check-In...');
  const testEmp = db.prepare("SELECT * FROM users WHERE email = 'emp@unitedsoft.com'").get();
  const adminUser = db.prepare("SELECT * FROM users WHERE email = 'admin@unitedsoft.com'").get();

  // Reset today's attendance for testEmp to test check-in
  const today = new Date().toISOString().split('T')[0];
  db.prepare('DELETE FROM attendance WHERE user_id = ? AND date = ?').run(testEmp.id, today);

  // 2.1 Enable Wi-Fi validation via HR settings API
  {
    const { req, res, getStatus, getData } = mockReqRes(
      { wifi_validation_enabled: true, allowed_wifi_ssids: 'UnitedSoft-Corp,UnitedSoft-Staff' },
      {}, {}, adminUser
    );
    officeController.updateNetworkSettings(req, res);
    assert.equal(getStatus(), 200);
    assert.equal(getData().settings.wifi_validation_enabled, true);
    console.log('✓ Network validation setting enabled by HR');
  }

  // 2.2 Attempt Check-In from unauthorized Wi-Fi (Should fail with exact message)
  {
    const { req, res, getStatus, getData } = mockReqRes(
      {
        latitude: 12.9716,
        longitude: 77.5946,
        wifiSsid: 'Home-WiFi-5G',
        networkType: 'WIFI'
      },
      {}, {}, testEmp
    );
    attendanceController.checkIn(req, res);
    assert.equal(getStatus(), 403);
    assert.equal(getData().error, 'Check-In is allowed only from the authorized company network.');
    console.log('✓ Unauthorized Wi-Fi correctly blocked with exact requirement error message:', getData().error);
  }

  // 2.3 Attempt Check-In from authorized Wi-Fi (Should succeed)
  {
    const office = db.prepare('SELECT * FROM office_locations WHERE is_active = 1 LIMIT 1').get();
    const { req, res, getStatus, getData } = mockReqRes(
      {
        latitude: office.latitude,
        longitude: office.longitude,
        wifiSsid: 'UnitedSoft-Corp',
        networkType: 'WIFI',
        bypassGeofence: true
      },
      {}, {}, testEmp
    );
    attendanceController.checkIn(req, res);
    assert.equal(getStatus(), 201);
    assert.ok(getData().attendance);
    console.log('✓ Authorized Wi-Fi check-in successfully accepted');
  }

  // 2.4 Disable Wi-Fi validation via HR settings API
  {
    const { req, res, getStatus, getData } = mockReqRes(
      { wifi_validation_enabled: false },
      {}, {}, adminUser
    );
    officeController.updateNetworkSettings(req, res);
    assert.equal(getStatus(), 200);
    assert.equal(getData().settings.wifi_validation_enabled, false);
    console.log('✓ Network validation toggled back to optional/disabled');
  }

  // =========================================================================
  // 3. Attendance History - Month Filter (Requirement 3)
  // =========================================================================
  console.log('\n[Test 3] Testing Attendance History Month Filter...');
  // 3.1 Employee view filtered by month
  {
    const { req, res, getStatus, getData } = mockReqRes({}, { month: '2026-10' }, {}, testEmp);
    attendanceController.getMyHistory(req, res);
    assert.equal(getStatus(), 200);
    assert.ok(Array.isArray(getData().records));
    const allOct = getData().records.every(r => r.date.startsWith('2026-10'));
    assert.ok(allOct, 'All retrieved records must belong to October 2026');
    console.log(`✓ Employee history month filter works. Records returned for Oct 2026: ${getData().records.length}`);
  }

  // 3.2 HR / Admin view filtered by month
  {
    const { req, res, getStatus, getData } = mockReqRes({}, { month: '2026-09' }, {}, adminUser);
    attendanceController.getAllAttendance(req, res);
    assert.equal(getStatus(), 200);
    const allSep = getData().records.every(r => r.date.startsWith('2026-09'));
    assert.ok(allSep, 'All retrieved records must belong to September 2026');
    console.log(`✓ HR attendance month filter works. Records returned for Sep 2026: ${getData().records.length}`);
  }

  // =========================================================================
  // 4. Outside-Shift / External Work Entry (Requirement 4)
  // =========================================================================
  console.log('\n[Test 4] Testing Outside-Shift / External Work Entry...');
  // 4.1 Colleges list retrieval
  {
    const { req, res, getStatus, getData } = mockReqRes({}, {}, {}, testEmp);
    outsideShiftController.getColleges(req, res);
    assert.equal(getStatus(), 200);
    assert.ok(Array.isArray(getData().colleges));
    assert.ok(getData().colleges.includes('St. Joseph Engineering College'));
    console.log(`✓ Selectable colleges retrieved: ${getData().colleges.length} colleges`);
  }

  // 4.2 Record outside-shift entry by Employee
  {
    const { req, res, getStatus, getData } = mockReqRes(
      {
        college_name: 'PES University',
        date: '2026-10-06',
        start_time: '10:00 AM',
        end_time: '06:00 PM',
        working_hours: 8,
        work_description: 'External Technical Assessment Panel'
      },
      {}, {}, testEmp
    );
    outsideShiftController.createOutsideShiftEntry(req, res);
    assert.equal(getStatus(), 201);
    assert.equal(getData().entry.college_name, 'PES University');
    assert.equal(getData().entry.staff_name, testEmp.full_name);
    console.log('✓ Outside-shift entry created with College Name, Department, and Staff Name');

    // Verify it also recorded attendance
    const attRec = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(testEmp.id, '2026-10-06');
    assert.ok(attRec, 'Corresponding attendance record must be created');
    assert.equal(attRec.verification_method, 'OUTSIDE_SHIFT_EXTERNAL');
    console.log('✓ Outside-shift attendance accurately reflected in attendance database');
  }

  // =========================================================================
  // 5. Team Leader (TL) Role & Permissions (Requirement 5 & 8)
  // =========================================================================
  console.log('\n[Test 5] Testing Team Leader (TL) Role & Team Permissions...');
  const tlUser = db.prepare("SELECT * FROM users WHERE email = 'tl@unitedsoft.com'").get();
  const opsEmp = db.prepare("SELECT * FROM users WHERE email = 'ops@unitedsoft.com'").get();

  // 5.1 TL views assigned team members
  {
    const { req, res, getStatus, getData } = mockReqRes({}, {}, {}, tlUser);
    attendanceController.getTeamMembers(req, res);
    assert.equal(getStatus(), 200);
    assert.ok(Array.isArray(getData().members));
    const memberCodes = getData().members.map(m => m.employee_code);
    assert.ok(memberCodes.includes('US-ENG-001'), 'Must include assigned engineer Rajesh');
    assert.ok(!memberCodes.includes('US-OPS-001'), 'Must NOT include operations staff Karan');
    console.log(`✓ TL team members correctly scoped to assigned team: ${memberCodes.join(', ')}`);
  }

  // 5.2 TL views team attendance history
  {
    const { req, res, getStatus, getData } = mockReqRes({}, { month: '2026-10' }, {}, tlUser);
    attendanceController.getTeamAttendance(req, res);
    assert.equal(getStatus(), 200);
    const usersInResult = getData().records.map(r => r.employee_code);
    assert.ok(!usersInResult.includes('US-OPS-001'), 'TL must NOT see unrelated department records');
    console.log(`✓ TL team attendance retrieved only for members belonging to TL team (${getData().records.length} records)`);
  }

  // 5.3 Normal employee unauthorized to call TL attendance API
  {
    const { req, res, getStatus, getData } = mockReqRes({}, {}, {}, testEmp);
    attendanceController.getTeamAttendance(req, res);
    assert.equal(getStatus(), 403);
    console.log('✓ Non-TL user blocked with 403 Forbidden on TL API');
  }

  // =========================================================================
  // 6. Leave Approval Workflow: Employee -> TL -> HR (Requirement 6)
  // =========================================================================
  console.log('\n[Test 6] Testing Leave Approval Workflow (Employee -> TL -> HR)...');
  const hrUser = db.prepare("SELECT * FROM users WHERE email = 'hr@unitedsoft.com'").get();

  // 6.1 Employee submits leave
  let leaveId;
  {
    const { req, res, getStatus, getData } = mockReqRes(
      {
        leave_type: 'CASUAL',
        start_date: '2026-10-20',
        end_date: '2026-10-21',
        reason: 'Personal urgent work'
      },
      {}, {}, testEmp
    );
    leaveController.applyLeave(req, res);
    assert.equal(getStatus(), 201);
    assert.equal(getData().leave.status, 'PENDING_TL', 'Initial status must be PENDING_TL for employee');
    leaveId = getData().leave.id;
    console.log('✓ Step 1: Employee submitted leave. Status:', getData().leave.status);
  }

  // 6.2 TL Approves Leave (First Level Approval)
  {
    const { req, res, getStatus, getData } = mockReqRes(
      { action: 'APPROVE', comments: 'TL Approved: Team work covered' },
      {}, { id: leaveId }, tlUser
    );
    leaveController.tlActionLeave(req, res);
    assert.equal(getStatus(), 200);
    assert.equal(getData().leave.status, 'PENDING_HR', 'Status after TL approval must be PENDING_HR');
    console.log('✓ Step 2: TL approved leave. Forwarded to HR. Status:', getData().leave.status);
  }

  // 6.3 HR Final Approval
  {
    const { req, res, getStatus, getData } = mockReqRes(
      { status: 'APPROVED', comments: 'HR Approved: Annual quota available' },
      {}, { id: leaveId }, hrUser
    );
    leaveController.updateLeaveStatus(req, res);
    assert.equal(getStatus(), 200);
    assert.equal(getData().leave.status, 'APPROVED', 'Status after HR approval must be APPROVED');
    console.log('✓ Step 3: HR gave final approval. Status:', getData().leave.status);
  }

  // 6.4 Check complete approval history in audit log
  {
    const { req, res, getStatus, getData } = mockReqRes({}, {}, { id: leaveId }, testEmp);
    leaveController.getLeaveHistoryLogs(req, res);
    assert.equal(getStatus(), 200);
    assert.ok(Array.isArray(getData().logs));
    const actions = getData().logs.map(l => l.action);
    assert.deepEqual(actions, ['SUBMITTED', 'TL_APPROVED', 'HR_APPROVED']);
    console.log('✓ Complete approval history verified in audit trail:', actions.join(' -> '));
  }

  // 6.5 Test TL Rejection & Resubmission Workflow
  {
    // Submit second leave
    const { req: sReq, res: sRes, getData: sData } = mockReqRes(
      { leave_type: 'SICK', start_date: '2026-11-01', end_date: '2026-11-02', reason: 'Medical checkup' },
      {}, {}, testEmp
    );
    leaveController.applyLeave(sReq, sRes);
    const rejLeaveId = sData().leave.id;

    // TL Rejects
    const { req: rReq, res: rRes, getData: rData } = mockReqRes(
      { action: 'REJECT', comments: 'Critical client milestone date, please reschedule' },
      {}, { id: rejLeaveId }, tlUser
    );
    leaveController.tlActionLeave(rReq, rRes);
    assert.equal(rData().leave.status, 'REJECTED');
    console.log('✓ TL rejection successfully stops request at TL stage (status: REJECTED)');

    // Employee Resubmits with adjusted dates
    const { req: rsReq, res: rsRes, getData: rsData } = mockReqRes(
      { start_date: '2026-11-05', end_date: '2026-11-06', reason: 'Rescheduled medical checkup' },
      {}, { id: rejLeaveId }, testEmp
    );
    leaveController.resubmitLeave(rsReq, rsRes);
    assert.equal(rsData().leave.status, 'PENDING_TL');
    console.log('✓ Employee resubmission returns leave to TL for review (status: PENDING_TL)');
  }

  // =========================================================================
  // 7. Department Filtering (Requirement 7)
  // =========================================================================
  console.log('\n[Test 7] Testing Department Filtering in Staff & Attendance...');
  // 7.1 Filter Staff by Department
  {
    const { req, res, getStatus, getData } = mockReqRes({}, { department: 'Engineering' }, {}, adminUser);
    employeeController.getEmployees(req, res);
    assert.equal(getStatus(), 200);
    const allEng = getData().employees.every(e => e.department === 'Engineering');
    assert.ok(allEng, 'All staff returned must belong to Engineering');
    console.log(`✓ Staff department filter (Engineering): ${getData().employees.length} staff members`);
  }

  // 7.2 Filter Attendance by Department
  {
    const { req, res, getStatus, getData } = mockReqRes({}, { department: 'Engineering', month: '2026-10' }, {}, adminUser);
    attendanceController.getAllAttendance(req, res);
    assert.equal(getStatus(), 200);
    const allEngAtt = getData().records.every(r => r.department === 'Engineering');
    assert.ok(allEngAtt, 'All attendance records must belong to Engineering department');
    console.log(`✓ Attendance department filter (Engineering): ${getData().records.length} records`);
  }

  console.log('\n======================================================');
  console.log('ALL BACKEND REQUIREMENTS TESTS PASSED SUCCESSFULLY! ✓');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
