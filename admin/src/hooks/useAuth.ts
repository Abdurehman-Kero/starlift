import { useState, useEffect, createContext, useContext } from 'react';
import { authApi } from '../services/api';

export interface AdminUser {
  email: string;
  role: string;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  admin: AdminUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuthProvider(): AuthContextType {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = localStorage.getItem('np_accessToken');
    if (token) {
      authApi
        .me()
        .then((res) => {
          if (res.data.success && res.data.data) {
            setAdmin(res.data.data);
            setIsAuthenticated(true);
          }
        })
        .catch(() => {
          localStorage.removeItem('np_accessToken');
          localStorage.removeItem('np_refreshToken');
          setIsAuthenticated(false);
          setAdmin(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await authApi.login(email, password);
      if (res.data.success && res.data.data) {
        localStorage.setItem('np_accessToken', res.data.data.accessToken);
        localStorage.setItem('np_refreshToken', res.data.data.refreshToken);
        const meRes = await authApi.me();
        if (meRes.data.success) {
          setAdmin(meRes.data.data);
          setIsAuthenticated(true);
        }
      } else {
        throw new Error(res.data.message || 'Login failed');
      }
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        err.message ||
        'Unable to connect to authentication service.';
      throw new Error(message);
    }
  };

  const logout = () => {
    localStorage.removeItem('np_accessToken');
    localStorage.removeItem('np_refreshToken');
    setAdmin(null);
    setIsAuthenticated(false);
  };

  return { isAuthenticated, admin, login, logout, loading };
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

