import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

async function doRefresh(): Promise<{ accessToken: string; refreshToken: string } | null> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  try {
    const { data } = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/auth/refresh`,
      { refreshToken },
    );
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return data;
  } catch {
    return null;
  }
}

// Single refresh gate: prevents race conditions between interceptor,
// visibilitychange, and proactive refresh all trying at once.
let refreshPromise: Promise<{ accessToken: string; refreshToken: string } | null> | null = null;

function singletonRefresh(): Promise<{ accessToken: string; refreshToken: string } | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Never intercept login/register/refresh to avoid loops
    const skipRefreshUrls = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];
    if (skipRefreshUrls.some(url => originalRequest?.url?.includes(url))) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && typeof window !== 'undefined' && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const result = await singletonRefresh();
        if (result) {
          originalRequest.headers.Authorization = `Bearer ${result.accessToken}`;
          processQueue(null, result.accessToken);
          return api(originalRequest);
        } else {
          processQueue(new Error('refresh failed'), null);
          // Redirect to login if refresh fails
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = '/login';
          }
          return Promise.reject(error);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

// ==================== PROACTIVE TOKEN REFRESH ====================
// Refresh every 6 hours to keep the session alive (JWT expires in 7d)
let proactiveRefreshTimer: NodeJS.Timeout | null = null;

function startProactiveRefresh() {
  if (typeof window === 'undefined') return;
  if (proactiveRefreshTimer) clearInterval(proactiveRefreshTimer);

  const REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

  proactiveRefreshTimer = setInterval(async () => {
    const result = await singletonRefresh();
    if (result) {
      console.log('[api] Token refreshed proactively');
    }
  }, REFRESH_INTERVAL);
}

// Refresh when the app comes back from background (mobile WebView)
if (typeof window !== 'undefined') {
  startProactiveRefresh();

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      const result = await singletonRefresh();
      if (result) {
        console.log('[api] Token refreshed on app resume');
      }
    }
  });
}

export default api;
