'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { queryKeys } from '@/lib/query-client';
import { BarChart3, Clock, Banknote, Loader2, Check, Pencil, Save, X, Mail } from 'lucide-react';

interface Stats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  thisQuarter: number;
  consultationPriceXof: number | null;
  defaultDurationMinutes: number;
}

export default function ConsultationStatsPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: stats, isLoading, isSuccess } = useQuery<Stats>({
    queryKey: queryKeys.doctor.consultationStats,
    queryFn: async () => {
      const { data } = await api.get('/doctors/consultation-stats');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 min to avoid spamming email
  });

  useEffect(() => {
    if (stats) {
      setPrice(stats.consultationPriceXof?.toString() ?? '');
      setDuration(stats.defaultDurationMinutes?.toString() ?? '15');
    }
  }, [stats]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { consultationPriceXof?: number; defaultDurationMinutes?: number }) => {
      const { data } = await api.patch('/doctors/profile', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.doctor.consultationStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.doctor.profile });
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const handleSave = () => {
    const payload: { consultationPriceXof?: number; defaultDurationMinutes?: number } = {};
    if (price) payload.consultationPriceXof = parseInt(price, 10);
    if (duration) payload.defaultDurationMinutes = parseInt(duration, 10);
    saveMutation.mutate(payload);
  };

  const handleCancel = () => {
    setEditing(false);
    if (stats) {
      setPrice(stats.consultationPriceXof?.toString() ?? '');
      setDuration(stats.defaultDurationMinutes?.toString() ?? '15');
    }
  };

  const statCards = [
    { label: "Aujourd'hui", value: stats?.today ?? 0, color: 'text-cyan-400' },
    { label: 'Cette semaine', value: stats?.thisWeek ?? 0, color: 'text-cyan-400' },
    { label: 'Ce mois', value: stats?.thisMonth ?? 0, color: 'text-cyan-400' },
    { label: 'Ce trimestre', value: stats?.thisQuarter ?? 0, color: 'text-cyan-400' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gradient-cyan flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-cyan-400" />
            Mes consultations
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Statistiques et parametres de vos teleconsultations
          </p>
        </div>
      </div>

      {/* Email notification banner */}
      {isSuccess && (
        <div className="mb-6 p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2">
          <Mail className="w-4 h-4 text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-400">
            Un rapport de vos statistiques a ete envoye a votre adresse email.
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="glass-card p-4 sm:p-6 rounded-xl shadow text-center">
            <p className={`text-3xl sm:text-4xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Settings Section */}
      <div className="glass-card rounded-xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            Parametres de consultation
          </h2>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 transition"
            >
              <Pencil className="w-4 h-4" />
              Modifier
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-red-400 transition"
              >
                <X className="w-4 h-4" />
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="glow-btn rounded-lg px-4 py-1.5 text-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Enregistrer
              </button>
            </div>
          )}
        </div>

        {saveSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            <p className="text-sm text-green-400">Parametres mis a jour avec succes.</p>
          </div>
        )}

        {saveMutation.isError && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">Erreur lors de la sauvegarde. Veuillez reessayer.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Price */}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Banknote className="w-4 h-4" />
              Prix de la consultation (XOF)
            </label>
            {editing ? (
              <input
                type="number"
                min="0"
                step="500"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Ex: 5000"
                className="w-full glass-input rounded-lg px-3 py-2.5 text-sm"
              />
            ) : (
              <div className="glass-card rounded-lg px-4 py-3">
                <p className="text-lg font-bold text-slate-200">
                  {stats?.consultationPriceXof != null
                    ? `${stats.consultationPriceXof.toLocaleString('fr-FR')} XOF`
                    : 'Non defini'}
                </p>
              </div>
            )}
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Duree par defaut (minutes)
            </label>
            {editing ? (
              <input
                type="number"
                min="5"
                max="120"
                step="5"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Ex: 15"
                className="w-full glass-input rounded-lg px-3 py-2.5 text-sm"
              />
            ) : (
              <div className="glass-card rounded-lg px-4 py-3">
                <p className="text-lg font-bold text-slate-200">
                  {stats?.defaultDurationMinutes ?? 15} min
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
