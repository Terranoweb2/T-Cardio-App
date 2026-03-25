'use client';

import { useState } from 'react';
import {
  Trophy, Target, Flame, Star, Lock, CheckCircle2,
  TrendingUp, Crown, Users, Zap, Loader2, Medal,
} from 'lucide-react';
import {
  useGamificationProfile,
  useAchievements,
  useAllBadges,
  useGoals,
  useLeaderboard,
  type GoalType,
} from '@/hooks/useGamification';

// ── XP helpers (same formula as XpBar component) ──

function getXpForLevel(level: number): number {
  return level * 500;
}

function getXpInCurrentLevel(totalXp: number, level: number): number {
  let xpBeforeLevel = 0;
  for (let i = 1; i < level; i++) {
    xpBeforeLevel += getXpForLevel(i);
  }
  return totalXp - xpBeforeLevel;
}

function getXpNeededForNextLevel(level: number): number {
  return getXpForLevel(level);
}

// ── Goal type labels ──

const goalTypeLabels: Record<GoalType, string> = {
  CONSECUTIVE_MEASUREMENTS: 'Mesures',
  MEDICATION_ADHERENCE: 'Observance',
  WEIGHT_GOAL: 'Poids',
  EXERCISE_MINUTES: 'Exercice',
  BP_GOAL: 'Tension',
  CUSTOM: 'Personnalise',
};

// ── Badge category colors ──

const categoryColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  HEALTH: { bg: 'from-red-500/20 to-pink-500/20', border: 'border-red-500/40', text: 'text-red-400', glow: 'shadow-red-500/20' },
  MEASUREMENT: { bg: 'from-cyan-500/20 to-blue-500/20', border: 'border-cyan-500/40', text: 'text-cyan-400', glow: 'shadow-cyan-500/20' },
  STREAK: { bg: 'from-orange-500/20 to-amber-500/20', border: 'border-orange-500/40', text: 'text-orange-400', glow: 'shadow-orange-500/20' },
  GOAL: { bg: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/40', text: 'text-green-400', glow: 'shadow-green-500/20' },
  SOCIAL: { bg: 'from-purple-500/20 to-violet-500/20', border: 'border-purple-500/40', text: 'text-purple-400', glow: 'shadow-purple-500/20' },
  MILESTONE: { bg: 'from-amber-500/20 to-yellow-500/20', border: 'border-amber-500/40', text: 'text-amber-400', glow: 'shadow-amber-500/20' },
  SPECIAL: { bg: 'from-teal-500/20 to-cyan-500/20', border: 'border-teal-500/40', text: 'text-teal-400', glow: 'shadow-teal-500/20' },
};

const defaultColors = {
  bg: 'from-slate-500/20 to-gray-500/20',
  border: 'border-slate-500/40',
  text: 'text-slate-400',
  glow: 'shadow-slate-500/20',
};

// ── Tabs ──

const tabs = [
  { key: 'badges' as const, label: 'Badges', icon: Star },
  { key: 'objectifs' as const, label: 'Objectifs', icon: Target },
  { key: 'classement' as const, label: 'Classement', icon: Users },
];

type TabKey = (typeof tabs)[number]['key'];

// ── Main component ──

