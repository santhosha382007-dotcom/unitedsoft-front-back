import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, OfficeLocation } from '../types';
import { api, setToken, removeToken, getToken, initApiClient } from '../api/client';

export interface ImpersonationState {
  isImpersonating: boolean;
  sessionId: string;
  hrAdminName: string;
  hrAdminId: string;
  employeeCode: string;
  employeeName: string;
  reason?: string;
}

interface AuthContextType {
  user: User | null;
  office: OfficeLocation | null;
  token: string | null;
  isLoading: boolean;
  impersonation: ImpersonationState | null;
  login: (
    identifier: string,
    pass: string,
    securityData?: {
      deviceId?: string;
      deviceKey?: string;
      detectedMobileNumbers?: string[];
      verificationCode?: string;
    }
  ) => Promise<any>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  setOffice: (office: OfficeLocation) => void;
  startImpersonation: (employeeId: string, reason?: string) => Promise<void>;
  exitImpersonation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const HR_BACKUP_SESSION_KEY = '@unitedsoft_hr_backup_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [office, setOffice] = useState<OfficeLocation | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(null);

  useEffect(() => {
    bootstrapAuth();
  }, []);

  async function bootstrapAuth() {
    try {
      await initApiClient();
      const storedToken = await getToken();
      if (storedToken) {
        setTokenState(storedToken);
        const me = await api.getMe();
        if (me && me.user) {
          setUser(me.user);
          if (me.office) setOffice(me.office);
        }
      }
    } catch (e) {
      console.warn('Bootstrap auth failed or offline', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(
    identifier: string,
    pass: string,
    securityData: {
      deviceId?: string;
      deviceKey?: string;
      detectedMobileNumbers?: string[];
      verificationCode?: string;
    } = {}
  ) {
    setIsLoading(true);
    try {
      const payload = {
        loginId: identifier,
        password: pass,
        deviceId: securityData.deviceId,
        deviceKey: securityData.deviceKey,
        detectedMobileNumbers: securityData.detectedMobileNumbers || [],
        verificationCode: securityData.verificationCode
      };

      const res = await api.login(payload);
      await setToken(res.token);
      setTokenState(res.token);
      setUser(res.user);
      if (res.office) {
        setOffice(res.office);
      }
      setImpersonation(null);
      await AsyncStorage.removeItem(HR_BACKUP_SESSION_KEY);
      return res;
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    if (impersonation) {
      await exitImpersonation();
      return;
    }
    await removeToken();
    await AsyncStorage.removeItem(HR_BACKUP_SESSION_KEY);
    setTokenState(null);
    setUser(null);
    setImpersonation(null);
  }

  async function refreshMe() {
    try {
      const me = await api.getMe();
      if (me && me.user) {
        setUser(me.user);
        if (me.office) setOffice(me.office);
      }
    } catch (e) {
      console.warn('Failed to refresh user profile', e);
    }
  }

  /**
   * HR starts impersonating an employee account (Flowchart Section 3)
   */
  async function startImpersonation(employeeId: string, reason?: string) {
    if (!token || !user) return;
    setIsLoading(true);
    try {
      // 1. Save current HR session securely
      const hrBackup = {
        token,
        user,
        office
      };
      await AsyncStorage.setItem(HR_BACKUP_SESSION_KEY, JSON.stringify(hrBackup));

      // 2. Request backend impersonation session
      const res = await api.hrImpersonate({ employeeId, reason });

      // 3. Switch active session to impersonated employee
      await setToken(res.token);
      setTokenState(res.token);
      setUser(res.user);
      if (res.office) setOffice(res.office);

      setImpersonation({
        isImpersonating: true,
        sessionId: res.impersonation.sessionId,
        hrAdminName: res.impersonation.hrAdminName,
        hrAdminId: res.impersonation.hrAdminId,
        employeeCode: res.impersonation.employeeCode,
        employeeName: res.impersonation.employeeName,
        reason: res.impersonation.reason
      });
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * HR exits employee view and returns to HR Dashboard (Flowchart Section 3)
   */
  async function exitImpersonation() {
    setIsLoading(true);
    try {
      if (impersonation?.sessionId) {
        try {
          await api.exitHrImpersonation({ sessionId: impersonation.sessionId });
        } catch (e) {
          console.warn('Error closing impersonation session on backend', e);
        }
      }

      // Restore HR backup session
      const backupJson = await AsyncStorage.getItem(HR_BACKUP_SESSION_KEY);
      if (backupJson) {
        const backup = JSON.parse(backupJson);
        await setToken(backup.token);
        setTokenState(backup.token);
        setUser(backup.user);
        if (backup.office) setOffice(backup.office);
        await AsyncStorage.removeItem(HR_BACKUP_SESSION_KEY);
      }
      setImpersonation(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        office,
        token,
        isLoading,
        impersonation,
        login,
        logout,
        refreshMe,
        setOffice,
        startImpersonation,
        exitImpersonation
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
