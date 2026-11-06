import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Linking,
  Platform,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../api/client';
import { theme } from '../../theme';

interface LiveEmployee {
  userId: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  checkInTime: string;
  checkInPhoto?: string;
  shiftMinutes: number;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  address: string | null;
  currentDistanceMeters: number | null;
  isInsideGeofence: boolean;
  cameraFrame: string | null;
  cameraTimestamp: string | null;
  cameraStatus: string;
  batteryLevel: number | null;
  isCharging: boolean;
  lastPingTime: string | null;
  secondsSincePing: number;
  connectionStatus: 'LIVE_STREAMING' | 'ONLINE' | 'IDLE' | 'AWAY' | 'OFFLINE';
}

export const AdminLiveTrackingScreen: React.FC = () => {
  const [employees, setEmployees] = useState<LiveEmployee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedFeed, setSelectedFeed] = useState<LiveEmployee | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const timerRef = useRef<any>(null);

  useEffect(() => {
    loadData();

    // Auto refresh every 6 seconds for live monitoring
    if (autoRefresh) {
      timerRef.current = setInterval(() => {
        loadData(true);
      }, 6000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getLiveEmployees();
      if (res && res.employees) {
        setEmployees(res.employees);
        setLastUpdated(new Date());

        // Update selected modal if open
        if (selectedFeed) {
          const updated = res.employees.find((e: LiveEmployee) => e.userId === selectedFeed.userId);
          if (updated) setSelectedFeed(updated);
        }
      }
    } catch (err) {
      console.warn('Error loading live tracking employees:', err);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openInGoogleMaps = (lat: number, lng: number, name: string) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${lat},${lng}(${encodeURIComponent(name)})`,
      android: `geo:0,0?q=${lat},${lng}(${encodeURIComponent(name)})`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    });
    if (url) {
      Linking.openURL(url).catch(() => {
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
      });
    }
  };

  const filtered = employees.filter(emp => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      emp.fullName?.toLowerCase().includes(q) ||
      emp.employeeCode?.toLowerCase().includes(q) ||
      emp.department?.toLowerCase().includes(q)
    );
  });

  const totalStreaming = employees.filter(e => e.connectionStatus === 'LIVE_STREAMING').length;
  const totalInOffice = employees.filter(e => e.isInsideGeofence).length;

  return (
    <View style={styles.container}>
      {/* Top Command Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={styles.liveRadarDot} />
          <View>
            <Text style={styles.screenTitle}>Live Employee Radar</Text>
            <Text style={styles.screenSubtitle}>
              Camera Feeds & Live GPS Tracking (Active Shift)
            </Text>
          </View>
        </View>

        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={[styles.toggleBtn, autoRefresh && styles.toggleBtnActive]}
            onPress={() => setAutoRefresh(!autoRefresh)}
          >
            <Ionicons
              name={autoRefresh ? 'sync' : 'pause'}
              size={14}
              color={autoRefresh ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.toggleBtnText, autoRefresh && styles.toggleBtnTextActive]}>
              {autoRefresh ? 'Live (6s)' : 'Paused'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={handleRefresh}
            accessibilityLabel="Refresh now"
          >
            <Ionicons name="refresh" size={16} color="#2563EB" />
          </TouchableOpacity>
        </View>
      </View>

      {/* KPI Stats Header */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{employees.length}</Text>
          <Text style={styles.statLabel}>Checked In</Text>
        </View>

        <View style={[styles.statCard, { borderColor: '#BBF7D0' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[styles.dot, { backgroundColor: '#16A34A' }]} />
            <Text style={[styles.statNumber, { color: '#16A34A' }]}>{totalStreaming}</Text>
          </View>
          <Text style={styles.statLabel}>Streaming Feed</Text>
        </View>

        <View style={[styles.statCard, { borderColor: '#BFDBFE' }]}>
          <Text style={[styles.statNumber, { color: '#2563EB' }]}>{totalInOffice}</Text>
          <Text style={styles.statLabel}>Inside Office</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Filter by staff name, code, or department..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Main List */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Connecting to staff live radar...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <Ionicons name="videocam-off-outline" size={56} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No Staff Currently Checked In</Text>
          <Text style={styles.emptyDesc}>
            Once an employee checks in from their mobile app, their continuous live GPS location and camera feed will stream here automatically.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {filtered.map(emp => {
            const hasCoords = emp.latitude !== null && emp.longitude !== null;
            const hours = Math.floor(emp.shiftMinutes / 60);
            const mins = emp.shiftMinutes % 60;
            const durationStr = `${hours}h ${mins}m`;

            return (
              <View key={emp.userId} style={styles.employeeCard}>
                {/* Employee Header */}
                <View style={styles.cardTop}>
                  <View style={styles.empInfo}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>
                        {emp.fullName?.charAt(0).toUpperCase() || 'U'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.empName}>{emp.fullName}</Text>
                        <Text style={styles.empCode}>{emp.employeeCode}</Text>
                      </View>
                      <Text style={styles.empSub}>
                        {emp.department} • {emp.designation || 'Staff'}
                      </Text>
                    </View>
                  </View>

                  {/* Status Indicator */}
                  <View
                    style={[
                      styles.statusPill,
                      emp.connectionStatus === 'LIVE_STREAMING'
                        ? styles.pillStreaming
                        : emp.connectionStatus === 'ONLINE'
                        ? styles.pillOnline
                        : styles.pillIdle
                    ]}
                  >
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            emp.connectionStatus === 'LIVE_STREAMING'
                              ? '#DC2626'
                              : emp.connectionStatus === 'ONLINE'
                              ? '#16A34A'
                              : '#D97706'
                        }
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        {
                          color:
                            emp.connectionStatus === 'LIVE_STREAMING'
                              ? '#DC2626'
                              : emp.connectionStatus === 'ONLINE'
                              ? '#16A34A'
                              : '#D97706'
                        }
                      ]}
                    >
                      {emp.connectionStatus === 'LIVE_STREAMING'
                        ? 'LIVE FEED'
                        : emp.connectionStatus === 'ONLINE'
                        ? 'GPS LIVE'
                        : 'BACKGROUND'}
                    </Text>
                  </View>
                </View>

                {/* Content Row: Live Camera Feed + Live GPS Location */}
                <View style={styles.feedGrid}>
                  {/* Camera Feed Thumbnail */}
                  <TouchableOpacity
                    style={styles.cameraBox}
                    onPress={() => setSelectedFeed(emp)}
                    activeOpacity={0.85}
                  >
                    {emp.cameraFrame ? (
                      <Image source={{ uri: emp.cameraFrame }} style={styles.cameraImage} />
                    ) : (
                      <View style={styles.noCameraBox}>
                        <Ionicons name="camera-outline" size={28} color="#64748B" />
                        <Text style={styles.noCameraText}>
                          {emp.cameraStatus === 'PAUSED_BACKGROUND'
                            ? 'Paused (Background)'
                            : 'Waiting for frame...'}
                        </Text>
                      </View>
                    )}

                    {/* Overlay Badges */}
                    <View style={styles.cameraOverlayTop}>
                      <View style={styles.liveTag}>
                        <View style={styles.redDot} />
                        <Text style={styles.liveTagText}>LIVE CAM</Text>
                      </View>
                      <Ionicons name="expand-outline" size={16} color="#FFFFFF" />
                    </View>

                    <View style={styles.cameraOverlayBottom}>
                      <Text style={styles.timestampText}>
                        {emp.secondsSincePing < 15
                          ? 'Just now'
                          : `${emp.secondsSincePing}s ago`}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Live GPS & Location Card */}
                  <View style={styles.locationDetails}>
                    <View style={styles.locItem}>
                      <Ionicons name="time" size={14} color="#64748B" />
                      <Text style={styles.locText}>
                        Shift: <Text style={{ fontWeight: '700' }}>{durationStr}</Text> (In at{' '}
                        {new Date(emp.checkInTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        )
                      </Text>
                    </View>

                    {/* Office Range Pill */}
                    <View style={styles.locItem}>
                      <Ionicons
                        name={emp.isInsideGeofence ? 'business' : 'navigate'}
                        size={14}
                        color={emp.isInsideGeofence ? '#16A34A' : '#D97706'}
                      />
                      <Text
                        style={[
                          styles.locText,
                          {
                            color: emp.isInsideGeofence ? '#16A34A' : '#D97706',
                            fontWeight: '700'
                          }
                        ]}
                      >
                        {emp.currentDistanceMeters !== null
                          ? emp.isInsideGeofence
                            ? `Inside Office (${emp.currentDistanceMeters}m)`
                            : `Remote / Outside (${(emp.currentDistanceMeters / 1000).toFixed(1)} km)`
                          : 'Detecting office distance...'}
                      </Text>
                    </View>

                    {/* Geocoded Address */}
                    <View style={styles.locItem}>
                      <Ionicons name="location" size={14} color="#2563EB" />
                      <Text style={styles.addressText} numberOfLines={2}>
                        {emp.address || (hasCoords ? `${emp.latitude?.toFixed(4)}°, ${emp.longitude?.toFixed(4)}°` : 'Location pending')}
                      </Text>
                    </View>

                    {/* Google Maps Button */}
                    {hasCoords && (
                      <TouchableOpacity
                        style={styles.mapsBtn}
                        onPress={() => openInGoogleMaps(emp.latitude!, emp.longitude!, emp.fullName)}
                      >
                        <Ionicons name="map-outline" size={13} color="#2563EB" />
                        <Text style={styles.mapsBtnText}>Open in Google Maps</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Expanded Live Camera Feed Modal */}
      <Modal visible={!!selectedFeed} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedFeed?.fullName}</Text>
                <Text style={styles.modalSub}>
                  {selectedFeed?.employeeCode} • {selectedFeed?.department}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedFeed(null)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {selectedFeed?.cameraFrame ? (
                <Image
                  source={{ uri: selectedFeed.cameraFrame }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.modalPlaceholder}>
                  <Ionicons name="videocam-off" size={48} color="#64748B" />
                  <Text style={{ color: '#94A3B8', marginTop: 8 }}>No active camera frame</Text>
                </View>
              )}

              <View style={styles.modalFooter}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={styles.redDot} />
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                    LIVE FEED MONITOR
                  </Text>
                </View>
                <Text style={{ color: '#94A3B8', fontSize: 12 }}>
                  {selectedFeed?.secondsSincePing !== undefined
                    ? `Updated ${selectedFeed.secondsSincePing}s ago`
                    : ''}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  liveRadarDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DC2626'
  },
  screenTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A'
  },
  screenSubtitle: {
    fontSize: 11,
    color: '#64748B'
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  toggleBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB'
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B'
  },
  toggleBtnTextActive: {
    color: '#FFFFFF'
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A'
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A'
  },
  list: {
    flex: 1
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12
  },
  employeeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  empInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2563EB'
  },
  empName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A'
  },
  empCode: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4
  },
  empSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  pillStreaming: {
    backgroundColor: '#FEF2F2'
  },
  pillOnline: {
    backgroundColor: '#F0FDF4'
  },
  pillIdle: {
    backgroundColor: '#FFFBEB'
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800'
  },
  feedGrid: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center'
  },
  cameraBox: {
    width: 130,
    height: 98,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#334155'
  },
  cameraImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  noCameraBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6
  },
  noCameraText: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center'
  },
  cameraOverlayTop: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444'
  },
  liveTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800'
  },
  cameraOverlayBottom: {
    position: 'absolute',
    bottom: 4,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3
  },
  timestampText: {
    color: '#E2E8F0',
    fontSize: 8,
    fontWeight: '600'
  },
  locationDetails: {
    flex: 1,
    gap: 6
  },
  locItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  locText: {
    fontSize: 12,
    color: '#334155'
  },
  addressText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
    flex: 1
  },
  mapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 2
  },
  mapsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  loadingText: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 13
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
    marginTop: 14
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    overflow: 'hidden'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  modalSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2
  },
  modalBody: {
    padding: 16
  },
  modalImage: {
    width: '100%',
    height: 320,
    backgroundColor: '#000000',
    borderRadius: 8
  },
  modalPlaceholder: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12
  }
});
