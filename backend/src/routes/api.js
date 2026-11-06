import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as authController from '../controllers/authController.js';
import * as attendanceController from '../controllers/attendanceController.js';
import * as employeeController from '../controllers/employeeController.js';
import * as leaveController from '../controllers/leaveController.js';
import * as payrollController from '../controllers/payrollController.js';
import * as officeController from '../controllers/officeController.js';
import * as reportController from '../controllers/reportController.js';
import * as securityController from '../controllers/securityController.js';
import * as trackingController from '../controllers/trackingController.js';
import * as outsideShiftController from '../controllers/outsideShiftController.js';

const router = express.Router();

// --- Public Authentication Routes ---
router.post('/auth/login', authController.login);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);
router.get('/auth/demo-accounts', authController.getDemoAccounts);

// --- Protected Routes (All Authenticated Users) ---
router.use(authenticate);

router.get('/auth/me', authController.getMe);
router.post('/auth/change-password', authController.changePassword);

// In-app Notifications
router.get('/notifications', authController.getMyNotifications);
router.patch('/notifications/:id/read', authController.markNotificationRead);

// Departments & Directory Info
router.get('/departments', employeeController.getDepartments);
router.get('/team-leaders', employeeController.getTeamLeaders);

// Employee Attendance
router.post('/attendance/check-in', attendanceController.checkIn);
router.post('/attendance/check-out', attendanceController.checkOut);
router.get('/attendance/today', attendanceController.getTodayStatus);
router.get('/attendance/my-history', attendanceController.getMyHistory);

// Outside-Shift / External Work Entry (Accessible by Employees, TLs, and HR)
router.get('/outside-shift/colleges', outsideShiftController.getColleges);
router.get('/outside-shift/entries', outsideShiftController.getOutsideShiftEntries);
router.post('/outside-shift/entries', outsideShiftController.createOutsideShiftEntry);

// Employee Leaves
router.post('/leaves/apply', leaveController.applyLeave);
router.post('/leaves/:id/resubmit', leaveController.resubmitLeave);
router.get('/leaves/my-leaves', leaveController.getMyLeaves);
router.get('/leaves/:id/history', leaveController.getLeaveHistoryLogs);

// Employee Payroll & PDF Payslips
router.get('/payroll/my-slips', payrollController.getMySlips);
router.get('/payroll/slips/:id', payrollController.getPayslipDetails);
router.get('/payroll/slips/:id/pdf', payrollController.downloadPayslipPDF);

// Office locations info
router.get('/office/locations', officeController.getOfficeLocations);

// --- Team Leader (TL) Management Routes ---
const tlOrHr = requireRole(['TL', 'ADMIN', 'HR', 'HR_ADMIN']);
router.get('/tl/attendance', tlOrHr, attendanceController.getTeamAttendance);
router.get('/tl/team-members', tlOrHr, attendanceController.getTeamMembers);
router.get('/tl/leaves', tlOrHr, leaveController.getTeamLeaves);
router.patch('/tl/leaves/:id/action', tlOrHr, leaveController.tlActionLeave);

// --- HR & Admin Management Routes ---
const hrOrAdmin = requireRole(['ADMIN', 'HR', 'HR_ADMIN']);
const adminOnly = requireRole(['ADMIN', 'HR_ADMIN']);

// Employee Management
router.get('/employees', hrOrAdmin, employeeController.getEmployees);
router.post('/employees', hrOrAdmin, employeeController.createEmployee);
router.get('/employees/:id', hrOrAdmin, employeeController.getEmployeeById);
router.put('/employees/:id', hrOrAdmin, employeeController.updateEmployee);
router.delete('/employees/:id', adminOnly, employeeController.deleteEmployee);

// Attendance Oversight
router.get('/attendance/all', hrOrAdmin, attendanceController.getAllAttendance);
router.put('/attendance/:id/override', hrOrAdmin, attendanceController.manualOverride);
router.post('/attendance/manual-entry', hrOrAdmin, attendanceController.manualEntry);

// Leave Approval Workflow
router.get('/leaves/all', hrOrAdmin, leaveController.getAllLeaves);
router.patch('/leaves/:id/status', hrOrAdmin, leaveController.updateLeaveStatus);

// Automated Payroll Generation & Oversight
router.post('/payroll/generate', hrOrAdmin, payrollController.generatePayroll);
router.get('/payroll/records', hrOrAdmin, payrollController.getPayrollRecords);
router.patch('/payroll/:id/status', hrOrAdmin, payrollController.updatePayrollStatus);

// Geofence & Network Management
router.put('/office/locations/:id', adminOnly, officeController.updateOfficeLocation);
router.post('/office/sync-current', adminOnly, officeController.setOfficeToCurrentLocation);
router.get('/settings/network', hrOrAdmin, officeController.getNetworkSettings);
router.put('/settings/network', hrOrAdmin, officeController.updateNetworkSettings);

// Reports Export (Excel/CSV/JSON)
router.get('/reports/attendance', hrOrAdmin, reportController.exportAttendanceReport);
router.get('/reports/payroll', hrOrAdmin, reportController.exportPayrollReport);

// --- Security & Device Verification (Flowchart Section 2, 3, 5, 6) ---
// HR Impersonation (Login as Employee)
router.post('/hr/impersonate', hrOrAdmin, securityController.hrImpersonate);
router.post('/hr/impersonate/exit', hrOrAdmin, securityController.exitHrImpersonation);

// Employee Device Reset & Controlled Verification Codes
router.post('/employees/:id/reset-device', hrOrAdmin, securityController.resetEmployeeDevice);
router.post('/employees/:id/generate-verification-code', hrOrAdmin, securityController.generateHrVerificationCode);

// Security & Audit Logs
router.get('/security/login-logs', hrOrAdmin, securityController.getLoginSecurityLogs);
router.get('/security/impersonation-logs', hrOrAdmin, securityController.getHrImpersonationLogs);

// --- Live Location & Camera Feed Tracking (Work Hours Shift Monitoring) ---
router.post('/tracking/live-location', trackingController.updateLiveLocation);
router.post('/tracking/camera-feed', trackingController.updateCameraFeed);
router.get('/tracking/live-employees', hrOrAdmin, trackingController.getLiveEmployees);
router.get('/tracking/history/:userId', hrOrAdmin, trackingController.getEmployeeTrackingHistory);
router.post('/tracking/stop-session', trackingController.stopTrackingSession);

export default router;
