import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normalized = status ? status.toUpperCase() : 'UNKNOWN';

  let bg = theme.colors.surface;
  let text = theme.colors.textMuted;
  let label = normalized;

  switch (normalized) {
    case 'PRESENT':
      bg = theme.colors.successBg;
      text = theme.colors.success;
      label = 'Present';
      break;
    case 'LATE':
      bg = theme.colors.warningBg;
      text = theme.colors.warning;
      label = 'Late';
      break;
    case 'HALF_DAY':
      bg = theme.colors.purpleBg;
      text = theme.colors.purple;
      label = 'Half Day';
      break;
    case 'ABSENT':
      bg = theme.colors.dangerBg;
      text = theme.colors.danger;
      label = 'Absent';
      break;
    case 'APPROVED':
      bg = theme.colors.successBg;
      text = theme.colors.success;
      label = 'Approved';
      break;
    case 'PENDING':
      bg = theme.colors.warningBg;
      text = theme.colors.warning;
      label = 'Pending';
      break;
    case 'REJECTED':
      bg = theme.colors.dangerBg;
      text = theme.colors.danger;
      label = 'Rejected';
      break;
    case 'PROCESSED':
      bg = theme.colors.infoBg;
      text = theme.colors.info;
      label = 'Processed';
      break;
    case 'PAID':
      bg = theme.colors.successBg;
      text = theme.colors.success;
      label = 'Paid';
      break;
    case 'DRAFT':
      bg = theme.colors.background;
      text = theme.colors.textMuted;
      label = 'Draft';
      break;
  }

  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: bg }, isSmall && styles.badgeSm]}>
      <Text style={[styles.text, { color: text }, isSmall && styles.textSm]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    alignSelf: 'flex-start'
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3
  },
  textSm: {
    fontSize: 10
  }
});
