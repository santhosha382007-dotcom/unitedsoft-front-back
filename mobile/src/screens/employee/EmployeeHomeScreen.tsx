import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { api } from '../../api/client';
import {
  getCurrentCoordinates,
  calculateDistanceMeters,
  authenticateWithBiometrics,
  getDeviceWifiInfo,
  LocationResult
} from '../../services/deviceService';
import { GeotagInfo } from '../../services/cameraService';
import { CameraModal } from '../../components/CameraModal';
import { GeotagPhotoView } from '../../components/GeotagPhotoView';
import { BackgroundPermissionModal } from '../../components/BackgroundPermissionModal';
import { LiveCameraStreamer } from '../../components/LiveCameraStreamer';
import {
  requestBackgroundMonitoringPermissions,
  startLiveTracking,
  stopLiveTracking
} from '../../services/trackingService';
import { AttendanceRecord } from '../../types';

// Company in-range threshold is 150 meters
const COMPANY_RADIUS_THRESHOLD = 150;

export const EmployeeHomeScreen: React.FC = () => {
  const { user, office } = useAuth();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [coords, setCoords] = useState<LocationResult | null>(null);
  const [distanceToOffice, setDistanceToOffice] = useState<number>(0);
  const [isInsideGeofence, setIsInsideGeofence] = useState<boolean>(true);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false);
  const [isCheckedOut, setIsCheckedOut] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshingLocation, setRefreshingLocation] = useState<boolean>(false);

  // Verification modal state
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);
  const [verifyAction, setVerifyAction] = useState<'IN' | 'OUT'>('IN');
  const [submittingPunch, setSubmittingPunch] = useState<boolean>(false);

  // Camera & Selfie Geotag state
  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
  const [selfieGeotag, setSelfieGeotag] = useState<GeotagInfo | null>(null);
  const [showPreviewSelfieModal, setShowPreviewSelfieModal] = useState<boolean>(false);

  // Background & Camera Monitoring state
  const [showBackgroundPermissionModal, setShowBackgroundPermissionModal] = useState<boolean>(false);
  const [monitoringPermissionGranted, setMonitoringPermissionGranted] = useState<boolean>(false);

  // Outside-Shift / College Visit state
  const [showOutsideShiftModal, setShowOutsideShiftModal] = useState<boolean>(false);
  const [collegesList, setCollegesList] = useState<string[]>([
    'Salem Government Arts College',
    'Knowledge Institute of Technology',
    'Sona College of Technology',
    'Government College of Engineering'
  ]);
  const [selectedCollege, setSelectedCollege] = useState<string>('Salem Government Arts College');
  const [customCollege, setCustomCollege] = useState<string>('');
  const [outsideDept, setOutsideDept] = useState<string>('');
  const [outsideStaffName, setOutsideStaffName] = useState<string>('');
  const [outsidePurpose, setOutsidePurpose] = useState<string>('Campus Recruitment / Training');
  const [outsideStartTime, setOutsideStartTime] = useState<string>('09:30 AM');
  const [outsideEndTime, setOutsideEndTime] = useState<string>('05:30 PM');
  const [submittingOutsideShift, setSubmittingOutsideShift] = useState<boolean>(false);

  const handleOpenOutsideShift = async () => {
    try {
      const res = await api.getOutsideColleges();
      if (res?.colleges?.length) {
        setCollegesList(res.colleges);
        if (!selectedCollege) setSelectedCollege(res.colleges[0]);
      }
    } catch (e) {
      console.warn('Failed to fetch colleges', e);
    }
    setOutsideDept(user?.department || 'Operations');
    setOutsideStaffName(user?.full_name || 'Staff');
    setShowOutsideShiftModal(true);
  };

  const handleSubmitOutsideShift = async () => {
    const finalCollege = customCollege.trim() || selectedCollege;
    if (!finalCollege) {
      Alert.alert('Required', 'Please select or enter a College Name');
      return;
    }

    setSubmittingOutsideShift(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await api.createOutsideShiftEntry({
        college_name: finalCollege,
        department: outsideDept || user?.department,
        staff_name: outsideStaffName || user?.full_name,
        date: todayStr,
        start_time: outsideStartTime,
        end_time: outsideEndTime,
        purpose: outsidePurpose,
        latitude: coords?.latitude,
        longitude: coords?.longitude
      });
      Alert.alert('Outside-Shift Recorded', res.message || 'Outside-shift entry has been recorded successfully!');
      setShowOutsideShiftModal(false);
      setCustomCollege('');
      await loadTodayAttendance();
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Failed to submit outside-shift entry');
    } finally {
      setSubmittingOutsideShift(false);
    }
  };

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch today's attendance and fetch location
  useEffect(() => {
    loadTodayAttendance();
    refreshLocation();
  }, []);

  async function loadTodayAttendance() {
    try {
      const res = await api.getTodayStatus();
      setIsCheckedIn(res.isCheckedIn);
      setIsCheckedOut(res.isCheckedOut);
      setTodayAttendance(res.attendance);

      // If employee is checked in, ensure live tracking is running
      if (res.isCheckedIn && !res.isCheckedOut) {
        startLiveTracking().catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to load today status', e);
    }
  }

  async function refreshLocation() {
    setRefreshingLocation(true);
    try {
      const loc = await getCurrentCoordinates();
      setCoords(loc);

      if (office) {
        const dist = calculateDistanceMeters(
          loc.latitude,
          loc.longitude,
          office.latitude,
          office.longitude
        );
        setDistanceToOffice(dist);
        // Company range threshold is strictly 150 meters
        setIsInsideGeofence(dist <= COMPANY_RADIUS_THRESHOLD);
      }
    } finally {
      setRefreshingLocation(false);
    }
  }

  const handleStartPunch = (action: 'IN' | 'OUT') => {
    if (action === 'IN' && !monitoringPermissionGranted) {
      setShowBackgroundPermissionModal(true);
      return;
    }
    proceedWithPunch(action);
  };

  const handleGrantMonitoringPermissions = async () => {
    setShowBackgroundPermissionModal(false);
    const result = await requestBackgroundMonitoringPermissions();
    setMonitoringPermissionGranted(result.granted || result.locationGranted);
    proceedWithPunch('IN');
  };

  const proceedWithPunch = (action: 'IN' | 'OUT') => {
    setVerifyAction(action);
    setSelfiePhoto(null);
    setSelfieGeotag(null);
    setShowVerifyModal(true);
  };

  const handleCaptureSelfieComplete = (photoDataUrl: string, geotag: GeotagInfo) => {
    setSelfiePhoto(photoDataUrl);
    setSelfieGeotag(geotag);
  };

  const handleConfirmPunch = async () => {
    // Check if employee needs selfie for check-in (mandatory only if outside 150m office range)
    const outOfRange = distanceToOffice > COMPANY_RADIUS_THRESHOLD;

    if (verifyAction === 'IN' && outOfRange && !selfiePhoto) {
      Alert.alert(
        'Selfie Photo Required',
        `You are ${Math.round(distanceToOffice)}m away from the company (outside the 150m range).\n\nCompany policy requires a geotagged selfie photo with location name, date, time, and coordinates to check in.`,
        [
          { text: 'Take Selfie', onPress: () => setShowCameraModal(true) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    setSubmittingPunch(true);
    try {
      // 1. Biometric verification prompt
      const bioResult = await authenticateWithBiometrics(
        `Verify identity to ${verifyAction === 'IN' ? 'Check In' : 'Check Out'}`
      );
      if (!bioResult.success) {
        Alert.alert('Verification Failed', bioResult.error || 'Biometric authentication failed');
        setSubmittingPunch(false);
        return;
      }

      // 2. Refresh location coordinates
      const currentLoc = coords || (await getCurrentCoordinates());

      if (verifyAction === 'IN') {
        let wifiSsid: string | undefined;
        try {
          const wifiInfo = await getDeviceWifiInfo();
          if (wifiInfo?.ssid) {
            wifiSsid = wifiInfo.ssid;
          }
        } catch (we) {
          console.warn('Could not retrieve WiFi SSID', we);
        }

        const res = await api.checkIn({
          latitude: currentLoc.latitude,
          longitude: currentLoc.longitude,
          verificationMethod: outOfRange ? 'GPS_SELFIE_WATERMARK' : 'GPS_BIOMETRIC',
          photo: selfiePhoto || undefined,
          bypassGeofence: outOfRange,
          wifiSsid
        });
        // Immediately start continuous live GPS & camera tracking throughout shift
        await startLiveTracking();
        Alert.alert(
          'Checked In Successfully',
          `${res.message}\n\n📍 Live GPS & Camera Monitoring is now active throughout your work shift.`
        );
      } else {
        const res = await api.checkOut({
          latitude: currentLoc.latitude,
          longitude: currentLoc.longitude,
          remarks: 'Checked out via Mobile App'
        });
        // Immediately stop continuous live tracking
        await stopLiveTracking();
        Alert.alert(
          'Checked Out',
          `${res.message}\nTotal Hours: ${res.workingHours} hrs\n\n🔒 Live GPS tracking and camera feeds have stopped.`
        );
      }

      setShowVerifyModal(false);
      setSelfiePhoto(null);
      setSelfieGeotag(null);
      await loadTodayAttendance();
    } catch (err: any) {
      if (err.code === 'INVALID_WIFI' || err.message?.includes('authorized company network') || err.message?.includes('Wi-Fi')) {
        Alert.alert(
          'Network Security Notice',
          'Check-In is allowed only from the authorized company network.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Punch Failed', err.message || 'Error recording attendance');
      }
    } finally {
      setSubmittingPunch(false);
    }
  };

  const allowedRadius = COMPANY_RADIUS_THRESHOLD; // strictly 150 meters
  const isOutOf50m = distanceToOffice > COMPANY_RADIUS_THRESHOLD;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Live Digital Clock Card */}
      <View style={styles.clockCard}>
        <Text style={styles.clockDate}>
          {currentTime.toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })}
        </Text>
        <Text style={styles.clockTime}>
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </Text>
        <View style={styles.shiftBadge}>
          <Ionicons name="time-outline" size={14} color="#BFDBFE" />
          <Text style={styles.shiftText}>General Shift: 09:00 AM - 06:00 PM</Text>
        </View>
      </View>

      {/* Live Work Hours Camera & GPS Streamer (Active when Checked In) */}
      <LiveCameraStreamer
        isCheckedIn={isCheckedIn && !isCheckedOut}
        employeeName={user?.full_name}
        employeeCode={user?.employee_code}
      />

      {/* Geofence Radar Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View
              style={[
                styles.radarDot,
                { backgroundColor: !isOutOf50m ? theme.colors.success : theme.colors.warning }
              ]}
            />
            <Text style={styles.cardTitle}>Company 150m Geofence</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshLocBtn}
            onPress={refreshLocation}
            disabled={refreshingLocation}
          >
            {refreshingLocation ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Ionicons name="refresh" size={16} color={theme.colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.geoInfoRow}>
          <View style={styles.geoMetric}>
            <Text style={styles.geoMetricValue}>
              {distanceToOffice > 1000
                ? `${(distanceToOffice / 1000).toFixed(1)} km`
                : `${Math.round(distanceToOffice)} m`}
            </Text>
            <Text style={styles.geoMetricLabel}>Distance to Office</Text>
          </View>

          <View style={styles.geoDivider} />

          <View style={styles.geoMetric}>
            <Text style={styles.geoMetricValue}>150 m</Text>
            <Text style={styles.geoMetricLabel}>Company Radius</Text>
          </View>

          <View style={styles.geoDivider} />

          <View style={styles.geoMetric}>
            <Text
              style={[
                styles.geoStatusTag,
                { color: !isOutOf50m ? theme.colors.success : theme.colors.warning }
              ]}
            >
              {!isOutOf50m ? 'IN RANGE' : 'OUT OF RANGE'}
            </Text>
            <Text style={styles.geoMetricLabel}>Zone Status</Text>
          </View>
        </View>

        <View
          style={[
            styles.geofenceNotice,
            { backgroundColor: !isOutOf50m ? theme.colors.successBg : theme.colors.warningBg }
          ]}
        >
          <Ionicons
            name={!isOutOf50m ? 'checkmark-circle-outline' : 'camera-outline'}
            size={18}
            color={!isOutOf50m ? theme.colors.success : theme.colors.warning}
          />
          <Text
            style={[
              styles.geofenceNoticeText,
              { color: !isOutOf50m ? theme.colors.success : '#B45309' }
            ]}
          >
            {!isOutOf50m
              ? `You are within 150 meters of ${office?.name || 'Company'}. Standard biometric check-in active.`
              : `You are ${Math.round(distanceToOffice)}m away (outside 150m company range). A geotagged selfie photo with location and timestamp is required to check in.`}
          </Text>
        </View>
      </View>

      {/* Main Punch Hero Action */}
      <View style={styles.punchSection}>
        {!isCheckedIn ? (
          <TouchableOpacity
            style={[styles.punchButton, styles.punchButtonIn]}
            activeOpacity={0.85}
            onPress={() => handleStartPunch('IN')}
          >
            <View style={styles.punchInnerCircle}>
              <Ionicons name="finger-print" size={54} color="#FFFFFF" />
              <Text style={styles.punchButtonTitle}>CHECK IN</Text>
              <Text style={styles.punchButtonSub}>
                {isOutOf50m ? 'Photo verification required' : 'Tap to verify & mark'}
              </Text>
            </View>
          </TouchableOpacity>
        ) : !isCheckedOut ? (
          <TouchableOpacity
            style={[styles.punchButton, styles.punchButtonOut]}
            activeOpacity={0.85}
            onPress={() => handleStartPunch('OUT')}
          >
            <View style={styles.punchInnerCircle}>
              <Ionicons name="log-out" size={54} color="#FFFFFF" />
              <Text style={styles.punchButtonTitle}>CHECK OUT</Text>
              <Text style={styles.punchButtonSub}>Tap to complete day</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={[styles.punchButton, styles.punchButtonDone]}>
            <View style={styles.punchInnerCircle}>
              <Ionicons name="checkmark-done-circle" size={54} color="#FFFFFF" />
              <Text style={styles.punchButtonTitle}>COMPLETED</Text>
              <Text style={styles.punchButtonSub}>Work day logged</Text>
            </View>
          </View>
        )}
      </View>

      {/* Today's Activity Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Today's Punch Log</Text>
          {todayAttendance && <StatusBadge status={todayAttendance.status} />}
        </View>

        <View style={styles.timelineRow}>
          <View style={styles.timeBlock}>
            <Text style={styles.timeLabel}>Check-In Time</Text>
            <Text style={styles.timeValue}>
              {todayAttendance?.check_in_time
                ? new Date(todayAttendance.check_in_time).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : '--:--'}
            </Text>
            <Text style={styles.timeSub}>
              {isCheckedIn
                ? todayAttendance?.verification_method === 'GPS_SELFIE_WATERMARK'
                  ? 'Geotagged Selfie'
                  : 'GPS & Biometric'
                : 'Not marked yet'}
            </Text>
          </View>

          <View style={styles.timelineCenter}>
            <View style={[styles.timeDot, isCheckedIn && styles.timeDotActive]} />
            <View style={styles.timeLine} />
            <View style={[styles.timeDot, isCheckedOut && styles.timeDotActive]} />
          </View>

          <View style={styles.timeBlock}>
            <Text style={styles.timeLabel}>Check-Out Time</Text>
            <Text style={styles.timeValue}>
              {todayAttendance?.check_out_time
                ? new Date(todayAttendance.check_out_time).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : '--:--'}
            </Text>
            <Text style={styles.timeSub}>
              {isCheckedOut ? `${todayAttendance?.working_hours || 0} hrs worked` : 'Awaiting punch-out'}
            </Text>
          </View>
        </View>

        {/* View Today's Selfie Proof button if check_in_photo exists */}
        {todayAttendance?.check_in_photo && (
          <TouchableOpacity
            style={styles.viewSelfieProofBtn}
            onPress={() => setShowPreviewSelfieModal(true)}
          >
            <Ionicons name="camera" size={16} color={theme.colors.primary} />
            <Text style={styles.viewSelfieProofText}>View Geotagged Selfie Proof</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Outside-Shift / College Visit Card */}
      <View style={styles.card}>
        <View style={styles.outsideHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.outsideIconCircle}>
              <Ionicons name="business" size={18} color="#0D9488" />
            </View>
            <View>
              <Text style={styles.cardTitle}>Outside-Shift Entry</Text>
              <Text style={styles.outsideCardSub}>External College & Off-Premises Work</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.outsideActionBtn}
            onPress={handleOpenOutsideShift}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.outsideActionBtnText}>Log Work</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.outsideDesc}>
          Deputed to an external college, partner campus, or off-site shift? Log external work with prepopulated staff and department details.
        </Text>
      </View>

      {/* Biometric / Selfie Verification Modal */}
      <Modal visible={showVerifyModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {verifyAction === 'IN' ? 'Digital Check-In Verification' : 'Check-Out Confirmation'}
              </Text>
              <TouchableOpacity onPress={() => setShowVerifyModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Check-In Range status explanation */}
            {verifyAction === 'IN' && (
              <View
                style={[
                  styles.modalRangeAlert,
                  isOutOf50m ? styles.modalRangeAlertWarning : styles.modalRangeAlertSuccess
                ]}
              >
                <Ionicons
                  name={isOutOf50m ? 'alert-circle' : 'checkmark-circle'}
                  size={20}
                  color={isOutOf50m ? '#D97706' : '#059669'}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.modalRangeAlertText,
                    { color: isOutOf50m ? '#92400E' : '#065F46' }
                  ]}
                >
                  {isOutOf50m
                    ? `Outside 150m company radius (${Math.round(distanceToOffice)}m away). A geotagged selfie photo is mandatory to check in.`
                    : `Within 150m company perimeter (${Math.round(distanceToOffice)}m away). Standard biometric check-in.`}
                </Text>
              </View>
            )}

            {/* Selfie Verification Card (Mandatory ONLY if outside 150m office range) */}
            {verifyAction === 'IN' && isOutOf50m && (
              <View style={styles.selfieBox}>
                {selfiePhoto ? (
                  <View style={{ width: '100%', alignItems: 'center' }}>
                    <GeotagPhotoView
                      photoUri={selfiePhoto}
                      locationName={selfieGeotag?.locationName}
                      dateStr={selfieGeotag?.dateStr}
                      timeStr={selfieGeotag?.timeStr}
                      latitude={selfieGeotag?.latitude}
                      longitude={selfieGeotag?.longitude}
                      employeeName={user?.full_name}
                      employeeCode={user?.employee_code}
                      height={200}
                    />
                    <TouchableOpacity
                      style={styles.retakeBtn}
                      onPress={() => setShowCameraModal(true)}
                    >
                      <Ionicons name="camera-reverse" size={16} color={theme.colors.primary} />
                      <Text style={styles.retakeBtnText}>Retake Selfie</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', width: '100%' }}>
                    <View style={styles.selfieIconCircle}>
                      <Ionicons
                        name="camera"
                        size={36}
                        color={isOutOf50m ? theme.colors.warning : theme.colors.primary}
                      />
                    </View>
                    <Text style={styles.selfieBoxTitle}>
                      Mandatory Remote Verification Selfie
                    </Text>
                    <Text style={styles.selfieBoxSub}>
                      You are outside the 150m company range. Camera access is required to capture your selfie stamped with your location name, date, time, and coordinates.
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.captureBtn,
                        isOutOf50m && { backgroundColor: theme.colors.warning }
                      ]}
                      onPress={() => setShowCameraModal(true)}
                    >
                      <Ionicons name="camera" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.captureBtnText}>
                        Open Camera & Take Selfie *
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Verification checklist */}
            <View style={styles.checkItem}>
              <Ionicons name="location" size={18} color={theme.colors.primary} />
              <Text style={styles.checkText}>
                GPS: {Math.round(distanceToOffice)}m from {office?.name || 'Company'} ({isOutOf50m ? '> 150m' : '≤ 150m'})
              </Text>
            </View>

            <View style={styles.checkItem}>
              <Ionicons name="finger-print" size={18} color={theme.colors.primary} />
              <Text style={styles.checkText}>Biometrics: Identity validation prompt</Text>
            </View>

            {verifyAction === 'IN' && isOutOf50m && (
              <View style={styles.checkItem}>
                <Ionicons
                  name={selfiePhoto ? 'checkmark-circle' : 'close-circle'}
                  size={18}
                  color={selfiePhoto ? theme.colors.success : theme.colors.danger}
                />
                <Text
                  style={[
                    styles.checkText,
                    !selfiePhoto && { color: theme.colors.danger, fontWeight: '700' }
                  ]}
                >
                  {selfiePhoto
                    ? 'Geotagged Selfie: Verified ✅'
                    : 'Geotagged Selfie: REQUIRED (Must take selfie) ⚠️'}
                </Text>
              </View>
            )}

            {verifyAction === 'IN' && !isOutOf50m && (
              <View style={styles.checkItem}>
                <Ionicons name="shield-checkmark" size={18} color={theme.colors.success} />
                <Text style={[styles.checkText, { color: theme.colors.success, fontWeight: '600' }]}>
                  Office Geofence Active (≤ 150m): Direct Check-In (No Selfie Needed)
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowVerifyModal(false)}
                variant="outline"
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title={
                  verifyAction === 'IN'
                    ? isOutOf50m && !selfiePhoto
                      ? 'Upload Selfie to Confirm'
                      : 'Confirm Check-In'
                    : 'Confirm Check-Out'
                }
                onPress={handleConfirmPunch}
                loading={submittingPunch}
                disabled={verifyAction === 'IN' && isOutOf50m && !selfiePhoto}
                variant={
                  verifyAction === 'IN' && isOutOf50m && !selfiePhoto
                    ? 'outline'
                    : verifyAction === 'IN'
                    ? 'success'
                    : 'danger'
                }
                icon={
                  verifyAction === 'IN' ? (
                    isOutOf50m && !selfiePhoto ? (
                      <Ionicons name="camera-outline" size={18} color="#64748B" />
                    ) : (
                      <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                    )
                  ) : undefined
                }
                style={[
                  { flex: 1.5 },
                  verifyAction === 'IN' && isOutOf50m && !selfiePhoto && {
                    backgroundColor: '#E2E8F0',
                    borderColor: '#CBD5E1',
                    opacity: 0.8
                  }
                ]}
                textStyle={
                  verifyAction === 'IN' && isOutOf50m && !selfiePhoto
                    ? { color: '#64748B', fontWeight: '700', fontSize: 13 }
                    : undefined
                }
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Interactive Camera Modal for Taking Geotagged Selfie */}
      <CameraModal
        visible={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={handleCaptureSelfieComplete}
        latitude={coords?.latitude || office?.latitude || 12.9716}
        longitude={coords?.longitude || office?.longitude || 77.5946}
        distanceToOffice={distanceToOffice}
        officeName={office?.name}
        officeLatitude={office?.latitude}
        officeLongitude={office?.longitude}
        userName={user?.full_name}
        userCode={user?.employee_code}
      />

      {/* Modal to Preview Today's Saved Selfie Proof */}
      <Modal visible={showPreviewSelfieModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.previewModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Today's Verified Selfie Proof</Text>
              <TouchableOpacity onPress={() => setShowPreviewSelfieModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {todayAttendance?.check_in_photo && (
              <GeotagPhotoView
                photoUri={todayAttendance.check_in_photo}
                latitude={todayAttendance.check_in_lat}
                longitude={todayAttendance.check_in_lng}
                dateStr={todayAttendance.date}
                timeStr={
                  todayAttendance.check_in_time
                    ? new Date(todayAttendance.check_in_time).toLocaleTimeString()
                    : undefined
                }
                employeeName={user?.full_name}
                employeeCode={user?.employee_code}
                height={320}
              />
            )}

            <View style={styles.selfieMetaInfo}>
              <Text style={styles.selfieMetaText}>
                Recorded at {todayAttendance?.distance_meters ? `${Math.round(todayAttendance.distance_meters)}m` : '0m'} from company.
              </Text>
            </View>

            <Button
              title="Close Preview"
              onPress={() => setShowPreviewSelfieModal(false)}
              variant="outline"
              style={{ marginTop: 14 }}
            />
          </View>
        </View>
      </Modal>

      {/* Background Live Monitoring Permission Dialog */}
      <BackgroundPermissionModal
        visible={showBackgroundPermissionModal}
        onGrant={handleGrantMonitoringPermissions}
        onCancel={() => setShowBackgroundPermissionModal(false)}
      />

      {/* Outside-Shift Work Entry Modal */}
      <Modal visible={showOutsideShiftModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '94%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="business" size={22} color="#0D9488" />
                <Text style={styles.modalTitle}>Outside-Shift Work Entry</Text>
              </View>
              <TouchableOpacity onPress={() => setShowOutsideShiftModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 8 }}>
              {/* College Name Selection */}
              <Text style={styles.outsideInputLabel}>College / Institution Name *</Text>
              <View style={styles.collegeChipsRow}>
                {collegesList.map((col) => (
                  <TouchableOpacity
                    key={col}
                    style={[
                      styles.collegeChip,
                      selectedCollege === col && !customCollege && styles.collegeChipSelected
                    ]}
                    onPress={() => {
                      setSelectedCollege(col);
                      setCustomCollege('');
                    }}
                  >
                    <Text
                      style={[
                        styles.collegeChipText,
                        selectedCollege === col && !customCollege && styles.collegeChipTextSelected
                      ]}
                      numberOfLines={1}
                    >
                      {col}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.outsideInputLabel, { marginTop: 8 }]}>Or Enter Other College / Location</Text>
              <TextInput
                style={styles.outsideTextInput}
                placeholder="Type external campus or college name..."
                placeholderTextColor={theme.colors.textLight}
                value={customCollege}
                onChangeText={(t) => {
                  setCustomCollege(t);
                  if (t) setSelectedCollege('');
                }}
              />

              {/* Department (Prepopulated) */}
              <Text style={styles.outsideInputLabel}>Department (Prepopulated)</Text>
              <TextInput
                style={[styles.outsideTextInput, styles.readOnlyInput]}
                value={outsideDept}
                onChangeText={setOutsideDept}
                placeholder="Department"
              />

              {/* Staff Name (Prepopulated) */}
              <Text style={styles.outsideInputLabel}>Staff Name (Prepopulated)</Text>
              <TextInput
                style={[styles.outsideTextInput, styles.readOnlyInput]}
                value={outsideStaffName}
                onChangeText={setOutsideStaffName}
                placeholder="Staff Name"
              />

              {/* Shift Hours */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.outsideInputLabel}>Start Time</Text>
                  <TextInput
                    style={styles.outsideTextInput}
                    value={outsideStartTime}
                    onChangeText={setOutsideStartTime}
                    placeholder="09:30 AM"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.outsideInputLabel}>End Time</Text>
                  <TextInput
                    style={styles.outsideTextInput}
                    value={outsideEndTime}
                    onChangeText={setOutsideEndTime}
                    placeholder="05:30 PM"
                  />
                </View>
              </View>

              {/* Work Purpose */}
              <Text style={styles.outsideInputLabel}>Purpose of Visit / Work</Text>
              <TextInput
                style={[styles.outsideTextInput, { height: 60, textAlignVertical: 'top' }]}
                multiline
                value={outsidePurpose}
                onChangeText={setOutsidePurpose}
                placeholder="e.g. Conduct campus interview / Faculty training"
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowOutsideShiftModal(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Submit Entry"
                onPress={handleSubmitOutsideShift}
                loading={submittingOutsideShift}
                style={{ flex: 1.5, backgroundColor: '#0D9488' }}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 30
  },
  clockCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4
  },
  clockDate: {
    color: '#93C5FD',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4
  },
  clockTime: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 1
  },
  shiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    marginTop: 8
  },
  shiftText: {
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  radarDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text
  },
  refreshLocBtn: {
    padding: 6,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.infoBg
  },
  geoInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md
  },
  geoMetric: {
    alignItems: 'center'
  },
  geoMetricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text
  },
  geoMetricLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2
  },
  geoStatusTag: {
    fontSize: 13,
    fontWeight: '800'
  },
  geoDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.border
  },
  geofenceNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: theme.borderRadius.md,
    marginTop: 10
  },
  geofenceNoticeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1
  },
  punchSection: {
    alignItems: 'center',
    marginVertical: 16
  },
  punchButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10
  },
  punchButtonIn: {
    backgroundColor: theme.colors.success
  },
  punchButtonOut: {
    backgroundColor: theme.colors.danger
  },
  punchButtonDone: {
    backgroundColor: '#64748B'
  },
  punchInnerCircle: {
    width: 154,
    height: 154,
    borderRadius: 77,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  punchButtonTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: 6
  },
  punchButtonSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
    paddingHorizontal: 8
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10
  },
  timeBlock: {
    flex: 1,
    alignItems: 'center'
  },
  timeLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600'
  },
  timeValue: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginVertical: 4
  },
  timeSub: {
    fontSize: 11,
    color: theme.colors.textMuted
  },
  timelineCenter: {
    alignItems: 'center',
    width: 40
  },
  timeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.border
  },
  timeDotActive: {
    backgroundColor: theme.colors.primary
  },
  timeLine: {
    width: 2,
    height: 30,
    backgroundColor: theme.colors.border,
    marginVertical: 4
  },
  viewSelfieProofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 10,
    backgroundColor: '#F0F9FF',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#BAE6FD'
  },
  viewSelfieProofText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: theme.spacing.lg,
    maxHeight: '92%'
  },
  previewModalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: theme.spacing.lg,
    maxHeight: '90%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text
  },
  modalRangeAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: theme.borderRadius.md,
    marginVertical: 8
  },
  modalRangeAlertWarning: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D'
  },
  modalRangeAlertSuccess: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  modalRangeAlertText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    lineHeight: 16
  },
  selfieBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    alignItems: 'center',
    marginVertical: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.border
  },
  selfieIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3
  },
  selfieBoxTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 3
  },
  selfieBoxSub: {
    fontSize: 11.5,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 16
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md
  },
  captureBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 8
  },
  retakeBtnText: {
    color: theme.colors.primary,
    fontSize: 12.5,
    fontWeight: '700',
    marginLeft: 6
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5
  },
  checkText: {
    fontSize: 12.5,
    color: theme.colors.text,
    marginLeft: 8,
    fontWeight: '600'
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 18
  },
  selfieMetaInfo: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md,
    alignItems: 'center'
  },
  selfieMetaText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600'
  },
  outsideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  outsideIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center'
  },
  outsideCardSub: {
    fontSize: 11,
    color: theme.colors.textMuted
  },
  outsideActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D9488',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    gap: 4
  },
  outsideActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  outsideDesc: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 17,
    marginTop: 4
  },
  outsideInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
    marginTop: 8
  },
  collegeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6
  },
  collegeChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC'
  },
  collegeChipSelected: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488'
  },
  collegeChipText: {
    fontSize: 11.5,
    color: theme.colors.text,
    fontWeight: '600'
  },
  collegeChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  outsideTextInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: theme.colors.text,
    marginBottom: 6
  },
  readOnlyInput: {
    backgroundColor: '#F1F5F9',
    color: '#475569'
  }
});
