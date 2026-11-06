import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { Button } from '../../components/Button';
import { api } from '../../api/client';
import { getCurrentCoordinates } from '../../services/deviceService';
import { OfficeLocation } from '../../types';

export const AdminGeofenceScreen: React.FC = () => {
  const [office, setOffice] = useState<OfficeLocation | null>(null);
  const [name, setName] = useState<string>('');
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const [radius, setRadius] = useState<string>('150');
  const [address, setAddress] = useState<string>('');

  // Wi-Fi Validation settings
  const [wifiValidationEnabled, setWifiValidationEnabled] = useState<boolean>(false);
  const [allowedSsids, setAllowedSsids] = useState<string>('');
  const [savingWifi, setSavingWifi] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [syncingCurrent, setSyncingCurrent] = useState<boolean>(false);

  useEffect(() => {
    loadAllSettings();
  }, []);

  async function loadAllSettings() {
    try {
      setLoading(true);
      const [officeRes, netRes] = await Promise.all([
        api.getOfficeLocations().catch(() => ({ offices: [] })),
        api.getNetworkSettings().catch(() => ({ settings: { wifi_validation_enabled: false, allowed_wifi_ssids: '' } }))
      ]);

      if (officeRes.offices && officeRes.offices.length > 0) {
        const off = officeRes.offices[0];
        setOffice(off);
        setName(off.name);
        setLat(String(off.latitude));
        setLng(String(off.longitude));
        setRadius(String(off.radius_meters));
        setAddress(off.address || '');
      }

      if (netRes.settings) {
        setWifiValidationEnabled(Boolean(netRes.settings.wifi_validation_enabled));
        setAllowedSsids(netRes.settings.allowed_wifi_ssids || '');
      }
    } catch (e) {
      console.warn('Failed to load settings', e);
    } finally {
      setLoading(false);
    }
  }

  const handleSaveGeofence = async () => {
    if (!office) return;
    setSaving(true);
    try {
      await api.updateOfficeLocation(office.id, {
        name,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        radius_meters: parseFloat(radius),
        address
      });
      Alert.alert('Settings Saved', 'Office geofence parameters updated successfully');
      await loadAllSettings();
    } catch (e: any) {
      Alert.alert('Save Failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWifiSecurity = async () => {
    setSavingWifi(true);
    try {
      await api.updateNetworkSettings({
        wifi_validation_enabled: wifiValidationEnabled,
        allowed_wifi_ssids: allowedSsids
      });
      Alert.alert(
        'Network Security Saved',
        `Wi-Fi validation is now ${wifiValidationEnabled ? 'ENABLED' : 'DISABLED'}.\nAuthorized SSIDs: ${allowedSsids || 'None'}`
      );
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'Unable to update Wi-Fi settings');
    } finally {
      setSavingWifi(false);
    }
  };

  const handleSyncToCurrentLocation = async () => {
    setSyncingCurrent(true);
    try {
      const coords = await getCurrentCoordinates();
      await api.syncOfficeLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        radius_meters: parseFloat(radius) || 200
      });
      Alert.alert(
        'Geofence Synced!',
        `Office center successfully updated to your real GPS location:\nLat: ${coords.latitude.toFixed(5)}, Lng: ${coords.longitude.toFixed(5)}`
      );
      await loadAllSettings();
    } catch (e: any) {
      Alert.alert('Sync Failed', e.message);
    } finally {
      setSyncingCurrent(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Ionicons name="shield-checkmark" size={26} color="#FFFFFF" />
        </View>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.bannerTitle}>Geofence & Wi-Fi Security</Text>
          <Text style={styles.bannerSub}>Enforces physical proximity and authorized company network access</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading security parameters...</Text>
        </View>
      ) : (
        <>
          {/* Card 1: Wi-Fi Validation Security Settings */}
          <View style={[styles.card, { marginBottom: 16 }]}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.wifiIconWrap}>
                  <Ionicons name="wifi" size={18} color="#0D9488" />
                </View>
                <View>
                  <Text style={styles.cardTitle}>Company Wi-Fi Security</Text>
                  <Text style={styles.cardSubTitle}>Network Validation Control</Text>
                </View>
              </View>
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.switchLabel}>Enforce Company Wi-Fi Check-In</Text>
                <Text style={styles.switchSub}>
                  Restricts mobile check-ins strictly to authorized office Wi-Fi networks.
                </Text>
              </View>
              <Switch
                value={wifiValidationEnabled}
                onValueChange={setWifiValidationEnabled}
                trackColor={{ false: '#CBD5E1', true: '#0D9488' }}
                thumbColor={wifiValidationEnabled ? '#FFFFFF' : '#F1F5F9'}
              />
            </View>

            {wifiValidationEnabled && (
              <View style={styles.wifiConfigBox}>
                <Text style={styles.label}>Authorized Wi-Fi SSIDs</Text>
                <TextInput
                  style={styles.input}
                  value={allowedSsids}
                  onChangeText={setAllowedSsids}
                  placeholder="e.g. UnitedSoft-Corp, UnitedSoft-5G, Office-WiFi"
                  autoCapitalize="none"
                />
                <Text style={styles.helperText}>
                  Enter comma-separated Wi-Fi network names (SSIDs). Staff must be connected to one of these networks to punch in.
                </Text>

                <View style={styles.securityAlertNotice}>
                  <Ionicons name="information-circle" size={16} color="#0369A1" />
                  <Text style={styles.securityAlertNoticeText}>
                    If an unauthorized network is detected, staff receive the exact message:
                    {'\n'}<Text style={{ fontWeight: '800' }}>"Check-In is allowed only from the authorized company network."</Text>
                  </Text>
                </View>
              </View>
            )}

            <Button
              title="Save Wi-Fi Security Settings"
              onPress={handleSaveWifiSecurity}
              loading={savingWifi}
              style={{ marginTop: 14 }}
            />
          </View>

          {/* Card 2: Office Geofence Location */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.wifiIconWrap, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="location" size={18} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>Primary Office Location</Text>
                  <Text style={styles.cardSubTitle}>GPS Boundary & Proximity</Text>
                </View>
              </View>
            </View>

            <Text style={styles.label}>Office Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Office Name"
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={styles.label}>Latitude</Text>
                <TextInput
                  style={styles.input}
                  value={lat}
                  onChangeText={setLat}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={styles.label}>Longitude</Text>
                <TextInput
                  style={styles.input}
                  value={lng}
                  onChangeText={setLng}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={styles.label}>Company In-Range Radius (Meters)</Text>
            <TextInput
              style={styles.input}
              value={radius}
              onChangeText={setRadius}
              keyboardType="numeric"
            />
            <Text style={styles.helperText}>
              Staff outside this radius are required to capture geotagged photo proof with location coordinates.
            </Text>

            <Text style={styles.label}>Office Address</Text>
            <TextInput
              style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
              value={address}
              onChangeText={setAddress}
              multiline
            />

            <Button
              title="Save Geofence Settings"
              onPress={handleSaveGeofence}
              loading={saving}
              style={{ marginTop: 12 }}
            />

            {/* Quick GPS Sync Utility */}
            <View style={styles.syncBox}>
              <View style={styles.syncBoxHeader}>
                <Ionicons name="navigate-circle-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.syncBoxTitle}>Rapid Testing Utility</Text>
              </View>
              <Text style={styles.syncBoxDesc}>
                Testing from home or field? Sync the office geofence directly to your current device coordinates with one tap.
              </Text>
              <Button
                title="Sync Office to My GPS Location"
                onPress={handleSyncToCurrentLocation}
                loading={syncingCurrent}
                variant="outline"
                style={{ marginTop: 10 }}
                icon={<Ionicons name="locate" size={18} color={theme.colors.primary} />}
              />
            </View>
          </View>
        </>
      )}
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
    paddingBottom: 35
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  bannerSub: {
    fontSize: 11,
    color: '#BFDBFE',
    marginTop: 2
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  cardHeader: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10
  },
  wifiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center'
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text
  },
  cardSubTitle: {
    fontSize: 11,
    color: theme.colors.textMuted
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8
  },
  switchLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: theme.colors.text
  },
  switchSub: {
    fontSize: 11.5,
    color: theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 16
  },
  wifiConfigBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  securityAlertNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: theme.borderRadius.md,
    padding: 10,
    marginTop: 10,
    gap: 8
  },
  securityAlertNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#0369A1',
    lineHeight: 16
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
    marginTop: 8
  },
  helperText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 4,
    marginBottom: 6,
    lineHeight: 15
  },
  row: {
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
    color: theme.colors.text
  },
  syncBox: {
    marginTop: 18,
    padding: 12,
    backgroundColor: theme.colors.infoBg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: '#BAE6FD'
  },
  syncBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  syncBoxTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: theme.colors.primary,
    marginLeft: 6
  },
  syncBoxDesc: {
    fontSize: 11,
    color: theme.colors.textMuted,
    lineHeight: 16
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: theme.colors.textMuted
  }
});
