import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { theme } from './src/theme';
import { Header } from './src/components/Header';
import { LoginScreen } from './src/screens/LoginScreen';
import { FirstTimeChangePasswordModal } from './src/components/FirstTimeChangePasswordModal';
import { LoadingScreen } from './src/components/LoadingScreen';

// Employee Screens
import { EmployeeHomeScreen } from './src/screens/employee/EmployeeHomeScreen';
import { AttendanceHistoryScreen } from './src/screens/employee/AttendanceHistoryScreen';
import { TeamAttendanceScreen } from './src/screens/employee/TeamAttendanceScreen';
import { LeaveScreen } from './src/screens/employee/LeaveScreen';
import { PayrollScreen } from './src/screens/employee/PayrollScreen';
import { ProfileScreen } from './src/screens/employee/ProfileScreen';

// HR / Admin Screens
import { AdminDashboardScreen } from './src/screens/admin/AdminDashboardScreen';
import { AdminEmployeesScreen } from './src/screens/admin/AdminEmployeesScreen';
import { AdminAttendanceScreen } from './src/screens/admin/AdminAttendanceScreen';
import { AdminLeavesScreen } from './src/screens/admin/AdminLeavesScreen';
import { AdminPayrollScreen } from './src/screens/admin/AdminPayrollScreen';
import { AdminGeofenceScreen } from './src/screens/admin/AdminGeofenceScreen';
import { AdminLiveTrackingScreen } from './src/screens/admin/AdminLiveTrackingScreen';
import { AdminWebOnlyNoticeScreen } from './src/screens/admin/AdminWebOnlyNoticeScreen';
import { api } from './src/api/client';
import { LeaveRecord } from './src/types';

