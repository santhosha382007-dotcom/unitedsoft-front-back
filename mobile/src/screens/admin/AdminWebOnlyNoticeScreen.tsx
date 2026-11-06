import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { Button } from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { getApiBaseUrl } from '../../api/client';

export const AdminWebOnlyNoticeScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const apiBase = getApiBaseUrl();
  const webAdminUrl = apiBase.replace('/api', '') + '/admin';

  const handleOpenBrowser = async () => {
    try {
      const supported = await Linking.canOpenURL(webAdminUrl);
      if (supported) {
        await Linking.openURL(webAdminUrl);
      } else {
        await Linking.openURL(webAdminUrl);
      }
    } catch (e: any) {
      Alert.alert('Open Browser', `Please visit the Admin Portal in your web browser:\n\n${webAdminUrl}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="desktop-outline" size={42} color={theme.colors.primary} />
        </View>

        <Text style={styles.title}>Admin Portal is Web Only</Text>
        <Text style={styles.roleSub}>
          Signed in as: <Text style={{ fontWeight: '800', color: theme.colors.text }}>{user?.full_name}</Text> ({user?.role})
        </Text>

        <Text style={styles.description}>
          In accordance with enterprise security policy, the <Text style={{ fontWeight: '700' }}>Administrator Control Center</Text> is restricted exclusively to the Web Dashboard.
        </Text>

        <View style={styles.urlBox}>
          <Text style={styles.urlLabel}>Admin Web Portal URL:</Text>
          <Text style={styles.urlText} selectable>{webAdminUrl}</Text>
        </View>

        <View style={styles.actions}>
          <Button
            title="Open Web Dashboard in Browser"
            onPress={handleOpenBrowser}
            icon={<Ionicons name="open-outline" size={18} color="#FFFFFF" />}
            style={{ marginBottom: 12 }}
          />

          <Button
            title="Sign Out from Mobile App"
            onPress={logout}
            variant="outline"
            icon={<Ionicons name="log-out-outline" size={18} color={theme.colors.danger} />}
            textStyle={{ color: theme.colors.danger }}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.xl,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 6
  },
  roleSub: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 16
  },
  description: {
    fontSize: 13.5,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20
  },
  urlBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    width: '100%',
    marginBottom: 22
  },
  urlLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  urlText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.colors.primary
  },
  actions: {
    width: '100%'
  }
});
