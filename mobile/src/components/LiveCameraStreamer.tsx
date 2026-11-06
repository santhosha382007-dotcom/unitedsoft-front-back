import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Image,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { transmitCameraFrame } from '../services/trackingService';

interface LiveCameraStreamerProps {
  isCheckedIn: boolean;
  employeeName?: string;
  employeeCode?: string;
}

export const LiveCameraStreamer: React.FC<LiveCameraStreamerProps> = ({
  isCheckedIn,
  employeeName,
  employeeCode
}) => {
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [lastFrameTime, setLastFrameTime] = useState<string>('Initializing...');
  const [minimized, setMinimized] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [previewFrame, setPreviewFrame] = useState<string | null>(null);

  const videoRef = useRef<any>(null);
  const canvasRef = useRef<any>(null);
  const streamRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (isCheckedIn) {
      startCameraStream();
    } else {
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
    };
  }, [isCheckedIn, facingMode]);

  const startCameraStream = async () => {
    if (!isCheckedIn) return;

    try {
      setStreamError(null);

      // On Web platform (and browsers on Android/PC):
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        // Stop any existing stream tracks first
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track: any) => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 320 },
            height: { ideal: 240 }
          },
          audio: false
        });

        streamRef.current = stream;

        // Create or bind hidden video element for frame extraction
        let video = videoRef.current;
        if (!video) {
          video = document.createElement('video');
          video.setAttribute('playsinline', 'true');
          video.setAttribute('autoplay', 'true');
          video.muted = true;
          video.style.display = 'none';
          document.body.appendChild(video);
          videoRef.current = video;
        }

        video.srcObject = stream;
        await video.play().catch(() => {});

        // Setup hidden canvas
        if (!canvasRef.current) {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 240;
          canvasRef.current = canvas;
        }

        setIsStreaming(true);

        // Schedule periodic frame transmission (every 6 seconds)
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(captureAndSendFrame, 6000);

        // Send first frame after 1.5s warm-up
        setTimeout(captureAndSendFrame, 1500);
      } else {
        // Native mobile fallback or simulator: Generate active presence badge
        setIsStreaming(true);
        setLastFrameTime(new Date().toLocaleTimeString());
      }
    } catch (err: any) {
      console.warn('Camera stream startup warning:', err);
      setStreamError(err.message || 'Camera permission required for live feed');
      setIsStreaming(false);
    }
  };

  const captureAndSendFrame = () => {
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Compress frame to low-bandwidth JPEG
          const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
          setPreviewFrame(dataUrl);
          transmitCameraFrame(dataUrl, facingMode);
          setLastFrameTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      }
    } catch (err) {
      // Ignore individual frame extraction errors
    }
  };

  const stopCameraStream = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track: any) => track.stop());
      } catch (e) {}
      streamRef.current = null;
    }

    if (videoRef.current && videoRef.current.parentNode) {
      try {
        videoRef.current.parentNode.removeChild(videoRef.current);
      } catch (e) {}
      videoRef.current = null;
    }

    setIsStreaming(false);
    setPreviewFrame(null);
  };

  const toggleCameraFacing = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  if (!isCheckedIn) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.livePulseDot} />
          <View>
            <Text style={styles.cardTitle}>LIVE WORK MONITORING</Text>
            <Text style={styles.cardSub}>Camera & GPS feed active for HR</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={toggleCameraFacing}
            accessibilityLabel="Switch camera"
          >
            <Ionicons name="camera-reverse-outline" size={18} color="#2563EB" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setMinimized(!minimized)}
          >
            <Ionicons
              name={minimized ? 'chevron-down-outline' : 'chevron-up-outline'}
              size={18}
              color="#64748B"
            />
          </TouchableOpacity>
        </View>
      </View>

      {!minimized && (
        <View style={styles.cardBody}>
          {streamError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={20} color="#DC2626" />
              <Text style={styles.errorText}>
                {streamError}. Location GPS tracking continues in background.
              </Text>
            </View>
          ) : (
            <View style={styles.feedRow}>
              {/* Camera Preview Thumbnail */}
              <View style={styles.previewBox}>
                {previewFrame ? (
                  <Image source={{ uri: previewFrame }} style={styles.previewImage} />
                ) : (
                  <View style={styles.placeholderBox}>
                    <ActivityIndicator size="small" color="#2563EB" />
                    <Text style={styles.placeholderText}>Connecting feed...</Text>
                  </View>
                )}
                <View style={styles.recBadge}>
                  <View style={styles.redDot} />
                  <Text style={styles.recText}>LIVE</Text>
                </View>
              </View>

              {/* Status details */}
              <View style={styles.statusCol}>
                <View style={styles.statusItem}>
                  <Ionicons name="videocam-outline" size={15} color="#059669" />
                  <Text style={styles.statusLabel}>HR Stream:</Text>
                  <Text style={styles.statusValue}>Broadcasting (6s)</Text>
                </View>

                <View style={styles.statusItem}>
                  <Ionicons name="location-outline" size={15} color="#2563EB" />
                  <Text style={styles.statusLabel}>GPS Tracker:</Text>
                  <Text style={styles.statusValue}>Continuous</Text>
                </View>

                <View style={styles.statusItem}>
                  <Ionicons name="time-outline" size={15} color="#D97706" />
                  <Text style={styles.statusLabel}>Last Ping:</Text>
                  <Text style={styles.statusValue}>{lastFrameTime}</Text>
                </View>

                <Text style={styles.privacyNote}>
                  🔒 Tracking strictly terminates upon Check Out.
                </Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F0F7FF',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  livePulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DC2626'
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E3A8A',
    letterSpacing: 0.8
  },
  cardSub: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '500'
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  cardBody: {
    padding: 14
  },
  feedRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center'
  },
  previewBox: {
    width: 110,
    height: 82,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#334155'
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  placeholderBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 9,
    marginTop: 4,
    textAlign: 'center'
  },
  recBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444'
  },
  recText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800'
  },
  statusCol: {
    flex: 1
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  statusValue: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600'
  },
  privacyNote: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
    marginTop: 4
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5'
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#B91C1C'
  }
});
