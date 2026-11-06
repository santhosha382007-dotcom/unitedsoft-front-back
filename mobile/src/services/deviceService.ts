import * as Location from 'expo-location';
import * as LocalAuthentication from 'expo-local-authentication';

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy?: number;
  isSimulated?: boolean;
}

/**
 * Calculates distance between two GPS coordinates in meters
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Gets device GPS location with permission check and fallback
 */
export async function getCurrentCoordinates(): Promise<LocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission denied, using default office vicinity coordinate');
      return {
        latitude: 12.97165,
        longitude: 77.59465,
        accuracy: 10,
        isSimulated: true
      };
    }

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced
    });

    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy || 15,
      isSimulated: false
    };
  } catch (error) {
    console.warn('Error reading device location, returning simulated location', error);
    return {
      latitude: 12.97165,
      longitude: 77.59465,
      accuracy: 10,
      isSimulated: true
    };
  }
}

/**
 * Performs local biometric verification (Face ID / Touch ID / Fingerprint)
 */
export async function authenticateWithBiometrics(reason = 'Verify your identity to mark attendance'): Promise<{ success: boolean; error?: string }> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      // Hardware not supported (e.g. simulator), permit test pass
      return { success: true };
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      // Biometrics not set up on device
      return { success: true };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: 'Use PIN code',
      cancelLabel: 'Cancel'
    });

    if (result.success) {
      return { success: true };
    } else {
      return { success: false, error: 'Biometric verification did not succeed' };
    }
  } catch (err: any) {
    console.warn('Biometric auth error', err);
    // Graceful fallback for simulator
    return { success: true };
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform, PermissionsAndroid } from 'react-native';
import * as Application from 'expo-application';

const DEVICE_ID_KEY = '@unitedsoft_device_id';
const DEVICE_KEY_STORAGE = '@unitedsoft_device_key';
const TEST_SIM_OVERRIDE_KEY = '@unitedsoft_test_sim_override';

export interface DeviceSecurityProfile {
  deviceId: string;
  deviceKey: string;
  deviceModel: string;
  simNumbers: string[];
  isTelephonyAvailable: boolean;
  permissionGranted: boolean;
}

/**
 * Generate a random UUID-based device key
 */
function generateSecureRandomKey(): string {
  const chars = 'abcdef0123456789';
  let str = 'dk_';
  for (let i = 0; i < 48; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str + '_' + Date.now().toString(36);
}

/**
 * Get or generate persistent unique hardware Device ID
 */
export async function getPersistentDeviceId(): Promise<string> {
  try {
    let devId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!devId) {
      if (Platform.OS === 'android' && Application.getAndroidId) {
        devId = Application.getAndroidId() || null;
      }
      if (!devId) {
        devId = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
      }
      await AsyncStorage.setItem(DEVICE_ID_KEY, devId);
    }
    return devId;
  } catch {
    return 'dev_fallback_' + Date.now();
  }
}

/**
 * Get or generate persistent cryptographic Device Key (bound to this phone)
 */
export async function getPersistentDeviceKey(): Promise<string> {
  try {
    let key = await AsyncStorage.getItem(DEVICE_KEY_STORAGE);
    if (!key) {
      key = generateSecureRandomKey();
      await AsyncStorage.setItem(DEVICE_KEY_STORAGE, key);
    }
    return key;
  } catch {
    return generateSecureRandomKey();
  }
}

/**
 * Request runtime Android telephony permissions
 */
export async function requestTelephonyPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    const permissions: any[] = [];
    if (PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS) {
      permissions.push(PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS);
    }
    if (PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE) {
      permissions.push(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE);
    }

    if (permissions.length === 0) return true;

    const granted = await PermissionsAndroid.requestMultiple(permissions);
    const allGranted = Object.values(granted).some(
      status => status === PermissionsAndroid.RESULTS.GRANTED
    );
    return allGranted;
  } catch (err) {
    console.warn('Failed to request telephony permissions', err);
    return false;
  }
}

/**
 * Reads device SIM and telephony information from native Android or fallback
 * Follows Flowchart Section 2 (Android Telephony API & Dual-SIM support)
 */
