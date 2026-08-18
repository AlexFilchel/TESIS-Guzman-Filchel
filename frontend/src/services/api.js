import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth - usa form data para OAuth2PasswordRequestForm
export const login = (username, password) => {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);
  return api.post('/api/auth/login', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
};

export const register = (data) => 
  api.post('/api/auth/register', data);

export const getMe = () => 
  api.get('/api/auth/me');

// Alertas
export const getAlertas = (params) => api.get('/api/alertas', { params });
export const getAlerta = (id) => api.get(`/api/alertas/${id}`);
export const updateAlerta = (id, data) => api.patch(`/api/alertas/${id}`, data);

// Metrics
export const getMetrics = () => api.get('/api/metrics/summary');
export const getTimeline = (dias = 7) => api.get(`/api/metrics/timeline?dias=${dias}`);
export const getTopIps = () => api.get('/api/metrics/top-ips');
export const getByCategory = () => api.get('/api/metrics/by-category');
// params opcionales: { desde, hasta, categorias: [...], ids: [...] }.
// Sin params calcula sobre toda la base.
export const getTiempos = (params) =>
  api.get('/api/metrics/tiempos', {
    params,
    // FastAPI espera los parametros repetidos (?ids=1&ids=2), no ids[]=
    paramsSerializer: { indexes: null }
  });

// Simulator
export const generateSimulator = (data) => api.post('/api/simulator/generate', data);
export const getSimulatorTipos = () => api.get('/api/simulator/tipos');

// Reglas
export const getReglas = () => api.get('/api/reglas/');
export const toggleRegla = (id) => api.patch(`/api/reglas/${id}/toggle`);

// Logs
export const getLogs = (params) => api.get('/api/logs/', { params });

export default api;