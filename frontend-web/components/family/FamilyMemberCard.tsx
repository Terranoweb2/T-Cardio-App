'use client';

import { Eye, UserMinus } from 'lucide-react';
import type { FamilyMember } from '@/hooks/useFamily';

interface FamilyMemberCardProps {
  member: FamilyMember;
  isOwner: boolean;
  isSelf: boolean;
  onViewData: (member: FamilyMember) => void;
  onRemove?: (memberId: string) => void;
}

export default function FamilyMemberCard({
  member,
  isOwner,
  isSelf,
  onViewData,
  onRemove,
}: FamilyMemberCardProps) {
  const { user } = member;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Membre';
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="glass-card rounded-xl p-4 hover:border-cyan-500/20 border border-transparent transition-all duration-200">
      <div className="flex items-center gap-3">
        {/* Avatar with initials */}
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-600/30 to-teal-600/30 border border-cyan-500/20 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-cyan-400">{initials}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-slate-200 truncate">{fullName}</h3>
            {isSelf && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 font-medium shrink-0">
                Vous
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate">{user.email}</p>
        </div>

        {/* Role badge */}
        <span
          className={`text-[10px] px-2 py-1 rounded-lg font-semibold shrink-0 ${
            member.role === 'OWNER'
              ? 'bg-amber-500/15 text-amber-400'
              : 'bg-slate-500/15 text-slate-400'
          }`}
        >
          {member.role === 'OWNER' ? 'Proprietaire' : 'Membre'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 mt-3">
        {!isSelf && (
          <button
            onClick={() => onViewData(member)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-cyan-400 hover:bg-cyan-500/10 transition"
          >
            <Eye className="w-3.5 h-3.5" />
            Voir les donnees
          </button>
        )}
        {isOwner && !isSelf && onRemove && (
          <button
            onClick={() => onRemove(member.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition"
          >
            <UserMinus className="w-3.5 h-3.5" />
            Retirer
          </button>
        )}
      </div>
    </div>
  );
}
