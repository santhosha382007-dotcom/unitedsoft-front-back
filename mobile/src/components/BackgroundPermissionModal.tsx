import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

interface BackgroundPermissionModalProps {
  visible: boolean;
  onGrant: () => void;
  onCancel: () => void;
}

export const BackgroundPermissionModal: React.FC<BackgroundPermissionModalProps> = ({
  visible,
  onGrant,
  onCancel
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header Banner */}
          <View style={styles.header}>
            <View style={styles.headerIconBox}>
              <Ionicons name="videocam" size={28} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Live Monitoring Required</Text>
              <Text style={styles.subtitle}>Shift Work Hours Security Policy</Text>
            </View>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.introText}>
              Company policy requires continuous live monitoring while you are checked in. Please grant background permissions to start your shift:
            </Text>

            {/* Feature 1: Background Location */}
            <View style={styles.featureRow}>
              <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="location" size={22} color="#2563EB" />
              </View>
              <View style={styles.featureTextCol}>
                <Text style={styles.featureTitle}>Background & Live GPS Location</Text>
                <Text style={styles.featureDesc}>
                  Allows tracking your work location continuously even when your phone is locked, minimized, or in your pocket.
                </Text>
              </View>
            </View>

            {/* Feature 2: Live Camera Feed */}
            <View style={styles.featureRow}>
              <View style={[styles.iconCircle, { backgroundColor: '#FDF2F8' }]}>
                <Ionicons name="camera" size={22} color="#DB2777" />
              </View>
              <View style={styles.featureTextCol}>
                <Text style={styles.featureTitle}>Live Camera Presence Feed</Text>
                <Text style={styles.featureDesc}>
                  Periodically streams camera presence to the HR Admin dashboard to verify active shift presence during work hours.
                </Text>
              </View>
            </View>

            {/* Feature 3: Auto-Stop Privacy Guarantee */}
            <View style={styles.featureRow}>
              <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="shield-checkmark" size={22} color="#059669" />
              </View>
              <View style={styles.featureTextCol}>
                <Text style={styles.featureTitle}>100% Privacy Guarantee</Text>
                <Text style={styles.featureDesc}>
                  All GPS tracking and camera feeds are strictly active during your shift only, and automatically shut down the moment you Check Out.
                </Text>
              </View>
            </View>

            {/* Instructions box */}
            <View style={styles.tipBox}>
              <Ionicons name="information-circle-outline" size={18} color="#D97706" style={{ marginTop: 2 }} />
              <Text style={styles.tipText}>
                When prompted by Android/iOS, please select{' '}
                <Text style={{ fontWeight: '700' }}>"Allow all the time"</Text> or{' '}
                <Text style={{ fontWeight: '700' }}>"While using the app"</Text> to ensure continuous work attendance verification.
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.grantBtn} onPress={onGrant} activeOpacity={0.8}>
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.grantBtnText}>Grant & Check In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  headerIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A'
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2
  },
  body: {
    marginBottom: 20
  },
  introText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 16
  },
  featureRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
    alignItems: 'flex-start'
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2
  },
  featureTextCol: {
    flex: 1
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 3
  },
  featureDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17
  },
  tipBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 6
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B'
  },
  grantBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  grantBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF'
  }
});
