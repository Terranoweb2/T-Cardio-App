import { create } from 'zustand';
import axios from 'axios';
import { startNativeCallService, stopNativeCallService } from '@/lib/native-call-service';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  emailVerified?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (user: any, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  loadFromStorage: () => void;
  setEmailVerified: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  login: (user, accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, isAuthenticated: true });

    // Start native call notification service (Android only, no-op in browser)
    startNativeCallService(accessToken, user.id, user.role).catch(() => {});
  },
  logout: () => {
    // Stop native call notification service (Android only, no-op in browser)
    stopNativeCallService().catch(() => {});

    // Only remove auth-specific keys — NEVER localStorage.clear()
    // This preserves any other app data (preferences, cache, etc.)
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
    // Redirect to login only on explicit user-initiated logout
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },
  loadFromStorage: () => {
    if (typeof window === 'undefined') return;

    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('accessToken');

    if (userStr && token) {
      try {
        const user = JSON.parse(userStr);
        set({ user, isAuthenticated: true });
        // Ensure native call service is running (Android only)
        startNativeCallService(token, user.id, user.role).catch(() => {});
      } catch {
        // Corrupted user data — try to recover from API
        recoverUserFromApi(set);
      }
    } else if (token && !userStr) {
      // Token exists but user data is missing — recover from API
      recoverUserFromApi(set);
    }
  },
  setEmailVerified: () => {
    set((state) => {
      if (state.user) {
        const updated = { ...state.user, emailVerified: true };
        localStorage.setItem('user', JSON.stringify(updated));
        return { user: updated };
      }
      return {};
    });
  },
}));

/**
 * If user data in localStorage is missing/corrupted but we have a valid token,
 * try to fetch the user profile from the API and restore the session.
 * This makes the session survive phone resets / cleared cache as long as the token is valid.
 */
async function recoverUserFromApi(set: any) {
  const token = localStorage.getItem('accessToken');
  if (!token) return;

  try {
    const { data } = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/auth/me`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (data && data.id) {
      const user: AuthUser = {
        id: data.id,
        email: data.email,
        role: data.role,
        emailVerified: data.emailVerified,
      };
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, isAuthenticated: true });
      console.log('[authStore] User recovered from API');
    }
  } catch {
    // API call failed — user will need to re-login when they try to do something
    console.warn('[authStore] Could not recover user from API');
  }
}
