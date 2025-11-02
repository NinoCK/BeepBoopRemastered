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
    
    // Log API request
    if (logger) {
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
    // Log successful API response
    if (logger) {
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
    
    // Log API error
    if (logger) {
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

export default api;