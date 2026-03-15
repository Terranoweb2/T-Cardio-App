import { create } from 'zustand';

interface Advertisement {
  id: string;
  type: 'POPUP' | 'TICKER';
  title: string;
  content: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  targetAudience: 'ALL' | 'PATIENT' | 'MEDECIN';
  startDate: string;
  endDate: string;
  priority: number;
  isActive: boolean;
}

interface AdState {
  popups: Advertisement[];
  tickers: Advertisement[];
  tickerDismissed: boolean;
  loaded: boolean;
  setAds: (popups: Advertisement[], tickers: Advertisement[]) => void;
  dismissTicker: () => void;
  resetTicker: () => void;
}

export const useAdStore = create<AdState>((set) => ({
  popups: [],
  tickers: [],
  tickerDismissed: false,
  loaded: false,
  setAds: (popups, tickers) => set({ popups, tickers, loaded: true }),
  dismissTicker: () => set({ tickerDismissed: true }),
  resetTicker: () => set({ tickerDismissed: false }),
}));
