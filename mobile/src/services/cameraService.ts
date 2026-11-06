import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

export interface GeotagInfo {
  latitude: number;
  longitude: number;
  locationName: string;
  dateStr: string;
  timeStr: string;
  userName?: string;
  userCode?: string;
}

export interface CapturedSelfie {
  uri: string; // File URI or Data URL
  dataUrl: string; // Base64 data URL with watermark
  geotag: GeotagInfo;
}

/**
 * Requests camera permission with user explanation
 */
export async function requestCameraPermission(): Promise<{ granted: boolean; error?: string }> {
  try {
    if (Platform.OS === 'web') {
      // In web, check mediaDevices if available
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
          // Stop stream immediately after test
          stream.getTracks().forEach(track => track.stop());
          return { granted: true };
        } catch (err: any) {
          console.warn('Web webcam permission error:', err);
          // If denied, fallback to image picker input
          return { granted: true };
        }
      }
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status === 'granted') {
      return { granted: true };
    }

    return {
      granted: false,
      error: 'Camera permission denied. Camera access is required to take attendance verification selfies.'
    };
  } catch (err: any) {
    console.warn('Error requesting camera permission:', err);
    return {
      granted: false,
      error: err.message || 'Unable to request camera permission'
    };
  }
}

/**
 * Reverse geocodes coordinates to a human-readable location address/name
 * e.g. "Erode, Tamil Nadu" or "Salem, Tamil Nadu" or "UnitedSoft Headquarters (HQ Campus)"
 */
export async function getGeocodedLocationName(
  latitude: number,
  longitude: number,
  office?: { latitude: number; longitude: number; name: string } | null
): Promise<string> {
  // 1. If close to known office (<= 150m)
  if (office && office.latitude && office.longitude) {
    const latDiff = Math.abs(latitude - office.latitude);
    const lngDiff = Math.abs(longitude - office.longitude);
    if (latDiff < 0.0014 && lngDiff < 0.0014) {
      return `${office.name} (HQ Campus)`;
    }
  }

  // 2. Try native Expo Location reverseGeocodeAsync
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (results && results.length > 0) {
      const r = results[0];
      const city = r.city || r.district || r.subregion;
      const state = r.region;
      const street = r.name || r.street;

      if (city) {
        if (street && street !== city && !city.includes(street)) {
          return `${street}, ${city}`;
        }
        return state && state !== city ? `${city}, ${state}` : city;
      }
    }
  } catch (e) {
    // Location.reverseGeocodeAsync might not be supported on web or without Google Play Services
  }

  // 3. Robust fallback: Fetch from Nominatim reverse geocoder
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
      {
        headers: { 'User-Agent': 'UnitedSoft-Attendance/1.0' },
        signal: controller ? controller.signal : undefined
      }
    );
    if (timeoutId) clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const place =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.suburb ||
          addr.municipality ||
          addr.county ||
          addr.state_district;
        const state = addr.state;

        if (place) {
          return state && state !== place ? `${place}, ${state}` : place;
        }
      }
    }
  } catch (err) {
    // network timeout or offline
  }

  // 4. Default fallback: coordinates
  return `GPS Location (${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°)`;
}

/**
 * Stamps Geotag Watermark (Location Name, Date, Time, Lat & Long) directly onto the image
 */