const MainApp: React.FC = () => {
  const { user, isLoading, impersonation, exitImpersonation } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('home');
  const [pageLoading, setPageLoading] = useState<boolean>(true);
  const [approvedLeaveAlert, setApprovedLeaveAlert] = useState<LeaveRecord | null>(null);
  const [pendingTLCount, setPendingTLCount] = useState<number>(0);
  const [showNotificationBar, setShowNotificationBar] = useState<boolean>(true);
  const insets = useSafeAreaInsets();

  const isAdmin = Boolean(user && ['ADMIN', 'HR_ADMIN'].includes(user.role) && !impersonation);
  const isHR = Boolean(user && user.role === 'HR' && !impersonation);
  const isTL = Boolean(user && user.role === 'TL' && !impersonation);
  const isEmployee = !isAdmin && !isHR && !isTL;

  // HR portal has dual modes: Self-Attendance (Punch & My History) & HR Management
  const [hrMode, setHrMode] = useState<'attendance' | 'management'>('attendance');

  // Ensure app UI is strictly below notification bar on ALL phones
  const topPadding = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 0) : insets.top;

  // Check if HR accepted any leave for employee to display bar notifications
  useEffect(() => {
    if (!user || isAdmin) {
      setApprovedLeaveAlert(null);
      return;
    }

    let isMounted = true;
    async function checkApprovedLeaves() {
      try {
        const res = await api.getMyLeaves();
        if (isMounted && res.leaves && Array.isArray(res.leaves)) {
          const approved = res.leaves.find((l: LeaveRecord) => l.status === 'APPROVED');
          if (approved) {
            setApprovedLeaveAlert(approved);
          } else {
            setApprovedLeaveAlert(null);
          }
        }
      } catch (err) {
        // Silently handle
      }
    }

    checkApprovedLeaves();
    const interval = setInterval(checkApprovedLeaves, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user, impersonation, isAdmin, activeTab]);

  // Check pending team leaves for Team Leaders to show badge counter
  useEffect(() => {
    if (!user || !isTL) {
      setPendingTLCount(0);
      return;
    }

    let isMounted = true;
    async function checkPendingTeamLeaves() {
      try {
        const res = await api.getTeamLeaves('PENDING');
        if (isMounted && res.leaves && Array.isArray(res.leaves)) {
          setPendingTLCount(res.leaves.length);
        }
      } catch (err) {
        // Silently handle
      }
    }

    checkPendingTeamLeaves();
    const interval = setInterval(checkPendingTeamLeaves, 12000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user, impersonation, isTL, activeTab]);

  // 2 seconds loading page for each and every page transition
  useEffect(() => {
    setPageLoading(true);
    const timer = setTimeout(() => {
      setPageLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [activeTab]);

  if (isLoading) {
    return <LoadingScreen pageName="UniSoft Team" />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  // Admin page is strictly restricted to Web Only
  if (isAdmin) {
    return <AdminWebOnlyNoticeScreen />;
  }

  const pageNames: Record<string, string> = {
    home: isHR && hrMode === 'management' ? 'HR Dashboard' : 'Punch Attendance',
    dashboard: 'HR Overview Dashboard',
    tracking: 'Live Staff Radar',
    history: 'Attendance History',
    team_attendance: 'Team Attendance',
    leaves: isHR && hrMode === 'management' ? 'Leave Management' : isTL ? 'Team Leaves & Approvals' : 'Leave Requests',
    admin_leaves: 'Leave Management & Approvals',
    payroll: 'Payroll Notifications',
    admin_payroll: 'Company Payroll Management',
    profile: 'Staff Profile',
    employees: 'Staff Directory',
    attendance: 'Live Company Attendance',
    geofence: 'Geofence Settings'
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <Header />

      {/* HR MODE BANNER (Flowchart Section 3 & Rule 9) */}
      {impersonation && (
        <View style={styles.hrModeBanner}>
          <View style={styles.hrModeLeft}>
            <View style={styles.hrModeBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#FFFFFF" />
              <Text style={styles.hrModeBadgeText}>HR MODE</Text>
            </View>
            <View style={styles.hrModeTextCol}>
              <Text style={styles.hrModeMainText} numberOfLines={1}>
                Viewing as Employee: <Text style={{ fontWeight: '800' }}>{impersonation.employeeCode}</Text> | {impersonation.employeeName}
              </Text>
              <Text style={styles.hrModeSubText} numberOfLines={1}>
                Authorized HR Session • {impersonation.hrAdminName}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.exitHrModeBtn}
            onPress={async () => {
              await exitImpersonation();
              setActiveTab('home');
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="exit-outline" size={14} color="#FFFFFF" />
            <Text style={styles.exitHrModeBtnText}>Exit View</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pop up notification in the bar when HR accepts leave */}
      {!isAdmin && approvedLeaveAlert && showNotificationBar && (
        <View style={styles.topNotificationBar}>
          <TouchableOpacity
            style={styles.topNotificationBarContent}
            onPress={() => {
              if (isHR) setHrMode('attendance');
              setActiveTab('leaves');
            }}
            activeOpacity={0.8}
          >
            <View style={styles.topNotificationIconCircle}>
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.topNotificationTextCol}>
              <Text style={styles.topNotificationTitle}>Leave Approved by HR!</Text>
              <Text style={styles.topNotificationSub} numberOfLines={1}>
                {approvedLeaveAlert.leave_type} Leave ({approvedLeaveAlert.start_date} → {approvedLeaveAlert.end_date}) was accepted. Tap to view.
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topNotificationCloseBtn}
            onPress={() => setShowNotificationBar(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* HR Dual-Mode Switcher: Self-Attendance System vs. HR Management Panel */}
      {isHR && (
        <View style={styles.hrSegmentContainer}>
          <TouchableOpacity
            style={[styles.hrSegmentBtn, hrMode === 'attendance' && styles.hrSegmentBtnActive]}
            onPress={() => {
              setHrMode('attendance');
              setActiveTab('home');
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="finger-print"
              size={15}
              color={hrMode === 'attendance' ? '#FFFFFF' : theme.colors.primary}
            />
            <Text style={[styles.hrSegmentText, hrMode === 'attendance' && styles.hrSegmentTextActive]}>
              My Attendance
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.hrSegmentBtn, hrMode === 'management' && styles.hrSegmentBtnActive]}
            onPress={() => {
              setHrMode('management');
              setActiveTab('dashboard');
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="business"
              size={15}
              color={hrMode === 'management' ? '#FFFFFF' : theme.colors.primary}
            />
            <Text style={[styles.hrSegmentText, hrMode === 'management' && styles.hrSegmentTextActive]}>
              HR Management
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Mandatory First-Time Password Change Modal */}
      <FirstTimeChangePasswordModal
        visible={Boolean(user.must_change_password) && !impersonation}
        onSuccess={() => {}}
      />

      {/* Main Content Area */}
      <View style={styles.screenContainer}>
        {pageLoading ? (
          <LoadingScreen pageName={pageNames[activeTab] || 'UniSoft Team'} />
        ) : isHR ? (
          hrMode === 'management' ? (
            <>
              {activeTab === 'dashboard' && (
                <AdminDashboardScreen
                  onNavigate={(tab) => {
                    if (tab === 'leaves') setActiveTab('admin_leaves');
                    else if (tab === 'payroll') setActiveTab('admin_payroll');
                    else setActiveTab(tab);
                  }}
                />
              )}
              {activeTab === 'tracking' && <AdminLiveTrackingScreen />}
              {activeTab === 'employees' && <AdminEmployeesScreen />}
              {activeTab === 'attendance' && <AdminAttendanceScreen />}
              {activeTab === 'admin_leaves' && <AdminLeavesScreen />}
              {activeTab === 'admin_payroll' && <AdminPayrollScreen />}
              {activeTab === 'geofence' && <AdminGeofenceScreen />}
            </>
          ) : (
            <>
              {activeTab === 'home' && <EmployeeHomeScreen />}
              {activeTab === 'history' && <AttendanceHistoryScreen />}
              {activeTab === 'leaves' && <LeaveScreen />}
              {activeTab === 'payroll' && <PayrollScreen />}
              {activeTab === 'profile' && <ProfileScreen />}
            </>
          )
        ) : isTL ? (
          <>
            {activeTab === 'home' && <EmployeeHomeScreen />}
            {activeTab === 'history' && <AttendanceHistoryScreen />}
            {activeTab === 'team_attendance' && <TeamAttendanceScreen />}
            {activeTab === 'leaves' && <LeaveScreen />}
            {activeTab === 'profile' && <ProfileScreen />}
          </>
        ) : (
          <>
            {activeTab === 'home' && <EmployeeHomeScreen />}
            {activeTab === 'history' && <AttendanceHistoryScreen />}
            {activeTab === 'leaves' && <LeaveScreen />}
            {activeTab === 'payroll' && <PayrollScreen />}
            {activeTab === 'profile' && <ProfileScreen />}
          </>
        )}
      </View>

      {/* Bottom Navigation Tab Bar */}
      <View style={styles.bottomNav}>
        {isHR ? (
          hrMode === 'management' ? (
            <>
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('dashboard')}
              >
                <Ionicons
                  name={activeTab === 'dashboard' ? 'grid' : 'grid-outline'}
                  size={22}
                  color={activeTab === 'dashboard' ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text style={[styles.navText, activeTab === 'dashboard' && styles.navTextActive]}>
                  Dashboard
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('tracking')}
              >
                <Ionicons
                  name={activeTab === 'tracking' ? 'videocam' : 'videocam-outline'}
                  size={22}
                  color={activeTab === 'tracking' ? '#DC2626' : theme.colors.textMuted}
                />
                <Text
                  style={[
                    styles.navText,
                    activeTab === 'tracking' && { color: '#DC2626', fontWeight: '800' }
                  ]}
                >
                  Radar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('employees')}
              >
                <Ionicons
                  name={activeTab === 'employees' ? 'people' : 'people-outline'}
                  size={22}
                  color={activeTab === 'employees' ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text style={[styles.navText, activeTab === 'employees' && styles.navTextActive]}>
                  Staff
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('attendance')}
              >
                <Ionicons
                  name={activeTab === 'attendance' ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={22}
                  color={activeTab === 'attendance' ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text style={[styles.navText, activeTab === 'attendance' && styles.navTextActive]}>
                  Attendance
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('admin_leaves')}
              >
                <Ionicons
                  name={activeTab === 'admin_leaves' ? 'mail-unread' : 'mail-unread-outline'}
                  size={22}
                  color={activeTab === 'admin_leaves' ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text style={[styles.navText, activeTab === 'admin_leaves' && styles.navTextActive]}>
                  Leaves
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('admin_payroll')}
              >
                <Ionicons
                  name={activeTab === 'admin_payroll' ? 'calculator' : 'calculator-outline'}
                  size={22}
                  color={activeTab === 'admin_payroll' ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text style={[styles.navText, activeTab === 'admin_payroll' && styles.navTextActive]}>
                  Payroll
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('geofence')}
              >
                <Ionicons
                  name={activeTab === 'geofence' ? 'location' : 'location-outline'}
                  size={22}
                  color={activeTab === 'geofence' ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text style={[styles.navText, activeTab === 'geofence' && styles.navTextActive]}>
                  Geofence
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('home')}
              >
                <Ionicons
                  name={activeTab === 'home' ? 'finger-print' : 'finger-print-outline'}
                  size={22}
                  color={activeTab === 'home' ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text style={[styles.navText, activeTab === 'home' && styles.navTextActive]}>
                  Punch
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('history')}
              >
                <Ionicons
                  name={activeTab === 'history' ? 'calendar' : 'calendar-outline'}
                  size={22}
                  color={activeTab === 'history' ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text style={[styles.navText, activeTab === 'history' && styles.navTextActive]}>
                  History
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => {
                  setActiveTab('leaves');
                  setShowNotificationBar(false);
                }}
              >
                <View style={styles.navIconWrap}>
                  <Ionicons
                    name={activeTab === 'leaves' ? 'time' : 'time-outline'}
                    size={22}
                    color={activeTab === 'leaves' ? theme.colors.primary : theme.colors.textMuted}
                  />
                  {approvedLeaveAlert && (
                    <View style={styles.tabBadge}>
                      <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <Text style={[styles.navText, activeTab === 'leaves' && styles.navTextActive]}>
                  Leaves
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('payroll')}
              >
                <Ionicons
                  name={activeTab === 'payroll' ? 'notifications' : 'notifications-outline'}
                  size={22}
                  color={activeTab === 'payroll' ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text style={[styles.navText, activeTab === 'payroll' && styles.navTextActive]}>
                  Payroll
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('profile')}
              >
                <Ionicons
                  name={activeTab === 'profile' ? 'person' : 'person-outline'}
                  size={22}
                  color={activeTab === 'profile' ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text style={[styles.navText, activeTab === 'profile' && styles.navTextActive]}>
                  Profile
                </Text>
              </TouchableOpacity>
            </>
          )
        ) : isTL ? (
          <>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setActiveTab('home')}
            >
              <Ionicons
                name={activeTab === 'home' ? 'finger-print' : 'finger-print-outline'}
                size={22}
                color={activeTab === 'home' ? theme.colors.primary : theme.colors.textMuted}
              />
              <Text style={[styles.navText, activeTab === 'home' && styles.navTextActive]}>
                Punch
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setActiveTab('history')}
            >
              <Ionicons
                name={activeTab === 'history' ? 'calendar' : 'calendar-outline'}
                size={22}
                color={activeTab === 'history' ? theme.colors.primary : theme.colors.textMuted}
              />
              <Text style={[styles.navText, activeTab === 'history' && styles.navTextActive]}>
                History
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setActiveTab('team_attendance')}
            >
              <Ionicons
                name={activeTab === 'team_attendance' ? 'people' : 'people-outline'}
                size={22}
                color={activeTab === 'team_attendance' ? '#0D9488' : theme.colors.textMuted}
              />
              <Text
                style={[
                  styles.navText,
                  activeTab === 'team_attendance' && { color: '#0D9488', fontWeight: '800' }
                ]}
              >
                Team
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => {
                setActiveTab('leaves');
                setShowNotificationBar(false);
              }}
            >
              <View style={styles.navIconWrap}>
                <Ionicons
                  name={activeTab === 'leaves' ? 'time' : 'time-outline'}
                  size={22}
                  color={activeTab === 'leaves' ? theme.colors.primary : theme.colors.textMuted}
                />
                {pendingTLCount > 0 ? (
                  <View style={styles.tabBadgeNumber}>
                    <Text style={styles.tabBadgeNumberText}>{pendingTLCount}</Text>
                  </View>
                ) : approvedLeaveAlert ? (
                  <View style={styles.tabBadge}>
                    <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
              <Text style={[styles.navText, activeTab === 'leaves' && styles.navTextActive]}>
                Leaves
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setActiveTab('profile')}
            >
              <Ionicons
                name={activeTab === 'profile' ? 'person' : 'person-outline'}
                size={22}
                color={activeTab === 'profile' ? theme.colors.primary : theme.colors.textMuted}
              />
              <Text style={[styles.navText, activeTab === 'profile' && styles.navTextActive]}>
                Profile
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setActiveTab('home')}
            >
              <Ionicons
                name={activeTab === 'home' ? 'finger-print' : 'finger-print-outline'}
                size={22}
                color={activeTab === 'home' ? theme.colors.primary : theme.colors.textMuted}
              />
              <Text style={[styles.navText, activeTab === 'home' && styles.navTextActive]}>
                Punch
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setActiveTab('history')}
            >
              <Ionicons
                name={activeTab === 'history' ? 'calendar' : 'calendar-outline'}
                size={22}
                color={activeTab === 'history' ? theme.colors.primary : theme.colors.textMuted}
              />
              <Text style={[styles.navText, activeTab === 'history' && styles.navTextActive]}>
                History
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => {
                setActiveTab('leaves');
                setShowNotificationBar(false);
              }}
            >
              <View style={styles.navIconWrap}>
                <Ionicons
                  name={activeTab === 'leaves' ? 'time' : 'time-outline'}
                  size={22}
                  color={activeTab === 'leaves' ? theme.colors.primary : theme.colors.textMuted}
                />
                {approvedLeaveAlert && (
                  <View style={styles.tabBadge}>
                    <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                  </View>
                )}
              </View>
              <Text style={[styles.navText, activeTab === 'leaves' && styles.navTextActive]}>
                Leaves
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setActiveTab('payroll')}
            >
              <Ionicons
                name={activeTab === 'payroll' ? 'notifications' : 'notifications-outline'}
                size={22}
                color={activeTab === 'payroll' ? theme.colors.primary : theme.colors.textMuted}
              />
              <Text style={[styles.navText, activeTab === 'payroll' && styles.navTextActive]}>
                Payroll
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setActiveTab('profile')}
            >
              <Ionicons
                name={activeTab === 'profile' ? 'person' : 'person-outline'}
                size={22}
                color={activeTab === 'profile' ? theme.colors.primary : theme.colors.textMuted}
              />
              <Text style={[styles.navText, activeTab === 'profile' && styles.navTextActive]}>
                Profile
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  hrSegmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 4,
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  hrSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6
  },
  hrSegmentBtnActive: {
    backgroundColor: theme.colors.primary,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2
  },
  hrSegmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B'
  },
  hrSegmentTextActive: {
    color: '#FFFFFF'
  },
  screenContainer: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  hrModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#D97706'
  },
  hrModeLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8
  },
  hrModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#B45309',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4
  },
  hrModeBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5
  },
  hrModeTextCol: {
    flex: 1
  },
  hrModeMainText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#78350F'
  },
  hrModeSubText: {
    fontSize: 10,
    color: '#92400E'
  },
  exitHrModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#B45309',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  exitHrModeBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingVertical: 8,
    paddingHorizontal: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  navText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginTop: 2
  },
  navTextActive: {
    color: theme.colors.primary,
    fontWeight: '800'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: '600'
  },
  topNotificationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15803D',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#166534',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3
  },
  topNotificationBarContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  topNotificationIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8
  },
  topNotificationTextCol: {
    flex: 1
  },
  topNotificationTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  topNotificationSub: {
    fontSize: 11,
    color: '#DCFCE7',
    marginTop: 1
  },
  topNotificationCloseBtn: {
    padding: 6,
    marginLeft: 6
  },
  navIconWrap: {
    position: 'relative'
  },
  tabBadge: {
    position: 'absolute',
    top: -3,
    right: -8,
    backgroundColor: '#16A34A',
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF'
  },
  tabBadgeNumber: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#DC2626',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF'
  },
  tabBadgeNumberText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900'
  }
});
