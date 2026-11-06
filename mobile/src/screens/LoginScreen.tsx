import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Modal,
  Image,
  StatusBar,
  Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import { Button } from '../components/Button';
import { api, getApiBaseUrl, setApiBaseUrl, CLOUD_API_URL, FALLBACK_CLOUD_API_URL, LOCAL_API_URL } from '../api/client';
import {
  getDeviceSecurityProfile,
  setTestSimOverride,
  clearTestSimOverride
} from '../services/deviceService';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 0) : insets.top;
  const scrollViewRef = useRef<ScrollView>(null);

  const DEMO_PRESETS = [
    { role: 'HR (Web & App)', email: 'hr@unitedsoft.com', pass: 'hr123', color: '#8B5CF6' },
    { role: 'Team Lead', email: 'tl@unitedsoft.com', pass: 'tl123', color: '#0EA5E9' },
    { role: 'Employee', email: 'emp@unitedsoft.com', pass: 'emp123', color: '#10B981' },
    { role: 'Admin (Web Only)', email: 'admin@unitedsoft.com', pass: 'admin123', color: '#6366F1' },
  ];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cloud server settings modal
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(getApiBaseUrl());

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Controlled Verification Flow Modal (Flowchart Section 2)
  const [showControlledModal, setShowControlledModal] = useState(false);
  const [maskedMobile, setMaskedMobile] = useState('');
  const [hrVerificationPin, setHrVerificationPin] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [simTestInput, setSimTestInput] = useState('');

  const handleLogin = async (overrideSecurity?: { verificationCode?: string; testSim?: string }) => {
    if (!email.trim() || !password) {
      setError('Please enter your Login ID / Email and password');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      if (overrideSecurity?.testSim) {
        await setTestSimOverride(overrideSecurity.testSim);
      }

      let profile = { deviceId: undefined as string | undefined, deviceKey: undefined as string | undefined, simNumbers: [] as string[] };
      try {
        profile = await getDeviceSecurityProfile();
      } catch (e) {
        console.warn('Could not read device security profile', e);
      }

      const res = await login(email.trim(), password, {
        deviceId: profile.deviceId,
        deviceKey: profile.deviceKey,
        detectedMobileNumbers: profile.simNumbers,
        verificationCode: overrideSecurity?.verificationCode
      });

      if (res?.isFirstDeviceRegistration) {
        Alert.alert(
          'Device Bound Successfully',
          'This device has been registered and bound to your employee account! Future logins will require this device & mobile.',
          [{ text: 'Continue' }]
        );
      }
    } catch (err: any) {
      const errCode = err.code || '';
      if (errCode === 'MOBILE_NOT_FOUND') {
        // Section 2: Mobile Number Found? -> NO
        setMaskedMobile(err.registeredMobileMasked || '');
        setShowControlledModal(true);
      } else if (errCode === 'MOBILE_MISMATCH') {
        // Section 2: Numbers Match? -> NO
        Alert.alert(
          'Login Blocked: SIM Mismatch',
          'This device is not registered for this employee account.\n\nThe SIM card detected in this phone does not match the mobile number registered by HR for this employee account.',
          [{ text: 'OK' }]
        );
        setError('Login Blocked: Device SIM does not match registered employee phone number.');
      } else if (errCode === 'DEVICE_MISMATCH') {
        // Section 2: Registered Device? -> NO (Device mismatch)
        Alert.alert(
          'Login Blocked: Unauthorized Device',
          'This employee account is bound to another registered device.\n\nIn accordance with company security policy, multi-device logins are prohibited. Please contact HR to reset your registered device.',
          [
            { text: 'Contact HR', onPress: () => setShowControlledModal(true) },
            { text: 'OK' }
          ]
        );
        setError('Login Blocked: Account is bound to another device. Contact HR to authorize a device transfer.');
      } else {
        setError(err.message || 'Login failed. Please check credentials or server connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Submit HR Emergency Verification Code (Controlled Verification Flow)
  const handleVerifyHrPin = async () => {
    if (!hrVerificationPin.trim()) {
      Alert.alert('Required', 'Please enter the 6-digit HR verification code');
      return;
    }

    setVerifyingPin(true);
    try {
      await handleLogin({ verificationCode: hrVerificationPin.trim() });
      setShowControlledModal(false);
      setHrVerificationPin('');
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message || 'Invalid or expired HR code');
    } finally {
      setVerifyingPin(false);
    }
  };

  // Apply SIM number override for test/controlled verification
  const handleApplySimOverride = async () => {
    if (!simTestInput.trim()) {
      Alert.alert('Required', 'Please enter the SIM mobile number to verify');
      return;
    }
    await setTestSimOverride(simTestInput.trim());
    setShowControlledModal(false);
    await handleLogin({ testSim: simTestInput.trim() });
  };

  const handleRequestResetCode = async () => {
    if (!forgotEmail.trim()) {
      Alert.alert('Required', 'Please enter your corporate email address');
      return;
    }

    setResetting(true);
    try {
      const res = await api.forgotPassword(forgotEmail.trim());
      setCodeSent(true);
      if (res.demo_code) {
        setResetCode(res.demo_code);
        Alert.alert('Verification Code Sent', `A reset code has been generated:\nCode: ${res.demo_code} (Auto-filled)`);
      } else {
        Alert.alert('Verification Code Sent', res.message);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to request reset code');
    } finally {
      setResetting(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!resetCode.trim() || !newPassword) {
      Alert.alert('Required', 'Please enter the verification code and new password');
      return;
    }

    setResetting(true);
    try {
      const res = await api.resetPassword({
        email: forgotEmail.trim(),
        code: resetCode.trim(),
        newPassword
      });
      Alert.alert('Password Updated', res.message || 'Your password has been reset successfully!');
      setShowForgotModal(false);
      setPassword(newPassword);
      setCodeSent(false);
      setResetCode('');
      setNewPassword('');
    } catch (err: any) {
      Alert.alert('Reset Failed', err.message || 'Invalid code or password reset error');
    } finally {
      setResetting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topPadding, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primaryDark} translucent={false} />
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Banner */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brandTitle}>UniSoft Team</Text>
          <Text style={styles.brandSubtitle}>Hardware & SIM Verified Attendance System</Text>
        </View>

        {/* Login Form Card */}
        <View style={styles.card}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Secure Staff Sign In</Text>
            <Text style={styles.formSubtitle}>Unified Access • Role-Based Permissions</Text>
          </View>

          {/* Quick Demo Fill Buttons */}
          <View style={styles.demoSection}>
            <Text style={styles.demoLabel}>Demo Fast-Fill Accounts:</Text>
            <View style={styles.demoChipsRow}>
              {DEMO_PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.role}
                  style={[styles.demoChip, { borderColor: p.color }]}
                  onPress={() => {
                    setEmail(p.email);
                    setPassword(p.pass);
                    setError(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.demoChipText, { color: p.color }]}>{p.role}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.securityPill}>
            <Ionicons name="shield-checkmark" size={14} color="#0D9488" />
            <Text style={styles.securityPillText}>
              Single Secure Login • Automatic Role Detection
            </Text>
          </View>

          <View style={styles.roleAccessNote}>
            <Ionicons name="information-circle-outline" size={14} color="#6366F1" />
            <Text style={styles.roleAccessNoteText}>
              HR Login works on both Mobile App & Web. Admin page is strictly restricted to Web.
            </Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={theme.colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Identifier Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Employee ID or Work Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="person-outline"
                size={20}
                color={theme.colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Staff Code (e.g. 12234) or Corporate Email"
                placeholderTextColor={theme.colors.textLight}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <View style={styles.passwordLabelRow}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity onPress={() => setShowForgotModal(true)}>
                <Text style={styles.forgotLink}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={theme.colors.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 150);
                }}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          <Button
            title="Sign In"
            onPress={() => handleLogin()}
            loading={loading}
            style={styles.loginBtn}
          />
        </View>

        {/* Cloud & Network Server Link */}
        <TouchableOpacity
          style={styles.serverLink}
          onPress={() => {
            setServerUrlInput(getApiBaseUrl());
            setShowServerModal(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="globe-outline" size={15} color="#94A3B8" />
          <Text style={styles.serverLinkText}>
            Server: {getApiBaseUrl().includes('onrender.com') || getApiBaseUrl().includes('trycloudflare') || !getApiBaseUrl().includes('10.227.') && !getApiBaseUrl().includes('localhost') ? 'Global Cloud (Active 🌐)' : 'Local Wi-Fi'}
          </Text>
          <Ionicons name="settings-outline" size={13} color="#94A3B8" style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        {/* CONTROLLED VERIFICATION FLOW MODAL (Flowchart Section 2) */}
        <Modal visible={showControlledModal} transparent animationType="slide">
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="shield-outline" size={24} color="#D97706" />
                    <Text style={styles.modalTitle}>Controlled Verification Flow</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowControlledModal(false)}>
                    <Ionicons name="close" size={24} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.warningCard}>
                  <Text style={styles.warningTitle}>Mobile number could not be verified on this device</Text>
                  <Text style={styles.warningDesc}>
                    The Android Telephony API was unable to detect an active SIM phone number on this hardware (carrier MSISDN absent or simulator environment).
                  </Text>
                  {maskedMobile ? (
                    <Text style={styles.maskedNumberText}>
                      HR Registered Mobile: <Text style={{ fontWeight: '800' }}>{maskedMobile}</Text>
                    </Text>
                  ) : null}
                </View>

                {/* Option 1: Contact HR directly */}
                <Text style={styles.sectionSubtitle}>Option 1: Contact HR Administrator</Text>
                <View style={styles.hrContactCard}>
                  <View style={styles.hrContactRow}>
                    <Ionicons name="person-circle-outline" size={20} color="#4F46E5" />
                    <Text style={styles.hrContactText}>HR Admin Office: Sarah Jenkins</Text>
                  </View>
                  <View style={styles.hrActionRow}>
                    <TouchableOpacity
                      style={styles.hrCallBtn}
                      onPress={() => Linking.openURL('tel:+15550100').catch(() => Alert.alert('HR Phone', '+1-555-0100'))}
                    >
                      <Ionicons name="call-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.hrBtnText}>Call HR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.hrEmailBtn}
                      onPress={() => Linking.openURL('mailto:admin@unitedsoft.com?subject=Device%20Mobile%20Verification%20Assistance').catch(() => Alert.alert('HR Email', 'admin@unitedsoft.com'))}
                    >
                      <Ionicons name="mail-outline" size={16} color="#4F46E5" />
                      <Text style={[styles.hrBtnText, { color: '#4F46E5' }]}>Email HR</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Option 2: Enter HR One-Time Emergency PIN */}
                <Text style={[styles.sectionSubtitle, { marginTop: 14 }]}>Option 2: Enter 6-Digit HR Authorization Code</Text>
                <Text style={styles.modalDesc}>
                  If HR has issued a temporary 6-digit device authorization code for your account, enter it below:
                </Text>
                <TextInput
                  style={[styles.modalInput, { letterSpacing: 4, fontWeight: '700', fontSize: 16 }]}
                  value={hrVerificationPin}
                  onChangeText={setHrVerificationPin}
                  placeholder="e.g. 583921"
                  keyboardType="numeric"
                  maxLength={6}
                />
                <Button
                  title="Verify HR Code & Bind Device"
                  onPress={handleVerifyHrPin}
                  loading={verifyingPin}
                  style={{ marginBottom: 12 }}
                />

                {/* Option 3: Manual SIM testing */}
                <View style={styles.devSimSection}>
                  <Text style={styles.devSimTitle}>Developer & SIM Test Helper</Text>
                  <Text style={styles.devSimDesc}>
                    If using a simulator or your SIM number is not automatically detected by Android, specify your SIM number to complete verification:
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    value={simTestInput}
                    onChangeText={setSimTestInput}
                    placeholder="Enter SIM phone number (e.g. 8903366719)"
                    keyboardType="phone-pad"
                  />
                  <TouchableOpacity style={styles.applySimBtn} onPress={handleApplySimOverride}>
                    <Text style={styles.applySimBtnText}>Apply SIM & Verify</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>

        {/* Forgot Password Modal */}
        <Modal visible={showForgotModal} transparent animationType="slide">
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Password Recovery</Text>
                  <TouchableOpacity onPress={() => setShowForgotModal(false)}>
                    <Ionicons name="close" size={24} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {!codeSent ? (
                  <>
                    <Text style={styles.modalDesc}>
                      Enter your registered corporate email to receive a password reset verification code.
                    </Text>
                    <Text style={styles.label}>Corporate Email</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={forgotEmail}
                      onChangeText={setForgotEmail}
                      placeholder="name@unitedsoft.com"
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                    <Button
                      title="Send Reset Code"
                      onPress={handleRequestResetCode}
                      loading={resetting}
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.modalDesc}>
                      Enter the 6-digit verification code sent to your email and select your new password.
                    </Text>
                    <Text style={styles.label}>Verification Code</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={resetCode}
                      onChangeText={setResetCode}
                      placeholder="6-Digit Code"
                      keyboardType="numeric"
                    />
                    <Text style={styles.label}>New Password</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="At least 6 characters"
                      secureTextEntry
                    />
                    <Button
                      title="Update Password"
                      onPress={handleConfirmReset}
                      loading={resetting}
                    />
                  </>
                )}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>

        {/* Server & Cloud Settings Modal */}
        <Modal visible={showServerModal} transparent animationType="slide">
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>API Server Endpoint</Text>
                  <TouchableOpacity onPress={() => setShowServerModal(false)}>
                    <Ionicons name="close" size={24} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalDesc}>
                  Connect to your UnitedSoft Attendance backend server across Wi-Fi or global Cloud:
                </Text>

                <View style={styles.presetRow}>
                  <TouchableOpacity
                    style={[styles.presetBtn, { flex: 1.2 }]}
                    onPress={() => setServerUrlInput(CLOUD_API_URL)}
                  >
                    <Text style={styles.presetBtnText}>🌐 Global Cloud</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.presetBtn, { flex: 1.1 }]}
                    onPress={() => setServerUrlInput(FALLBACK_CLOUD_API_URL)}
                  >
                    <Text style={styles.presetBtnText}>☁️ Backup Cloud</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.presetBtn, { flex: 0.9 }]}
                    onPress={() => setServerUrlInput(LOCAL_API_URL)}
                  >
                    <Text style={styles.presetBtnText}>🏠 Local Dev</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.modalInput}
                  value={serverUrlInput}
                  onChangeText={setServerUrlInput}
                  placeholder="https://your-api.com/api"
                  autoCapitalize="none"
                />

                <Button
                  title="Save Server URL"
                  onPress={async () => {
                    await setApiBaseUrl(serverUrlInput.trim());
                    setShowServerModal(false);
                    Alert.alert('Saved', 'Server address updated successfully!');
                  }}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.primaryDark
  },
  scrollContent: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center'
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 20
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  logoImg: {
    width: 48,
    height: 48
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 4,
    fontWeight: '500'
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10
  },
  formHeader: {
    marginBottom: 12,
    alignItems: 'center'
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text
  },
  formSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2
  },
  demoSection: {
    marginBottom: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  demoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  demoChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  demoChip: {
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: theme.borderRadius.full
  },
  demoChipText: {
    fontSize: 11,
    fontWeight: '700'
  },
  securityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    marginBottom: 14
  },
  securityPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F766E'
  },
  roleAccessNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    marginBottom: 14
  },
  roleAccessNoteText: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '600',
    color: '#4338CA',
    lineHeight: 15
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: theme.borderRadius.md,
    padding: 10,
    marginBottom: 12,
    gap: 8
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.danger,
    fontWeight: '600'
  },
  inputGroup: {
    marginBottom: 14
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6
  },
  forgotLink: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primaryLight
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12
  },
  inputIcon: {
    marginRight: 10
  },
  input: {
    flex: 1,
    height: 46,
    fontSize: 14,
    color: theme.colors.text
  },
  eyeBtn: {
    padding: 6
  },
  loginBtn: {
    marginTop: 4,
    backgroundColor: theme.colors.primary
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
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
    marginBottom: 12
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text
  },
  modalDesc: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: 12,
    lineHeight: 18
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 10
  },
  warningCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 14
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 4
  },
  warningDesc: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 17
  },
  maskedNumberText: {
    marginTop: 6,
    fontSize: 12,
    color: '#92400E'
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 6
  },
  hrContactCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 10
  },
  hrContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10
  },
  hrContactText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text
  },
  hrActionRow: {
    flexDirection: 'row',
    gap: 10
  },
  hrCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D9488',
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    gap: 6
  },
  hrEmailBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    gap: 6
  },
  hrBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  devSimSection: {
    marginTop: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: theme.borderRadius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  devSimTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 2
  },
  devSimDesc: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8
  },
  applySimBtn: {
    backgroundColor: '#334155',
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center'
  },
  applySimBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  serverLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignSelf: 'center'
  },
  serverLinkText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '600',
    marginLeft: 6
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  presetBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text
  }
});
