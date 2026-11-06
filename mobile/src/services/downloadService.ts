import { Platform, Linking, Alert } from 'react-native';
import { getApiBaseUrl, getToken } from '../api/client';

export interface DownloadOptions {
  url: string;
  filename: string;
  mimeType?: string;
}

/**
 * Universal file downloader that works seamlessly across Web, Android, and iOS.
 * Transmits authentication token via query parameter and headers.
 */
export async function downloadFile({ url, filename, mimeType = 'application/octet-stream' }: DownloadOptions): Promise<boolean> {
  try {
    const token = await getToken();
    const separator = url.includes('?') ? '&' : '?';
    const authenticatedUrl = token ? `${url}${separator}token=${encodeURIComponent(token)}` : url;

    // --- Web Platform (Browser Blob Download) ---
    if (Platform.OS === 'web') {
      try {
        const response = await fetch(authenticatedUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`);
        }

        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        return true;
      } catch (webErr: any) {
        console.warn('[Download] Fallback to window.open on web:', webErr.message);
        if (typeof window !== 'undefined') {
          window.open(authenticatedUrl, '_blank');
          return true;
        }
        throw webErr;
      }
    }

    // --- Native Mobile Platform (Android & iOS) ---
    // Launch system browser / native download manager with authenticated query token
    const canOpen = await Linking.canOpenURL(authenticatedUrl).catch(() => true);
    if (canOpen) {
      await Linking.openURL(authenticatedUrl);
      Alert.alert(
        'Download Started 📥',
        `"${filename}" is downloading to your device.\n\nCheck your notification bar or device Downloads folder to view the file.`,
        [{ text: 'OK' }]
      );
      return true;
    } else {
      Alert.alert('Download Error', 'Unable to open file downloader on this device.');
      return false;
    }
  } catch (err: any) {
    console.error('[Download Failed]', err);
    Alert.alert('Download Failed', err.message || 'Could not download the requested file. Please check your network connection.');
    return false;
  }
}

/**
 * Download HR Attendance Report CSV
 */
export async function downloadAttendanceReport(month?: string, date?: string): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  let query = 'format=csv';
  if (date) query += `&date=${encodeURIComponent(date)}`;
  else if (month) query += `&month=${encodeURIComponent(month)}`;
  const url = `${baseUrl}/reports/attendance?${query}`;
  const filename = `Attendance_Report_${date || month || 'all'}.csv`;
  return downloadFile({ url, filename, mimeType: 'text/csv' });
}

/**
 * Download HR Payroll Report CSV
 */
export async function downloadPayrollReport(monthYear?: string): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/reports/payroll?format=csv${monthYear ? `&month_year=${monthYear}` : ''}`;
  const filename = `Payroll_Report_${monthYear || new Date().toISOString().slice(0, 7)}.csv`;
  return downloadFile({ url, filename, mimeType: 'text/csv' });
}

/**
 * Download Employee / HR Payslip PDF
 */
export async function downloadPayslipPdf(slipId: string, employeeCode?: string, monthYear?: string): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/payroll/slips/${slipId}/pdf`;
  const filename = `Payslip_${employeeCode || 'Emp'}_${monthYear || 'Voucher'}.pdf`;
  return downloadFile({ url, filename, mimeType: 'application/pdf' });
}
