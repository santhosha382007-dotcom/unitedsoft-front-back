import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { api } from '../../api/client';
import { downloadAttendanceReport, downloadPayrollReport } from '../../services/downloadService';

interface AdminDashboardProps {
  onNavigate: (tab: string) => void;
}

export const AdminDashboardScreen: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<any>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [downloadingAtt, setDownloadingAtt] = useState<boolean>(false);
  const [downloadingPay, setDownloadingPay] = useState<boolean>(false);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  function formatCheckInTime(dateStr?: string) {
    if (!dateStr) return '--:--';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return dateStr;
    }
  }

  function formatCheckInDate(dateStr?: string) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) {
        return 'Today';
      }
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }

  function formatLocationText(r: any) {
    const dist = r.distance_meters;
    if (dist !== undefined && dist !== null) {
      if (dist <= 150) {
        return 'Office (Within 150m • Salem HQ)';
      }
      if (dist < 1000) {
        return `Remote • ${Math.round(dist)}m from office`;
      }
      return `Remote • ${(dist / 1000).toFixed(1)} km from office`;
    }
    if (r.check_in_lat && r.check_in_lng) {
      return `GPS: ${r.check_in_lat.toFixed(4)}, ${r.check_in_lng.toFixed(4)}`;
    }
    return 'Location Recorded';
  }

  async function loadDashboardStats() {
    try {
      setLoading(true);
      const [empRes, attRes, leaveRes, payRes] = await Promise.all([
        api.getEmployees(),
        api.getAllAttendance(),
        api.getAllLeaves('PENDING'),
        api.getPayrollRecords('2026-09')
      ]);

      const totalEmployees = empRes.employees ? empRes.employees.length : 0;
      const allRecords = attRes.records || [];
      const presentCount = allRecords.filter((r: any) => r.status === 'PRESENT').length;
      const lateCount = allRecords.filter((r: any) => r.status === 'LATE').length;
      const pendingLeaves = leaveRes.pendingCount || 0;
      const totalPayroll = payRes.summary ? payRes.summary.totalNetPayout : 0;

      // Extract recent check-in members (sorted by check_in_time DESC, up to 6 members)
      const recent = allRecords
        .filter((r: any) => Boolean(r.check_in_time))
        .sort((a: any, b: any) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime())
        .slice(0, 6);

      setRecentCheckIns(recent);
      setStats({
        totalEmployees,
        presentCount,
        lateCount,
        pendingLeaves,
        totalPayroll
      });
    } catch (err) {
      console.warn('Failed to load dashboard stats', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadDashboardStats();
          }}
        />
      }
    >
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>HR & Admin Control Panel</Text>
        <Text style={styles.bannerSub}>Company Attendance & Payroll Overview</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading company metrics...</Text>
        </View>
      ) : (
        <>
          {/* Top KPI Cards Grid */}
          <View style={styles.grid}>
            {/* Total Employees */}
            <TouchableOpacity
              style={styles.kpiCard}
              activeOpacity={0.7}
              onPress={() => onNavigate('employees')}
            >
              <View style={[styles.kpiIcon, { backgroundColor: theme.colors.infoBg }]}>
                <Ionicons name="people" size={24} color={theme.colors.info} />
              </View>
              <Text style={styles.kpiValue}>{stats?.totalEmployees || 0}</Text>
              <Text style={styles.kpiLabel}>Total Staff</Text>
            </TouchableOpacity>

            {/* Present Today */}
            <TouchableOpacity
              style={styles.kpiCard}
              activeOpacity={0.7}
              onPress={() => onNavigate('attendance')}
            >
              <View style={[styles.kpiIcon, { backgroundColor: theme.colors.successBg }]}>
                <Ionicons name="checkmark-done" size={24} color={theme.colors.success} />
              </View>
              <Text style={[styles.kpiValue, { color: theme.colors.success }]}>
                {stats?.presentCount || 0}
              </Text>
              <Text style={styles.kpiLabel}>Present Today</Text>
            </TouchableOpacity>

            {/* Late Arrivals */}
            <TouchableOpacity
              style={styles.kpiCard}
              activeOpacity={0.7}
              onPress={() => onNavigate('attendance')}
            >
              <View style={[styles.kpiIcon, { backgroundColor: theme.colors.warningBg }]}>
                <Ionicons name="time" size={24} color={theme.colors.warning} />
              </View>
              <Text style={[styles.kpiValue, { color: theme.colors.warning }]}>
                {stats?.lateCount || 0}
              </Text>
              <Text style={styles.kpiLabel}>Late Arrivals</Text>
            </TouchableOpacity>

            {/* Pending Leaves */}
            <TouchableOpacity
              style={styles.kpiCard}
              activeOpacity={0.7}
              onPress={() => onNavigate('leaves')}
            >
              <View style={[styles.kpiIcon, { backgroundColor: theme.colors.purpleBg }]}>
                <Ionicons name="mail-unread" size={24} color={theme.colors.purple} />
              </View>
              <Text style={[styles.kpiValue, { color: theme.colors.purple }]}>
                {stats?.pendingLeaves || 0}
              </Text>
              <Text style={styles.kpiLabel}>Pending Leaves</Text>
            </TouchableOpacity>
          </View>

          {/* Monthly Payroll Quick Widget */}
          <TouchableOpacity
            style={styles.payrollWidget}
            activeOpacity={0.8}
            onPress={() => onNavigate('payroll')}
          >
            <View style={styles.payrollWidgetLeft}>
              <View style={styles.payrollWidgetIcon}>
                <Ionicons name="cash-outline" size={26} color="#FFFFFF" />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.payrollWidgetTitle}>Automated Monthly Payroll</Text>
                <Text style={styles.payrollWidgetSub}>Calculated based on digital attendance</Text>
              </View>
            </View>
            <Text style={styles.payrollWidgetAmount}>
              ₹{(stats?.totalPayroll || 0).toLocaleString('en-IN')}
            </Text>
          </TouchableOpacity>

          {/* Live Shift Radar & Camera Feed Showcase Banner */}
          <TouchableOpacity
            style={styles.liveRadarBanner}
            activeOpacity={0.85}
            onPress={() => onNavigate('tracking')}
          >
            <View style={styles.liveRadarBannerLeft}>
              <View style={styles.liveRadarPulseBox}>
                <Ionicons name="videocam" size={22} color="#FFFFFF" />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.liveRadarBannerTitle}>Live Employee Radar</Text>
                  <View style={styles.liveRadarTag}>
                    <View style={styles.liveRadarRedDot} />
                    <Text style={styles.liveRadarTagText}>CAMERA + GPS</Text>
                  </View>
                </View>
                <Text style={styles.liveRadarBannerSub}>
                  Live camera feeds & continuous GPS tracking for checked-in staff
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Section 3: HR Authorized Employee Access (Impersonation) & Security Quick Row */}
          <View style={styles.securityQuickRow}>
            <TouchableOpacity
              style={styles.securityQuickCard}
              activeOpacity={0.8}
              onPress={() => onNavigate('employees')}
            >
              <View style={[styles.securityQuickIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="swap-horizontal" size={18} color="#D97706" />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.securityQuickTitle}>Login as Staff</Text>
                <Text style={styles.securityQuickSub}>HR Mode Oversight</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.securityQuickCard}
              activeOpacity={0.8}
              onPress={() => onNavigate('employees')}
            >
              <View style={[styles.securityQuickIcon, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#4F46E5" />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.securityQuickTitle}>Security Logs</Text>
                <Text style={styles.securityQuickSub}>SIM & Device Ledger</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Recent Check In Members Section */}
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="time" size={19} color={theme.colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.sectionHeaderTitle}>Recent Check In Members</Text>
            </View>
            <TouchableOpacity onPress={() => onNavigate('attendance')} style={styles.viewAllBtn} activeOpacity={0.7}>
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          {recentCheckIns.length === 0 ? (
            <View style={styles.emptyRecentBox}>
              <Ionicons name="finger-print-outline" size={38} color={theme.colors.textLight} />
              <Text style={styles.emptyRecentTitle}>No Check-In Activity Yet</Text>
              <Text style={styles.emptyRecentSub}>Live employee punches with time & location will appear here</Text>
            </View>
          ) : (
            <View style={styles.recentList}>
              {recentCheckIns.map((r: any) => {
                const isWithinOffice = (r.distance_meters !== undefined && r.distance_meters !== null) ? r.distance_meters <= 150 : false;
                const isLate = r.status === 'LATE';
                const isPresent = r.status === 'PRESENT';

                return (
                  <TouchableOpacity
                    key={r.id}
                    style={styles.recentMemberCard}
                    activeOpacity={0.7}
                    onPress={() => onNavigate('attendance')}
                  >
                    <View style={[styles.memberAvatar, { backgroundColor: isWithinOffice ? theme.colors.primary : '#4338CA' }]}>
                      <Text style={styles.avatarInitial}>
                        {r.full_name ? r.full_name.charAt(0).toUpperCase() : 'U'}
                      </Text>
                    </View>

                    <View style={styles.memberInfo}>
                      <View style={styles.memberTopRow}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {r.full_name}
                        </Text>
                        <View
                          style={[
                            styles.statusPill,
                            isPresent
                              ? styles.statusPillSuccess
                              : isLate
                              ? styles.statusPillWarning
                              : styles.statusPillInfo
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              isPresent
                                ? { color: theme.colors.success }
                                : isLate
                                ? { color: theme.colors.warning }
                                : { color: theme.colors.info }
                            ]}
                          >
                            {isPresent ? 'Present' : isLate ? 'Late' : r.status || 'Checked In'}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.memberSub}>
                        {r.employee_code || 'EMP'} • {r.department || 'Staff'}
                      </Text>

                      <View style={styles.detailsRow}>
                        <View style={styles.detailItem}>
                          <Ionicons name="time-outline" size={13} color={theme.colors.textMuted} />
                          <Text style={styles.detailText}>
                            {formatCheckInDate(r.check_in_time)} {formatCheckInTime(r.check_in_time)}
                          </Text>
                        </View>

                        <View style={[styles.detailItem, { marginLeft: 10, flex: 1 }]}>
                          <Ionicons
                            name={isWithinOffice ? "business-outline" : "location-outline"}
                            size={13}
                            color={isWithinOffice ? "#059669" : "#2563EB"}
                          />
                          <Text
                            style={[
                              styles.detailText,
                              { color: isWithinOffice ? "#059669" : "#2563EB", fontWeight: '600' }
                            ]}
                            numberOfLines={1}
                          >
                            {formatLocationText(r)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Export Reports Section */}
          <Text style={[styles.sectionHeader, { marginTop: 14 }]}>Export Reports (Excel / CSV)</Text>
          <View style={styles.reportsRow}>
            <TouchableOpacity
              style={[styles.reportBtn, downloadingAtt && { opacity: 0.6 }]}
              disabled={downloadingAtt}
              onPress={async () => {
                setDownloadingAtt(true);
                try {
                  await downloadAttendanceReport();
                } catch (err: any) {
                  Alert.alert('Download Error', err.message || 'Could not export attendance report');
                } finally {
                  setDownloadingAtt(false);
                }
              }}
            >
              {downloadingAtt ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Ionicons name="document-text-outline" size={18} color={theme.colors.primary} />
              )}
              <Text style={styles.reportBtnText}>
                {downloadingAtt ? 'Downloading...' : 'Attendance CSV'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.reportBtn,
                { backgroundColor: theme.colors.successBg, borderColor: '#A7F3D0' },
                downloadingPay && { opacity: 0.6 }
              ]}
              disabled={downloadingPay}
              onPress={async () => {
                setDownloadingPay(true);
                try {
                  await downloadPayrollReport();
                } catch (err: any) {
                  Alert.alert('Download Error', err.message || 'Could not export payroll report');
                } finally {
                  setDownloadingPay(false);
                }
              }}
            >
              {downloadingPay ? (
                <ActivityIndicator size="small" color={theme.colors.success} />
              ) : (
                <Ionicons name="cloud-download-outline" size={18} color={theme.colors.success} />
              )}
              <Text style={[styles.reportBtnText, { color: theme.colors.success }]}>
                {downloadingPay ? 'Downloading...' : 'Payroll CSV'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 30
  },
  banner: {
    marginBottom: theme.spacing.md
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.text
  },
  bannerSub: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 2
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md
  },
  kpiCard: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3
  },
  kpiIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: '900',
    color: theme.colors.text
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginTop: 2
  },
  payrollWidget: {
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
    elevation: 3
  },
  payrollWidgetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  payrollWidgetIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center'
  },
  payrollWidgetTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  payrollWidgetSub: {
    fontSize: 11,
    color: '#93C5FD',
    marginTop: 2
  },
  payrollWidgetAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: '#6EE7B7',
    marginLeft: 10
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 12
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    marginRight: 2
  },
  recentList: {
    marginBottom: 14
  },
  recentMemberCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 12,
    marginBottom: 9,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800'
  },
  memberInfo: {
    flex: 1
  },
  memberTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  memberName: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    flex: 1,
    marginRight: 8
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm
  },
  statusPillSuccess: {
    backgroundColor: theme.colors.successBg
  },
  statusPillWarning: {
    backgroundColor: theme.colors.warningBg
  },
  statusPillInfo: {
    backgroundColor: theme.colors.infoBg
  },
  statusPillText: {
    fontSize: 10.5,
    fontWeight: '800'
  },
  memberSub: {
    fontSize: 11.5,
    color: theme.colors.textMuted,
    marginTop: 1,
    marginBottom: 6
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  detailText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginLeft: 4
  },
  emptyRecentBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderStyle: 'dashed'
  },
  emptyRecentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 8
  },
  emptyRecentSub: {
    fontSize: 11.5,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 4
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: theme.colors.textMuted
  },
  reportsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  reportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.infoBg,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 10,
    marginHorizontal: 4
  },
  reportBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
    marginLeft: 6
  },
  securityQuickRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12
  },
  securityQuickCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 10,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  securityQuickIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center'
  },
  securityQuickTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text
  },
  securityQuickSub: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 1
  },
  liveRadarBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4
  },
  liveRadarBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  liveRadarPulseBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center'
  },
  liveRadarBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  liveRadarTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(220, 38, 38, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DC2626'
  },
  liveRadarRedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444'
  },
  liveRadarTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FCA5A5'
  },
  liveRadarBannerSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 15
  }
});
