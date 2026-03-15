'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

export default function ThemeInitializer() {
  const loadFromStorage = useThemeStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return null;
}
