import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  user: { id: string; email: string; role: string } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: any, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (user, accessToken, refreshToken) => {
    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
    await SecureStore.setItemAsync('user', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('user');
    set({ user: null, isAuthenticated: false });
  },

  loadSession: async () => {
    try {
      const userStr = await SecureStore.getItemAsync('user');
      const token = await SecureStore.getItemAsync('accessToken');
      if (userStr && token) {
        set({ user: JSON.parse(userStr), isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
