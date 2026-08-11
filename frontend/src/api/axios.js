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

// Helper to extract clean error message and assign to dynamic friendlyMessage attribute
function processError(error) {
  let friendlyMessage = 'خطایی در ارتباط با سرور رخ داد. لطفاً مجدداً تلاش کنید.';

  if (error.response) {
    const status = error.response.status;
    const backendError = error.response.data?.error || error.response.data?.message;

    if (backendError) {
      friendlyMessage = backendError;
    } else {
      switch (status) {
        case 400:
          friendlyMessage = 'درخواست ارسال شده نامعتبر است یا فرم به درستی تکمیل نشده است.';
          break;
        case 401:
          friendlyMessage = 'نشست کاربری شما منقضی شده است. لطفا مجدداً وارد سیستم شوید.';
          break;
        case 403:
          friendlyMessage = 'شما دسترسی لازم برای انجام این عملیات را ندارید.';
          break;
        case 404:
          friendlyMessage = 'مورد یا مسیر درخواستی یافت نشد.';
          break;
        case 500:
          friendlyMessage = 'خطای داخلی سرور رخ داده است. لطفاً بعداً تلاش کنید.';
          break;
        default:
          friendlyMessage = `خطایی با کد ${status} رخ داده است.`;
      }
    }

    // Dynanically inject friendlyMessage to ensure compatibility with existing code
    if (!error.response.data) {
      error.response.data = {};
    }
    if (typeof error.response.data === 'object') {
      error.response.data.error = friendlyMessage;
    }
  } else if (error.request) {
    // Request made but no response received (Network error / offline)
    friendlyMessage = 'خطا در اتصال به شبکه. لطفاً وضعیت اتصال اینترنت خود را بررسی کنید.';
    error.response = {
      status: 0,
      data: { error: friendlyMessage }
    };
  } else {
    // Something else triggered the error
    friendlyMessage = error.message || 'خطای ناشناخته‌ای رخ داده است.';
    error.response = {
      status: 0,
      data: { error: friendlyMessage }
    };
  }

  error.friendlyMessage = friendlyMessage;
  return error;
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
    const processedError = processError(error);
    if (processedError.response?.status === 401 && !processedError.config?.url?.includes('/auth/login')) {
      handleUnauthorized();
    }
    return Promise.reject(processedError);
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
    const processedError = processError(error);
    if (processedError.response?.status === 401 && !processedError.config?.url?.includes('/auth/login')) {
      handleUnauthorized();
    }
    return Promise.reject(processedError);
  }
);

export default api;
