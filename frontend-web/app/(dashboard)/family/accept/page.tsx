'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, Users } from 'lucide-react';
import api from '@/lib/api';

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Lien d\'invitation invalide — aucun token fourni.');
      return;
    }

    const acceptInvitation = async () => {
      try {
        const { data } = await api.post(`/family/accept/${token}`);
        setGroupName(data?.name || 'votre groupe familial');
        setStatus('success');
        setTimeout(() => router.push('/family'), 3000);
      } catch (err: any) {
        setStatus('error');
        const msg =
          err?.response?.data?.message ||
          'Erreur lors de l\'acceptation de l\'invitation. Le lien est peut-etre expire ou invalide.';
        setErrorMessage(msg);
      }
    };

    acceptInvitation();
  }, [token]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full">
        <div className="glass-card rounded-2xl p-8 text-center">
          {status === 'loading' && (
            <>
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-600/20 to-teal-600/20 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              </div>
              <h2 className="text-lg font-bold text-slate-200 mb-2">
                Acceptation en cours...
              </h2>
              <p className="text-sm text-slate-400">
                Veuillez patienter pendant que nous traitons votre invitation.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-lg font-bold text-slate-200 mb-2">
                Invitation acceptee !
              </h2>
              <p className="text-sm text-slate-400 mb-4">
                Vous avez rejoint le groupe familial <strong className="text-cyan-400">{groupName}</strong>.
                Vous allez etre redirige...
              </p>
              <button
                onClick={() => router.push('/family')}
                className="glow-btn rounded-lg px-6 py-2.5 text-sm font-semibold flex items-center gap-2 mx-auto"
              >
                <Users className="w-4 h-4" />
                Voir mon groupe familial
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-lg font-bold text-slate-200 mb-2">
                Erreur
              </h2>
              <p className="text-sm text-red-400 mb-6">
                {errorMessage}
              </p>
              <button
                onClick={() => router.push('/family')}
                className="glow-btn rounded-lg px-6 py-2.5 text-sm font-semibold flex items-center gap-2 mx-auto"
              >
                <Users className="w-4 h-4" />
                Retour
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AcceptFamilyInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}
