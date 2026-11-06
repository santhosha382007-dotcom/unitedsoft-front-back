import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { api } from '../../api/client';
import { PayrollRecord } from '../../types';
import { downloadPayrollReport, downloadPayslipPdf } from '../../services/downloadService';

export const AdminPayrollScreen: React.FC = () => {
  const [monthYear, setMonthYear] = useState<string>('2026-09');
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [downloadingCsv, setDownloadingCsv] = useState<boolean>(false);
  const [downloadingSlipId, setDownloadingSlipId] = useState<string | null>(null);

  useEffect(() => {
    loadPayrollRecords();
  }, [monthYear]);

  async function loadPayrollRecords() {
    try {
      setLoading(true);
      const res = await api.getPayrollRecords(monthYear);
      setRecords(res.records || []);
      setSummary(res.summary || null);
    } catch (err) {
      console.warn('Failed to load payroll', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const handleRunPayroll = async () => {
    setGenerating(true);
    try {
      const res = await api.generatePayroll(monthYear);
      Alert.alert(
        'Payroll Computed Successfully',
        `Automated calculation processed for ${res.count} active employees in pay period ${res.month_year}.`
      );
      await loadPayrollRecords();
    } catch (err: any) {
      Alert.alert('Payroll Error', err.message || 'Error processing automated payroll');
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkAsPaid = async (rec: PayrollRecord) => {
    try {
      await api.updatePayrollStatus(rec.id, 'PAID');
      Alert.alert('Success', `Payroll marked as PAID for ${rec.full_name}`);
      await loadPayrollRecords();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const renderPayrollRow = ({ item }: { item: PayrollRecord }) => {
    const isPaid = item.status === 'PAID';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.empInfo}>
            <Text style={styles.empName}>{item.full_name}</Text>
            <Text style={styles.empCode}>{item.employee_code} • {item.department}</Text>
          </View>
          <StatusBadge status={item.status} size="sm" />
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Gross Pay</Text>
            <Text style={styles.metricValue}>₹{item.gross_salary.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Deductions (LOP+PF+Tax)</Text>
            <Text style={[styles.metricValue, { color: theme.colors.danger }]}>
              -₹{(item.lop_deduction + item.pf_deduction + item.tax_deduction).toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Net Salary</Text>
            <Text style={[styles.metricValue, { color: theme.colors.success }]}>
              ₹{item.net_salary.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        <View style={styles.attendanceRow}>
          <Text style={styles.attendanceText}>
            Workdays: {item.total_working_days} | Present: {item.present_days}d | LOP: {item.unpaid_leave_days}d | OT: {item.overtime_hours}h
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.pdfSlipBtn}
            disabled={downloadingSlipId === item.id}
            onPress={async () => {
              setDownloadingSlipId(item.id);
              try {
                await downloadPayslipPdf(item.id, item.employee_code, item.month_year);
              } catch (e: any) {
                Alert.alert('Download Error', e.message || 'Could not download PDF payslip');
              } finally {
                setDownloadingSlipId(null);
              }
            }}
          >
            {downloadingSlipId === item.id ? (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 4 }} />
            ) : (
              <Ionicons name="document-text-outline" size={15} color={theme.colors.primary} style={{ marginRight: 4 }} />
            )}
            <Text style={styles.pdfSlipBtnText}>
              {downloadingSlipId === item.id ? 'Downloading...' : 'PDF Slip'}
            </Text>
          </TouchableOpacity>

          {!isPaid && (
            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => handleMarkAsPaid(item)}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color={theme.colors.success} />
              <Text style={styles.payBtnText}>Disburse / Mark as Paid</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Run Payroll Hero Section */}
      <View style={styles.engineHero}>
        <View style={styles.engineTop}>
          <View>
            <Text style={styles.engineTitle}>Automated Payroll Engine</Text>
            <Text style={styles.engineSub}>Period: {monthYear}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <TouchableOpacity
              style={[styles.csvBtn, downloadingCsv && { opacity: 0.6 }]}
              disabled={downloadingCsv}
              onPress={async () => {
                setDownloadingCsv(true);
                try {
                  await downloadPayrollReport(monthYear);
                } catch (e: any) {
                  Alert.alert('Download Error', e.message || 'Could not export payroll report');
                } finally {
                  setDownloadingCsv(false);
                }
              }}
              activeOpacity={0.8}
            >
              {downloadingCsv ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 4 }} />
              ) : (
                <Ionicons name="cloud-download-outline" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
              )}
              <Text style={styles.csvBtnText}>{downloadingCsv ? '...' : 'CSV'}</Text>
            </TouchableOpacity>

            <Button
              title="⚡ Run Payroll"
              onPress={handleRunPayroll}
              loading={generating}
              style={styles.runBtn}
              textStyle={{ fontSize: 13 }}
            />
          </View>
        </View>

        {summary && (
          <View style={styles.financialsRow}>
            <View style={styles.finCol}>
              <Text style={styles.finLabel}>Total Gross</Text>
              <Text style={styles.finValue}>₹{Math.round(summary.totalGross).toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.finDivider} />
            <View style={styles.finCol}>
              <Text style={styles.finLabel}>Deductions</Text>
              <Text style={[styles.finValue, { color: '#FCA5A5' }]}>
                -₹{Math.round(summary.totalDeductions).toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.finDivider} />
            <View style={styles.finCol}>
              <Text style={styles.finLabel}>Net Company Payout</Text>
              <Text style={[styles.finValue, { color: '#6EE7B7' }]}>
                ₹{Math.round(summary.totalNetPayout).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Roster List */}
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Fetching company payroll vouchers...</Text>
        </View>
      ) : records.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="cash-outline" size={48} color={theme.colors.textLight} />
          <Text style={styles.emptyText}>No payroll records for {monthYear}</Text>
          <Text style={styles.emptySub}>Tap "⚡ Run Payroll" above to automatically calculate.</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={item => item.id}
          renderItem={renderPayrollRow}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadPayrollRecords();
              }}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  engineHero: {
    backgroundColor: theme.colors.primaryDark,
    padding: theme.spacing.md,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4
  },
  engineTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  engineTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  engineSub: {
    fontSize: 12,
    color: '#93C5FD',
    marginTop: 2
  },
  csvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    height: 38,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)'
  },
  csvBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  runBtn: {
    height: 38,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 14
  },
  financialsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: theme.borderRadius.md,
    padding: 10
  },
  finCol: {
    alignItems: 'center',
    flex: 1
  },
  finLabel: {
    fontSize: 10,
    color: '#CBD5E1',
    fontWeight: '600'
  },
  finValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2
  },
  finDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)'
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 24
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  empInfo: {
    flex: 1
  },
  empName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text
  },
  empCode: {
    fontSize: 12,
    color: theme.colors.textMuted
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md,
    padding: 8,
    marginVertical: 6
  },
  metricItem: {
    alignItems: 'center',
    flex: 1
  },
  metricLabel: {
    fontSize: 10,
    color: theme.colors.textMuted
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 2
  },
  attendanceRow: {
    paddingVertical: 4
  },
  attendanceText: {
    fontSize: 11,
    color: theme.colors.textMuted
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  pdfSlipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  pdfSlipBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
    marginLeft: 2
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.successBg
  },
  payBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.success,
    marginLeft: 4
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
  emptyText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 10
  },
  emptySub: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
    textAlign: 'center'
  }
});
