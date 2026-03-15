'use client';

import { Bot, User } from 'lucide-react';
import { useMemo } from 'react';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

/**
 * Compute relative time label in French.
 */
function relativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return 'a l\'instant';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'hier';
  if (diffD < 7) return `il y a ${diffD}j`;
  return new Date(isoString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Very light markdown parser: **bold**, bullet points (- item), and line breaks.
 * Returns an array of React elements.
 */
function parseMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    // Bullet point
    const bulletMatch = line.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      elements.push(
        <div key={`line-${lineIdx}`} className="flex items-start gap-1.5 sm:gap-2 ml-0.5 sm:ml-1">
          <span className="text-cyan-400 mt-0.5 shrink-0">&#8226;</span>
          <span className="break-words overflow-wrap-anywhere min-w-0">{parseBold(bulletMatch[1])}</span>
        </div>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={`line-${lineIdx}`} className="h-2" />);
    } else {
      elements.push(
        <span key={`line-${lineIdx}`} className="block break-words overflow-wrap-anywhere">
          {parseBold(line)}
        </span>
      );
    }
  });

  return elements;
}

function parseBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export default function MessageBubble({ role, content, timestamp }: MessageBubbleProps) {
  const isUser = role === 'user';
  const timeLabel = useMemo(() => (timestamp ? relativeTime(timestamp) : null), [timestamp]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up w-full overflow-hidden`}>
      {/* Assistant avatar */}
      {!isUser && (
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mr-2 mt-1 shrink-0">
          <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
        </div>
      )}

      <div
        className={`max-w-[75%] sm:max-w-[80%] rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 overflow-hidden ${
          isUser
            ? 'bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/25 text-white'
            : 'glass-card text-slate-300'
        }`}
      >
        <div className="text-[13px] sm:text-sm leading-relaxed space-y-0.5 break-words overflow-wrap-anywhere">
          {parseMarkdown(content)}
        </div>
        {timeLabel && (
          <p className={`text-[10px] mt-1.5 ${isUser ? 'text-cyan-300/50 text-right' : 'text-slate-500'}`}>
            {timeLabel}
          </p>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/25 flex items-center justify-center ml-2 mt-1 shrink-0">
          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300" />
        </div>
      )}
    </div>
  );
}
