import axios from 'axios';

let isRedirecting = false;
let redirectTimer = null;

function handleUnauthorized() {
  if (isRedirecting) return;
  isRedirecting = true;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
  if (redirectTimer) clearTimeout(redirectTimer);
  redirectTimer = setTimeout(() => { isRedirecting = false; }, 2000);
}

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      handleUnauthorized();
    }
    return Promise.reject(error);
  }
);

export const uploadApi = axios.create({
  baseURL: '/api',
  timeout: 300000,
});

uploadApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

uploadApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      handleUnauthorized();
    }
    return Promise.reject(error);
  }
);

export default api;
