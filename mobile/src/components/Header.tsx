import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  const { user, logout } = useAuth();

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'HR_ADMIN';
  const isHR = user?.role === 'HR';
  const isTL = user?.role === 'TL';

  const roleLabel = isAdmin ? 'Admin' : isHR ? 'HR Officer' : isTL ? 'Team Lead' : 'Employee';
  const roleBg = isAdmin ? theme.colors.purpleBg : isHR ? '#F3E8FF' : isTL ? '#CCFBF1' : theme.colors.infoBg;
  const roleColor = isAdmin ? theme.colors.purple : isHR ? '#7E22CE' : isTL ? '#0D9488' : theme.colors.info;

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{user?.full_name || 'UnitedSoft User'}</Text>
          <View style={styles.roleRow}>
            <View style={[styles.roleBadge, { backgroundColor: roleBg }]}>
              <Text style={[styles.roleText, { color: roleColor }]}>
                {roleLabel}
              </Text>
            </View>
            <Text style={styles.empCode}>{user?.employee_code || user?.department}</Text>
          </View>
        </View>
      </View>

      <View style={styles.right}>
        <TouchableOpacity style={styles.iconBtn} onPress={logout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={22} color={theme.colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  avatar: {
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
  info: {
    flex: 1
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: theme.borderRadius.sm,
    marginRight: 6
  },
  roleText: {
    fontSize: 10,
    fontWeight: '700'
  },
  empCode: {
    fontSize: 12,
    color: theme.colors.textMuted
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconBtn: {
    padding: 8,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.dangerBg
  }
});