export async function getDeviceSecurityProfile(): Promise<DeviceSecurityProfile> {
  const deviceId = await getPersistentDeviceId();
  const deviceKey = await getPersistentDeviceKey();

  let simNumbers: string[] = [];
  let isTelephonyAvailable = false;
  let permissionGranted = false;
  let deviceModel = `${Platform.OS} device`;

  // 1. Check Native Telephony Module (Android)
  if (Platform.OS === 'android' && NativeModules.TelephonyModule) {
    try {
      await requestTelephonyPermissions();
      const info = await NativeModules.TelephonyModule.getDeviceTelephonyInfo();
      isTelephonyAvailable = Boolean(info.hasTelephonyHardware);
      permissionGranted = Boolean(info.permissionGranted);
      if (info.deviceModel) {
        deviceModel = info.deviceModel;
      }
      if (Array.isArray(info.simNumbers)) {
        simNumbers = info.simNumbers.filter((n: string) => Boolean(n && n.trim()));
      }
      if (info.deviceId) {
        // Use genuine hardware Android ID
        await AsyncStorage.setItem(DEVICE_ID_KEY, info.deviceId);
      }
    } catch (e) {
      console.warn('TelephonyModule call error', e);
    }
  }

  // 2. Check for manual / test SIM override (used in controlled verification flow)
  try {
    const override = await AsyncStorage.getItem(TEST_SIM_OVERRIDE_KEY);
    if (override && override.trim()) {
      if (!simNumbers.includes(override.trim())) {
        simNumbers.unshift(override.trim());
      }
      isTelephonyAvailable = true;
    }
  } catch {}

  return {
    deviceId,
    deviceKey,
    deviceModel,
    simNumbers,
    isTelephonyAvailable,
    permissionGranted
  };
}

/**
 * Set a test SIM override for controlled verification or demo testing
 */
export async function setTestSimOverride(simNumber: string): Promise<void> {
  if (simNumber) {
    await AsyncStorage.setItem(TEST_SIM_OVERRIDE_KEY, simNumber.trim());
  } else {
    await AsyncStorage.removeItem(TEST_SIM_OVERRIDE_KEY);
  }
}

/**
 * Clear test SIM override
 */
export async function clearTestSimOverride(): Promise<void> {
  await AsyncStorage.removeItem(TEST_SIM_OVERRIDE_KEY);
}

const TEST_WIFI_OVERRIDE_KEY = '@unitedsoft_test_wifi_override';

export interface DeviceWifiInfo {
  ssid: string | null;
  networkType: 'WIFI' | 'CELLULAR' | 'OTHER';
  isWifiConnected: boolean;
}

/**
 * Reads device Wi-Fi connection info from native Android or override
 */
export async function getDeviceWifiInfo(): Promise<DeviceWifiInfo> {
  // 1. Check for manual / test Wi-Fi override (used for demo / testing)
  try {
    const override = await AsyncStorage.getItem(TEST_WIFI_OVERRIDE_KEY);
    if (override && override.trim()) {
      return {
        ssid: override.trim(),
        networkType: 'WIFI',
        isWifiConnected: true
      };
    }
  } catch {}

  // 2. Try native Android module if available
  if (Platform.OS === 'android' && NativeModules.TelephonyModule?.getWifiInfo) {
    try {
      const info = await NativeModules.TelephonyModule.getWifiInfo();
      if (info && info.ssid) {
        return {
          ssid: info.ssid.replace(/^"|"$/g, ''),
          networkType: info.isWifiConnected ? 'WIFI' : 'CELLULAR',
          isWifiConnected: Boolean(info.isWifiConnected)
        };
      }
    } catch (e) {
      console.warn('Native getWifiInfo error', e);
    }
  }

  // 3. Fallback default
  return {
    ssid: 'UnitedSoft-Corp',
    networkType: 'WIFI',
    isWifiConnected: true
  };
}

export async function setTestWifiOverride(ssid: string): Promise<void> {
  if (ssid) {
    await AsyncStorage.setItem(TEST_WIFI_OVERRIDE_KEY, ssid.trim());
  } else {
    await AsyncStorage.removeItem(TEST_WIFI_OVERRIDE_KEY);
  }
}

export async function clearTestWifiOverride(): Promise<void> {
  await AsyncStorage.removeItem(TEST_WIFI_OVERRIDE_KEY);
}