export default function GamificationPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('badges');

  const { data: profile, isLoading: profileLoading, isError: profileError } = useGamificationProfile();
  const { data: achievements, isLoading: achievementsLoading } = useAchievements();
  const { data: allBadges, isLoading: badgesLoading } = useAllBadges();
  const { data: goals, isLoading: goalsLoading } = useGoals();
  const { data: leaderboard, isLoading: leaderboardLoading } = useLeaderboard();

  // Computed XP values
  const currentLevelXp = profile ? getXpInCurrentLevel(profile.totalXp, profile.level) : 0;
  const neededXp = profile ? getXpNeededForNextLevel(profile.level) : 1;
  const xpProgress = Math.min((currentLevelXp / neededXp) * 100, 100);

  // Build unlocked badge map
  const unlockedMap = new Map<string, string>();
  achievements?.forEach((a) => {
    unlockedMap.set(a.badge.code, a.unlockedAt);
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gradient-cyan">
            Mon Parcours Sante
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Progressez, debloquez des badges et atteignez vos objectifs
          </p>
        </div>
        {profile && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600/20 to-teal-600/20 border border-cyan-500/30">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-slate-200">Niveau {profile.level}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── XP Progress Card ── */}
      {profileLoading ? (
        <div className="glass-card rounded-2xl p-6 mb-6 animate-pulse">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-cardio-800" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-cardio-800 rounded w-1/3" />
              <div className="h-3 bg-cardio-800 rounded w-1/2" />
            </div>
          </div>
          <div className="h-4 bg-cardio-800 rounded-full w-full" />
        </div>
      ) : profileError ? (
        <div className="glass-card rounded-2xl p-8 mb-6 text-center">
          <p className="text-slate-500">Impossible de charger votre profil de gamification</p>
        </div>
      ) : profile ? (
        <div className="glass-card rounded-2xl p-5 sm:p-6 mb-6 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-cyan-500/5 to-transparent rounded-bl-full pointer-events-none" />

          <div className="relative">
            {/* Top row: Level + Stats */}
            <div className="flex items-start gap-4 mb-5">
              {/* Level badge */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 flex flex-col items-center justify-center shrink-0">
                <span className="text-2xl sm:text-3xl font-bold text-cyan-400">{profile.level}</span>
                <span className="text-[10px] text-slate-500 -mt-0.5">NIVEAU</span>
              </div>

              {/* Stats row */}
              <div className="flex-1 grid grid-cols-3 gap-2 sm:gap-3">
                {/* XP */}
                <div className="bg-cardio-800/50 rounded-xl p-2.5 sm:p-3 text-center">
                  <Zap className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                  <p className="text-sm sm:text-base font-bold text-slate-200">
                    {profile.totalXp.toLocaleString('fr-FR')}
                  </p>
                  <p className="text-[10px] text-slate-500">XP Total</p>
                </div>

                {/* Streak */}
                <div className="bg-cardio-800/50 rounded-xl p-2.5 sm:p-3 text-center">
                  <Flame className={`w-4 h-4 mx-auto mb-1 ${
                    profile.streak >= 7 ? 'text-orange-400' : 'text-orange-400/60'
                  }`} />
                  <p className="text-sm sm:text-base font-bold text-slate-200">
                    {profile.streak}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    jour{profile.streak !== 1 ? 's' : ''} de suite
                  </p>
                </div>

                {/* Rank */}
                <div className="bg-cardio-800/50 rounded-xl p-2.5 sm:p-3 text-center">
                  <TrendingUp className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                  <p className="text-sm sm:text-base font-bold text-slate-200">
                    {profile.longestStreak}
                  </p>
                  <p className="text-[10px] text-slate-500">Record serie</p>
                </div>
              </div>
            </div>

            {/* XP progress bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400">
                  Progression vers le niveau {profile.level + 1}
                </span>
                <span className="text-xs font-medium text-cyan-400">
                  {currentLevelXp.toLocaleString('fr-FR')} / {neededXp.toLocaleString('fr-FR')} XP
                </span>
              </div>
              <div className="w-full h-3.5 rounded-full bg-cardio-800 border border-cyan-500/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-400 to-green-400 transition-all duration-1000 ease-out relative"
                  style={{ width: `${xpProgress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-pulse" />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 text-center mt-1.5">
                Encore <span className="text-cyan-400 font-medium">
                  {(neededXp - currentLevelXp).toLocaleString('fr-FR')}
                </span> XP pour atteindre le niveau {profile.level + 1}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Tab Bar ── */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-600 via-teal-600 to-cyan-700 text-white shadow-lg shadow-cyan-500/20'
                  : 'glass-card border border-cyan-500/10 text-slate-400 hover:text-slate-300 hover:border-cyan-500/20'
              }`}
            >
              <TabIcon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════ Badges Tab ═══════════ */}
      {activeTab === 'badges' && (
        <div className="page-transition">
          {badgesLoading || achievementsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
                  <div className="w-14 h-14 rounded-full bg-cardio-800 mx-auto mb-3" />
                  <div className="h-3 bg-cardio-800 rounded w-2/3 mx-auto mb-2" />
                  <div className="h-2.5 bg-cardio-800 rounded w-4/5 mx-auto" />
                </div>
              ))}
            </div>
          ) : !allBadges || !achievements ? (
            <div className="glass-card rounded-2xl p-8 sm:p-12 text-center">
              <Star className="w-10 h-10 text-amber-400/40 mx-auto mb-3" />
              <p className="text-slate-500">Impossible de charger les badges</p>
            </div>
          ) : allBadges.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 sm:p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
                <Star className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-200 mb-2">
                Aucun badge disponible
              </h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Les badges seront bientot disponibles. Continuez a suivre votre sante pour etre pret !
              </p>
            </div>
          ) : (
            <>
              {/* Badges summary */}
              <div className="glass-card rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <span className="text-sm font-medium text-slate-300">Badges collectes</span>
                  </div>
                  <span className="text-sm font-bold text-cyan-400">
                    {achievements.length} / {allBadges.length}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-cardio-800 mt-2.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-700"
                    style={{
                      width: `${allBadges.length > 0 ? (achievements.length / allBadges.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Badges grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {allBadges.map((badge) => {
                  const isUnlocked = unlockedMap.has(badge.code);
                  const unlockDate = unlockedMap.get(badge.code);
                  const colors = categoryColors[badge.category] || defaultColors;

                  return (
                    <div
                      key={badge.code}
                      className={`relative flex flex-col items-center gap-2.5 p-4 rounded-xl border transition-all duration-300 text-center ${
                        isUnlocked
                          ? `bg-gradient-to-br ${colors.bg} ${colors.border} hover:shadow-lg ${colors.glow} hover:scale-[1.02]`
                          : 'bg-cardio-800/30 border-cyan-500/10 opacity-50'
                      }`}
                    >
                      {/* Icon circle */}
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center ${
                          isUnlocked
                            ? `bg-gradient-to-br ${colors.bg} border-2 ${colors.border}`
                            : 'bg-cardio-700/50 border border-slate-600/30'
                        }`}
                      >
                        {isUnlocked ? (
                          <Star className={`w-6 h-6 ${colors.text}`} />
                        ) : (
                          <Lock className="w-5 h-5 text-slate-600" />
                        )}
                      </div>

                      {/* Badge name */}
                      <p
                        className={`text-xs font-medium leading-tight line-clamp-2 ${
                          isUnlocked ? 'text-slate-200' : 'text-slate-500'
                        }`}
                      >
                        {badge.name}
                      </p>

                      {/* Description */}
                      <p
                        className={`text-[10px] leading-snug line-clamp-2 ${
                          isUnlocked ? 'text-slate-400' : 'text-slate-600'
                        }`}
                      >
                        {badge.description}
                      </p>

                      {/* XP + unlock date */}
                      <div className="mt-auto">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${
                            isUnlocked
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                              : 'bg-cardio-700/50 text-slate-600 border border-slate-600/20'
                          }`}
                        >
                          +{badge.xpReward} XP
                        </span>
                        {isUnlocked && unlockDate && (
                          <p className="text-[9px] text-green-400/70 mt-1.5">
                            {formatDate(unlockDate)}
                          </p>
                        )}
                      </div>

                      {/* Glow effect for unlocked */}
                      {isUnlocked && (
                        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-white/5 to-transparent rotate-12" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════ Objectifs Tab ═══════════ */}
      {activeTab === 'objectifs' && (
        <div className="page-transition">
          {goalsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-cardio-800" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-cardio-800 rounded w-1/3" />
                      <div className="h-3 bg-cardio-800 rounded w-1/4" />
                    </div>
                  </div>
                  <div className="h-2.5 bg-cardio-800 rounded-full w-full" />
                </div>
              ))}
            </div>
          ) : !goals || goals.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 sm:p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/20 flex items-center justify-center">
                <Target className="w-8 h-8 text-cyan-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-200 mb-2">
                Aucun objectif defini
              </h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Rendez-vous dans la page Objectifs pour creer vos premiers objectifs de sante et gagner des XP !
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.map((goal) => {
                const progress = goal.targetValue > 0
                  ? Math.min((goal.currentValue / goal.targetValue) * 100, 100)
                  : 0;
                const isCompleted = goal.status === 'COMPLETED';
                const typeLabel = goalTypeLabels[goal.type as GoalType] || goal.type;

                return (
                  <div
                    key={goal.id}
                    className={`glass-card rounded-xl p-4 transition-all duration-200 ${
                      isCompleted ? 'border-green-500/20' : 'hover:border-cyan-500/20'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isCompleted
                            ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30'
                            : 'bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/20'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-4.5 h-4.5 text-green-400" />
                        ) : (
                          <Target className="w-4.5 h-4.5 text-cyan-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3
                          className={`font-semibold truncate ${
                            isCompleted ? 'text-green-300' : 'text-slate-200'
                          }`}
                        >
                          {goal.title}
                        </h3>
                        <span className="inline-block text-[10px] px-2 py-0.5 mt-1 rounded bg-cardio-800 border border-cyan-500/10 text-slate-400">
                          {typeLabel}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-bold shrink-0 ${
                          isCompleted ? 'text-green-400' : 'text-cyan-400'
                        }`}
                      >
                        {Math.round(progress)}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2.5 rounded-full bg-cardio-800 border border-cyan-500/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          isCompleted
                            ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                            : 'bg-gradient-to-r from-cyan-500 via-teal-500 to-cyan-400'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-500">
                        {goal.currentValue}{goal.unit ? ` ${goal.unit}` : ''} / {goal.targetValue}{goal.unit ? ` ${goal.unit}` : ''}
                      </span>
                      {isCompleted && (
                        <span className="text-[10px] text-green-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Termine
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ Classement Tab ═══════════ */}
      {activeTab === 'classement' && (
        <div className="page-transition">
          {leaderboardLoading ? (
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-cardio-800" />
                    <div className="flex-1 h-4 bg-cardio-800 rounded" />
                    <div className="w-16 h-4 bg-cardio-800 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ) : !leaderboard || leaderboard.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 sm:p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
                <Trophy className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-200 mb-2">
                Classement non disponible
              </h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Le classement sera disponible une fois que suffisamment d&apos;utilisateurs auront commence leur parcours.
              </p>
            </div>
          ) : (
            <div className="glass-card rounded-xl overflow-hidden">
              {/* Desktop table */}
              <div className="hidden sm:block">
                <table className="w-full">
                  <thead className="bg-cardio-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 w-16">Rang</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Joueur</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Niveau</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">XP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-500/10">
                    {leaderboard.slice(0, 10).map((entry, index) => {
                      const rank = index + 1;
                      const isTopThree = rank <= 3;
                      const medalEmojis = ['', '', ''];
                      const rankColors = ['text-amber-400', 'text-slate-300', 'text-amber-600'];

                      return (
                        <tr
                          key={index}
                          className={`transition hover:bg-cyan-500/5 ${
                            isTopThree ? 'bg-cyan-500/5' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span
                              className={`text-sm font-bold ${
                                isTopThree ? rankColors[rank - 1] : 'text-slate-500'
                              }`}
                            >
                              {isTopThree ? (
                                <span className="flex items-center gap-1">
                                  <Medal className={`w-4 h-4 ${rankColors[rank - 1]}`} />
                                  #{rank}
                                </span>
                              ) : (
                                `#${rank}`
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-600/30 to-teal-600/30 border border-cyan-500/20 flex items-center justify-center shrink-0">
                                <span className="text-xs font-semibold text-cyan-400">
                                  {(entry.firstName || '??').slice(0, 2).toUpperCase()}
                                </span>
                              </div>
                              <span className="text-sm font-medium text-slate-200">
                                {entry.firstName || 'Anonyme'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 font-medium">
                              Niv. {entry.level}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-medium text-amber-400">
                              {entry.totalXp.toLocaleString('fr-FR')} XP
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-cyan-500/10">
                {leaderboard.slice(0, 10).map((entry, index) => {
                  const rank = index + 1;
                  const isTopThree = rank <= 3;
                  const rankColors = ['text-amber-400', 'text-slate-300', 'text-amber-600'];

                  return (
                    <div
                      key={index}
                      className={`p-4 flex items-center gap-3 ${
                        isTopThree ? 'bg-cyan-500/5' : ''
                      }`}
                    >
                      {/* Rank */}
                      <div
                        className={`w-8 text-center font-bold text-sm ${
                          isTopThree ? rankColors[rank - 1] : 'text-slate-500'
                        }`}
                      >
                        {isTopThree ? (
                          <Medal className={`w-5 h-5 mx-auto ${rankColors[rank - 1]}`} />
                        ) : (
                          `#${rank}`
                        )}
                      </div>

                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-600/30 to-teal-600/30 border border-cyan-500/20 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-cyan-400">
                          {(entry.firstName || '??').slice(0, 2).toUpperCase()}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">
                          {entry.firstName || 'Anonyme'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>Niv. {entry.level}</span>
                          <span className="text-slate-600">|</span>
                          <span className="flex items-center gap-0.5">
                            <Flame
                              className={`w-3 h-3 ${
                                entry.streak >= 7 ? 'text-orange-400' : 'text-slate-500'
                              }`}
                            />
                            {entry.streak}j
                          </span>
                        </div>
                      </div>

                      {/* XP */}
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-amber-400">
                          {entry.totalXp.toLocaleString('fr-FR')}
                        </p>
                        <p className="text-[10px] text-slate-500">XP</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
