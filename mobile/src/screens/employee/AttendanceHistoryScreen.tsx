import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../api/client';
import { AttendanceRecord } from '../../types';

export const AttendanceHistoryScreen: React.FC = () => {
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

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    loadHistory(selectedMonth);
  }, [selectedMonth]);

  async function loadHistory(monthParam?: string) {
    try {
      setLoading(true);
      const res = await api.getMyHistory(monthParam || undefined);
      setRecords(res.records || []);
      setSummary(res.summary || null);
    } catch (err) {
      console.warn('Failed to load history', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const handleSelectMonth = (monthKey: string) => {
    setSelectedMonth(monthKey);
  };

  const renderAttendanceItem = ({ item }: { item: AttendanceRecord }) => {
    const inTime = item.check_in_time
      ? new Date(item.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '--:--';
    const outTime = item.check_out_time
      ? new Date(item.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '--:--';

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.dateBlock}>
            <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.dateText}>
              {new Date(item.date).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </Text>
          </View>
          <StatusBadge status={item.status} size="sm" />
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.timeCol}>
            <Text style={styles.timeLabel}>In</Text>
            <Text style={styles.timeVal}>{inTime}</Text>
          </View>

          <View style={styles.arrowCol}>
            <Ionicons name="arrow-forward" size={16} color={theme.colors.textLight} />
          </View>

          <View style={styles.timeCol}>
            <Text style={styles.timeLabel}>Out</Text>
            <Text style={styles.timeVal}>{outTime}</Text>
          </View>

          <View style={styles.hrsCol}>
            <Text style={styles.hrsVal}>{item.working_hours ? `${item.working_hours}h` : '0h'}</Text>
            <Text style={styles.timeLabel}>Duration</Text>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <View style={styles.methodTag}>
            <Ionicons name="location-outline" size={13} color={theme.colors.textMuted} />
            <Text style={styles.methodText}>
              {item.distance_meters !== undefined ? `${Math.round(item.distance_meters)}m away` : 'Office'}
            </Text>
          </View>

          {item.overtime_hours > 0 && (
            <View style={styles.otBadge}>
              <Text style={styles.otText}>+{item.overtime_hours}h OT</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Month Filter Bar */}
      <View style={styles.filterSection}>
        <View style={styles.filterHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="filter-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.filterLabel}>Month Filter</Text>
          </View>
          {selectedMonth ? (
            <TouchableOpacity onPress={() => handleSelectMonth('')} activeOpacity={0.7}>
              <Text style={styles.clearFilterText}>Show All Months</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.filterSubText}>All Time Records</Text>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthChipsRow}
        >
          <TouchableOpacity
            style={[styles.monthChip, !selectedMonth && styles.monthChipActive]}
            onPress={() => handleSelectMonth('')}
            activeOpacity={0.8}
          >
            <Text style={[styles.monthChipText, !selectedMonth && styles.monthChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {availableMonths.map((m) => {
            const isSelected = selectedMonth === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[styles.monthChip, isSelected && styles.monthChipActive]}
                onPress={() => handleSelectMonth(m.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.monthChipText, isSelected && styles.monthChipTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Monthly Summary KPI Banner */}
      {summary && (
        <View style={styles.kpiContainer}>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiNumber}>{summary.present || 0}</Text>
            <Text style={styles.kpiLabel}>Present</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiNumber, { color: theme.colors.warning }]}>{summary.late || 0}</Text>
            <Text style={styles.kpiLabel}>Late</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiNumber, { color: theme.colors.purple }]}>{summary.halfDay || 0}</Text>
            <Text style={styles.kpiLabel}>Half-Day</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiNumber, { color: theme.colors.primaryLight }]}>
              {summary.totalOvertimeHours ? `${summary.totalOvertimeHours.toFixed(1)}h` : '0h'}
            </Text>
            <Text style={styles.kpiLabel}>Overtime</Text>
          </View>
        </View>
      )}

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading attendance history...</Text>
        </View>
      ) : records.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="calendar-clear-outline" size={48} color={theme.colors.textLight} />
          <Text style={styles.emptyText}>No attendance records found yet</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={item => item.id}
          renderItem={renderAttendanceItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadHistory();
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
  filterSection: {
    backgroundColor: theme.colors.surface,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 8
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text
  },
  filterSubText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '600'
  },
  clearFilterText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '700'
  },
  monthChipsRow: {
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center'
  },
  monthChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  monthChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  monthChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text
  },
  monthChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  kpiContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    justifyContent: 'space-around',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  kpiItem: {
    alignItems: 'center',
    flex: 1
  },
  kpiNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.success
  },
  kpiLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontWeight: '600'
  },
  kpiDivider: {
    width: 1,
    height: 26,
    backgroundColor: theme.colors.border
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 24
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm + 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  dateBlock: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginLeft: 6
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md,
    padding: 10,
    marginBottom: 8
  },
  timeCol: {
    flex: 1,
    alignItems: 'center'
  },
  arrowCol: {
    width: 24,
    alignItems: 'center'
  },
  timeLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  timeVal: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 2
  },
  hrsCol: {
    flex: 1,
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border
  },
  hrsVal: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.primary,
    marginTop: 2
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  methodTag: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  methodText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginLeft: 4
  },
  otBadge: {
    backgroundColor: theme.colors.infoBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm
  },
  otText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.info
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
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: '600'
  }
});
