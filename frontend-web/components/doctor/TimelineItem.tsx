'use client';

import React from 'react';
import { format, parseISO } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  Video,
  Info,
  FileText,
} from 'lucide-react';

interface TimelineItemProps {
  type: 'measurement' | 'alert' | 'teleconsultation' | 'system' | 'report';
  timestamp: string;
  title: string;
  description?: string;
  value?: string;
  severity?: 'info' | 'warning' | 'critical';
  patientId?: string;
}

const typeConfig = {
  measurement: { icon: Activity, dotColor: 'bg-emerald-500', iconColor: 'text-emerald-400' },
  alert: { icon: AlertTriangle, dotColor: 'bg-amber-500', iconColor: 'text-amber-400' },
  teleconsultation: { icon: Video, dotColor: 'bg-violet-500', iconColor: 'text-violet-400' },
  system: { icon: Info, dotColor: 'bg-slate-500', iconColor: 'text-slate-400' },
  report: { icon: FileText, dotColor: 'bg-blue-500', iconColor: 'text-blue-400' },
};

const severityColors = {
  info: 'border-slate-600/40 bg-slate-800/30',
  warning: 'border-amber-600/40 bg-amber-900/20',
  critical: 'border-red-600/40 bg-red-900/20',
};

export default function TimelineItem({
  type,
  timestamp,
  title,
  description,
  value,
  severity = 'info',
  patientId,
}: TimelineItemProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  let formattedTime: string;
  try {
    formattedTime = format(parseISO(timestamp), 'HH:mm');
  } catch {
    formattedTime = '--:--';
  }

  const content = (
    <div className="flex items-start gap-3 py-2.5 px-1 border-b border-cardio-700/30">
      {/* Time column */}
      <div className="w-16 flex-shrink-0 pt-0.5">
        <span className="text-[11px] text-slate-500 font-mono">{formattedTime}</span>
      </div>

      {/* Dot indicator */}
      <div className="flex flex-col items-center flex-shrink-0 pt-1">
        <div className={`w-2.5 h-2.5 rounded-full ${config.dotColor} ring-2 ring-cardio-900`} />
        <div className="w-px flex-1 bg-cardio-700/40 mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${config.iconColor}`} />
          <span className="text-sm font-medium text-slate-200 truncate">
            {title}
          </span>
        </div>

        {description && (
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{description}</p>
        )}

        {value && (
          <span
            className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-mono border ${severityColors[severity]}`}
          >
            {value}
          </span>
        )}
      </div>
    </div>
  );

  if (patientId) {
    return (
      <a
        href={`/doctor/patients/${patientId}`}
        className="block hover:bg-cardio-800/40 transition-colors rounded"
      >
        {content}
      </a>
    );
  }

  return content;
}
