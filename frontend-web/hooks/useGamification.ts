import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';

// ── Types ──

export interface GamificationProfile {
  totalXp: number;
  level: number;
  streak: number;
  longestStreak: number;
}

export interface Badge {
  code: string;
  name: string;
  description: string;
  category: string;
  xpReward: number;
}

export interface Achievement {
  id: string;
  badge: Badge;
  unlockedAt: string;
}

export type GoalType =
  | 'CONSECUTIVE_MEASUREMENTS'
  | 'MEDICATION_ADHERENCE'
  | 'WEIGHT_GOAL'
  | 'EXERCISE_MINUTES'
  | 'BP_GOAL'
  | 'CUSTOM';

export interface Goal {
  id: string;
  type: GoalType;
  title: string;
  description?: string;
  targetValue: number;
  currentValue: number;
  unit?: string;
  deadline?: string;
  status: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  firstName: string;
  totalXp: number;
  level: number;
  streak: number;
}

interface CreateGoalPayload {
  type: GoalType;
  title: string;
  description?: string;
  targetValue: number;
  unit?: string;
  deadline?: string;
}

interface UpdateGoalPayload {
  goalId: string;
  currentValue: number;
}

// ── Hooks ──

export function useGamificationProfile() {
  return useQuery({
    queryKey: queryKeys.gamification.profile,
    queryFn: async () => {
      const { data } = await api.get('/gamification/profile');
      return data as GamificationProfile;
    },
  });
}

export function useAchievements() {
  return useQuery({
    queryKey: queryKeys.gamification.achievements,
    queryFn: async () => {
      const { data } = await api.get('/gamification/achievements');
      return data as Achievement[];
    },
  });
}

export function useAllBadges() {
  return useQuery({
    queryKey: queryKeys.gamification.badges,
    queryFn: async () => {
      const { data } = await api.get('/gamification/badges');
      return data as Badge[];
    },
  });
}

export function useGoals() {
  return useQuery({
    queryKey: queryKeys.gamification.goals,
    queryFn: async () => {
      const { data } = await api.get('/gamification/goals');
      return data as Goal[];
    },
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: queryKeys.gamification.leaderboard,
    queryFn: async () => {
      const { data } = await api.get('/gamification/leaderboard');
      return data as LeaderboardEntry[];
    },
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateGoalPayload) => {
      const { data } = await api.post('/gamification/goals', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gamification.goals });
      queryClient.invalidateQueries({ queryKey: queryKeys.gamification.profile });
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ goalId, currentValue }: UpdateGoalPayload) => {
      const { data } = await api.patch(`/gamification/goals/${goalId}`, { currentValue });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gamification.goals });
      queryClient.invalidateQueries({ queryKey: queryKeys.gamification.profile });
      queryClient.invalidateQueries({ queryKey: queryKeys.gamification.achievements });
    },
  });
}
