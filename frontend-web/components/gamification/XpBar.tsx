'use client';

import { Zap } from 'lucide-react';

interface XpBarProps {
  totalXp: number;
  level: number;
}

// XP required per level (simple formula: level * 500)
function getXpForLevel(level: number): number {
  return level * 500;
}

function getXpInCurrentLevel(totalXp: number, level: number): number {
  // XP accumulated before current level
  let xpBeforeLevel = 0;
  for (let i = 1; i < level; i++) {
    xpBeforeLevel += getXpForLevel(i);
  }
  return totalXp - xpBeforeLevel;
}

function getXpNeededForNextLevel(level: number): number {
  return getXpForLevel(level);
}

export default function XpBar({ totalXp, level }: XpBarProps) {
  const currentLevelXp = getXpInCurrentLevel(totalXp, level);
  const neededXp = getXpNeededForNextLevel(level);
  const progress = Math.min((currentLevelXp / neededXp) * 100, 100);

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-teal-500/30 border border-cyan-500/30 flex items-center justify-center">
            <span className="text-lg font-bold text-cyan-400">{level}</span>
          </div>
          <div>
            <p className="text-xs text-slate-400">Niveau actuel</p>
            <p className="text-sm font-semibold text-slate-200">Niveau {level}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-right">
          <Zap className="w-4 h-4 text-amber-400" />
          <div>
            <p className="text-sm font-bold text-slate-200">{totalXp.toLocaleString('fr-FR')}</p>
            <p className="text-xs text-slate-500">XP total</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="w-full h-3 rounded-full bg-cardio-800 border border-cyan-500/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-500 to-cyan-400 transition-all duration-700 ease-out relative"
            style={{ width: `${progress}%` }}
          >
            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          </div>
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-slate-500">{currentLevelXp.toLocaleString('fr-FR')} XP</span>
          <span className="text-xs text-slate-500">{neededXp.toLocaleString('fr-FR')} XP</span>
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center mt-2">
        Encore <span className="text-cyan-400 font-medium">{(neededXp - currentLevelXp).toLocaleString('fr-FR')}</span> XP pour le niveau {level + 1}
      </p>
    </div>
  );
}
