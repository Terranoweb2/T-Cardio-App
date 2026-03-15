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
        // If already refreshing, queue this request and wait
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

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/auth/refresh`,
            { refreshToken },
          );
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          processQueue(null, data.accessToken);
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          // NEVER auto-disconnect — just reject the request silently.
          // The user stays on the current page and can retry.
          // Only explicit logout (user action) should clear storage.
          console.warn('[api] Token refresh failed — session may need re-login');
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
      // No refresh token available — still don't auto-disconnect.
      // Just reject the request. User stays logged in visually.
      console.warn('[api] No refresh token available');
    }
    return Promise.reject(error);
  },
);

// ==================== PROACTIVE TOKEN REFRESH ====================
// Token expires in 365 days, but we refresh every 7 days proactively
// to keep the session alive indefinitely.
let proactiveRefreshTimer: NodeJS.Timeout | null = null;

function startProactiveRefresh() {
  if (typeof window === 'undefined') return;
  if (proactiveRefreshTimer) clearInterval(proactiveRefreshTimer);

  const REFRESH_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days

  proactiveRefreshTimer = setInterval(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return;

    try {
      const { data } = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/auth/refresh`,
        { refreshToken },
      );
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      console.log('[api] Token refreshed proactively');
    } catch {
      // Silent failure — token is still valid for months
      console.warn('[api] Proactive token refresh failed — will retry later');
    }
  }, REFRESH_INTERVAL);
}

// Also refresh when the app comes back from background (mobile WebView)
if (typeof window !== 'undefined') {
  startProactiveRefresh();

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      // App came back to foreground — refresh token to ensure it's valid
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) return;

      try {
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/auth/refresh`,
          { refreshToken },
        );
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        console.log('[api] Token refreshed on app resume');
      } catch {
        // Silent failure — don't disconnect the user
        console.warn('[api] Token refresh on resume failed — session still active');
      }
    }
  });
}

export default api;
