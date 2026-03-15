'use client';

import { ArrowRight } from 'lucide-react';

interface SuggestedFollowupsProps {
  suggestions: string[];
  onSelect: (text: string) => void;
}

export default function SuggestedFollowups({ suggestions, onSelect }: SuggestedFollowupsProps) {
  if (!suggestions.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 sm:gap-2 pb-1">
      {suggestions.map((suggestion, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(suggestion)}
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-medium
                     glass-card text-slate-300 border border-transparent
                     hover:border-cyan-400/30 hover:text-cyan-300
                     transition-all duration-200 active:scale-95"
        >
          <ArrowRight className="w-3 h-3 text-cyan-400 shrink-0" />
          <span>{suggestion}</span>
        </button>
      ))}
    </div>
  );
}
