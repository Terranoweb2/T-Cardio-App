'use client';

import { Flame } from 'lucide-react';

interface StreakCounterProps {
  streak: number;
  longestStreak: number;
}

export default function StreakCounter({ streak, longestStreak }: StreakCounterProps) {
  const isHotStreak = streak >= 7;

  return (
    <div className={`glass-card rounded-xl p-4 relative overflow-hidden ${
      isHotStreak ? 'border-orange-500/30' : ''
    }`}>
      {/* Background glow for hot streak */}
      {isHotStreak && (
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-red-500/5 pointer-events-none" />
      )}

      <div className="relative flex items-center gap-4">
        {/* Flame icon */}
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${
          isHotStreak
            ? 'bg-gradient-to-br from-orange-500/30 to-red-500/30 border border-orange-500/40 animate-glow-pulse'
            : 'bg-gradient-to-br from-orange-500/15 to-amber-500/15 border border-orange-500/20'
        }`}>
          <Flame className={`w-7 h-7 ${
            isHotStreak ? 'text-orange-400 animate-float' : 'text-orange-400/70'
          }`} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className={`text-2xl font-bold ${
              isHotStreak ? 'text-orange-400' : 'text-slate-200'
            }`}>
              {streak}
            </span>
            <span className="text-sm text-slate-400">
              jour{streak !== 1 ? 's' : ''} d&apos;affilee
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Record : <span className="text-slate-400 font-medium">{longestStreak}</span> jour{longestStreak !== 1 ? 's' : ''}
          </p>
          {isHotStreak && (
            <p className="text-xs text-orange-400 font-medium mt-1">
              Serie en feu !
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
