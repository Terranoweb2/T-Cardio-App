import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  loadFromStorage: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',

  toggleTheme: () => {
    const newTheme: Theme = get().theme === 'dark' ? 'light' : 'dark';
    if (typeof window !== 'undefined') {
      localStorage.setItem('tcardio-theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
    }
    set({ theme: newTheme });
  },

  loadFromStorage: () => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('tcardio-theme') as Theme | null;
    const theme = stored || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
}));
