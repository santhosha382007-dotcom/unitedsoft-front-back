import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme';
import { Button } from '../../components/Button';

export const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout }
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.full_name ? user.full_name.charAt(0) : 'U'}</Text>
        </View>
        <Text style={styles.name}>{user?.full_name}</Text>
        <Text style={styles.role}>{user?.designation}</Text>
        <View style={styles.badgeRow}>
          <View style={styles.codeBadge}>
            <Text style={styles.codeBadgeText}>{user?.employee_code}</Text>
          </View>
          <View style={[styles.codeBadge, { backgroundColor: theme.colors.purpleBg }]}>
            <Text style={[styles.codeBadgeText, { color: theme.colors.purple }]}>{user?.department}</Text>
          </View>
        </View>
      </View>

      {/* Info Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contact & Work Details</Text>
        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={18} color={theme.colors.textMuted} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={18} color={theme.colors.textMuted} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{user?.phone || 'Not set'}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={18} color={theme.colors.textMuted} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Date Joined</Text>
            <Text style={styles.infoValue}>{user?.joining_date || '2023-01-01'}</Text>
          </View>
        </View>
      </View>

      {/* Shift & Work Rules */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Shift & Attendance Policy</Text>
        <View style={styles.ruleItem}>
          <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
          <View style={styles.ruleContent}>
            <Text style={styles.ruleTitle}>General Shift Timings</Text>
            <Text style={styles.ruleDesc}>09:00 AM to 06:00 PM (Monday - Friday)</Text>
          </View>
        </View>
        <View style={styles.ruleItem}>
          <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.success} />
          <View style={styles.ruleContent}>
            <Text style={styles.ruleTitle}>Grace Period & Overtime</Text>
            <Text style={styles.ruleDesc}>15 min grace window (until 09:15 AM). Hours &gt; 8h calculate overtime.</Text>
          </View>
        </View>
      </View>

      <Button
        title="Sign Out"
        onPress={handleLogout}
        variant="danger"
        style={{ marginTop: 8 }}
        icon={<Ionicons name="log-out-outline" size={18} color="#FFFFFF" />}
      />
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
  profileCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900'
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text
  },
  role: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 2
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 8
  },
  codeBadge: {
    backgroundColor: theme.colors.infoBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
    marginHorizontal: 3
  },
  codeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 10
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC'
  },
  infoContent: {
    marginLeft: 12
  },
  infoLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    textTransform: 'uppercase'
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 1
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8
  },
  ruleContent: {
    marginLeft: 12,
    flex: 1
  },
  ruleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text
  },
  ruleDesc: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1
  }
});
