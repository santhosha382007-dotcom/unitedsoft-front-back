import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { api } from '../api/client';
import { requestCameraPermission } from './cameraService';

interface TrackingState {
  isActive: boolean;
  intervalId: any | null;
  cameraIntervalId: any | null;
  lastCoords: { latitude: number; longitude: number } | null;
  lastAddress: string | null;
  cameraStatus: 'LIVE' | 'PAUSED_BACKGROUND' | 'OFFLINE';
}

const state: TrackingState = {
  isActive: false,
  intervalId: null,
  cameraIntervalId: null,
  lastCoords: null,
  lastAddress: null,
  cameraStatus: 'OFFLINE'
};

let appStateSubscription: any = null;

/**
 * Requests required permissions for live background tracking and camera feed:
 * 1. Foreground Location
 * 2. Background Location (Always Allow)
 * 3. Camera Access
 */
export async function requestBackgroundMonitoringPermissions(): Promise<{
  granted: boolean;
  locationGranted: boolean;
  backgroundGranted: boolean;
  cameraGranted: boolean;
  message?: string;
}> {
  try {
    // 1. Foreground Location
    const fg = await Location.requestForegroundPermissionsAsync();
    const locationGranted = fg.status === 'granted';

    // 2. Background Location
    let backgroundGranted = false;
    if (locationGranted) {
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        try {
          const bg = await Location.requestBackgroundPermissionsAsync();
          backgroundGranted = bg.status === 'granted';
        } catch (bgErr) {
          console.warn('Background location request warning:', bgErr);
          // On some devices/simulators, background permission is automatically granted or handled via foreground
          backgroundGranted = locationGranted;
        }
      } else {
        backgroundGranted = true; // Web uses standard geolocation
      }
    }

    // 3. Camera Permission
    const cam = await requestCameraPermission();
    const cameraGranted = cam.granted;

    const allGranted = locationGranted && cameraGranted;

    let message = 'All monitoring permissions successfully granted.';
    if (!locationGranted) {
      message = 'Location permission is required for work attendance.';
    } else if (!cameraGranted) {
      message = 'Camera permission is required for live work verification.';
    } else if (!backgroundGranted) {
      message = 'Foreground location granted. For optimal tracking when phone is locked, enable "Allow all the time" in Settings.';
    }

    return {
      granted: allGranted,
      locationGranted,
      backgroundGranted,
      cameraGranted,
      message
    };
  } catch (err: any) {
    console.error('Error requesting background monitoring permissions:', err);
    return {
      granted: false,
      locationGranted: false,
      backgroundGranted: false,
      cameraGranted: false,
      message: err.message || 'Error checking permissions'
    };
  }
}

/**
 * Starts live background location pinging loop (every 10-15s during shift)
 */
export async function startLiveTracking(): Promise<boolean> {
  if (state.isActive) {
    return true;
  }

  state.isActive = true;
  state.cameraStatus = 'LIVE';

  // Immediate first ping
  await sendLocationPing();

  // Schedule periodic ping every 12 seconds
  if (state.intervalId) {
    clearInterval(state.intervalId);
  }
  state.intervalId = setInterval(() => {
    if (state.isActive) {
      sendLocationPing().catch(() => {});
    }
  }, 12000);

  // Monitor AppState to update camera status if app moves to background
  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
  }

  return true;
}

/**
 * Handler when app minimizes or resumes
 */
function handleAppStateChange(nextAppState: AppStateStatus) {
  if (!state.isActive) return;

  if (nextAppState === 'active') {
    state.cameraStatus = 'LIVE';
    api.updateCameraFeed({ cameraStatus: 'LIVE' }).catch(() => {});
  } else {
    // App minimized / backgrounded: OS temporarily restricts raw camera capture
    state.cameraStatus = 'PAUSED_BACKGROUND';
    api.updateCameraFeed({ cameraStatus: 'PAUSED_BACKGROUND' }).catch(() => {});
  }
}

/**
 * Retrieves coordinates and posts to backend
 */
async function sendLocationPing(): Promise<void> {
  try {
    let latitude = 0;
    let longitude = 0;
    let accuracy = 10;

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        await new Promise<void>(resolve => {
          navigator.geolocation.getCurrentPosition(
            pos => {
              latitude = pos.coords.latitude;
              longitude = pos.coords.longitude;
              accuracy = pos.coords.accuracy || 10;
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      }
    } else {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
      accuracy = pos.coords.accuracy || 10;
    }

    if (latitude !== 0 && longitude !== 0) {
      state.lastCoords = { latitude, longitude };

      // Periodic reverse geocoding if moved
      let address = state.lastAddress;
      if (!address) {
        try {
          const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (rev && rev.length > 0) {
            const r = rev[0];
            address = [r.name || r.street, r.city || r.district, r.region].filter(Boolean).join(', ');
            state.lastAddress = address;
          }
        } catch (e) {}
      }

      await api.updateLiveLocation({
        latitude,
        longitude,
        accuracy,
        address: address || undefined
      });
    }
  } catch (err) {
    // Silent catch on network blip
  }
}

/**
 * Transmits a live camera frame to the backend
 */
export async function transmitCameraFrame(frameBase64: string, facingMode: string = 'user'): Promise<boolean> {
  if (!state.isActive) return false;
  try {
    await api.updateCameraFeed({
      cameraFrame: frameBase64,
      cameraStatus: 'LIVE',
      facingMode
    });
    return true;
  } catch (err) {
    console.warn('Failed to transmit camera frame:', err);
    return false;
  }
}

/**
 * Stops live tracking loop and terminates shift monitoring
 */
export async function stopLiveTracking(): Promise<void> {
  state.isActive = false;
  state.cameraStatus = 'OFFLINE';

  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  if (state.cameraIntervalId) {
    clearInterval(state.cameraIntervalId);
    state.cameraIntervalId = null;
  }

  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  try {
    await api.stopTrackingSession();
  } catch (err) {}
}

export function isTrackingActive(): boolean {
  return state.isActive;
}

export function getTrackingStatus() {
  return {
    isActive: state.isActive,
    cameraStatus: state.cameraStatus,
    lastCoords: state.lastCoords,
    lastAddress: state.lastAddress
  };
}
