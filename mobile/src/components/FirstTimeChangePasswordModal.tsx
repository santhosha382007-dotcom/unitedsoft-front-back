import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { Button } from './Button';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface FirstTimeChangePasswordModalProps {
  visible: boolean;
  onSuccess: () => void;
}

export const FirstTimeChangePasswordModal: React.FC<FirstTimeChangePasswordModalProps> = ({
  visible,
  onSuccess
}) => {
  const { user, refreshMe, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (!newPassword.trim()) {
      setError('Please enter your new password');
      return;
    }

    if (newPassword.trim().length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await api.changePassword({
        currentPassword: currentPassword.trim() || undefined,
        newPassword: newPassword.trim()
      });

      Alert.alert(
        'Password Updated Successfully',
        'Your new password has been set. You can now access the UnitedSoft Attendance Portal.',
        [
          {
            text: 'Continue to App',
            onPress: async () => {
              await refreshMe();
              onSuccess();
            }
          }
        ]
      );
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* Header Icon */}
            <View style={styles.iconCircle}>
              <Ionicons name="key" size={32} color={theme.colors.primary} />
            </View>

            <Text style={styles.title}>First-Time Password Change</Text>
            <Text style={styles.subtitle}>
              Welcome, <Text style={{ fontWeight: '800', color: theme.colors.text }}>{user?.full_name}</Text>! Your account was created by the administrator with a temporary password.
            </Text>

            <View style={styles.noticeBox}>
              <Ionicons name="shield-checkmark" size={18} color="#059669" style={{ marginRight: 8 }} />
              <Text style={styles.noticeText}>
                For security compliance, please create a new personal password before accessing your dashboard.
              </Text>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={theme.colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Login ID Display */}
            <View style={styles.idBox}>
              <Text style={styles.idLabel}>Your Staff Login ID</Text>
              <Text style={styles.idValue}>{user?.employee_code || user?.email}</Text>
            </View>

            {/* Current / Temporary Password */}
            <Text style={styles.fieldLabel}>Temporary / Current Password (Optional if newly issued)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter temporary password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPass}
              />
              <TouchableOpacity
                onPress={() => setShowCurrentPass(!showCurrentPass)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showCurrentPass ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={theme.colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* New Password */}
            <Text style={styles.fieldLabel}>New Private Password * (min 6 characters)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter your new password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPass}
              />
              <TouchableOpacity
                onPress={() => setShowNewPass(!showNewPass)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showNewPass ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={theme.colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* Confirm New Password */}
            <Text style={styles.fieldLabel}>Confirm New Password *</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showNewPass}
              />
            </View>

            {/* Action Buttons */}
            <Button
              title="Save New Password & Continue"
              onPress={handleSubmit}
              loading={loading}
              icon={<Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />}
              style={{ marginTop: 14 }}
            />

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => logout()}
            >
              <Ionicons name="log-out-outline" size={16} color={theme.colors.textMuted} />
              <Text style={styles.logoutBtnText}>Log Out & Return Later</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: theme.spacing.md
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.infoBg,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12
  },
  title: {
    fontSize: 19,
    fontWeight: '900',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 6
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 10,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 14
  },
  noticeText: {
    fontSize: 11.5,
    color: '#065F46',
    fontWeight: '600',
    flex: 1,
    lineHeight: 16
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 10
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.danger,
    marginLeft: 6,
    fontWeight: '600',
    flex: 1
  },
  idBox: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  idLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600'
  },
  idValue: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
    marginTop: 8
  },
  inputContainer: {
    position: 'relative',
    justifyContent: 'center'
  },
  input: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13,
    color: theme.colors.text
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    padding: 4
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8
  },
  logoutBtnText: {
    color: theme.colors.textMuted,
    fontSize: 12.5,
    fontWeight: '600',
    marginLeft: 6
  }
});
