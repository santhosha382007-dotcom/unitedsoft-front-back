import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { api } from '../../api/client';
import { LeaveRecord, LeaveType } from '../../types';

export const LeaveScreen: React.FC = () => {
  const { user } = useAuth();
  const isTL = user?.role === 'TL';

  const [activeTab, setActiveTab] = useState<'MY_LEAVES' | 'TEAM_LEAVES'>('MY_LEAVES');

  // Employee Leaves state
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // TL Team Leaves state
  const [teamLeaves, setTeamLeaves] = useState<LeaveRecord[]>([]);
  const [loadingTeamLeaves, setLoadingTeamLeaves] = useState<boolean>(false);

  // Pop-up notification for HR approved leave
  const [showApprovalPopup, setShowApprovalPopup] = useState<boolean>(false);
  const [latestApprovedLeave, setLatestApprovedLeave] = useState<LeaveRecord | null>(null);

  // Apply leave modal
  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('CASUAL');
  const [startDate, setStartDate] = useState<string>('2026-10-08');
  const [endDate, setEndDate] = useState<string>('2026-10-09');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Resubmit leave modal
  const [showResubmitModal, setShowResubmitModal] = useState<boolean>(false);
  const [resubmitTarget, setResubmitTarget] = useState<LeaveRecord | null>(null);
  const [resubmitStartDate, setResubmitStartDate] = useState<string>('');
  const [resubmitEndDate, setResubmitEndDate] = useState<string>('');
  const [resubmitReason, setResubmitReason] = useState<string>('');
  const [submittingResubmit, setSubmittingResubmit] = useState<boolean>(false);

  // TL Action Modal (Approve / Reject)
  const [showActionModal, setShowActionModal] = useState<boolean>(false);
  const [actionTarget, setActionTarget] = useState<LeaveRecord | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [actionRemarks, setActionRemarks] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  // Audit Logs Modal
  const [showLogsModal, setShowLogsModal] = useState<boolean>(false);
  const [selectedLeaveLogs, setSelectedLeaveLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  useEffect(() => {
    loadLeaves();
    if (isTL) {
      loadTeamLeaves();
    }
  }, [isTL]);

  async function loadLeaves() {
    try {
      setLoading(true);
      const res = await api.getMyLeaves();
      const leavesList: LeaveRecord[] = res.leaves || [];
      setLeaves(leavesList);

      // Check if HR has approved any leave
      const approvedList = leavesList.filter((l) => l.status === 'APPROVED');
      if (approvedList.length > 0) {
        setLatestApprovedLeave(approvedList[0]);
      } else {
        setLatestApprovedLeave(null);
      }
    } catch (err) {
      console.warn('Failed to load leaves', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadTeamLeaves() {
    try {
      setLoadingTeamLeaves(true);
      const res = await api.getTeamLeaves();
      setTeamLeaves(res.leaves || []);
    } catch (err) {
      console.warn('Failed to load team leaves', err);
    } finally {
      setLoadingTeamLeaves(false);
    }
  }

  const handleApplyLeave = async () => {
    if (!reason.trim()) {
      Alert.alert('Required', 'Please enter a reason for the leave');
      return;
    }
    if (!startDate || !endDate) {
      Alert.alert('Required', 'Please enter valid start and end dates (YYYY-MM-DD)');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.applyLeave({
        leave_type: leaveType,
        start_date: startDate.trim(),
        end_date: endDate.trim(),
        reason: reason.trim()
      });
      Alert.alert('Submitted', res.message || 'Leave applied successfully and sent to Team Leader for review!');
      setShowApplyModal(false);
      setReason('');
      await loadLeaves();
    } catch (err: any) {
      Alert.alert('Application Failed', err.message || 'Error submitting leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenResubmit = (item: LeaveRecord) => {
    setResubmitTarget(item);
    setResubmitStartDate(item.start_date);
    setResubmitEndDate(item.end_date);
    setResubmitReason(item.reason);
    setShowResubmitModal(true);
  };

  const handleConfirmResubmit = async () => {
    if (!resubmitTarget) return;
    if (!resubmitReason.trim() || !resubmitStartDate || !resubmitEndDate) {
      Alert.alert('Required', 'Please fill in all dates and updated reason');
      return;
    }

    setSubmittingResubmit(true);
    try {
      const res = await api.resubmitLeave(resubmitTarget.id, {
        start_date: resubmitStartDate.trim(),
        end_date: resubmitEndDate.trim(),
        reason: resubmitReason.trim()
      });
      Alert.alert('Resubmitted', res.message || 'Leave request resubmitted for TL review');
      setShowResubmitModal(false);
      await loadLeaves();
    } catch (err: any) {
      Alert.alert('Resubmission Error', err.message || 'Failed to resubmit leave request');
    } finally {
      setSubmittingResubmit(false);
    }
  };

  const handleOpenTlAction = (item: LeaveRecord, action: 'APPROVE' | 'REJECT') => {
    setActionTarget(item);
    setActionType(action);
    setActionRemarks('');
    setShowActionModal(true);
  };

  const handleConfirmTlAction = async () => {
    if (!actionTarget) return;
    setSubmittingAction(true);
    try {
      const res = await api.tlActionLeave(actionTarget.id, {
        action: actionType,
        remarks: actionRemarks.trim()
      });
      Alert.alert(
        actionType === 'APPROVE' ? 'Approved & Escalated' : 'Request Rejected',
        res.message || 'Leave request updated successfully.'
      );
      setShowActionModal(false);
      await loadTeamLeaves();
    } catch (err: any) {
      Alert.alert('Action Failed', err.message || 'Failed to update leave request');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleViewAuditTrail = async (leaveId: string) => {
    setShowLogsModal(true);
    setLoadingLogs(true);
    try {
      const res = await api.getLeaveHistory(leaveId);
      setSelectedLeaveLogs(res.logs || []);
    } catch (err) {
      console.warn('Failed to load leave logs', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const pendingTeamLeavesCount = teamLeaves.filter(
    (l) => l.status === 'PENDING' || l.status === 'PENDING_TL' || l.status === 'RESUBMITTED'
  ).length;

  const renderTimeline = (item: LeaveRecord) => {
    // 3-step hierarchy: Employee -> TL Approval -> HR Approval
    const step1Done = true; // Always applied
    const tlApproved = item.tl_status === 'APPROVED' || item.status === 'PENDING_HR' || item.status === 'APPROVED';
    const tlRejected = item.tl_status === 'REJECTED' || (item.status === 'REJECTED' && !item.tl_status);
    const hrApproved = item.status === 'APPROVED' || item.hr_status === 'APPROVED';
    const hrRejected = item.hr_status === 'REJECTED';

    return (
      <View style={styles.timelineContainer}>
        <Text style={styles.timelineTitle}>Approval Timeline</Text>
        <View style={styles.stepperRow}>
          {/* Step 1: Requested */}
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, styles.stepCircleDone]}>
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            </View>
            <Text style={styles.stepLabel}>Requested</Text>
            <Text style={styles.stepSubLabel}>Employee</Text>
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
                size={14}
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
                size={14}
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

        {/* Remarks display */}
        {item.tl_remarks ? (
          <View style={styles.remarksBox}>
            <Text style={styles.remarksAuthor}>TL Remarks ({item.tl_name || 'Team Leader'}):</Text>
            <Text style={styles.remarksContent}>{item.tl_remarks}</Text>
          </View>
        ) : null}

        {item.hr_remarks || item.comments ? (
          <View style={[styles.remarksBox, { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' }]}>
            <Text style={[styles.remarksAuthor, { color: '#166534' }]}>
              HR Remarks ({item.hr_name || item.approver_name || 'HR Admin'}):
            </Text>
            <Text style={[styles.remarksContent, { color: '#15803D' }]}>
              {item.hr_remarks || item.comments}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderMyLeaveItem = ({ item }: { item: LeaveRecord }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.leaveTypeWrap}>
          <Text style={styles.leaveTypeTitle}>{item.leave_type} LEAVE</Text>
          <Text style={styles.daysCount}>
            {item.total_days} {item.total_days === 1 ? 'day' : 'days'}
          </Text>
        </View>
        <StatusBadge status={item.status} size="sm" />
      </View>

      <View style={styles.dateRangeBox}>
        <Ionicons name="calendar" size={15} color={theme.colors.primary} />
        <Text style={styles.dateRangeText}>
          {item.start_date} → {item.end_date}
        </Text>
      </View>

      <Text style={styles.reasonText}>"{item.reason}"</Text>

      {/* 3-Step Approval Timeline */}
      {renderTimeline(item)}

      <View style={styles.cardFooterActions}>
        <TouchableOpacity
          style={styles.auditLogLink}
          onPress={() => handleViewAuditTrail(item.id)}
          activeOpacity={0.7}
        >
          <Ionicons name="receipt-outline" size={14} color={theme.colors.primary} />
          <Text style={styles.auditLogLinkText}>Audit Trail</Text>
        </TouchableOpacity>

        {item.status === 'REJECTED' && (
          <TouchableOpacity
            style={styles.resubmitBtn}
            onPress={() => handleOpenResubmit(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={14} color="#FFFFFF" />
            <Text style={styles.resubmitBtnText}>Resubmit Request</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderTeamLeaveItem = ({ item }: { item: LeaveRecord }) => {
    const isPendingTl = item.status === 'PENDING' || item.status === 'PENDING_TL' || item.status === 'RESUBMITTED';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.staffNameText}>{item.full_name || 'Staff Member'}</Text>
            <Text style={styles.staffMetaText}>
              {item.employee_code || ''} • {item.department || ''}
            </Text>
          </View>
          <StatusBadge status={item.status} size="sm" />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6, gap: 8 }}>
          <View style={styles.categoryPill}>
            <Text style={styles.categoryPillText}>{item.leave_type}</Text>
          </View>
          <Text style={styles.dateRangeText}>
            {item.start_date} → {item.end_date} ({item.total_days} {item.total_days === 1 ? 'day' : 'days'})
          </Text>
        </View>

        <Text style={styles.reasonText}>"{item.reason}"</Text>

        {/* 3-Step Timeline */}
        {renderTimeline(item)}

        {/* TL Actions if pending TL review */}
        {isPendingTl && (
          <View style={styles.tlActionsRow}>
            <TouchableOpacity
              style={styles.tlRejectBtn}
              onPress={() => handleOpenTlAction(item, 'REJECT')}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
              <Text style={styles.tlRejectBtnText}>Reject</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tlApproveBtn}
              onPress={() => handleOpenTlAction(item, 'APPROVE')}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
              <Text style={styles.tlApproveBtnText}>Approve (Send to HR)</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.auditLogLink, { marginTop: 8 }]}
          onPress={() => handleViewAuditTrail(item.id)}
          activeOpacity={0.7}
        >
          <Ionicons name="receipt-outline" size={14} color={theme.colors.primary} />
          <Text style={styles.auditLogLinkText}>View Audit Trail</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Action Bar */}
      <View style={styles.topActionBar}>
        <View style={styles.topActionLeft}>
          <Text style={styles.pageHeading}>Leave Portal</Text>
          <Text style={styles.pageSubheading}>Multi-tier Approval Workflow (Employee → TL → HR)</Text>
        </View>
        <TouchableOpacity
          style={styles.applyLeavePrimaryBtn}
          onPress={() => setShowApplyModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.applyLeavePrimaryBtnText}>Apply Leave</Text>
        </TouchableOpacity>
      </View>

      {/* Role Navigation Segment Tabs for Team Leader (TL) */}
      {isTL && (
        <View style={styles.roleTabsContainer}>
          <TouchableOpacity
            style={[styles.roleTab, activeTab === 'MY_LEAVES' && styles.roleTabActive]}
            onPress={() => setActiveTab('MY_LEAVES')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="person-outline"
              size={16}
              color={activeTab === 'MY_LEAVES' ? '#FFFFFF' : theme.colors.textMuted}
            />
            <Text style={[styles.roleTabText, activeTab === 'MY_LEAVES' && styles.roleTabTextActive]}>
              My Leaves ({leaves.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roleTab, activeTab === 'TEAM_LEAVES' && styles.roleTabActive]}
            onPress={() => setActiveTab('TEAM_LEAVES')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="people-outline"
              size={16}
              color={activeTab === 'TEAM_LEAVES' ? '#FFFFFF' : theme.colors.textMuted}
            />
            <Text style={[styles.roleTabText, activeTab === 'TEAM_LEAVES' && styles.roleTabTextActive]}>
              TL Approval
            </Text>
            {pendingTeamLeavesCount > 0 && (
              <View style={styles.badgePill}>
                <Text style={styles.badgePillText}>{pendingTeamLeavesCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* HR Approved notification banner for employee */}
      {activeTab === 'MY_LEAVES' && latestApprovedLeave && (
        <View style={styles.pageNotificationBanner}>
          <View style={styles.notificationBannerHeader}>
            <View style={styles.notificationIconWrap}>
              <Ionicons name="checkmark-circle" size={20} color="#15803D" />
            </View>
            <View style={styles.notificationTextWrap}>
              <Text style={styles.notificationBannerTitle}>Leave Approved by HR!</Text>
              <Text style={styles.notificationBannerSubtitle}>
                Your {latestApprovedLeave.leave_type} leave ({latestApprovedLeave.start_date} → {latestApprovedLeave.end_date}) was approved.
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Main Content List */}
      {activeTab === 'MY_LEAVES' ? (
        loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading leave records...</Text>
          </View>
        ) : leaves.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="document-text-outline" size={48} color={theme.colors.textLight} />
            <Text style={styles.emptyTitle}>No Leave Applications Found</Text>
            <Text style={styles.emptySubtitle}>Tap "+ Apply Leave" above to request time off.</Text>
          </View>
        ) : (
          <FlatList
            data={leaves}
            keyExtractor={(item) => item.id}
            renderItem={renderMyLeaveItem}
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
        )
      ) : (
        loadingTeamLeaves && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading team leave requests...</Text>
          </View>
        ) : teamLeaves.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="checkmark-done-circle-outline" size={48} color={theme.colors.textLight} />
            <Text style={styles.emptyTitle}>No Team Leave Requests</Text>
            <Text style={styles.emptySubtitle}>No pending requests from your assigned team members.</Text>
          </View>
        ) : (
          <FlatList
            data={teamLeaves}
            keyExtractor={(item) => item.id}
            renderItem={renderTeamLeaveItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadTeamLeaves();
                }}
              />
            }
          />
        )
      )}

      {/* Apply Leave Modal */}
      <Modal visible={showApplyModal} transparent animationType="slide">
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
                <Text style={styles.modalTitle}>Apply For Leave</Text>
                <TouchableOpacity onPress={() => setShowApplyModal(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Leave Type Selector */}
              <Text style={styles.inputLabel}>Leave Category</Text>
              <View style={styles.typeSelector}>
                {(['CASUAL', 'SICK', 'PAID', 'UNPAID'] as LeaveType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeOption, leaveType === type && styles.typeOptionActive]}
                    onPress={() => setLeaveType(type)}
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        leaveType === type && styles.typeOptionTextActive
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Date Inputs */}
              <View style={styles.dateInputsRow}>
                <View style={styles.dateInputCol}>
                  <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="2026-10-08"
                  />
                </View>

                <View style={styles.dateInputCol}>
                  <Text style={styles.inputLabel}>End Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="2026-10-09"
                  />
                </View>
              </View>

              {/* Reason */}
              <Text style={styles.inputLabel}>Reason / Remarks</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={reason}
                onChangeText={setReason}
                placeholder="Reason for requesting leave..."
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setShowApplyModal(false)}
                  variant="outline"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Submit Application"
                  onPress={handleApplyLeave}
                  loading={submitting}
                  style={{ flex: 1.5 }}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Resubmit Leave Modal */}
      <Modal visible={showResubmitModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="refresh" size={20} color={theme.colors.primary} />
                  <Text style={styles.modalTitle}>Resubmit Leave Request</Text>
                </View>
                <TouchableOpacity onPress={() => setShowResubmitModal(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubDesc}>
                Update dates or address rejection feedback before submitting back to your Team Leader for review.
              </Text>

              <View style={styles.dateInputsRow}>
                <View style={styles.dateInputCol}>
                  <Text style={styles.inputLabel}>Start Date</Text>
                  <TextInput
                    style={styles.textInput}
                    value={resubmitStartDate}
                    onChangeText={setResubmitStartDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>

                <View style={styles.dateInputCol}>
                  <Text style={styles.inputLabel}>End Date</Text>
                  <TextInput
                    style={styles.textInput}
                    value={resubmitEndDate}
                    onChangeText={setResubmitEndDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Updated Reason & Explanation</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={resubmitReason}
                onChangeText={setResubmitReason}
                placeholder="Clarify or update reasons..."
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setShowResubmitModal(false)}
                  variant="outline"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Resubmit to TL"
                  onPress={handleConfirmResubmit}
                  loading={submittingResubmit}
                  style={{ flex: 1.5, backgroundColor: '#0D9488' }}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* TL Action Modal (Approve / Reject) */}
      <Modal visible={showActionModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons
                  name={actionType === 'APPROVE' ? 'checkmark-circle' : 'close-circle'}
                  size={22}
                  color={actionType === 'APPROVE' ? '#059669' : '#DC2626'}
                />
                <Text style={styles.modalTitle}>
                  {actionType === 'APPROVE' ? 'Approve & Send to HR' : 'Reject Leave Request'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowActionModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {actionTarget && (
              <View style={styles.actionTargetInfo}>
                <Text style={styles.actionTargetName}>
                  {actionTarget.full_name} ({actionTarget.employee_code})
                </Text>
                <Text style={styles.actionTargetDates}>
                  {actionTarget.leave_type} Leave: {actionTarget.start_date} → {actionTarget.end_date} ({actionTarget.total_days} days)
                </Text>
              </View>
            )}

            <Text style={styles.inputLabel}>
              {actionType === 'APPROVE' ? 'Team Leader Remarks (Optional)' : 'Rejection Reason / Feedback *'}
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={actionRemarks}
              onChangeText={setActionRemarks}
              placeholder={actionType === 'APPROVE' ? 'e.g. Recommended for approval' : 'e.g. Coverage required on project deadline'}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowActionModal(false)}
                variant="outline"
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title={actionType === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}
                onPress={handleConfirmTlAction}
                loading={submittingAction}
                variant={actionType === 'APPROVE' ? 'success' : 'danger'}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Audit Trail Modal */}
      <Modal visible={showLogsModal} transparent animationType="fade">
        <View style={styles.logsModalOverlay}>
          <View style={styles.logsModalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="receipt" size={20} color={theme.colors.primary} />
                <Text style={styles.modalTitle}>Leave Audit Trail</Text>
              </View>
              <TouchableOpacity onPress={() => setShowLogsModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {loadingLogs ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={{ marginTop: 8, fontSize: 12, color: theme.colors.textMuted }}>
                  Loading history logs...
                </Text>
              </View>
            ) : selectedLeaveLogs.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: theme.colors.textMuted }}>No audit records found.</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 360, marginTop: 8 }}>
                {selectedLeaveLogs.map((log, idx) => (
                  <View key={log.id || idx} style={styles.logItem}>
                    <View style={styles.logDot} />
                    <View style={styles.logContent}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.logAction}>{log.action_type || 'UPDATE'}</Text>
                        <Text style={styles.logTime}>
                          {log.created_at ? new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                        </Text>
                      </View>
                      <Text style={styles.logActor}>
                        By: {log.actor_name || 'System'} ({log.actor_role || ''})
                      </Text>
                      <Text style={styles.logTransition}>
                        Status: {log.from_status || 'NONE'} → <Text style={{ fontWeight: '800' }}>{log.to_status}</Text>
                      </Text>
                      {log.remarks ? <Text style={styles.logRemarks}>"{log.remarks}"</Text> : null}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            <Button
              title="Close"
              onPress={() => setShowLogsModal(false)}
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
  topActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  topActionLeft: {
    flex: 1
  },
  pageHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text
  },
  pageSubheading: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2
  },
  applyLeavePrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    elevation: 2,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3
  },
  applyLeavePrimaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },
  roleTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 4,
    marginHorizontal: theme.spacing.md,
    marginTop: 10,
    borderRadius: theme.borderRadius.lg
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: theme.borderRadius.md,
    gap: 6
  },
  roleTabActive: {
    backgroundColor: theme.colors.primary,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  roleTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted
  },
  roleTabTextActive: {
    color: '#FFFFFF'
  },
  badgePill: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10
  },
  badgePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900'
  },
  pageNotificationBanner: {
    marginHorizontal: theme.spacing.md,
    marginTop: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: theme.borderRadius.lg,
    padding: 10
  },
  notificationBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  notificationIconWrap: {
    marginRight: 8
  },
  notificationTextWrap: {
    flex: 1
  },
  notificationBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D'
  },
  notificationBannerSubtitle: {
    fontSize: 11.5,
    color: '#166534',
    marginTop: 2
  },
  listContent: {
    padding: theme.spacing.md,
    paddingTop: 8,
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
    marginBottom: 6
  },
  leaveTypeWrap: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  leaveTypeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.primary,
    marginRight: 8
  },
  daysCount: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted
  },
  staffNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text
  },
  staffMetaText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1
  },
  categoryPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm
  },
  categoryPillText: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '700'
  },
  dateRangeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  dateRangeText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: 4
  },
  reasonText: {
    fontSize: 12.5,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
    marginBottom: 6
  },
  timelineContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md,
    padding: 10,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  timelineTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  stepItem: {
    alignItems: 'center',
    flex: 1
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  stepCircleDone: {
    backgroundColor: '#059669'
  },
  stepCirclePending: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B'
  },
  stepCircleRejected: {
    backgroundColor: '#DC2626'
  },
  stepLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: theme.colors.text
  },
  stepSubLabel: {
    fontSize: 9.5,
    color: theme.colors.textMuted
  },
  stepConnector: {
    height: 2,
    flex: 0.6,
    backgroundColor: '#CBD5E1',
    marginBottom: 16
  },
  stepConnectorActive: {
    backgroundColor: '#059669'
  },
  remarksBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  remarksAuthor: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#92400E'
  },
  remarksContent: {
    fontSize: 11.5,
    color: '#78350F',
    marginTop: 2
  },
  cardFooterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6
  },
  auditLogLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  auditLogLinkText: {
    fontSize: 11.5,
    color: theme.colors.primary,
    fontWeight: '700'
  },
  resubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0D9488',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm
  },
  resubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700'
  },
  tlActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10
  },
  tlRejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    gap: 6
  },
  tlRejectBtnText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 12
  },
  tlApproveBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    gap: 6
  },
  tlApproveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
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
  emptyTitle: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: theme.spacing.md
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text
  },
  modalSubDesc: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 12,
    lineHeight: 16
  },
  actionTargetInfo: {
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: theme.borderRadius.md,
    marginBottom: 10
  },
  actionTargetName: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text
  },
  actionTargetDates: {
    fontSize: 11.5,
    color: theme.colors.textMuted,
    marginTop: 2
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
    marginTop: 8
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  typeOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    marginHorizontal: 3
  },
  typeOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.infoBg
  },
  typeOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted
  },
  typeOptionTextActive: {
    color: theme.colors.primary
  },
  dateInputsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  dateInputCol: {
    flex: 1,
    marginHorizontal: 3
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    height: 42,
    fontSize: 13,
    color: theme.colors.text
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
    paddingTop: 8
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 16
  },
  logsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  logsModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.xl,
    padding: 18,
    maxHeight: '85%'
  },
  logItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start'
  },
  logDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
    marginTop: 5,
    marginRight: 10
  },
  logContent: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  logAction: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text
  },
  logTime: {
    fontSize: 10,
    color: theme.colors.textMuted
  },
  logActor: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2
  },
  logTransition: {
    fontSize: 11.5,
    color: theme.colors.text,
    marginTop: 2
  },
  logRemarks: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#475569',
    marginTop: 4
  }
});
