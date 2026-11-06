import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { Button } from '../../components/Button';
import { api } from '../../api/client';
import { User } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const AdminEmployeesScreen: React.FC = () => {
  const { startImpersonation } = useAuth();
  const [employees, setEmployees] = useState<User[]>([]);
  const [search, setSearch] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Impersonation modal (Flowchart Section 3)
  const [showImpersonateModal, setShowImpersonateModal] = useState<boolean>(false);
  const [selectedForImpersonate, setSelectedForImpersonate] = useState<User | null>(null);
  const [impersonateReason, setImpersonateReason] = useState<string>('HR Administrative Oversight');
  const [impersonatingLoading, setImpersonatingLoading] = useState<boolean>(false);

  // Security logs modal (Flowchart Section 6)
  const [showSecurityLogsModal, setShowSecurityLogsModal] = useState<boolean>(false);
  const [logTab, setLogTab] = useState<'LOGIN' | 'IMPERSONATION'>('LOGIN');
  const [loginLogs, setLoginLogs] = useState<any[]>([]);
  const [impersonationLogs, setImpersonationLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  // Onboard modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [newlyCreatedStaff, setNewlyCreatedStaff] = useState<{
    code: string;
    email: string;
    pass: string;
    name: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    employee_code: '',
    full_name: '',
    email: '',
    password: 'StaffPass@123',
    department: 'Engineering',
    designation: 'Software Developer',
    role: 'EMPLOYEE',
    team_leader_id: '',
    phone: '+1-555-0150',
    base_salary: '60000',
    hra: '15000',
    allowances: '5000',
    pf_deduction: '3000',
    tax_deduction: '6000'
  });

  // Edit modal
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    loadEmployees(search, departmentFilter);
  }, [departmentFilter]);

  async function loadMetadata() {
    try {
      const [deptRes, tlRes] = await Promise.all([
        api.getDepartments(),
        api.getTeamLeaders()
      ]);
      setDepartments(deptRes.departments || []);
      setTeamLeaders(tlRes.teamLeaders || tlRes.team_leaders || []);
    } catch (e) {
      console.warn('Failed to load metadata', e);
    }
  }

  async function loadEmployees(query = search, dept = departmentFilter) {
    try {
      setLoading(true);
      const res = await api.getEmployees({ search: query, department: dept || undefined });
      setEmployees(res.employees || []);
    } catch (err) {
      console.warn('Failed to load employees', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const handleCreateEmployee = async () => {
    if (!formData.full_name || !formData.email) {
      Alert.alert('Required Fields', 'Please enter Full Name and Corporate Email');
      return;
    }

    if (formData.password && formData.password.length < 6) {
      Alert.alert('Password Too Short', 'Initial password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createEmployee(formData);
      setShowAddModal(false);

      // Save credentials to display to Admin
      setNewlyCreatedStaff({
        code: res.employee.employee_code,
        email: res.employee.email,
        pass: formData.password || 'StaffPass@123',
        name: res.employee.full_name
      });

      setFormData({
        employee_code: '',
        full_name: '',
        email: '',
        password: 'StaffPass@123',
        department: 'Engineering',
        designation: 'Software Developer',
        role: 'EMPLOYEE',
        team_leader_id: '',
        phone: '+1-555-0150',
        base_salary: '60000',
        hra: '15000',
        allowances: '5000',
        pf_deduction: '3000',
        tax_deduction: '6000'
      });
      await loadEmployees();
      await loadMetadata();
    } catch (err: any) {
      Alert.alert('Account Creation Failed', err.message || 'Error creating staff account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (emp: User) => {
    setEditingEmployee(emp);
    setEditFormData({
      full_name: emp.full_name,
      department: emp.department,
      designation: emp.designation,
      role: emp.role || 'EMPLOYEE',
      team_leader_id: emp.team_leader_id || '',
      phone: emp.phone || '',
      base_salary: String(emp.base_salary),
      hra: String(emp.hra),
      allowances: String(emp.allowances),
      pf_deduction: String(emp.pf_deduction),
      tax_deduction: String(emp.tax_deduction)
    });
  };

  const handleSaveEdit = async () => {
    if (!editingEmployee) return;
    setSubmitting(true);
    try {
      await api.updateEmployee(editingEmployee.id, editFormData);
      Alert.alert('Saved', 'Employee profile and settings updated successfully');
      setEditingEmployee(null);
      await loadEmployees();
      await loadMetadata();
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Error updating employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = (emp: User) => {
    Alert.alert(
      'Delete Staff Member',
      `Are you sure you want to delete ${emp.full_name} (${emp.employee_code})? All associated records will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteEmployee(emp.id);
              await loadEmployees();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ]
    );
  };

  const handleResetDevice = (emp: User) => {
    Alert.alert(
      'Reset Device Binding',
      `Reset device registration for ${emp.full_name} (${emp.employee_code})?\n\nThis will remove the current hardware binding and allow the employee to register their new phone on next login.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Device',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.resetEmployeeDevice(emp.id);
              Alert.alert('Device Reset', `Device registration for ${emp.full_name} has been cleared.`);
              await loadEmployees();
            } catch (e: any) {
              Alert.alert('Reset Failed', e.message);
            }
          }
        }
      ]
    );
  };

  const handleGeneratePin = async (emp: User) => {
    try {
      const res = await api.generateHrVerificationCode(emp.id);
      Alert.alert(
        'HR Device Authorization PIN',
        `Temporary 6-Digit PIN for ${emp.full_name}:\n\nPIN: ${res.code}\n\nValid for 15 minutes. Provide this to the employee if their device telephony cannot automatically detect the SIM number.`,
        [{ text: 'Done' }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleStartImpersonate = async () => {
    if (!selectedForImpersonate) return;
    setImpersonatingLoading(true);
    try {
      await startImpersonation(selectedForImpersonate.id, impersonateReason);
      setShowImpersonateModal(false);
    } catch (e: any) {
      Alert.alert('Impersonation Failed', e.message || 'Error creating impersonation session');
    } finally {
      setImpersonatingLoading(false);
    }
  };

  const handleOpenSecurityLogs = async () => {
    setShowSecurityLogsModal(true);
    setLoadingLogs(true);
    try {
      const [secRes, impRes] = await Promise.all([
        api.getLoginSecurityLogs(),
        api.getHrImpersonationLogs()
      ]);
      setLoginLogs(secRes.logs || []);
      setImpersonationLogs(impRes.logs || []);
    } catch (e: any) {
      console.warn('Error loading security logs', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const renderEmployeeCard = ({ item }: { item: User }) => {
    const isInactive = item.status === 'INACTIVE';
    const totalGross = (item.base_salary || 0) + (item.hra || 0) + (item.allowances || 0);

    return (
      <View style={[styles.card, isInactive && styles.cardInactive]}>
        <View style={styles.cardHeader}>
          <View style={styles.empAvatar}>
            <Text style={styles.avatarText}>{item.full_name.charAt(0)}</Text>
          </View>
          <View style={styles.empMain}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={styles.empName}>{item.full_name}</Text>
              {item.role === 'TL' && (
                <View style={styles.tlBadge}>
                  <Ionicons name="people" size={10} color="#0F766E" />
                  <Text style={styles.tlBadgeText}>Team Leader</Text>
                </View>
              )}
            </View>
            <Text style={styles.empRole}>{item.designation} • {item.department}</Text>
            <Text style={styles.empCode}>{item.employee_code} • {item.email}</Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: isInactive ? theme.colors.dangerBg : theme.colors.successBg }]}>
            <Text style={[styles.statusChipText, { color: isInactive ? theme.colors.danger : theme.colors.success }]}>
              {item.status}
            </Text>
          </View>
        </View>

        {/* Mobile & Device Security Status Bar (Flowchart Section 2, 5, 6) */}
        <View style={styles.deviceSecurityRow}>
          <View style={styles.deviceInfoCol}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="call-outline" size={13} color="#0D9488" />
              <Text style={styles.devicePhoneText}>
                Registered SIM: <Text style={{ fontWeight: '800' }}>{item.phone || 'Not Registered'}</Text>
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
              <Ionicons
                name={item.device_registered ? 'shield-checkmark' : 'time-outline'}
                size={13}
                color={item.device_registered ? '#16A34A' : '#D97706'}
              />
              <Text style={[styles.deviceBindingText, { color: item.device_registered ? '#16A34A' : '#D97706' }]}>
                {item.device_registered
                  ? `Device Bound: ${item.device_id ? item.device_id.slice(0, 14) + '...' : 'Verified'}`
                  : 'Device Unbound (Awaiting First Login)'}
              </Text>
            </View>
          </View>

          {/* Quick Device Actions for HR */}
          <View style={styles.deviceActionsCol}>
            {item.device_registered ? (
              <TouchableOpacity
                style={styles.deviceResetBtn}
                onPress={() => handleResetDevice(item)}
              >
                <Ionicons name="refresh" size={11} color="#DC2626" />
                <Text style={styles.deviceResetBtnText}>Reset Device</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.devicePinBtn}
              onPress={() => handleGeneratePin(item)}
            >
              <Ionicons name="key-outline" size={11} color="#4F46E5" />
              <Text style={styles.devicePinBtnText}>Device PIN</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.salaryRow}>
          <View style={styles.salaryItem}>
            <Text style={styles.salaryLabel}>Base Pay</Text>
            <Text style={styles.salaryVal}>₹{item.base_salary.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.salaryItem}>
            <Text style={styles.salaryLabel}>HRA + Allowances</Text>
            <Text style={styles.salaryVal}>₹{(item.hra + item.allowances).toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.salaryItem}>
            <Text style={styles.salaryLabel}>Monthly Gross</Text>
            <Text style={[styles.salaryVal, { color: theme.colors.primary }]}>₹{totalGross.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {item.role !== 'HR_ADMIN' && (
            <TouchableOpacity
              style={styles.actionBtnImpersonate}
              onPress={() => {
                setSelectedForImpersonate(item);
                setImpersonateReason('HR Administrative Oversight');
                setShowImpersonateModal(true);
              }}
            >
              <Ionicons name="swap-horizontal" size={14} color="#FFFFFF" />
              <Text style={styles.actionBtnImpersonateText}>Login as Staff</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionBtnOutline}
            onPress={() => handleStartEdit(item)}
          >
            <Ionicons name="create-outline" size={14} color={theme.colors.primary} />
            <Text style={styles.actionBtnText}>Edit Info</Text>
          </TouchableOpacity>

          {item.role !== 'HR_ADMIN' && (
            <TouchableOpacity
              style={styles.actionBtnDanger}
              onPress={() => handleDeleteEmployee(item)}
            >
              <Ionicons name="trash-outline" size={14} color={theme.colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search and Onboard Bar */}
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search employee, ID, department..."
            value={search}
            onChangeText={t => {
              setSearch(t);
              loadEmployees(t);
            }}
          />
        </View>

        <TouchableOpacity
          style={styles.auditBtn}
          onPress={handleOpenSecurityLogs}
          activeOpacity={0.7}
        >
          <Ionicons name="shield-checkmark" size={16} color="#4F46E5" />
          <Text style={styles.auditBtnText}>Logs</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add Staff</Text>
        </TouchableOpacity>
      </View>

      {/* Department Filter Section */}
      {departments.length > 0 && (
        <View style={styles.deptFilterSection}>
          <View style={styles.deptFilterHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="business-outline" size={15} color="#0D9488" />
              <Text style={styles.deptFilterLabel}>Department Filter</Text>
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
            contentContainerStyle={styles.deptFilterChipsRow}
          >
            <TouchableOpacity
              style={[styles.deptChip, !departmentFilter && styles.deptChipActive]}
              onPress={() => setDepartmentFilter('')}
              activeOpacity={0.8}
            >
              <Text style={[styles.deptChipText, !departmentFilter && styles.deptChipTextActive]}>
                All Departments
              </Text>
            </TouchableOpacity>
            {departments.map((d) => {
              const isSelected = departmentFilter === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.deptChip, isSelected && styles.deptChipActive]}
                  onPress={() => setDepartmentFilter(d)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.deptChipText, isSelected && styles.deptChipTextActive]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading employee directory...</Text>
        </View>
      ) : employees.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={48} color={theme.colors.textLight} />
          <Text style={styles.emptyText}>No employees found</Text>
        </View>
      ) : (
        <FlatList
          data={employees}
          keyExtractor={item => item.id}
          renderItem={renderEmployeeCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadEmployees();
              }}
            />
          }
        />
      )}

      {/* Onboard Employee Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
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
                <Text style={styles.modalTitle}>Onboard New Employee</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.formSection}>Staff Login Credentials (Admin Access Only)</Text>
              <Text style={styles.formSubnote}>
                Only Admin has access to create staff accounts, assign Login IDs, and create passwords. Staff will be required to change their password on first login.
              </Text>

              <Text style={styles.fieldLabel}>Staff Login ID / Employee Code</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. US-ENG-105 (Leave blank to auto-generate)"
                value={formData.employee_code}
                onChangeText={t => setFormData({ ...formData, employee_code: t })}
                autoCapitalize="characters"
              />

              <Text style={styles.fieldLabel}>Initial Temporary Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="Temporary Password (e.g. StaffPass@123)"
                value={formData.password}
                onChangeText={t => setFormData({ ...formData, password: t })}
              />

              <Text style={styles.formSection}>Personal & Job Details</Text>
              <TextInput
                style={styles.input}
                placeholder="Full Name (e.g. Rachel Adams) *"
                value={formData.full_name}
                onChangeText={t => setFormData({ ...formData, full_name: t })}
              />
              <TextInput
                style={styles.input}
                placeholder="Corporate Email *"
                value={formData.email}
                onChangeText={t => setFormData({ ...formData, email: t })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <View style={styles.formRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 6 }]}
                  placeholder="Department"
                  value={formData.department}
                  onChangeText={t => setFormData({ ...formData, department: t })}
                />
                <TextInput
                  style={[styles.input, { flex: 1, marginLeft: 6 }]}
                  placeholder="Designation"
                  value={formData.designation}
                  onChangeText={t => setFormData({ ...formData, designation: t })}
                />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                value={formData.phone}
                onChangeText={t => setFormData({ ...formData, phone: t })}
              />

              <Text style={styles.fieldLabel}>Account Role</Text>
              <View style={styles.rolePickerRow}>
                {['EMPLOYEE', 'TL', 'HR'].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleChip, formData.role === r && styles.roleChipActive]}
                    onPress={() => setFormData({ ...formData, role: r })}
                  >
                    <Text style={[styles.roleChipText, formData.role === r && styles.roleChipTextActive]}>
                      {r === 'TL' ? 'Team Lead (TL)' : r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {teamLeaders.length > 0 && (
                <>
                  <Text style={styles.fieldLabel}>Assign Team Leader</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    <TouchableOpacity
                      style={[styles.tlChip, !formData.team_leader_id && styles.tlChipActive]}
                      onPress={() => setFormData({ ...formData, team_leader_id: '' })}
                    >
                      <Text style={[styles.tlChipText, !formData.team_leader_id && styles.tlChipTextActive]}>
                        None
                      </Text>
                    </TouchableOpacity>
                    {teamLeaders.map(tl => (
                      <TouchableOpacity
                        key={tl.id}
                        style={[styles.tlChip, formData.team_leader_id === tl.id && styles.tlChipActive]}
                        onPress={() => setFormData({ ...formData, team_leader_id: tl.id })}
                      >
                        <Text style={[styles.tlChipText, formData.team_leader_id === tl.id && styles.tlChipTextActive]}>
                          {tl.full_name} ({tl.department})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={styles.formSection}>Salary Structure (Monthly INR - ₹)</Text>
              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.fieldLabel}>Base Salary</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.base_salary}
                    onChangeText={t => setFormData({ ...formData, base_salary: t })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.fieldLabel}>HRA</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.hra}
                    onChangeText={t => setFormData({ ...formData, hra: t })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.fieldLabel}>Allowances</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.allowances}
                    onChangeText={t => setFormData({ ...formData, allowances: t })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.fieldLabel}>PF Deduction</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.pf_deduction}
                    onChangeText={t => setFormData({ ...formData, pf_deduction: t })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setShowAddModal(false)}
                  variant="outline"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Create Employee"
                  onPress={handleCreateEmployee}
                  loading={submitting}
                  style={{ flex: 1.5 }}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal visible={!!editingEmployee} transparent animationType="slide">
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
                <Text style={styles.modalTitle}>Edit Profile & Salary</Text>
                <TouchableOpacity onPress={() => setEditingEmployee(null)}>
                  <Ionicons name="close" size={24} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.formSection}>Employee Profile</Text>
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                value={editFormData.full_name}
                onChangeText={t => setEditFormData({ ...editFormData, full_name: t })}
              />
              <View style={styles.formRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 6 }]}
                  placeholder="Department"
                  value={editFormData.department}
                  onChangeText={t => setEditFormData({ ...editFormData, department: t })}
                />
                <TextInput
                  style={[styles.input, { flex: 1, marginLeft: 6 }]}
                  placeholder="Designation"
                  value={editFormData.designation}
                  onChangeText={t => setEditFormData({ ...editFormData, designation: t })}
                />
              </View>

              <Text style={styles.fieldLabel}>Account Role</Text>
              <View style={styles.rolePickerRow}>
                {['EMPLOYEE', 'TL', 'HR'].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleChip, editFormData.role === r && styles.roleChipActive]}
                    onPress={() => setEditFormData({ ...editFormData, role: r })}
                  >
                    <Text style={[styles.roleChipText, editFormData.role === r && styles.roleChipTextActive]}>
                      {r === 'TL' ? 'Team Lead (TL)' : r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {teamLeaders.length > 0 && (
                <>
                  <Text style={styles.fieldLabel}>Assign Team Leader</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    <TouchableOpacity
                      style={[styles.tlChip, !editFormData.team_leader_id && styles.tlChipActive]}
                      onPress={() => setEditFormData({ ...editFormData, team_leader_id: '' })}
                    >
                      <Text style={[styles.tlChipText, !editFormData.team_leader_id && styles.tlChipTextActive]}>
                        None
                      </Text>
                    </TouchableOpacity>
                    {teamLeaders.map(tl => (
                      <TouchableOpacity
                        key={tl.id}
                        style={[styles.tlChip, editFormData.team_leader_id === tl.id && styles.tlChipActive]}
                        onPress={() => setEditFormData({ ...editFormData, team_leader_id: tl.id })}
                      >
                        <Text style={[styles.tlChipText, editFormData.team_leader_id === tl.id && styles.tlChipTextActive]}>
                          {tl.full_name} ({tl.department})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={styles.formSection}>Salary Settings (INR - ₹)</Text>
              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.fieldLabel}>Base Salary (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={editFormData.base_salary}
                    onChangeText={t => setEditFormData({ ...editFormData, base_salary: t })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.fieldLabel}>HRA (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={editFormData.hra}
                    onChangeText={t => setEditFormData({ ...editFormData, hra: t })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setEditingEmployee(null)}
                  variant="outline"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Save Changes"
                  onPress={handleSaveEdit}
                  loading={submitting}
                  style={{ flex: 1.5 }}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Newly Created Account Credentials Modal */}
      <Modal visible={!!newlyCreatedStaff} transparent animationType="fade">
        <View style={styles.credentialsModalOverlay}>
          <View style={styles.credentialsModal}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-done" size={32} color="#059669" />
            </View>
            <Text style={styles.credTitle}>Staff Account Created!</Text>
            <Text style={styles.credSub}>
              Share these credentials with {newlyCreatedStaff?.name}. The staff member will be required to change their password upon their first login.
            </Text>

            <View style={styles.credCard}>
              <View style={styles.credRow}>
                <Text style={styles.credLabel}>Staff Login ID:</Text>
                <Text style={styles.credValue}>{newlyCreatedStaff?.code}</Text>
              </View>
              <View style={styles.credRow}>
                <Text style={styles.credLabel}>Work Email:</Text>
                <Text style={styles.credValue}>{newlyCreatedStaff?.email}</Text>
              </View>
              <View style={styles.credRow}>
                <Text style={styles.credLabel}>Temporary Password:</Text>
                <Text style={[styles.credValue, { color: theme.colors.primary }]}>{newlyCreatedStaff?.pass}</Text>
              </View>
              <View style={styles.credBadge}>
                <Ionicons name="lock-closed" size={13} color="#D97706" />
                <Text style={styles.credBadgeText}>1st Login: Force Password Change Enforced</Text>
              </View>
            </View>

            <Button
              title="Done & Close"
              onPress={() => setNewlyCreatedStaff(null)}
              style={{ marginTop: 16 }}
            />
          </View>
        </View>
      </Modal>

      {/* HR IMPERSONATION CONFIRMATION MODAL (Flowchart Section 3) */}
      <Modal visible={showImpersonateModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.impersonateModalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="shield-checkmark" size={22} color="#F59E0B" />
                <Text style={styles.modalTitle}>HR Authorized Access</Text>
              </View>
              <TouchableOpacity onPress={() => setShowImpersonateModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {selectedForImpersonate && (
              <View style={styles.impersonateTargetBox}>
                <Text style={styles.impersonateTargetName}>
                  {selectedForImpersonate.full_name} ({selectedForImpersonate.employee_code})
                </Text>
                <Text style={styles.impersonateTargetSub}>
                  {selectedForImpersonate.designation} • {selectedForImpersonate.department}
                </Text>
                <Text style={styles.impersonateTargetPhone}>
                  📱 SIM Mobile: {selectedForImpersonate.phone || 'Not Registered'}
                </Text>
              </View>
            )}

            <View style={styles.impersonateNotice}>
              <Ionicons name="information-circle-outline" size={16} color="#78350F" />
              <Text style={styles.impersonateNoticeText}>
                You will temporarily view the app in <Text style={{ fontWeight: '800' }}>HR MODE</Text> as this employee. All actions will be logged in the immutable security audit log.
              </Text>
            </View>

            <Text style={styles.fieldLabel}>Reason for Access (Audit Purpose)</Text>
            <TextInput
              style={styles.modalInput}
              value={impersonateReason}
              onChangeText={setImpersonateReason}
              placeholder="e.g. Attendance oversight, Leave balance verification"
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowImpersonateModal(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Access as Staff"
                onPress={handleStartImpersonate}
                loading={impersonatingLoading}
                style={{ flex: 1.6, backgroundColor: '#D97706' }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* SECURITY & AUDIT LOGS MODAL (Flowchart Section 6) */}
      <Modal visible={showSecurityLogsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.logsModalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="shield-half-outline" size={22} color={theme.colors.primary} />
                <Text style={styles.modalTitle}>Security & Audit Logs</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSecurityLogsModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Tab switch between Login Logs and Impersonation Logs */}
            <View style={styles.logTabSwitcher}>
              <TouchableOpacity
                style={[styles.logTab, logTab === 'LOGIN' && styles.logTabActive]}
                onPress={() => setLogTab('LOGIN')}
              >
                <Text style={[styles.logTabText, logTab === 'LOGIN' && styles.logTabTextActive]}>
                  Login & SIM Logs
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.logTab, logTab === 'IMPERSONATION' && styles.logTabActive]}
                onPress={() => setLogTab('IMPERSONATION')}
              >
                <Text style={[styles.logTabText, logTab === 'IMPERSONATION' && styles.logTabTextActive]}>
                  HR Impersonation ({impersonationLogs.length})
                </Text>
              </TouchableOpacity>
            </View>

            {loadingLogs ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={{ marginTop: 8, fontSize: 12, color: theme.colors.textMuted }}>Fetching audit ledger...</Text>
              </View>
            ) : logTab === 'LOGIN' ? (
              <FlatList
                data={loginLogs}
                keyExtractor={(item, index) => item.log_id || String(index)}
                renderItem={({ item }) => {
                  const isSuccess = item.login_status === 'SUCCESS';
                  const isBlocked = item.login_status === 'BLOCKED' || item.login_status === 'DENIED';
                  return (
                    <View style={styles.logItemCard}>
                      <View style={styles.logItemHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.logItemEmp}>{item.employee_code || 'Guest'}</Text>
                          <View style={[styles.logTypeBadge, { backgroundColor: item.user_type === 'HR' ? '#EEF2FF' : '#F0FDFA' }]}>
                            <Text style={[styles.logTypeBadgeText, { color: item.user_type === 'HR' ? '#4F46E5' : '#0D9488' }]}>
                              {item.user_type}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.logStatusBadge, { backgroundColor: isSuccess ? '#DCFCE7' : '#FEE2E2' }]}>
                          <Text style={[styles.logStatusBadgeText, { color: isSuccess ? '#16A34A' : '#DC2626' }]}>
                            {item.login_status}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.logItemSub}>
                        Verification: <Text style={{ fontWeight: '700' }}>{item.verification_status}</Text>
                      </Text>
                      {item.failure_reason ? (
                        <Text style={styles.logItemReason}>Reason: {item.failure_reason}</Text>
                      ) : null}
                      <Text style={styles.logItemTime}>
                        {item.timestamp ? new Date(item.timestamp).toLocaleString() : ''} • IP: {item.ip_address || '127.0.0.1'}
                      </Text>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: theme.colors.textMuted }}>No security audit logs found</Text>
                  </View>
                }
              />
            ) : (
              <FlatList
                data={impersonationLogs}
                keyExtractor={(item, index) => item.log_id || String(index)}
                renderItem={({ item }) => (
                  <View style={styles.logItemCard}>
                    <View style={styles.logItemHeader}>
                      <Text style={styles.logItemEmp}>
                        HR: {item.hr_name || item.hr_id}
                      </Text>
                      <View style={[styles.logStatusBadge, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={[styles.logStatusBadgeText, { color: '#B45309' }]}>
                          HR_MODE
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.logItemSub}>
                      Target: <Text style={{ fontWeight: '800' }}>{item.employee_name} ({item.employee_code})</Text>
                    </Text>
                    <Text style={styles.logItemReason}>Reason: {item.reason || 'None specified'}</Text>
                    <Text style={styles.logItemTime}>
                      {item.timestamp ? new Date(item.timestamp).toLocaleString() : ''} • Duration: {item.duration || 'In Progress'}
                    </Text>
                  </View>
                )}
                ListEmptyComponent={
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: theme.colors.textMuted }}>No HR impersonation sessions logged yet</Text>
                  </View>
                }
              />
            )}

            <Button
              title="Close Audit Logs"
              onPress={() => setShowSecurityLogsModal(false)}
              style={{ marginTop: 10 }}
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
  topBar: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 10,
    height: 40,
    marginRight: 10
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: theme.colors.text
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: theme.borderRadius.md
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 4
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
  cardInactive: {
    opacity: 0.6
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  empAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18
  },
  empMain: {
    flex: 1
  },
  empName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text
  },
  empRole: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 1
  },
  empCode: {
    fontSize: 11,
    color: theme.colors.textLight,
    marginTop: 2
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '800'
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md,
    padding: 8,
    marginVertical: 6
  },
  salaryItem: {
    alignItems: 'center',
    flex: 1
  },
  salaryLabel: {
    fontSize: 10,
    color: theme.colors.textMuted
  },
  salaryVal: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 2
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    marginRight: 8
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    marginLeft: 4
  },
  actionBtnDanger: {
    padding: 6,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.dangerBg
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.md,
    paddingVertical: 24
  },
  credentialsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: theme.spacing.md
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
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text
  },
  formSection: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
    marginTop: 10,
    marginBottom: 6,
    textTransform: 'uppercase'
  },
  formRow: {
    flexDirection: 'row'
  },
  input: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    height: 42,
    fontSize: 13,
    color: theme.colors.text,
    marginBottom: 8
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginBottom: 3
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 16
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
  formSubnote: {
    fontSize: 11,
    color: theme.colors.textMuted,
    lineHeight: 15,
    marginBottom: 8
  },
  credentialsModal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    width: '90%',
    maxWidth: 440,
    alignSelf: 'center',
    alignItems: 'center'
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10
  },
  credTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4
  },
  credSub: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 17
  },
  credCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  credRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0'
  },
  credLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600'
  },
  credValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: theme.colors.text
  },
  credBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm
  },
  credBadgeText: {
    fontSize: 10.5,
    color: '#92400E',
    fontWeight: '700',
    marginLeft: 4
  },
  auditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 10,
    height: 40,
    borderRadius: theme.borderRadius.md,
    marginRight: 8
  },
  auditBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5'
  },
  deviceSecurityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: theme.borderRadius.md,
    padding: 8,
    marginVertical: 4
  },
  deviceInfoCol: {
    flex: 1
  },
  devicePhoneText: {
    fontSize: 11,
    color: '#134E4A'
  },
  deviceBindingText: {
    fontSize: 10.5,
    fontWeight: '700'
  },
  deviceActionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  deviceResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm
  },
  deviceResetBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626'
  },
  devicePinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm
  },
  devicePinBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4F46E5'
  },
  actionBtnImpersonate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    marginRight: 6
  },
  actionBtnImpersonateText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  impersonateModalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    maxWidth: 440,
    width: '92%',
    alignSelf: 'center'
  },
  impersonateTargetBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 10
  },
  impersonateTargetName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text
  },
  impersonateTargetSub: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2
  },
  impersonateTargetPhone: {
    fontSize: 11,
    color: '#0D9488',
    fontWeight: '700',
    marginTop: 4
  },
  impersonateNotice: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: theme.borderRadius.md,
    padding: 10,
    marginBottom: 12
  },
  impersonateNoticeText: {
    flex: 1,
    fontSize: 11.5,
    color: '#78350F',
    lineHeight: 16
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    height: 42,
    fontSize: 13,
    color: theme.colors.text,
    marginBottom: 12
  },
  logsModalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    width: '94%',
    maxHeight: '85%',
    alignSelf: 'center'
  },
  logTabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: theme.borderRadius.md,
    padding: 3,
    marginBottom: 10
  },
  logTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: theme.borderRadius.sm
  },
  logTabActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  logTabText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.colors.textMuted
  },
  logTabTextActive: {
    color: theme.colors.primary
  },
  logItemCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: theme.borderRadius.md,
    padding: 10,
    marginBottom: 8
  },
  logItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  logItemEmp: {
    fontSize: 12.5,
    fontWeight: '800',
    color: theme.colors.text
  },
  logTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  logTypeBadgeText: {
    fontSize: 9.5,
    fontWeight: '800'
  },
  logStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  logStatusBadgeText: {
    fontSize: 9.5,
    fontWeight: '900'
  },
  logItemSub: {
    fontSize: 11,
    color: theme.colors.text
  },
  logItemReason: {
    fontSize: 10.5,
    color: '#DC2626',
    marginTop: 2
  },
  logItemTime: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 3
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
  rolePickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  roleChip: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: theme.colors.primary,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  roleChipTextActive: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  tlChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  tlChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  tlChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  tlChipTextActive: {
    color: '#059669',
    fontWeight: '800',
  },
  tlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tlBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F766E',
  }
});