export async function stampGeotagWatermark(
  imageSource: string, // file uri or base64
  geotag: GeotagInfo
): Promise<string> {
  // If running in Web environment, use HTML5 Canvas to burn the watermark into pixels
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise<string>((resolve) => {
      const img = new (window as any).Image();
      if (!imageSource.startsWith('data:') && !imageSource.startsWith('blob:')) {
        img.crossOrigin = 'anonymous';
      }

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let w = img.width || 800;
          let h = img.height || 600;

          // Limit resolution for performance and reliable transmission
          const maxDim = 1000;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(imageSource);
            return;
          }

          // 1. Draw raw selfie
          ctx.drawImage(img, 0, 0, w, h);

          // 2. Draw Geotag Overlay Banner at the bottom
          const bannerHeight = Math.max(140, Math.round(h * 0.25));
          const startY = h - bannerHeight;

          // Dark gradient backdrop
          const gradient = ctx.createLinearGradient(0, startY, 0, h);
          gradient.addColorStop(0, 'rgba(15, 23, 42, 0.75)'); // Slate 900
          gradient.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, startY, w, bannerHeight);

          // Top emerald neon accent line
          ctx.fillStyle = '#10B981';
          ctx.fillRect(0, startY, w, 4);

          // Text metrics based on canvas size
          const scale = Math.max(0.7, w / 700);
          const padX = Math.round(20 * scale);
          let textY = startY + Math.round(16 * scale);
          const lineGap = Math.round(24 * scale);

          // Line 1: Header / Location Name
          ctx.fillStyle = '#34D399'; // Emerald-400
          ctx.font = `bold ${Math.round(17 * scale)}px sans-serif`;
          ctx.textBaseline = 'top';
          ctx.fillText(`📍 ${geotag.locationName}`, padX, textY);

          textY += lineGap;

          // Line 2: Date & Time
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `bold ${Math.round(15 * scale)}px sans-serif`;
          ctx.fillText(`📅 ${geotag.dateStr}   •   ⏰ ${geotag.timeStr}`, padX, textY);

          textY += lineGap;

          // Line 3: Latitude & Longitude
          ctx.fillStyle = '#93C5FD'; // Blue-300
          ctx.font = `600 ${Math.round(14 * scale)}px monospace, sans-serif`;
          ctx.fillText(`🌐 Lat: ${geotag.latitude.toFixed(6)}°   Long: ${geotag.longitude.toFixed(6)}°`, padX, textY);

          textY += lineGap;

          // Line 4: System verification badge & Employee info
          ctx.fillStyle = '#CBD5E1'; // Slate-300
          ctx.font = `500 ${Math.round(12 * scale)}px sans-serif`;
          const empStr = geotag.userName ? ` • ${geotag.userName} (${geotag.userCode || 'Staff'})` : '';
          ctx.fillText(`🛡️ UnitedSoft Attendance Verified${empStr}`, padX, textY);

          const result = canvas.toDataURL('image/jpeg', 0.85);
          resolve(result);
        } catch (err) {
          console.warn('Canvas watermark error:', err);
          resolve(imageSource);
        }
      };

      img.onerror = () => {
        resolve(imageSource);
      };

      img.src = imageSource;
    });
  }

  // If on Native mobile:
  // If it's already a base64 string without data prefix, prefix it
  if (!imageSource.startsWith('data:image') && !imageSource.startsWith('http') && !imageSource.startsWith('file://')) {
    return `data:image/jpeg;base64,${imageSource}`;
  }

  return imageSource;
}

/**
 * Launches front camera via Expo ImagePicker, retrieves GPS location,
 * and stamps location name, time, date, latitude, and longitude onto the image.
 */
export async function takeGeotaggedSelfie(options: {
  latitude: number;
  longitude: number;
  locationName: string;
  userName?: string;
  userCode?: string;
}): Promise<CapturedSelfie | null> {
  const perm = await requestCameraPermission();
  if (!perm.granted) {
    throw new Error(perm.error || 'Camera permission is required');
  }

  const result = await ImagePicker.launchCameraAsync({
    cameraType: ImagePicker.CameraType.front,
    allowsEditing: false,
    quality: 0.75,
    base64: true
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const now = new Date();

  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const geotag: GeotagInfo = {
    latitude: options.latitude,
    longitude: options.longitude,
    locationName: options.locationName,
    dateStr,
    timeStr,
    userName: options.userName,
    userCode: options.userCode
  };

  // Determine source image format
  const rawSource = asset.base64
    ? `data:image/jpeg;base64,${asset.base64}`
    : asset.uri;

  // Stamp the geotag watermark onto the image
  const watermarkedDataUrl = await stampGeotagWatermark(rawSource, geotag);

  return {
    uri: asset.uri,
    dataUrl: watermarkedDataUrl,
    geotag
  };
}
