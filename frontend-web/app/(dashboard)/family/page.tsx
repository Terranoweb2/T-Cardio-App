'use client';

import { useState } from 'react';
import {
  Users, Plus, Loader2, UserPlus, Clock, Mail,
  Heart, Pill, Activity, ArrowLeft, X, Crown,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  useFamilyGroup,
  useCreateFamilyGroup,
  useRemoveFamilyMember,
  useMemberHealthData,
} from '@/hooks/useFamily';
import type { FamilyMember } from '@/hooks/useFamily';
import { useAuthStore } from '@/stores/authStore';
import FamilyMemberCard from '@/components/family/FamilyMemberCard';
import InviteMemberModal from '@/components/family/InviteMemberModal';
import toast from 'react-hot-toast';

export default function FamilyPage() {
  const { user } = useAuthStore();
  const { data: group, isLoading, refetch } = useFamilyGroup();
  const createGroupMutation = useCreateFamilyGroup();
  const removeMemberMutation = useRemoveFamilyMember();

  const [groupName, setGroupName] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const isOwner = group?.members?.some(
    (m) => m.user.id === user?.id && m.role === 'OWNER'
  ) ?? false;

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Veuillez entrer un nom de groupe');
      return;
    }
    try {
      await createGroupMutation.mutateAsync(groupName.trim());
      setGroupName('');
      refetch();
    } catch {
      // handled by mutation
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (confirmRemove === memberId) {
      try {
        await removeMemberMutation.mutateAsync(memberId);
        setConfirmRemove(null);
        if (selectedMember?.id === memberId) setSelectedMember(null);
      } catch {
        // handled by mutation
      }
    } else {
      setConfirmRemove(memberId);
      setTimeout(() => setConfirmRemove(null), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  // ─── No family group yet ──────────────────────────────────────────
  if (!group) {
    return (
      <div className="page-transition">
        <h1 className="text-xl sm:text-2xl font-bold text-gradient-cyan mb-6">
          Compte familial
        </h1>

        <div className="max-w-md mx-auto">
          <div className="glass-card rounded-2xl p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-600/20 to-teal-600/20 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-cyan-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-200 mb-2">
              Creer un groupe familial
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Creez un groupe pour suivre la sante de vos proches et partager les donnees
              medicales en toute securite.
            </p>

            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-1 text-left">Nom du groupe</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Ex: Famille Dupont"
                className="w-full glass-input rounded-lg px-3 py-2.5 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
              />
            </div>

            <button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || createGroupMutation.isPending}
              className="w-full glow-btn rounded-lg py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {createGroupMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Creer le groupe
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Family group exists ──────────────────────────────────────────
  const pendingInvitations = group.invitations?.filter((inv) => inv.status === 'PENDING') || [];

  return (
    <div className="page-transition">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gradient-cyan flex items-center gap-2">
            <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
            {group.name}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {group.members.length} membre{group.members.length > 1 ? 's' : ''}
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="glow-btn rounded-lg px-4 py-2 text-sm flex items-center gap-2 self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            Inviter un membre
          </button>
        )}
      </div>

      {/* Member detail view */}
      {selectedMember ? (
        <MemberHealthView
          member={selectedMember}
          onBack={() => setSelectedMember(null)}
        />
      ) : (
        <>
          {/* Members grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {group.members.map((member) => (
              <FamilyMemberCard
                key={member.id}
                member={member}
                isOwner={isOwner}
                isSelf={member.user.id === user?.id}
                onViewData={(m) => setSelectedMember(m)}
                onRemove={isOwner ? (id) => handleRemoveMember(id) : undefined}
              />
            ))}
          </div>

          {/* Pending invitations */}
          {pendingInvitations.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Invitations en attente
              </h2>
              <div className="space-y-2">
                {pendingInvitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="glass-card rounded-xl p-3 flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300 truncate">{inv.email}</p>
                      <p className="text-xs text-slate-500">
                        Envoyee le {format(new Date(inv.createdAt), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 font-semibold shrink-0">
                      En attente
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Invite modal */}
      {showInviteModal && (
        <InviteMemberModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}

// ─── Member Health Data View ─────────────────────────────────────────

interface MemberHealthViewProps {
  member: FamilyMember;
  onBack: () => void;
}

function MemberHealthView({ member, onBack }: MemberHealthViewProps) {
  const { data: healthData, isLoading } = useMemberHealthData(member.id);
  const fullName = [member.user.firstName, member.user.lastName].filter(Boolean).join(' ') || 'Membre';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const riskColors: Record<string, string> = {
    FAIBLE: 'text-green-400 bg-green-500/15',
    MODERE: 'text-amber-400 bg-amber-500/15',
    ELEVE: 'text-red-400 bg-red-500/15',
    CRITIQUE: 'text-red-300 bg-red-500/20',
  };

  return (
    <div>
      {/* Back button + name */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400 transition mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux membres
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-600/30 to-teal-600/30 border border-cyan-500/20 flex items-center justify-center">
          <span className="text-sm font-bold text-cyan-400">
            {fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
          </span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-200">{fullName}</h2>
          <p className="text-xs text-slate-500">{member.user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Latest measurement */}
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-5 h-5 text-red-400" />
            <h3 className="text-sm font-semibold text-slate-300">Dernieres mesures</h3>
          </div>

          {healthData?.measurements?.latest ? (
            <div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-2xl font-bold text-red-400">
                  {healthData.measurements.latest.systolic}
                </span>
                <span className="text-slate-500">/</span>
                <span className="text-2xl font-bold text-cyan-400">
                  {healthData.measurements.latest.diastolic}
                </span>
                <span className="text-xs text-slate-500 ml-1">mmHg</span>
              </div>

              {healthData.measurements.latest.pulse && (
                <p className="text-xs text-slate-400 mb-2">
                  Pouls : {healthData.measurements.latest.pulse} bpm
                </p>
              )}

              {healthData.measurements.latest.riskLevel && (
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  riskColors[healthData.measurements.latest.riskLevel] || 'text-slate-400 bg-slate-500/15'
                }`}>
                  {healthData.measurements.latest.riskLevel}
                </span>
              )}

              <p className="text-xs text-slate-500 mt-2">
                {format(new Date(healthData.measurements.latest.measuredAt), "dd MMM yyyy 'a' HH:mm", { locale: fr })}
              </p>

              <div className="mt-3 pt-3 border-t border-cyan-500/10 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Total mesures</p>
                  <p className="text-sm font-semibold text-slate-300">{healthData.measurements.count}</p>
                </div>
                {healthData.measurements.averageSystolic && (
                  <div>
                    <p className="text-xs text-slate-500">Moyenne</p>
                    <p className="text-sm font-semibold text-slate-300">
                      {Math.round(healthData.measurements.averageSystolic)}/{Math.round(healthData.measurements.averageDiastolic || 0)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Aucune mesure disponible</p>
            </div>
          )}
        </div>

        {/* Active medications */}
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Pill className="w-5 h-5 text-green-400" />
            <h3 className="text-sm font-semibold text-slate-300">Medicaments actifs</h3>
            {healthData?.medications?.count !== undefined && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-medium">
                {healthData.medications.count}
              </span>
            )}
          </div>

          {healthData?.medications?.active && healthData.medications.active.length > 0 ? (
            <div className="space-y-2">
              {healthData.medications.active.map((med) => (
                <div
                  key={med.id}
                  className="p-2.5 rounded-lg bg-cardio-800/50 border border-cyan-500/5"
                >
                  <p className="text-sm text-slate-200 font-medium">{med.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {med.dosage && (
                      <span className="text-xs text-slate-400">{med.dosage}</span>
                    )}
                    <span className="text-xs text-slate-500">{med.frequency}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <Pill className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Aucun medicament actif</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
