import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { api } from '../../api/client';
import { LeaveRecord } from '../../types';

type LeaveFilterTab = 'AWAITING_HR' | 'PENDING_TL' | 'APPROVED' | 'REJECTED' | 'ALL';

export const AdminLeavesScreen: React.FC = () => {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [activeTab, setActiveTab] = useState<LeaveFilterTab>('AWAITING_HR');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Action modal (Approve / Reject)
  const [actionLeave, setActionLeave] = useState<LeaveRecord | null>(null);
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Audit trail modal
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [auditLeave, setAuditLeave] = useState<LeaveRecord | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadLeaves();
  }, [selectedDept]);

  async function loadInitialData() {
    try {
      const [deptRes] = await Promise.all([
        api.getDepartments().catch(() => ({ departments: [] }))
      ]);
      setDepartments(deptRes.departments || []);
    } catch (e) {
      console.warn('Failed loading departments', e);
    }
    await loadLeaves();
  }

  async function loadLeaves() {
    try {
      setLoading(true);
      const res = await api.getAllLeaves({
        department: selectedDept || undefined
      });
      setLeaves(res.leaves || []);
    } catch (err) {
      console.warn('Failed to load leaves', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Filter leaves based on active tab
  const filteredLeaves = leaves.filter(lv => {
    if (activeTab === 'AWAITING_HR') {
      // TL approved, or direct to HR (no TL assigned)
      return lv.status === 'TL_APPROVED' || (lv.status === 'PENDING' && !(lv as any).tl_id);
    }
    if (activeTab === 'PENDING_TL') {
      return lv.status === 'PENDING' && !!(lv as any).tl_id;
    }
    if (activeTab === 'APPROVED') {
      return lv.status === 'APPROVED';
    }
    if (activeTab === 'REJECTED') {
      return lv.status === 'REJECTED';
    }
    return true; // ALL
  });

  // Count of awaiting HR review
  const awaitingHrCount = leaves.filter(
    lv => lv.status === 'TL_APPROVED' || (lv.status === 'PENDING' && !(lv as any).tl_id)
  ).length;

  const handleStartAction = (lv: LeaveRecord, type: 'APPROVED' | 'REJECTED') => {
    setActionLeave(lv);
    setActionType(type);
    setComment(
      type === 'APPROVED'
        ? 'Approved by HR Director'
        : 'Declined due to departmental project deadlines'
    );
  };

  const handleConfirmAction = async () => {
    if (!actionLeave) return;
    setSubmitting(true);
    try {
      await api.updateLeaveStatus(actionLeave.id, {
        status: actionType,
        comments: comment
      });
      Alert.alert('Status Updated', `Leave request has been ${actionType.toLowerCase()}`);
      setActionLeave(null);
      await loadLeaves();
    } catch (err: any) {
      Alert.alert('Action Failed', err.message || 'Error updating leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAuditTrail = async (item: LeaveRecord) => {
    setAuditLeave(item);
    setShowAuditModal(true);
    setLoadingAudit(true);
    try {
      const res = await api.getLeaveHistoryLogs(item.id);
      setAuditLogs(res.logs || []);
    } catch (e: any) {
      Alert.alert('Audit Log Error', e.message || 'Unable to retrieve audit history');
    } finally {
      setLoadingAudit(false);
    }
  };

  const renderTimeline = (item: LeaveRecord) => {
    const isSubmitted = true;
    const tlApproved = item.status === 'TL_APPROVED' || item.status === 'APPROVED' || !!item.tl_approved_at;
    const tlRejected = item.status === 'REJECTED' && !item.hr_approved_at && !!item.tl_remarks;
    const hrApproved = item.status === 'APPROVED';
    const hrRejected = item.status === 'REJECTED' && !!item.hr_remarks;

    return (
      <View style={styles.timelineWrap}>
        <Text style={styles.timelineTitle}>3-Step Approval Workflow</Text>
        <View style={styles.timelineSteps}>
          {/* Step 1: Requested */}
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, styles.stepCircleDone]}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </View>
            <Text style={styles.stepLabel}>Requested</Text>
            <Text style={[styles.stepSubLabel, { color: '#059669', fontWeight: '700' }]}>Submitted</Text>
          </View>

          <View style={[styles.stepConnector, (tlApproved || tlRejected) && styles.stepConnectorActive]} />

          {/* Step 2: TL Approval */}
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepCircle,
                tlApproved
                  ? styles.stepCircleDone
                  : tlRejected
                  ? styles.stepCircleRejected
                  : styles.stepCirclePending
              ]}
            >
              <Ionicons
                name={tlApproved ? 'checkmark' : tlRejected ? 'close' : 'time-outline'}
                size={12}
                color={tlApproved || tlRejected ? '#FFFFFF' : '#D97706'}
              />
            </View>
            <Text style={styles.stepLabel}>TL Approval</Text>
            <Text
              style={[
                styles.stepSubLabel,
                tlApproved && { color: '#059669', fontWeight: '700' },
                tlRejected && { color: '#DC2626', fontWeight: '700' }
              ]}
            >
              {tlApproved ? 'Approved' : tlRejected ? 'Rejected' : 'Pending'}
            </Text>
          </View>

          <View style={[styles.stepConnector, (hrApproved || hrRejected) && styles.stepConnectorActive]} />

          {/* Step 3: HR Approval */}
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepCircle,
                hrApproved
                  ? styles.stepCircleDone
                  : hrRejected
                  ? styles.stepCircleRejected
                  : styles.stepCirclePending
              ]}
            >
              <Ionicons
                name={hrApproved ? 'checkmark' : hrRejected ? 'close' : 'time-outline'}
                size={12}
                color={hrApproved || hrRejected ? '#FFFFFF' : '#D97706'}
              />
            </View>
            <Text style={styles.stepLabel}>HR Approval</Text>
            <Text
              style={[
                styles.stepSubLabel,
                hrApproved && { color: '#059669', fontWeight: '700' },
                hrRejected && { color: '#DC2626', fontWeight: '700' }
              ]}
            >
              {hrApproved ? 'Approved' : hrRejected ? 'Rejected' : 'Pending'}
            </Text>
          </View>
        </View>

        {/* TL Remarks */}
        {item.tl_remarks ? (
          <View style={styles.remarksBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="person-circle-outline" size={13} color="#0F766E" />
              <Text style={styles.remarksAuthor}>TL Remarks ({item.tl_name || 'Team Leader'}):</Text>
            </View>
            <Text style={styles.remarksContent}>{item.tl_remarks}</Text>
          </View>
        ) : null}

        {/* HR Remarks */}
        {item.hr_remarks || item.comments ? (
          <View style={[styles.remarksBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="shield-checkmark-outline" size={13} color="#166534" />
              <Text style={[styles.remarksAuthor, { color: '#166534' }]}>
                HR Remarks ({item.hr_name || item.approver_name || 'HR Admin'}):
              </Text>
            </View>
            <Text style={[styles.remarksContent, { color: '#15803D' }]}>
              {item.hr_remarks || item.comments}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderLeaveRow = ({ item }: { item: LeaveRecord }) => {
    const canHrAction = item.status === 'TL_APPROVED' || item.status === 'PENDING';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.empInfo}>
            <Text style={styles.empName}>{item.full_name || 'Employee'}</Text>
            <Text style={styles.empCode}>{item.employee_code} • {item.department}</Text>
          </View>
          <StatusBadge status={item.status} size="sm" />
        </View>

        <View style={styles.detailsBox}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{item.leave_type} LEAVE</Text>
            <Text style={styles.daysText}>({item.total_days} {item.total_days === 1 ? 'day' : 'days'})</Text>
          </View>

          <View style={styles.dateBox}>
            <Ionicons name="calendar-outline" size={14} color={theme.colors.textMuted} />
            <Text style={styles.dateText}>{item.start_date} → {item.end_date}</Text>
          </View>
        </View>

        <Text style={styles.reasonText}>Reason: "{item.reason}"</Text>

        {/* 3-Step Approval Timeline */}
        {renderTimeline(item)}

        {/* Card Actions Footer */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.auditBtn}
            onPress={() => handleOpenAuditTrail(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="receipt-outline" size={14} color={theme.colors.primary} />
            <Text style={styles.auditBtnText}>Audit Trail</Text>
          </TouchableOpacity>

          {canHrAction && (
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={[styles.btnAction, styles.btnReject]}
                onPress={() => handleStartAction(item, 'REJECTED')}
              >
                <Ionicons name="close" size={15} color={theme.colors.danger} />
                <Text style={styles.btnRejectText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnAction, styles.btnApprove]}
                onPress={() => handleStartAction(item, 'APPROVED')}
              >
                <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                <Text style={styles.btnApproveText}>Approve</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Department Filter Section */}
      {departments.length > 0 && (
        <View style={styles.deptFilterSection}>
          <View style={styles.deptFilterHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="business-outline" size={15} color="#0D9488" />
              <Text style={styles.deptFilterLabel}>Department Filter</Text>
            </View>
            {selectedDept ? (
              <TouchableOpacity onPress={() => setSelectedDept('')} activeOpacity={0.7}>
                <Text style={styles.clearFilterText}>All Departments</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.deptFilterChipsRow}
          >
            <TouchableOpacity
              style={[styles.deptChip, !selectedDept && styles.deptChipActive]}
              onPress={() => setSelectedDept('')}
            >
              <Text style={[styles.deptChipText, !selectedDept && styles.deptChipTextActive]}>
                All Departments
              </Text>
            </TouchableOpacity>

            {departments.map(dept => {
              const isSelected = selectedDept === dept;
              return (
                <TouchableOpacity
                  key={dept}
                  style={[styles.deptChip, isSelected && styles.deptChipActive]}
                  onPress={() => setSelectedDept(dept)}
                >
                  <Text style={[styles.deptChipText, isSelected && styles.deptChipTextActive]}>
                    {dept}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Status Filter Tabs */}
      <View style={styles.filtersBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
          <TouchableOpacity
            style={[styles.filterChip, activeTab === 'AWAITING_HR' && styles.filterChipActive]}
            onPress={() => setActiveTab('AWAITING_HR')}
          >
            <Text style={[styles.filterChipText, activeTab === 'AWAITING_HR' && styles.filterChipTextActive]}>
              Awaiting HR Review
            </Text>
            {awaitingHrCount > 0 && (
              <View style={[styles.tabBadge, activeTab === 'AWAITING_HR' ? styles.tabBadgeActive : styles.tabBadgeInactive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'AWAITING_HR' ? styles.tabBadgeTextActive : styles.tabBadgeTextInactive]}>
                  {awaitingHrCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeTab === 'PENDING_TL' && styles.filterChipActive]}
            onPress={() => setActiveTab('PENDING_TL')}
          >
            <Text style={[styles.filterChipText, activeTab === 'PENDING_TL' && styles.filterChipTextActive]}>
              Pending TL
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeTab === 'APPROVED' && styles.filterChipActive]}
            onPress={() => setActiveTab('APPROVED')}
          >
            <Text style={[styles.filterChipText, activeTab === 'APPROVED' && styles.filterChipTextActive]}>
              Approved
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeTab === 'REJECTED' && styles.filterChipActive]}
            onPress={() => setActiveTab('REJECTED')}
          >
            <Text style={[styles.filterChipText, activeTab === 'REJECTED' && styles.filterChipTextActive]}>
              Rejected
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeTab === 'ALL' && styles.filterChipActive]}
            onPress={() => setActiveTab('ALL')}
          >
            <Text style={[styles.filterChipText, activeTab === 'ALL' && styles.filterChipTextActive]}>
              All Requests
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main List */}
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading leave requests...</Text>
        </View>
      ) : filteredLeaves.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="folder-open-outline" size={48} color={theme.colors.textLight} />
          <Text style={styles.emptyText}>No leave requests matching criteria</Text>
          <Text style={styles.emptySubText}>
            {activeTab === 'AWAITING_HR'
              ? 'No pending leaves waiting for HR decision.'
              : 'Try changing the status tab or department filter.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredLeaves}
          keyExtractor={item => item.id}
          renderItem={renderLeaveRow}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadLeaves();
              }}
            />
          }
        />
      )}

      {/* Confirmation & Remarks Modal */}
      <Modal visible={!!actionLeave} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {actionType === 'APPROVED' ? 'Approve Leave Request' : 'Decline Leave Request'}
                </Text>
                <TouchableOpacity onPress={() => setActionLeave(null)}>
                  <Ionicons name="close" size={24} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.actionDesc}>
                Employee: <Text style={{ fontWeight: '800' }}>{actionLeave?.full_name}</Text> • {actionLeave?.department}
                {'\n'}Duration: {actionLeave?.total_days} {actionLeave?.total_days === 1 ? 'day' : 'days'} ({actionLeave?.start_date} → {actionLeave?.end_date})
              </Text>

              <Text style={styles.fieldLabel}>HR Decision Remarks</Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                value={comment}
                onChangeText={setComment}
                placeholder="Enter remarks or justification for the employee..."
                multiline
              />

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setActionLeave(null)}
                  variant="outline"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title={actionType === 'APPROVED' ? 'Confirm Approval' : 'Confirm Decline'}
                  onPress={handleConfirmAction}
                  loading={submitting}
                  variant={actionType === 'APPROVED' ? 'success' : 'danger'}
                  style={{ flex: 1.5 }}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Audit Trail Modal */}
      <Modal visible={showAuditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.auditModalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="receipt-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.modalTitle}>Leave Audit Trail</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAuditModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {auditLeave && (
              <View style={styles.auditEmpInfoBox}>
                <Text style={styles.auditEmpName}>{auditLeave.full_name} ({auditLeave.employee_code})</Text>
                <Text style={styles.auditLeaveDesc}>
                  {auditLeave.leave_type} Leave • {auditLeave.total_days} days ({auditLeave.start_date} to {auditLeave.end_date})
                </Text>
              </View>
            )}

            {loadingAudit ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={{ marginTop: 8, fontSize: 12, color: theme.colors.textMuted }}>
                  Fetching audit trail...
                </Text>
              </View>
            ) : auditLogs.length === 0 ? (
              <View style={{ padding: 25, alignItems: 'center' }}>
                <Ionicons name="information-circle-outline" size={32} color={theme.colors.textLight} />
                <Text style={{ marginTop: 6, fontSize: 13, color: theme.colors.textMuted }}>
                  No historical logs recorded for this leave.
                </Text>
              </View>
            ) : (
              <FlatList
                data={auditLogs}
                keyExtractor={(item, idx) => item.id || String(idx)}
                style={{ maxHeight: 380 }}
                renderItem={({ item, index }) => (
                  <View style={styles.auditLogItem}>
                    <View style={styles.auditLogHeader}>
                      <View style={styles.auditActionBadge}>
                        <Text style={styles.auditActionBadgeText}>{item.action}</Text>
                      </View>
                      <Text style={styles.auditTimeText}>
                        {item.created_at ? new Date(item.created_at).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        }) : ''}
                      </Text>
                    </View>
                    <Text style={styles.auditActorText}>
                      By: <Text style={{ fontWeight: '700' }}>{item.actor_name || 'System'}</Text> ({item.actor_role || 'STAFF'})
                    </Text>
                    {item.comments ? (
                      <Text style={styles.auditCommentText}>
                        "{item.comments}"
                      </Text>
                    ) : null}
                  </View>
                )}
              />
            )}

            <Button
              title="Close Audit Log"
              onPress={() => setShowAuditModal(false)}
              variant="outline"
              style={{ marginTop: 14 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  deptFilterSection: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  deptFilterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deptFilterLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F766E',
    letterSpacing: 0.3,
  },
  clearFilterText: {
    fontSize: 11.5,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  deptFilterChipsRow: {
    paddingRight: 10,
    gap: 6,
  },
  deptChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deptChipActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  deptChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  deptChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filtersBar: {
    paddingVertical: 8,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.full,
    backgroundColor: '#F1F5F9',
    marginRight: 8
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: theme.colors.textMuted
  },
  filterChipTextActive: {
    color: '#FFFFFF'
  },
  tabBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: '#FFFFFF',
  },
  tabBadgeInactive: {
    backgroundColor: '#DC2626',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  tabBadgeTextActive: {
    color: theme.colors.primary,
  },
  tabBadgeTextInactive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 24
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0'
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
    color: theme.colors.textMuted,
    marginTop: 1
  },
  detailsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md,
    padding: 8,
    marginVertical: 6
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  typeText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
    marginRight: 4
  },
  daysText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600'
  },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: 4
  },
  reasonText: {
    fontSize: 12.5,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 6
  },
  timelineWrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md,
    padding: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#EEF2F6'
  },
  timelineTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8
  },
  timelineSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8
  },
  stepItem: {
    alignItems: 'center',
    width: 78
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4
  },
  stepCircleDone: {
    backgroundColor: '#059669'
  },
  stepCirclePending: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#D97706'
  },
  stepCircleRejected: {
    backgroundColor: '#DC2626'
  },
  stepLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center'
  },
  stepSubLabel: {
    fontSize: 9.5,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 1
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: '#CBD5E1',
    marginTop: -16
  },
  stepConnectorActive: {
    backgroundColor: '#059669'
  },
  remarksBox: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: theme.borderRadius.sm,
    padding: 8,
    marginTop: 8
  },
  remarksAuthor: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0F766E'
  },
  remarksContent: {
    fontSize: 11.5,
    color: '#134E4A',
    marginTop: 2
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  auditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
    gap: 4
  },
  auditBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.colors.primary
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  btnAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.md,
  },
  btnReject: {
    backgroundColor: theme.colors.dangerBg,
    borderWidth: 1,
    borderColor: theme.colors.danger
  },
  btnRejectText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.danger,
    marginLeft: 4
  },
  btnApprove: {
    backgroundColor: theme.colors.success
  },
  btnApproveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 4
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 420
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text
  },
  actionDesc: {
    fontSize: 12.5,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginBottom: 12
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6
  },
  input: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: theme.colors.text
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 16
  },
  auditModalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    width: '95%',
    maxWidth: 440,
    maxHeight: '85%'
  },
  auditEmpInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  auditEmpName: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text
  },
  auditLeaveDesc: {
    fontSize: 11.5,
    color: theme.colors.textMuted,
    marginTop: 2
  },
  auditLogItem: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: theme.borderRadius.md,
    padding: 10,
    marginBottom: 8
  },
  auditLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  auditActionBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4
  },
  auditActionBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.primary
  },
  auditTimeText: {
    fontSize: 10,
    color: theme.colors.textMuted
  },
  auditActorText: {
    fontSize: 11.5,
    color: theme.colors.text,
    marginTop: 2
  },
  auditCommentText: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
    marginTop: 3
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: theme.colors.textMuted
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 10
  },
  emptySubText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
    textAlign: 'center'
  }
});
