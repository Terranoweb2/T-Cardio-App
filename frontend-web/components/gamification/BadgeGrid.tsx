'use client';

import { useState } from 'react';
import {
  Lock, Award, Star, Heart, Activity, Target,
  Trophy, Shield, Zap, X,
} from 'lucide-react';
import type { Badge, Achievement } from '@/hooks/useGamification';

interface BadgeGridProps {
  allBadges: Badge[];
  achievements: Achievement[];
}

// Map badge category to an icon
const categoryIcons: Record<string, typeof Award> = {
  HEALTH: Heart,
  MEASUREMENT: Activity,
  STREAK: Zap,
  GOAL: Target,
  SOCIAL: Star,
  MILESTONE: Trophy,
  SPECIAL: Shield,
};

// Map badge category to color
const categoryColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  HEALTH: { bg: 'from-red-500/20 to-pink-500/20', border: 'border-red-500/40', text: 'text-red-400', glow: 'shadow-red-500/20' },
  MEASUREMENT: { bg: 'from-cyan-500/20 to-blue-500/20', border: 'border-cyan-500/40', text: 'text-cyan-400', glow: 'shadow-cyan-500/20' },
  STREAK: { bg: 'from-orange-500/20 to-amber-500/20', border: 'border-orange-500/40', text: 'text-orange-400', glow: 'shadow-orange-500/20' },
  GOAL: { bg: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/40', text: 'text-green-400', glow: 'shadow-green-500/20' },
  SOCIAL: { bg: 'from-purple-500/20 to-violet-500/20', border: 'border-purple-500/40', text: 'text-purple-400', glow: 'shadow-purple-500/20' },
  MILESTONE: { bg: 'from-amber-500/20 to-yellow-500/20', border: 'border-amber-500/40', text: 'text-amber-400', glow: 'shadow-amber-500/20' },
  SPECIAL: { bg: 'from-teal-500/20 to-cyan-500/20', border: 'border-teal-500/40', text: 'text-teal-400', glow: 'shadow-teal-500/20' },
};

const defaultColors = { bg: 'from-slate-500/20 to-gray-500/20', border: 'border-slate-500/40', text: 'text-slate-400', glow: 'shadow-slate-500/20' };

export default function BadgeGrid({ allBadges, achievements }: BadgeGridProps) {
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  // Map unlocked badge codes to their unlock dates
  const unlockedMap = new Map<string, string>();
  achievements.forEach((a) => {
    unlockedMap.set(a.badge.code, a.unlockedAt);
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const selectedUnlockDate = selectedBadge ? unlockedMap.get(selectedBadge.code) : null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {allBadges.map((badge) => {
          const isUnlocked = unlockedMap.has(badge.code);
          const colors = categoryColors[badge.category] || defaultColors;
          const Icon = categoryIcons[badge.category] || Award;

          return (
            <button
              key={badge.code}
              onClick={() => setSelectedBadge(badge)}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-300 text-center ${
                isUnlocked
                  ? `bg-gradient-to-br ${colors.bg} ${colors.border} hover:shadow-lg ${colors.glow} hover:scale-[1.02]`
                  : 'bg-cardio-800/50 border-cyan-500/10 opacity-60 hover:opacity-80'
              }`}
            >
              {/* Badge icon */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                isUnlocked
                  ? `bg-gradient-to-br ${colors.bg} border ${colors.border}`
                  : 'bg-cardio-700/50 border border-slate-600/30'
              }`}>
                {isUnlocked ? (
                  <Icon className={`w-6 h-6 ${colors.text}`} />
                ) : (
                  <Lock className="w-5 h-5 text-slate-500" />
                )}
              </div>

              {/* Name */}
              <p className={`text-xs font-medium leading-tight line-clamp-2 ${
                isUnlocked ? 'text-slate-200' : 'text-slate-500'
              }`}>
                {badge.name}
              </p>

              {/* XP reward */}
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                isUnlocked
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                  : 'bg-cardio-700/50 text-slate-500 border border-slate-600/20'
              }`}>
                +{badge.xpReward} XP
              </span>

              {/* Shine effect for unlocked */}
              {isUnlocked && (
                <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                  <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-white/5 to-transparent rotate-12" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Badge detail modal */}
      {selectedBadge && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedBadge(null)}
        >
          <div
            className="glass-card rounded-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {(() => {
                  const colors = categoryColors[selectedBadge.category] || defaultColors;
                  const Icon = categoryIcons[selectedBadge.category] || Award;
                  const isUnlocked = unlockedMap.has(selectedBadge.code);
                  return (
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                      isUnlocked
                        ? `bg-gradient-to-br ${colors.bg} border ${colors.border}`
                        : 'bg-cardio-700/50 border border-slate-600/30'
                    }`}>
                      {isUnlocked ? (
                        <Icon className={`w-7 h-7 ${colors.text}`} />
                      ) : (
                        <Lock className="w-6 h-6 text-slate-500" />
                      )}
                    </div>
                  );
                })()}
                <div>
                  <h3 className="text-base font-semibold text-slate-200">{selectedBadge.name}</h3>
                  <span className="text-xs text-amber-400">+{selectedBadge.xpReward} XP</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedBadge(null)}
                className="p-1.5 rounded-lg hover:bg-cardio-700/50 transition"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <p className="text-sm text-slate-400 mb-4">{selectedBadge.description}</p>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 capitalize">
                Categorie : {selectedBadge.category.toLowerCase()}
              </span>
              {selectedUnlockDate ? (
                <span className="text-green-400 font-medium">
                  Debloque le {formatDate(selectedUnlockDate)}
                </span>
              ) : (
                <span className="text-slate-500">Non debloque</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
