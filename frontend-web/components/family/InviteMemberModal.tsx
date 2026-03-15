'use client';

import { useState } from 'react';
import { X, Mail, Loader2, Send } from 'lucide-react';
import { useInviteFamilyMember } from '@/hooks/useFamily';

interface InviteMemberModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function InviteMemberModal({ onClose, onSuccess }: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const inviteMutation = useInviteFamilyMember();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      await inviteMutation.mutateAsync(email.trim());
      onSuccess?.();
      onClose();
    } catch {
      // Error already handled by mutation onError
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="glass-card rounded-2xl p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <Mail className="w-5 h-5 text-cyan-400" />
            Inviter un membre
          </h2>
          <button onClick={onClose} className="p-1 hover:text-red-400 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-400 mb-4">
          Envoyez une invitation par email pour ajouter un membre de votre famille.
          Il recevra un lien pour rejoindre votre groupe.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Email input */}
          <div className="mb-6">
            <label className="block text-sm text-slate-400 mb-1">Adresse email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="membre@exemple.com"
                required
                className="w-full glass-input rounded-lg pl-10 pr-3 py-2.5 text-sm"
                autoFocus
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!email.trim() || inviteMutation.isPending}
            className="w-full glow-btn rounded-lg py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {inviteMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {inviteMutation.isPending ? 'Envoi en cours...' : "Envoyer l'invitation"}
          </button>
        </form>
      </div>
    </div>
  );
}
