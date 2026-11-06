import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../theme';
import { Button } from './Button';
import { GeotagPhotoView } from './GeotagPhotoView';
import {
  GeotagInfo,
  stampGeotagWatermark,
  getGeocodedLocationName,
  requestCameraPermission
} from '../services/cameraService';

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (photoDataUrl: string, geotag: GeotagInfo) => void;
  latitude: number;
  longitude: number;
  distanceToOffice: number;
  officeName?: string;
  officeLatitude?: number;
  officeLongitude?: number;
  userName?: string;
  userCode?: string;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  visible,
  onClose,
  onCapture,
  latitude,
  longitude,
  distanceToOffice,
  officeName = 'Company',
  officeLatitude,
  officeLongitude,
  userName,
  userCode
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [askingPermission, setAskingPermission] = useState<boolean>(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [capturedGeotag, setCapturedGeotag] = useState<GeotagInfo | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);
  const [locationName, setLocationName] = useState<string>('Detecting location...');
  const [currentTime, setCurrentTime] = useState<string>('');

  // Web webcam stream ref
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [webcamActive, setWebcamActive] = useState<boolean>(false);

  // Live clock
  useEffect(() => {
    const updateClock = () => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch location address when opened
  useEffect(() => {
    if (visible) {
      setCapturedPhoto(null);
      setCapturedGeotag(null);
      loadAddress();
      checkCameraAccess();
    } else {
      stopWebcam();
    }
  }, [visible, latitude, longitude, officeLatitude, officeLongitude]);

  async function loadAddress() {
    setLocationName('Detecting location...');
    try {
      const officeObj = (officeLatitude && officeLongitude) ? {
        latitude: officeLatitude,
        longitude: officeLongitude,
        name: officeName
      } : null;

      const name = await getGeocodedLocationName(latitude, longitude, officeObj);
      setLocationName(name);
    } catch {
      setLocationName('Remote GPS Location');
    }
  }

  async function checkCameraAccess() {
    setAskingPermission(true);
    try {
      const res = await requestCameraPermission();
      setHasPermission(res.granted);
      if (res.granted && Platform.OS === 'web') {
        startWebcam();
      }
    } finally {
      setAskingPermission(false);
    }
  }

  // Web Webcam handler
  async function startWebcam() {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
        setWebcamActive(true);
      }
    } catch (e) {
      console.warn('Could not initialize direct web webcam stream', e);
      setWebcamActive(false);
    }
  }

  function stopWebcam() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setWebcamActive(false);
  }

  // Snap photo from web video element
  async function snapFromWebcam() {
    if (!videoRef.current) return;
    setProcessing(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.85);

      await processAndWatermark(rawDataUrl);
    } catch (err: any) {
      Alert.alert('Snap Failed', err.message || 'Error capturing photo from camera');
    } finally {
      setProcessing(false);
    }
  }

  // Native ImagePicker Camera launcher
  async function launchNativeCamera() {
    setProcessing(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Access Required',
          'UnitedSoft Attendance needs camera access to take your check-in selfie. Please grant camera permission.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: false,
        quality: 0.75,
        base64: true
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const rawImage = asset.base64
        ? `data:image/jpeg;base64,${asset.base64}`
        : asset.uri;

      await processAndWatermark(rawImage);
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Could not launch camera');
    } finally {
      setProcessing(false);
    }
  }

  async function processAndWatermark(rawImageSource: string) {
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
      latitude,
      longitude,
      locationName,
      dateStr,
      timeStr,
      userName,
      userCode
    };

    const watermarked = await stampGeotagWatermark(rawImageSource, geotag);
    setCapturedPhoto(watermarked);
    setCapturedGeotag(geotag);
    stopWebcam();
  }

  async function useSimulatedSelfie() {
    setProcessing(true);
    try {
      let samplePhoto = '';
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const bg = ctx.createLinearGradient(0, 0, 640, 480);
          bg.addColorStop(0, '#1E293B');
          bg.addColorStop(1, '#0F172A');
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, 640, 480);

          // Head / Face
          ctx.fillStyle = '#FCD34D';
          ctx.beginPath();
          ctx.arc(320, 190, 85, 0, Math.PI * 2);
          ctx.fill();

          // Eyes
          ctx.fillStyle = '#1E293B';
          ctx.beginPath();
          ctx.arc(290, 180, 8, 0, Math.PI * 2);
          ctx.arc(350, 180, 8, 0, Math.PI * 2);
          ctx.fill();

          // Smile
          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(320, 215, 30, 0.2 * Math.PI, 0.8 * Math.PI);
          ctx.stroke();

          // Shoulders / Clothes
          ctx.fillStyle = '#2563EB';
          ctx.beginPath();
          ctx.ellipse(320, 420, 180, 140, 0, Math.PI, 2 * Math.PI);
          ctx.fill();

          samplePhoto = canvas.toDataURL('image/jpeg', 0.85);
        }
      }

      if (!samplePhoto) {
        samplePhoto = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="%231E293B"/><circle cx="320" cy="190" r="85" fill="%23FCD34D"/><circle cx="290" cy="180" r="8" fill="%231E293B"/><circle cx="350" cy="180" r="8" fill="%231E293B"/><path d="M 290 220 Q 320 255 350 220" stroke="%231E293B" stroke-width="5" fill="none"/><ellipse cx="320" cy="420" rx="180" ry="140" fill="%232563EB"/></svg>';
      }

      await processAndWatermark(samplePhoto);
    } catch (err: any) {
      Alert.alert('Simulation Error', err.message || 'Error simulating selfie');
    } finally {
      setProcessing(false);
    }
  }

  const handleRetake = () => {
    setCapturedPhoto(null);
    setCapturedGeotag(null);
    if (Platform.OS === 'web') {
      startWebcam();
    }
  };

  const handleConfirm = () => {
    if (!capturedPhoto || !capturedGeotag) {
      Alert.alert('Photo Required', 'Please take a selfie photo before confirming.');
      return;
    }
    stopWebcam();
    onCapture(capturedPhoto, capturedGeotag);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerBadge}>
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.title}>Attendance Selfie Verification</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                stopWebcam();
                onClose();
              }}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={24} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Range Status Alert */}
          <View style={[styles.rangeNotice, distanceToOffice > 150 ? styles.rangeWarning : styles.rangeSuccess]}>
            <Ionicons
              name={distanceToOffice > 150 ? 'warning-outline' : 'checkmark-circle-outline'}
              size={18}
              color={distanceToOffice > 150 ? '#D97706' : '#059669'}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.rangeNoticeText, { color: distanceToOffice > 150 ? '#B45309' : '#047857' }]}>
              {distanceToOffice > 150
                ? `You are ${Math.round(distanceToOffice)}m away (outside 150m company range). A geotagged selfie photo is mandatory to check in.`
                : `You are within 150m of ${officeName}. Selfie photo verification active.`}
            </Text>
          </View>

          {/* Camera View / Preview Area */}
          <View style={styles.cameraBox}>
            {capturedPhoto && capturedGeotag ? (
              // 1. Captured Photo Preview with Geotag Watermark
              <View style={styles.previewContainer}>
                <GeotagPhotoView
                  photoUri={capturedPhoto}
                  locationName={capturedGeotag.locationName}
                  dateStr={capturedGeotag.dateStr}
                  timeStr={capturedGeotag.timeStr}
                  latitude={capturedGeotag.latitude}
                  longitude={capturedGeotag.longitude}
                  employeeName={userName}
                  employeeCode={userCode}
                  height={260}
                />
                <View style={styles.capturedTag}>
                  <Ionicons name="checkmark-done" size={14} color="#10B981" />
                  <Text style={styles.capturedTagText}>Geotag & Timestamp Successfully Applied</Text>
                </View>
              </View>
            ) : hasPermission === false ? (
              // 2. Camera Permission Denied View
              <View style={styles.permissionDeniedBox}>
                <Ionicons name="videocam-off" size={44} color={theme.colors.danger} />
                <Text style={styles.permTitle}>Camera Access Required</Text>
                <Text style={styles.permDesc}>
                  UnitedSoft Attendance needs camera access to take your check-in selfie when you are outside the 150m company range.
                </Text>
                <Button
                  title="Grant Camera Access"
                  onPress={checkCameraAccess}
                  loading={askingPermission}
                  style={{ marginTop: 12 }}
                />
              </View>
            ) : (
              // 3. Live Camera Viewfinder
              <View style={styles.viewfinderBox}>
                {Platform.OS === 'web' ? (
                  <View style={styles.webVideoWrapper}>
                    {/* Native HTML5 video tag for web preview */}
                    {/* @ts-ignore */}
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: '100%',
                        height: 230,
                        objectFit: 'cover',
                        borderRadius: 12,
                        transform: 'scaleX(-1)' // Mirror selfie view
                      }}
                    />
                    <View style={styles.faceGuideOverlay}>
                      <View style={styles.faceOval} />
                      <Text style={styles.faceGuideText}>Align your face inside frame</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.nativePromptBox}>
                    <Ionicons name="camera-reverse-outline" size={54} color={theme.colors.primary} />
                    <Text style={styles.nativePromptTitle}>Front Camera Ready</Text>
                    <Text style={styles.nativePromptSub}>
                      Tap below to open your camera and capture your geotagged check-in selfie.
                    </Text>
                  </View>
                )}

                {/* Live Real-time Geotag Strip */}
                <View style={styles.liveGeotagStrip}>
                  <View style={styles.liveGeoRow}>
                    <Ionicons name="location" size={12} color="#10B981" />
                    <Text style={styles.liveGeoLocation} numberOfLines={1}>
                      {locationName}
                    </Text>
                  </View>
                  <View style={styles.liveGeoRow}>
                    <Ionicons name="time-outline" size={12} color="#94A3B8" />
                    <Text style={styles.liveGeoDetail}>
                      {currentTime} • Lat: {latitude.toFixed(4)}°, Lng: {longitude.toFixed(4)}°
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            {capturedPhoto ? (
              <View style={styles.actionRow}>
                <Button
                  title="Retake Selfie"
                  onPress={handleRetake}
                  variant="outline"
                  icon={<Ionicons name="refresh" size={16} color={theme.colors.primary} />}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Confirm & Use Selfie"
                  onPress={handleConfirm}
                  variant="success"
                  icon={<Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />}
                  style={{ flex: 1.5 }}
                />
              </View>
            ) : (
              <View style={styles.actionRow}>
                {Platform.OS === 'web' && webcamActive ? (
                  <Button
                    title="Snap Geotagged Selfie"
                    onPress={snapFromWebcam}
                    loading={processing}
                    icon={<Ionicons name="camera" size={18} color="#FFFFFF" />}
                    style={{ flex: 1 }}
                  />
                ) : (
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Open Camera & Snap Selfie"
                      onPress={launchNativeCamera}
                      loading={processing}
                      icon={<Ionicons name="camera" size={18} color="#FFFFFF" />}
                      style={{ width: '100%' }}
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end'
  },
  container: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: theme.spacing.lg,
    maxHeight: '92%'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text
  },
  closeBtn: {
    padding: 4
  },
  rangeNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: theme.borderRadius.md,
    marginBottom: 12
  },
  rangeWarning: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D'
  },
  rangeSuccess: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#6EE7B7'
  },
  rangeNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    lineHeight: 16
  },
  cameraBox: {
    marginVertical: 4
  },
  previewContainer: {
    alignItems: 'center'
  },
  capturedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  capturedTagText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6
  },
  permissionDeniedBox: {
    padding: 24,
    backgroundColor: '#FEF2F2',
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  permTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.danger,
    marginTop: 8
  },
  permDesc: {
    fontSize: 12,
    color: '#991B1B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17
  },
  viewfinderBox: {
    backgroundColor: '#0F172A',
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    position: 'relative'
  },
  webVideoWrapper: {
    position: 'relative',
    height: 230,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center'
  },
  faceGuideOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none'
  },
  faceOval: {
    width: 140,
    height: 180,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    borderStyle: 'dashed'
  },
  faceGuideText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6
  },
  nativePromptBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    backgroundColor: '#F8FAFC'
  },
  nativePromptTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 8
  },
  nativePromptSub: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 4
  },
  liveGeotagStrip: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  liveGeoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 1.5
  },
  liveGeoLocation: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
    flex: 1
  },
  liveGeoDetail: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 6
  },
  actions: {
    marginTop: 16,
    marginBottom: 8
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  simulatedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 8,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD'
  },
  simulatedBtnText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6
  }
});
