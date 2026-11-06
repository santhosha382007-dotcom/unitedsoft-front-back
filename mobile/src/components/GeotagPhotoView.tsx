import React from 'react';
import { View, Text, StyleSheet, Image, ViewStyle, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

interface GeotagPhotoViewProps {
  photoUri: string;
  locationName?: string;
  dateStr?: string;
  timeStr?: string;
  latitude?: number;
  longitude?: number;
  employeeName?: string;
  employeeCode?: string;
  height?: number;
  style?: ViewStyle;
}

export const GeotagPhotoView: React.FC<GeotagPhotoViewProps> = ({
  photoUri,
  locationName,
  dateStr,
  timeStr,
  latitude,
  longitude,
  employeeName,
  employeeCode,
  height = 280,
  style
}) => {
  return (
    <View style={[styles.container, { height }, style]}>
      <Image source={{ uri: photoUri }} style={styles.image} resizeMode="cover" />

      {/* Geotag Watermark Overlay Banner */}
      <View style={styles.watermarkBanner}>
        <View style={styles.accentLine} />

        {locationName ? (
          <View style={styles.row}>
            <Ionicons name="location-sharp" size={13} color="#34D399" style={styles.icon} />
            <Text style={styles.locationText} numberOfLines={1}>
              {locationName}
            </Text>
          </View>
        ) : null}

        <View style={styles.row}>
          <Ionicons name="calendar-outline" size={12} color="#FFFFFF" style={styles.icon} />
          <Text style={styles.detailText}>
            {dateStr || new Date().toLocaleDateString()} {timeStr ? `• ${timeStr}` : ''}
          </Text>
        </View>

        {latitude !== undefined && longitude !== undefined ? (
          <View style={styles.row}>
            <Ionicons name="navigate-outline" size={12} color="#93C5FD" style={styles.icon} />
            <Text style={styles.coordText}>
              Lat: {latitude.toFixed(5)}° • Long: {longitude.toFixed(5)}°
            </Text>
          </View>
        ) : null}

        <View style={styles.verifiedRow}>
          <Ionicons name="shield-checkmark" size={12} color="#10B981" style={styles.icon} />
          <Text style={styles.verifiedText}>
            UnitedSoft GPS Verified {employeeName ? `• ${employeeName}` : ''}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#334155'
  },
  image: {
    width: '100%',
    height: '100%'
  },
  watermarkBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomLeftRadius: theme.borderRadius.lg,
    borderBottomRightRadius: theme.borderRadius.lg
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#10B981'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 1.5
  },
  icon: {
    marginRight: 6
  },
  locationText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '800',
    flex: 1
  },
  detailText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600'
  },
  coordText: {
    color: '#93C5FD',
    fontSize: 10.5,
    fontWeight: '600',
    fontFamily: 'monospace'
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    paddingTop: 3,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.15)'
  },
  verifiedText: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '500'
  }
});
