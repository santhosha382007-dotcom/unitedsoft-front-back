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
import { AttendanceRecord, AttendanceStatus } from '../../types';
import { GeotagPhotoView } from '../../components/GeotagPhotoView';
import { downloadAttendanceReport } from '../../services/downloadService';

export const AdminAttendanceScreen: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [departments, setDepartments] = useState<string[]>([]);

  const availableMonths = React.useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      list.push({ key, label });
    }
    return list;
  }, []);

  const [monthFilter, setMonthFilter] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [downloadingCsv, setDownloadingCsv] = useState<boolean>(false);

  // Manual override modal
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [selectedSelfieRecord, setSelectedSelfieRecord] = useState<AttendanceRecord | null>(null);
  const [newStatus, setNewStatus] = useState<AttendanceStatus>('PRESENT');
  const [newHours, setNewHours] = useState<string>('8.0');
  const [overrideRemarks, setOverrideRemarks] = useState<string>('Adjusted by HR Admin');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Manual attendance entry for No Network spots
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [manualUserId, setManualUserId] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [manualStatus, setManualStatus] = useState<AttendanceStatus>('PRESENT');
  const [manualInTime, setManualInTime] = useState<string>('09:00 AM');
  const [manualOutTime, setManualOutTime] = useState<string>('06:00 PM');
  const [manualHours, setManualHours] = useState<string>('8.0');
  const [manualRemarks, setManualRemarks] = useState<string>('Employee in No Network spot - Verified by HR');
  const [manualSubmitting, setManualSubmitting] = useState<boolean>(false);

  // Outside-Shift Entry modal for HR
  const [showOutsideShiftModal, setShowOutsideShiftModal] = useState<boolean>(false);
  const [collegesList, setCollegesList] = useState<string[]>([
    'Salem Government Arts College',
    'Knowledge Institute of Technology',
    'Sona College of Technology',
    'Government College of Engineering'
  ]);
  const [selectedCollege, setSelectedCollege] = useState<string>('Salem Government Arts College');
  const [customCollege, setCustomCollege] = useState<string>('');
  const [outsideUserId, setOutsideUserId] = useState<string>('');
  const [outsideDate, setOutsideDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [outsideStartTime, setOutsideStartTime] = useState<string>('09:30 AM');
  const [outsideEndTime, setOutsideEndTime] = useState<string>('05:30 PM');
  const [outsidePurpose, setOutsidePurpose] = useState<string>('Campus Recruitment / Training');
  const [submittingOutsideShift, setSubmittingOutsideShift] = useState<boolean>(false);

  async function loadEmployees() {
    try {
      const res = await api.getEmployees();
      const list = res.employees || [];
      setEmployees(list);
      if (list.length > 0 && !manualUserId) {
        setManualUserId(list[0].id);
      }
      if (list.length > 0 && !outsideUserId) {
        setOutsideUserId(list[0].id);
      }
    } catch (e) {
      console.warn('Failed to load employees', e);
    }
  }

  async function loadDepartments() {
    try {
      const res = await api.getDepartments();
      setDepartments(res.departments || []);
    } catch (e) {
      console.warn('Failed to load departments', e);
    }
  }

  const handleOpenManualEntry = async () => {
    await loadEmployees();
    setManualDate(new Date().toISOString().split('T')[0]);
    setManualStatus('PRESENT');
    setManualHours('8.0');
    setManualRemarks('Employee in No Network spot - Verified by HR');
    setShowManualModal(true);
  };

  const handleOpenOutsideShift = async () => {
    await loadEmployees();
    try {
      const res = await api.getOutsideColleges();
      if (res?.colleges?.length) {
        setCollegesList(res.colleges);
        if (!selectedCollege) setSelectedCollege(res.colleges[0]);
      }
    } catch (e) {
      console.warn('Failed to load colleges', e);
    }
    setOutsideDate(new Date().toISOString().split('T')[0]);
    setShowOutsideShiftModal(true);
  };

  const handleSaveOutsideShift = async () => {
    const finalCollege = customCollege.trim() || selectedCollege;
    if (!finalCollege) {
      Alert.alert('Required', 'Please select or enter the College Name');
      return;
    }
    const targetEmp = employees.find(e => e.id === outsideUserId) || employees[0];
    setSubmittingOutsideShift(true);
    try {
      const res = await api.createOutsideShiftEntry({
        college_name: finalCollege,
        department: targetEmp?.department,
        staff_name: targetEmp?.full_name,
        date: outsideDate,
        start_time: outsideStartTime,
        end_time: outsideEndTime,
        purpose: outsidePurpose
      });
      Alert.alert('Outside-Shift Recorded', res.message || 'Outside-shift entry has been recorded');
      setShowOutsideShiftModal(false);
      setCustomCollege('');
      await loadAttendance();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record outside-shift entry');
    } finally {
      setSubmittingOutsideShift(false);
    }
  };

  const handleSaveManualEntry = async () => {
    if (!manualUserId) {
      Alert.alert('Required', 'Please select an employee');
      return;
    }
    setManualSubmitting(true);
    try {
      const res = await api.manualAttendanceEntry({
        user_id: manualUserId,
        date: manualDate,
        status: manualStatus,
        check_in_time: `${manualDate}T09:00:00.000Z`,
        check_out_time: `${manualDate}T18:00:00.000Z`,
        working_hours: parseFloat(manualHours) || 8.0,
        remarks: manualRemarks
      });
      Alert.alert('Attendance Recorded', res.message || 'Manual attendance recorded successfully');
      setShowManualModal(false);
      await loadAttendance();
    } catch (err: any) {
      Alert.alert('Submission Failed', err.message || 'Could not record manual attendance');
    } finally {
      setManualSubmitting(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [statusFilter, departmentFilter, monthFilter]);

  async function loadAttendance() {
    try {
      setLoading(true);
      const res = await api.getAllAttendance({
        status: statusFilter || undefined,
        department: departmentFilter || undefined,
        month: monthFilter || undefined
      });
      setRecords(res.records || []);
    } catch (err) {
      console.warn('Failed to load attendance', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const handleStartOverride = (rec: AttendanceRecord) => {
    setSelectedRecord(rec);
    setNewStatus(rec.status);
    setNewHours(String(rec.working_hours || 8));
  };

  const handleSaveOverride = async () => {
    if (!selectedRecord) return;
    setSubmitting(true);
    try {
      await api.overrideAttendance(selectedRecord.id, {
        status: newStatus,
        working_hours: parseFloat(newHours) || 8,
        remarks: overrideRemarks
      });
      Alert.alert('Updated', 'Attendance record updated successfully');
      setSelectedRecord(null);
      await loadAttendance();
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Error updating attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const renderAttendanceRow = ({ item }: { item: AttendanceRecord }) => {
    const inTime = item.check_in_time
      ? new Date(item.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '--:--';
    const outTime = item.check_out_time
      ? new Date(item.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '--:--';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.empInfo}>
            <Text style={styles.empName}>{item.full_name || 'Staff'}</Text>
            <Text style={styles.empSub}>{item.employee_code} • {item.department}</Text>
          </View>
          <StatusBadge status={item.status} size="sm" />
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Date</Text>
            <Text style={styles.metricValue}>{item.date}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>In / Out</Text>
            <Text style={styles.metricValue}>{inTime} - {outTime}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Hours</Text>
            <Text style={[styles.metricValue, { color: theme.colors.primary }]}>
              {item.working_hours}h {item.overtime_hours > 0 ? `(+${item.overtime_hours}h OT)` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <View style={styles.geoTag}>
            <Ionicons name="location" size={13} color={theme.colors.textMuted} />
            <Text style={styles.geoText}>
              {item.distance_meters !== undefined ? `${Math.round(item.distance_meters)}m from office` : 'Office'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {item.check_in_photo ? (
              <TouchableOpacity
                style={styles.selfieBtn}
                onPress={() => setSelectedSelfieRecord(item)}
              >
                <Ionicons name="camera" size={13} color="#059669" />
                <Text style={styles.selfieBtnText}>Selfie Proof</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.overrideBtn}
              onPress={() => handleStartOverride(item)}
            >
              <Ionicons name="create-outline" size={14} color={theme.colors.primary} />
              <Text style={styles.overrideBtnText}>HR Adjust</Text>
            </TouchableOpacity>
          </View>
        </View>

        {item.verification_method === 'HR_MANUAL_NO_NETWORK' && (
          <View style={styles.noNetBadgeRow}>
            <Ionicons name="cellular-outline" size={13} color="#B45309" style={{ marginRight: 4 }} />
            <Text style={styles.noNetBadgeText}>Manual Entry (No Network Spot)</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top HR Action Header */}
      <View style={styles.topHeaderCard}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.topHeaderTitle}>Daily Attendance Management</Text>
          <Text style={styles.topHeaderSub}>{records.length} records • Audit & External Work</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            style={[styles.exportCsvBtn, downloadingCsv && { opacity: 0.6 }]}
            disabled={downloadingCsv}
            onPress={async () => {
              setDownloadingCsv(true);
              try {
                await downloadAttendanceReport();
              } catch (e: any) {
                Alert.alert('Download Error', e.message || 'Could not export attendance');
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
            <Text style={styles.exportCsvBtnText}>{downloadingCsv ? '...' : 'CSV'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outsideShiftHeaderBtn}
            onPress={handleOpenOutsideShift}
            activeOpacity={0.8}
          >
            <Ionicons name="business" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.manualEntryBtnText}>Outside-Shift Entry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manualEntryBtn}
            onPress={handleOpenManualEntry}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.manualEntryBtnText}>Manual Punch</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Month Filter Section */}
      <View style={styles.filterSection}>
        <View style={styles.filterHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="filter-outline" size={15} color={theme.colors.primary} />
            <Text style={styles.filterLabel}>Month Filter</Text>
          </View>
          {monthFilter ? (
            <TouchableOpacity onPress={() => setMonthFilter('')} activeOpacity={0.7}>
              <Text style={styles.clearFilterText}>Show All Months</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.filterSubText}>All Time</Text>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          <TouchableOpacity
            style={[styles.filterChip, !monthFilter && styles.filterChipActive]}
            onPress={() => setMonthFilter('')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, !monthFilter && styles.filterChipTextActive]}>
              All Months
            </Text>
          </TouchableOpacity>
          {availableMonths.map((m) => {
            const isSelected = monthFilter === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setMonthFilter(m.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Department Filter Section */}
      {departments.length > 0 && (
        <View style={styles.filterSection}>
          <View style={styles.filterHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="business-outline" size={15} color="#0D9488" />
              <Text style={styles.filterLabel}>Department Filter</Text>
            </View>
            {departmentFilter ? (
              <TouchableOpacity onPress={() => setDepartmentFilter('')} activeOpacity={0.7}>
                <Text style={styles.clearFilterText}>All Departments</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipsRow}
          >
            <TouchableOpacity
              style={[styles.filterChip, !departmentFilter && styles.deptChipActive]}
              onPress={() => setDepartmentFilter('')}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, !departmentFilter && styles.filterChipTextActive]}>
                All Departments
              </Text>
            </TouchableOpacity>
            {departments.map((d) => {
              const isSelected = departmentFilter === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.filterChip, isSelected && styles.deptChipActive]}
                  onPress={() => setDepartmentFilter(d)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Status Filter Tabs */}
      <View style={styles.filtersBar}>
        {['', 'PRESENT', 'LATE', 'HALF_DAY'].map(f => (
          <TouchableOpacity
            key={f || 'ALL'}
            style={[styles.statusTabChip, statusFilter === f && styles.statusTabChipActive]}
            onPress={() => setStatusFilter(f)}
          >
            <Text style={[styles.statusTabChipText, statusFilter === f && styles.statusTabChipTextActive]}>
              {f ? f : 'ALL STATUSES'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading company attendance...</Text>
        </View>
      ) : records.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="time-outline" size={48} color={theme.colors.textLight} />
          <Text style={styles.emptyText}>No attendance records found</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={item => item.id}
          renderItem={renderAttendanceRow}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadAttendance();
              }}
            />
          }
        />
      )}

      {/* Manual Override Modal */}
      <Modal visible={!!selectedRecord} transparent animationType="slide">
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
                <Text style={styles.modalTitle}>HR Attendance Override</Text>
                <TouchableOpacity onPress={() => setSelectedRecord(null)}>
                  <Ionicons name="close" size={24} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.employeeBanner}>
                {selectedRecord?.full_name} ({selectedRecord?.employee_code}) • {selectedRecord?.date}
              </Text>

              <Text style={styles.fieldLabel}>Attendance Status</Text>
              <View style={styles.statusSelector}>
                {(['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT'] as AttendanceStatus[]).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusOption, newStatus === s && styles.statusOptionActive]}
                    onPress={() => setNewStatus(s)}
                  >
                    <Text style={[styles.statusOptionText, newStatus === s && styles.statusOptionTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Total Working Hours</Text>
              <TextInput
                style={styles.input}
                value={newHours}
                onChangeText={setNewHours}
                keyboardType="numeric"
              />

              <Text style={styles.fieldLabel}>Audit Remark / Reason for Adjustment</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                value={overrideRemarks}
                onChangeText={setOverrideRemarks}
                multiline
              />

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setSelectedRecord(null)}
                  variant="outline"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Apply Override"
                  onPress={handleSaveOverride}
                  loading={submitting}
                  style={{ flex: 1.5 }}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Geotagged Selfie Proof Viewer Modal */}
      <Modal visible={!!selectedSelfieRecord} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="camera" size={20} color="#059669" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Geotagged Selfie Verification</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedSelfieRecord(null)}>
                <Ionicons name="close" size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.employeeBanner}>
              {selectedSelfieRecord?.full_name} ({selectedSelfieRecord?.employee_code}) • {selectedSelfieRecord?.department}
            </Text>

            {selectedSelfieRecord?.check_in_photo && (
              <GeotagPhotoView
                photoUri={selectedSelfieRecord.check_in_photo}
                latitude={selectedSelfieRecord.check_in_lat}
                longitude={selectedSelfieRecord.check_in_lng}
                dateStr={selectedSelfieRecord.date}
                timeStr={
                  selectedSelfieRecord.check_in_time
                    ? new Date(selectedSelfieRecord.check_in_time).toLocaleTimeString()
                    : undefined
                }
                employeeName={selectedSelfieRecord.full_name}
                employeeCode={selectedSelfieRecord.employee_code}
                height={290}
              />
            )}

            <View style={styles.selfieAuditBox}>
              <Text style={styles.selfieAuditText}>
                Distance from Company: {selectedSelfieRecord?.distance_meters ? `${Math.round(selectedSelfieRecord.distance_meters)}m` : '0m'}
              </Text>
              <Text style={styles.selfieAuditText}>
                Verification: {selectedSelfieRecord?.verification_method || 'GPS_SELFIE_WATERMARK'}
              </Text>
              {selectedSelfieRecord?.remarks ? (
                <Text style={styles.selfieAuditSub}>Remarks: {selectedSelfieRecord.remarks}</Text>
              ) : null}
            </View>

            <Button
              title="Close Proof"
              onPress={() => setSelectedSelfieRecord(null)}
              variant="outline"
              style={{ marginTop: 14 }}
            />
          </View>
        </View>
      </Modal>

      {/* Manual Entry for No Network Spot Modal */}
      <Modal visible={showManualModal} transparent animationType="slide">
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
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="cloud-offline" size={22} color="#D97706" style={{ marginRight: 8 }} />
                  <Text style={styles.modalTitle}>Manual Entry (No Network)</Text>
                </View>
                <TouchableOpacity onPress={() => setShowManualModal(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.noNetNotice}>
                <Ionicons name="information-circle-outline" size={18} color="#92400E" style={{ marginRight: 6 }} />
                <Text style={styles.noNetNoticeText}>
                  Use this form to log attendance for staff who worked in areas without mobile internet or cellular network.
                </Text>
              </View>

              {/* Employee Selection */}
              <Text style={styles.fieldLabel}>Select Employee *</Text>
              {employees.length === 0 ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 8 }} />
              ) : (
                <View style={styles.empSelectContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    {employees.map(emp => {
                      const isSelected = manualUserId === emp.id;
                      return (
                        <TouchableOpacity
                          key={emp.id}
                          style={[styles.empChip, isSelected && styles.empChipActive]}
                          onPress={() => setManualUserId(emp.id)}
                        >
                          <Text style={[styles.empChipName, isSelected && styles.empChipNameActive]}>
                            {emp.full_name}
                          </Text>
                          <Text style={[styles.empChipCode, isSelected && styles.empChipCodeActive]}>
                            {emp.employee_code} • {emp.department}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Date */}
              <Text style={styles.fieldLabel}>Attendance Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={manualDate}
                onChangeText={setManualDate}
                placeholder="YYYY-MM-DD"
              />

              {/* Status */}
              <Text style={styles.fieldLabel}>Attendance Status</Text>
              <View style={styles.statusSelector}>
                {(['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT'] as AttendanceStatus[]).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusOption, manualStatus === s && styles.statusOptionActive]}
                    onPress={() => setManualStatus(s)}
                  >
                    <Text style={[styles.statusOptionText, manualStatus === s && styles.statusOptionTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Time and Hours Row */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Check-In Time</Text>
                  <TextInput
                    style={styles.input}
                    value={manualInTime}
                    onChangeText={setManualInTime}
                    placeholder="09:00 AM"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Working Hours</Text>
                  <TextInput
                    style={styles.input}
                    value={manualHours}
                    onChangeText={setManualHours}
                    keyboardType="numeric"
                    placeholder="8.0"
                  />
                </View>
              </View>

              {/* Remarks */}
              <Text style={styles.fieldLabel}>Reason / Location Note</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                value={manualRemarks}
                onChangeText={setManualRemarks}
                multiline
                placeholder="e.g. Employee working in basement / rural site without network"
              />

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setShowManualModal(false)}
                  variant="outline"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Submit Attendance"
                  onPress={handleSaveManualEntry}
                  loading={manualSubmitting}
                  variant="success"
                  icon={<Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />}
                  style={{ flex: 1.5 }}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Outside-Shift Entry Modal for HR */}
      <Modal visible={showOutsideShiftModal} transparent animationType="slide">
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
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="business" size={20} color="#0D9488" style={{ marginRight: 8 }} />
                  <Text style={styles.modalTitle}>Outside-Shift Entry (HR)</Text>
                </View>
                <TouchableOpacity onPress={() => setShowOutsideShiftModal(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Select Employee */}
              <Text style={styles.fieldLabel}>Select Staff Member *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {employees.map(emp => {
                  const isSelected = outsideUserId === emp.id;
                  return (
                    <TouchableOpacity
                      key={emp.id}
                      style={[styles.empChip, isSelected && styles.empChipActive]}
                      onPress={() => setOutsideUserId(emp.id)}
                    >
                      <Text style={[styles.empChipName, isSelected && styles.empChipNameActive]}>
                        {emp.full_name}
                      </Text>
                      <Text style={[styles.empChipCode, isSelected && styles.empChipCodeActive]}>
                        {emp.employee_code} • {emp.department}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* College Selector */}
              <Text style={styles.fieldLabel}>College / Institution Name *</Text>
              <View style={styles.collegeChipsRow}>
                {collegesList.map((col) => (
                  <TouchableOpacity
                    key={col}
                    style={[
                      styles.collegeChip,
                      selectedCollege === col && !customCollege && styles.collegeChipSelected
                    ]}
                    onPress={() => {
                      setSelectedCollege(col);
                      setCustomCollege('');
                    }}
                  >
                    <Text
                      style={[
                        styles.collegeChipText,
                        selectedCollege === col && !customCollege && styles.collegeChipTextSelected
                      ]}
                      numberOfLines={1}
                    >
                      {col}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 6 }]}>Or Enter Custom College Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Type external campus / college name..."
                placeholderTextColor={theme.colors.textLight}
                value={customCollege}
                onChangeText={(t) => {
                  setCustomCollege(t);
                  if (t) setSelectedCollege('');
                }}
              />

              {/* Date */}
              <Text style={styles.fieldLabel}>Visit Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={outsideDate}
                onChangeText={setOutsideDate}
                placeholder="YYYY-MM-DD"
              />

              {/* Hours */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Start Time</Text>
                  <TextInput
                    style={styles.input}
                    value={outsideStartTime}
                    onChangeText={setOutsideStartTime}
                    placeholder="09:30 AM"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>End Time</Text>
                  <TextInput
                    style={styles.input}
                    value={outsideEndTime}
                    onChangeText={setOutsideEndTime}
                    placeholder="05:30 PM"
                  />
                </View>
              </View>

              {/* Purpose */}
              <Text style={styles.fieldLabel}>Purpose / External Work Note</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                value={outsidePurpose}
                onChangeText={setOutsidePurpose}
                multiline
                placeholder="e.g. Placement drive / Faculty development"
              />

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setShowOutsideShiftModal(false)}
                  variant="outline"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Save Outside-Shift"
                  onPress={handleSaveOutsideShift}
                  loading={submittingOutsideShift}
                  style={{ flex: 1.5, backgroundColor: '#0D9488' }}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  filtersBar: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: '#F1F5F9',
    marginRight: 8
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textMuted
  },
  filterChipTextActive: {
    color: '#FFFFFF'
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
  empSub: {
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
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 2
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6
  },
  geoTag: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  geoText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginLeft: 4
  },
  overrideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.infoBg
  },
  overrideBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
    marginLeft: 4
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    padding: theme.spacing.lg
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text
  },
  employeeBanner: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 12
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 10,
    marginBottom: 6
  },
  statusSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  statusOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    marginHorizontal: 3
  },
  statusOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.infoBg
  },
  statusOptionText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textMuted
  },
  statusOptionTextActive: {
    color: theme.colors.primary
  },
  input: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    height: 42,
    fontSize: 13,
    color: theme.colors.text
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 18
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
  selfieBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginRight: 6
  },
  selfieBtnText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4
  },
  selfieAuditBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  selfieAuditText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    marginVertical: 2
  },
  selfieAuditSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 4
  },
  topHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  topHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text
  },
  topHeaderSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2
  },
  exportCsvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md
  },
  exportCsvBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  manualEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md
  },
  manualEntryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  noNetBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: 'flex-start'
  },
  noNetBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309'
  },
  noNetNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: '#D97706',
    marginBottom: 10
  },
  noNetNoticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: '#92400E',
    fontWeight: '600'
  },
  empSelectContainer: {
    marginBottom: 4
  },
  empChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginRight: 8
  },
  empChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: theme.colors.primary
  },
  empChipName: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text
  },
  empChipNameActive: {
    color: theme.colors.primary
  },
  empChipCode: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2
  },
  empChipCodeActive: {
    color: theme.colors.primary
  },
  outsideShiftHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D9488',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md
  },
  filterSection: {
    backgroundColor: theme.colors.surface,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 6
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text
  },
  filterSubText: {
    fontSize: 11,
    color: theme.colors.textMuted
  },
  clearFilterText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '700'
  },
  filterChipsRow: {
    paddingHorizontal: 14,
    gap: 6,
    alignItems: 'center'
  },
  deptChipActive: {
    backgroundColor: '#0D9488'
  },
  statusTabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: '#F1F5F9',
    marginRight: 8
  },
  statusTabChipActive: {
    backgroundColor: theme.colors.primary
  },
  statusTabChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textMuted
  },
  statusTabChipTextActive: {
    color: '#FFFFFF'
  },
  collegeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6
  },
  collegeChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC'
  },
  collegeChipSelected: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488'
  },
  collegeChipText: {
    fontSize: 11.5,
    color: theme.colors.text,
    fontWeight: '600'
  },
  collegeChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700'
  }
});
