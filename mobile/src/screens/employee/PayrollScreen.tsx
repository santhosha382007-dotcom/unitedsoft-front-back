import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../api/client';
import { PayrollRecord } from '../../types';

export const PayrollScreen: React.FC = () => {
  const [slips, setSlips] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    loadPayrollNotifications();
  }, []);

  async function loadPayrollNotifications() {
    try {
      setLoading(true);
      const res = await api.getMySlips();
      setSlips(res.slips || []);
    } catch (err) {
      console.warn('Failed to load payroll notifications', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const renderNotificationCard = ({ item }: { item: PayrollRecord }) => {
    const formattedDate = item.generated_at
      ? new Date(item.generated_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      : item.month_year;

    return (
      <View style={styles.notificationCard}>
        <View style={styles.cardTopRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="notifications" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.notificationTitle}>Payroll Notification</Text>
            <Text style={styles.periodText}>Pay Period: {item.month_year}</Text>
          </View>
          <StatusBadge status={item.status} size="sm" />
        </View>

        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>
            Your payroll for the month of <Text style={styles.boldText}>{item.month_year}</Text> has been processed and approved by HR administration.
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <Ionicons name="calendar-outline" size={13} color={theme.colors.textMuted} />
            <Text style={styles.footerDateText}>Processed: {formattedDate}</Text>
          </View>
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
            <Text style={styles.verifiedText}>HR Verified</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Banner / Heading */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <Text style={styles.pageTitle}>Payroll Notifications</Text>
          <Text style={styles.pageSubtitle}>
            Official alerts for salary & payroll releases
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshIconBtn}
          onPress={() => {
            setRefreshing(true);
            loadPayrollNotifications();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Fetching payroll notifications...</Text>
        </View>
      ) : slips.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="notifications-off-outline" size={48} color={theme.colors.textLight} />
          </View>
          <Text style={styles.emptyTitle}>No Payroll Notifications</Text>
          <Text style={styles.emptyDescription}>
            You currently have no payroll notifications. When HR generates and processes your payroll, you will be alerted here.
          </Text>
          <TouchableOpacity
            style={styles.checkAgainBtn}
            onPress={() => {
              setRefreshing(true);
              loadPayrollNotifications();
            }}
          >
            <Ionicons name="reload" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.checkAgainBtnText}>Check For Updates</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={slips}
          keyExtractor={item => item.id}
          renderItem={renderNotificationCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadPayrollNotifications();
              }}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  headerLeft: {
    flex: 1
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text
  },
  pageSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2
  },
  refreshIconBtn: {
    padding: 8,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#EFF6FF'
  },
  listContent: {
    padding: theme.spacing.md,
    paddingTop: 12
  },
  notificationCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  headerTextWrap: {
    flex: 1
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text
  },
  periodText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 1,
    fontWeight: '600'
  },
  messageContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 12
  },
  messageText: {
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 19
  },
  boldText: {
    fontWeight: '700',
    color: theme.colors.primary
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  footerDateText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginLeft: 5,
    fontWeight: '500'
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    marginLeft: 4
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
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 6
  },
  emptyDescription: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 20,
    marginBottom: 20
  },
  checkAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md
  },
  checkAgainBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  }
});
