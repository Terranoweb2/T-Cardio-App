'use client';

import { useState } from 'react';
import {
  User, Target, Award, Trophy, X, Plus,
  Zap, Flame, TrendingUp, Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import XpBar from '@/components/gamification/XpBar';
import StreakCounter from '@/components/gamification/StreakCounter';
import BadgeGrid from '@/components/gamification/BadgeGrid';
import GoalCard from '@/components/gamification/GoalCard';
import {
  useGamificationProfile,
  useAchievements,
  useAllBadges,
  useGoals,
  useLeaderboard,
  useCreateGoal,
  type GoalType,
} from '@/hooks/useGamification';

// ── Tab config ──

const tabs = [
  { key: 'profile', label: 'Mon profil', icon: User },
  { key: 'goals', label: 'Objectifs', icon: Target },
  { key: 'badges', label: 'Badges', icon: Award },
  { key: 'leaderboard', label: 'Classement', icon: Trophy },
] as const;

type TabKey = (typeof tabs)[number]['key'];

// ── Goal type options ──

const goalTypeOptions: { value: GoalType; label: string }[] = [
  { value: 'CONSECUTIVE_MEASUREMENTS', label: 'Mesures consecutives' },
  { value: 'MEDICATION_ADHERENCE', label: 'Observance medicaments' },
  { value: 'WEIGHT_GOAL', label: 'Objectif poids' },
  { value: 'EXERCISE_MINUTES', label: 'Minutes exercice' },
  { value: 'BP_GOAL', label: 'Objectif tension' },
  { value: 'CUSTOM', label: 'Personnalise' },
];

export default function GoalsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  // Data hooks
  const { data: profile, isLoading: profileLoading } = useGamificationProfile();
  const { data: achievements, isLoading: achievementsLoading } = useAchievements();
  const { data: allBadges, isLoading: badgesLoading } = useAllBadges();
  const { data: goals, isLoading: goalsLoading } = useGoals();
  const { data: leaderboard, isLoading: leaderboardLoading } = useLeaderboard();

  // New goal modal
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [goalType, setGoalType] = useState<GoalType>('CONSECUTIVE_MEASUREMENTS');
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalUnit, setGoalUnit] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');
  const createGoal = useCreateGoal();

  const handleCreateGoal = () => {
    if (!goalTitle.trim()) {
      toast.error('Veuillez entrer un titre');
      return;
    }
    if (!goalTarget || Number(goalTarget) <= 0) {
      toast.error('Veuillez entrer une valeur cible valide');
      return;
    }

    createGoal.mutate(
      {
        type: goalType,
        title: goalTitle.trim(),
        description: goalDescription.trim() || undefined,
        targetValue: Number(goalTarget),
        unit: goalUnit.trim() || undefined,
        deadline: goalDeadline || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Objectif cree avec succes');
          setShowNewGoal(false);
          resetGoalForm();
        },
        onError: () => {
          toast.error('Erreur lors de la creation de l\'objectif');
        },
      }
    );
  };

  const resetGoalForm = () => {
    setGoalType('CONSECUTIVE_MEASUREMENTS');
    setGoalTitle('');
    setGoalDescription('');
    setGoalTarget('');
    setGoalUnit('');
    setGoalDeadline('');
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gradient-cyan">Gamification</h1>
        <p className="text-sm text-slate-400 mt-1">Suivez vos progres et debloquez des recompenses</p>
      </div>

      {/* Tabs */}
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

      {/* ═══════════ Tab: Mon profil ═══════════ */}
      {activeTab === 'profile' && (
        <div className="space-y-4 page-transition">
          {profileLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
                  <div className="h-16 bg-cardio-800 rounded" />
                </div>
              ))}
            </div>
          ) : profile ? (
            <>
              {/* XP Bar */}
              <XpBar totalXp={profile.totalXp} level={profile.level} />

              {/* Streak Counter */}
              <StreakCounter streak={profile.streak} longestStreak={profile.longestStreak} />

              {/* Quick stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="glass-card rounded-xl p-4 text-center">
                  <Zap className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                  <p className="text-lg font-bold text-slate-200">{profile.totalXp.toLocaleString('fr-FR')}</p>
                  <p className="text-xs text-slate-500">XP Total</p>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                  <TrendingUp className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
                  <p className="text-lg font-bold text-slate-200">{profile.level}</p>
                  <p className="text-xs text-slate-500">Niveau</p>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                  <Flame className="w-5 h-5 text-orange-400 mx-auto mb-2" />
                  <p className="text-lg font-bold text-slate-200">{profile.streak}</p>
                  <p className="text-xs text-slate-500">Serie actuelle</p>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                  <Trophy className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                  <p className="text-lg font-bold text-slate-200">{profile.longestStreak}</p>
                  <p className="text-xs text-slate-500">Meilleure serie</p>
                </div>
              </div>

              {/* Recent achievements preview */}
              {achievements && achievements.length > 0 && (
                <div className="glass-card rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Derniers badges obtenus</h3>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {achievements.slice(0, 5).map((a) => (
                      <div
                        key={a.id}
                        className="flex flex-col items-center gap-1.5 shrink-0"
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 flex items-center justify-center">
                          <Award className="w-5 h-5 text-cyan-400" />
                        </div>
                        <p className="text-[10px] text-slate-400 text-center max-w-[70px] truncate">
                          {a.badge.name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="glass-card rounded-xl p-8 text-center">
              <p className="text-slate-500">Impossible de charger votre profil</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ Tab: Objectifs ═══════════ */}
      {activeTab === 'goals' && (
        <div className="page-transition">
          {/* Header with add button */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-400">
              {goals && goals.length > 0
                ? `${goals.length} objectif${goals.length > 1 ? 's' : ''}`
                : 'Aucun objectif'}
            </p>
            <button
              onClick={() => setShowNewGoal(true)}
              className="glow-btn px-3 py-1.5 rounded-lg transition text-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Nouvel objectif
            </button>
          </div>

          {goalsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
                  <div className="h-4 bg-cardio-800 rounded w-1/3 mb-3" />
                  <div className="h-2.5 bg-cardio-800 rounded w-full mb-2" />
                  <div className="h-3 bg-cardio-800 rounded w-1/4" />
                </div>
              ))}
            </div>
          ) : !goals || goals.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 sm:p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/20 flex items-center justify-center">
                <Target className="w-8 h-8 text-cyan-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-200 mb-2">
                Definissez vos objectifs
              </h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
                Fixez des objectifs de sante personnalises et suivez vos progres quotidiennement.
              </p>
              <button
                onClick={() => setShowNewGoal(true)}
                className="glow-btn px-6 py-2.5 rounded-lg transition text-sm inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Creer votre premier objectif
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ Tab: Badges ═══════════ */}
      {activeTab === 'badges' && (
        <div className="page-transition">
          {badgesLoading || achievementsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-cardio-800 mx-auto mb-2" />
                  <div className="h-3 bg-cardio-800 rounded w-2/3 mx-auto mb-2" />
                  <div className="h-3 bg-cardio-800 rounded w-1/2 mx-auto" />
                </div>
              ))}
            </div>
          ) : allBadges && achievements ? (
            <>
              {/* Summary */}
              <div className="glass-card rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-cyan-400" />
                    <span className="text-sm font-medium text-slate-300">Badges collectes</span>
                  </div>
                  <span className="text-sm font-bold text-cyan-400">
                    {achievements.length} / {allBadges.length}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-cardio-800 mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-700"
                    style={{
                      width: `${allBadges.length > 0 ? (achievements.length / allBadges.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <BadgeGrid allBadges={allBadges} achievements={achievements} />
            </>
          ) : (
            <div className="glass-card rounded-xl p-8 text-center">
              <p className="text-slate-500">Impossible de charger les badges</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ Tab: Classement ═══════════ */}
      {activeTab === 'leaderboard' && (
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
            <div className="glass-card rounded-xl p-8 text-center">
              <Trophy className="w-10 h-10 text-amber-400/50 mx-auto mb-3" />
              <p className="text-slate-500">Le classement n&apos;est pas encore disponible</p>
            </div>
          ) : (
            <div className="glass-card rounded-xl overflow-hidden">
              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="w-full">
                  <thead className="bg-cardio-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 w-16">Rang</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Joueur</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Niveau</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">XP</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Serie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-500/10">
                    {leaderboard.slice(0, 10).map((entry, index) => {
                      const rank = index + 1;
                      const isTopThree = rank <= 3;
                      const rankColors = ['text-amber-400', 'text-slate-300', 'text-amber-600'];

                      return (
                        <tr
                          key={index}
                          className={`transition hover:bg-cyan-500/5 ${
                            isTopThree ? 'bg-cyan-500/5' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${
                              isTopThree ? rankColors[rank - 1] : 'text-slate-500'
                            }`}>
                              {rank <= 3 ? (
                                <span className="flex items-center gap-1">
                                  {rank === 1 && <Trophy className="w-4 h-4 text-amber-400" />}
                                  {rank === 2 && <Trophy className="w-4 h-4 text-slate-300" />}
                                  {rank === 3 && <Trophy className="w-4 h-4 text-amber-600" />}
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
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm text-slate-400 flex items-center gap-1 justify-end">
                              <Flame className={`w-3.5 h-3.5 ${entry.streak >= 7 ? 'text-orange-400' : 'text-slate-500'}`} />
                              {entry.streak}j
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-cyan-500/10">
                {leaderboard.slice(0, 10).map((entry, index) => {
                  const rank = index + 1;
                  const isTopThree = rank <= 3;
                  const rankColors = ['text-amber-400', 'text-slate-300', 'text-amber-600'];

                  return (
                    <div
                      key={index}
                      className={`p-4 flex items-center gap-3 ${isTopThree ? 'bg-cyan-500/5' : ''}`}
                    >
                      {/* Rank */}
                      <div className={`w-8 text-center font-bold text-sm ${
                        isTopThree ? rankColors[rank - 1] : 'text-slate-500'
                      }`}>
                        {rank <= 3 ? (
                          <Trophy className={`w-5 h-5 mx-auto ${rankColors[rank - 1]}`} />
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
                            <Flame className={`w-3 h-3 ${entry.streak >= 7 ? 'text-orange-400' : 'text-slate-500'}`} />
                            {entry.streak}j
                          </span>
                        </div>
                      </div>

                      {/* XP */}
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-amber-400">{entry.totalXp.toLocaleString('fr-FR')}</p>
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

      {/* ── New Goal Modal ── */}
      {showNewGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-200">Nouvel objectif</h2>
              <button
                onClick={() => { setShowNewGoal(false); resetGoalForm(); }}
                className="p-1.5 rounded-lg hover:bg-cardio-700/50 transition"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Goal type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Type d&apos;objectif
                </label>
                <select
                  value={goalType}
                  onChange={(e) => setGoalType(e.target.value as GoalType)}
                  className="glass-input w-full px-4 py-2.5 rounded-lg text-sm"
                >
                  {goalTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Titre <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  placeholder="Ex: 30 mesures ce mois"
                  className="glass-input w-full px-4 py-2.5 rounded-lg text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Description <span className="text-slate-500">(optionnel)</span>
                </label>
                <textarea
                  value={goalDescription}
                  onChange={(e) => setGoalDescription(e.target.value)}
                  placeholder="Description de votre objectif..."
                  rows={2}
                  className="glass-input w-full px-4 py-2.5 rounded-lg text-sm resize-none"
                />
              </div>

              {/* Target value & unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Valeur cible <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    placeholder="30"
                    min="1"
                    className="glass-input w-full px-4 py-2.5 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Unite <span className="text-slate-500">(opt.)</span>
                  </label>
                  <input
                    type="text"
                    value={goalUnit}
                    onChange={(e) => setGoalUnit(e.target.value)}
                    placeholder="Ex: mesures, kg, min"
                    className="glass-input w-full px-4 py-2.5 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Date limite <span className="text-slate-500">(optionnel)</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  <input
                    type="date"
                    value={goalDeadline}
                    onChange={(e) => setGoalDeadline(e.target.value)}
                    className="glass-input w-full pl-10 pr-4 py-2.5 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowNewGoal(false); resetGoalForm(); }}
                className="flex-1 px-4 py-2.5 border border-slate-600 rounded-lg text-slate-300 hover:bg-cardio-700/50 transition text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateGoal}
                disabled={createGoal.isPending}
                className="flex-1 glow-btn px-4 py-2.5 rounded-lg transition text-sm font-medium disabled:opacity-50"
              >
                {createGoal.isPending ? 'Creation...' : 'Creer l\'objectif'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
