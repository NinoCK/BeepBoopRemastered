import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import api, { setUnauthorizedHandler } from '../lib/api';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  email_verified_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface AuthResponse {
  user: AuthUser;
  token: {
    plain_text?: string;
    type?: string;
  } | string;
}

export interface LoginPayload {
  email: string;
  password: string;
  device_name?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  device_name?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const extractToken = (token: AuthResponse['token']): string => {
  if (typeof token === 'string') {
    return token;
  }

  return token?.plain_text ?? '';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const clearAuth = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.get<{ user: AuthUser }>('/auth/me');
        setUser(response.data.user);
      } catch (error) {
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrap();
  }, [token, clearAuth]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearAuth();
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [clearAuth]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }, [token]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const response = await api.post<AuthResponse>('/auth/login', {
        ...payload,
        device_name: payload.device_name ?? 'Browser Session',
      });

      const tokenValue = extractToken(response.data.token);
      if (!tokenValue) {
        throw new Error('Token was not returned from the server.');
      }

      setUser(response.data.user);
      setToken(tokenValue);
      setIsLoading(false);
    },
    []
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const response = await api.post<AuthResponse>('/auth/register', {
        ...payload,
        device_name: payload.device_name ?? 'Browser Session',
      });

      const tokenValue = extractToken(response.data.token);
      if (!tokenValue) {
        throw new Error('Token was not returned from the server.');
      }

      setUser(response.data.user);
      setToken(tokenValue);
      setIsLoading(false);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Ignore logout errors; we'll clear local state regardless
    } finally {
      clearAuth();
      setIsLoading(false);
    }
  }, [clearAuth]);

  const refreshUser = useCallback(async () => {
    if (!token) {
      clearAuth();
      return;
    }

    const response = await api.get<{ user: AuthUser }>('/auth/me');
    setUser(response.data.user);
  }, [token, clearAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, token, isLoading, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }

  return context;
};

export default AuthContext;

