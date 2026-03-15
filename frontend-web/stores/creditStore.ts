import { create } from 'zustand';

interface CreditState {
  balance: number | null;
  loading: boolean;
  setBalance: (balance: number) => void;
  setLoading: (loading: boolean) => void;
}

export const useCreditStore = create<CreditState>((set) => ({
  balance: null,
  loading: false,
  setBalance: (balance) => set({ balance }),
  setLoading: (loading) => set({ loading }),
}));
