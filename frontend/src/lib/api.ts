import axios from 'axios';
import type { LogEntry } from '../contexts/AppLoggingContext';

// Logger function that will be injected from React context
let logger: ((log: Omit<LogEntry, 'id' | 'timestamp'>) => void) | null = null;

// Function to inject logger from React context
export const setApiLogger = (logFn: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void) => {
  logger = logFn;
};

// Helper to sanitize sensitive data
const sanitizeData = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  
  const sensitiveKeys = ['password', 'api_key', 'apiKey', 'token', 'authorization', 'auth_token', 'secret'];
  const sanitized = Array.isArray(data) ? [...data] : { ...data };
  
  for (const key in sanitized) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }
  
  return sanitized;
};

// Create axios instance with default config  
const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: false,
  timeout: 30000, // 30 second timeout for LLM requests
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Don't set Content-Type for FormData - let axios handle it with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    // Log API request (skip periodic status checks)
    if (logger && config.url !== '/models/status') {
      const startTime = Date.now();
      (config as any).__startTime = startTime;
      
      logger({
        level: 'info',
        category: 'api',
        message: `${config.method?.toUpperCase()} ${config.url}`,
        source: 'API',
        context: {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          data: config.data ? sanitizeData(config.data) : undefined
        }
      });
    } else if (logger && config.url === '/models/status') {
      // Still track start time for response interceptor even if not logging
      const startTime = Date.now();
      (config as any).__startTime = startTime;
    }
    
    return config;
  },
  (error) => {
    // Log request error
    if (logger) {
      logger({
        level: 'error',
        category: 'api',
        message: `Request failed: ${error.message || 'Unknown error'}`,
        source: 'API',
        context: { error: error.message }
      });
    }
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Log successful API response (skip periodic status checks)
    if (logger && response.config.url !== '/models/status') {
      const startTime = (response.config as any).__startTime;
      const responseTime = startTime ? Date.now() - startTime : undefined;
      
      logger({
        level: 'success',
        category: 'api',
        message: `${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`,
        source: 'API',
        context: {
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          status: response.status,
          statusText: response.statusText,
          responseTime: responseTime ? `${responseTime}ms` : undefined,
          dataSize: response.data ? JSON.stringify(response.data).length : 0
        }
      });
    }
    
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('auth_token');
      // Redirect to login or handle as needed
    }
    
    // Log API error (skip periodic status checks unless it's a network error)
    if (logger && error.config?.url !== '/models/status') {
      const startTime = (error.config as any)?.__startTime;
      const responseTime = startTime ? Date.now() - startTime : undefined;
      
      logger({
        level: 'error',
        category: 'api',
        message: `${error.config?.method?.toUpperCase() || 'REQUEST'} ${error.config?.url || 'unknown'} - ${error.response?.status || 'Network Error'}`,
        source: 'API',
        context: {
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseTime: responseTime ? `${responseTime}ms` : undefined,
          error: error.response?.data || error.message,
          message: error.message
        }
      });
    }
    
    return Promise.reject(error);
  }
);

// Shortcut API methods
export interface Shortcut {
  id: number;
  name: string;
  url: string;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export const shortcutsApi = {
  getAll: async (): Promise<Shortcut[]> => {
    const response = await api.get('/shortcuts');
    return response.data;
  },
  
  create: async (data: { name: string; url: string; icon?: string }): Promise<Shortcut> => {
    const response = await api.post('/shortcuts', data);
    return response.data;
  },
  
  update: async (id: number, data: { name?: string; url?: string; icon?: string }): Promise<Shortcut> => {
    const response = await api.put(`/shortcuts/${id}`, data);
    return response.data;
  },
  
  delete: async (id: number): Promise<void> => {
    await api.delete(`/shortcuts/${id}`);
  },
};

export default api;