import { create } from 'zustand';

interface Subscription {
  id: string;
  plan: 'BASIC' | 'PRO';
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING';
  priceXof: number;
  startDate: string | null;
  endDate: string | null;
  autoRenew: boolean;
}

interface SubscriptionState {
  subscription: Subscription | null;
  isActive: boolean;
  loading: boolean;
  setSubscription: (subscription: Subscription | null, isActive: boolean) => void;
  setLoading: (loading: boolean) => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  subscription: null,
  isActive: false,
  loading: false,
  setSubscription: (subscription, isActive) => set({ subscription, isActive }),
  setLoading: (loading) => set({ loading }),
}));
