# UnitedSoft Attendance & Automated Payroll System

> **A cross-platform mobile application for Android & iOS built from a single codebase (React Native + Expo & TypeScript), powered by a dedicated Node.js/Express REST backend with SQLite relational database.**

---

## 🌟 Key Highlights & Business Capabilities

### 📱 1. Employee Digital Mobile Portal
- **GPS Geofenced Digital Check-In / Check-Out**: Computes distance to office using the Haversine formula and enforces presence within designated office boundary (e.g. 200m).
- **Biometric & Selfie Verification**: Captures TouchID / FaceID authentication and photo verification before logging attendance.
- **Dynamic Attendance Status**: Automatically flags check-ins after 09:15 AM as `LATE`, logs `PRESENT`, flags early departure (<4.5 hrs) as `HALF_DAY`, and tracks overtime (>8 hrs).
- **Attendance History & KPI Breakdown**: Monthly calendar summary displaying working hours, overtime hours, and check-in distances.
- **Digital Leave Management**:
  - Annual leave balances: Casual (12), Sick (10), Paid (15).
  - Apply for leave with real-time day calculation and status tracking (`PENDING`, `APPROVED`, `REJECTED`).
- **Automated Digital Payslips**:
  - View net take-home salary and itemized salary breakdown (Base, HRA, Allowances, Overtime pay, LOP, PF, Tax).
  - Exportable digital salary voucher modal.

### 👑 2. HR & Admin Oversight & Control Panel
- **Real-Time Executive Dashboard**: High-level headcount, present count today, late arrivals today, pending leave requests, and company-wide monthly payroll budget.
- **Employee Directory & Record Management**: Search staff, onboard new employees with customized salary structures, edit profiles, or deactivate records.
- **Attendance Oversight & HR Audit Override**: Real-time company attendance roster with filter by status/department, and manual override capability with audit trail logging.
- **Leave Approval Queue**: 1-Tap `Approve` or `Decline` action with audit remarks sent directly to the employee.
- **Automated Payroll Engine**:
  - 1-Click monthly calculation for all employees:
    $$\text{Gross} = \text{Base} + \text{HRA} + \text{Allowances} + \text{Overtime}$$
    $$\text{Net} = \text{Gross} - (\text{LOP} + \text{PF} + \text{Tax})$$
  - Automated deduction for unpaid leaves / absent days (Loss of Pay).
  - Disburse and mark salary as `PAID`.
- **Geofence Radar Configuration**: Edit office coordinates and radius in meters, plus a "Sync Office to My GPS Location" one-tap testing button.

---

## ⚡ Quick Start Guide

### Prerequisites
- Node.js (v18+ or v24+)
- npm

---

### Step 1: Start the Backend API Server
The backend runs on port `5000` with pre-seeded demo data (HR Director, employees, office location, and historical logs).

```powershell
# Open terminal 1
cd "e:\UnitedSoft Attendance system\backend"
npm install
npm start
```
> The API server will be live at `http://localhost:5000` and health check at `http://localhost:5000/api/health`.

---

### Step 2: Start the Mobile Application (Android, iOS & Web)

```powershell
# Open terminal 2
cd "e:\UnitedSoft Attendance system\mobile"
npm install
npm start
```

#### Choose your target platform:
- **Android Device / Emulator**: Press `a` in the terminal, or scan the QR code with **Expo Go** on Android.
- **iOS Device / Simulator**: Press `i` in the terminal, or scan the QR code with the iOS Camera app into **Expo Go**.
- **Web Browser Preview**: Press `w` in the terminal or run `npm run web` to preview the responsive mobile app in your browser!

---

## 🔑 Pre-Seeded Demo Accounts

You can log in instantly using the pre-configured accounts:

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **HR / Admin** | `admin@unitedsoft.com` | `admin123` | Sarah Jenkins (HR Director & System Admin) |
| **Employee (Engineering)** | `12234` | `Password@123` | Alex Morgan (Senior Full Stack Engineer) |
| **Employee (Engineering)** | `12235` | `Password@123` | Elena Vance (Lead UI/UX Designer) |
| **Employee (Engineering)** | `12236` | `Password@123` | David Chen (QA Specialist) |

*(Quick 1-tap demo login buttons are also provided on the mobile login screen).*

---

## 📂 Project Architecture

```
e:\UnitedSoft Attendance system\
├── backend/
│   ├── data/
│   │   └── attendance.sqlite       # Local SQLite database
│   ├── src/
│   │   ├── config.js               # Environment settings & office default coords
│   │   ├── db.js                   # Node SQLite database initialization & seeding
│   │   ├── middleware/
│   │   │   └── auth.js             # JWT verification & Role-Based Access Control
│   │   ├── utils/
│   │   │   └── geo.js              # Haversine distance & geofence validation
│   │   ├── services/
│   │   │   └── payrollService.js   # Automated monthly payroll calculation engine
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── attendanceController.js
│   │   │   ├── employeeController.js
│   │   │   ├── leaveController.js
│   │   │   ├── payrollController.js
│   │   │   └── officeController.js
│   │   ├── routes/
│   │   │   └── api.js              # REST endpoints
│   │   └── server.js               # Express application entrypoint
│   └── package.json
│
└── mobile/
    ├── src/
    │   ├── api/
    │   │   └── client.ts           # Unified API fetch client with AsyncStorage token
    │   ├── context/
    │   │   └── AuthContext.tsx     # Role, user session, and demo switcher
    │   ├── services/
    │   │   └── deviceService.ts    # GPS geofencing & biometric authentication
    │   ├── theme.ts                # Corporate design system tokens
    │   ├── types.ts                # TypeScript domain models
    │   ├── components/
    │   │   ├── Button.tsx
    │   │   ├── Header.tsx
    │   │   └── StatusBadge.tsx
    │   └── screens/
    │       ├── LoginScreen.tsx
    │       ├── employee/
    │       │   ├── EmployeeHomeScreen.tsx
    │       │   ├── AttendanceHistoryScreen.tsx
    │       │   ├── LeaveScreen.tsx
    │       │   ├── PayrollScreen.tsx
    │       │   └── ProfileScreen.tsx
    │       └── admin/
    │           ├── AdminDashboardScreen.tsx
    │           ├── AdminEmployeesScreen.tsx
    │           ├── AdminAttendanceScreen.tsx
    │           ├── AdminLeavesScreen.tsx
    │           ├── AdminPayrollScreen.tsx
    │           └── AdminGeofenceScreen.tsx
    ├── App.tsx                     # Main app root & bottom tab navigation
    └── package.json
```

---

## 🔒 Security & Verification Highlights
1. **Haversine Geofencing**: Ensures attendance cannot be spoofed outside the defined office radius.
2. **Local Biometric Challenge**: Leverages device hardware (Face ID, Touch ID, Android Biometrics) before confirming check-in.
3. **Role-Based API Protection**: Strict JWT validation ensures employees cannot access other staff's payslips, modify geofence coordinates, or approve their own leaves.
