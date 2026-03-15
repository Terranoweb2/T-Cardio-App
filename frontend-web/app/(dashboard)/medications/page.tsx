'use client';

import { useState } from 'react';
import {
  Pill,
  CheckCircle2,
  BarChart3,
  Plus,
  Clock,
  Check,
  SkipForward,
  CalendarDays,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  useTodayChecklist,
  useMedications,
  useAdherenceStats,
  useLogMedication,
  type TodayChecklistItem,
} from '@/hooks/useMedications';
import MedicationCard, { getFrequencyLabel } from '@/components/medications/MedicationCard';
import AddMedicationModal from '@/components/medications/AddMedicationModal';
import toast from 'react-hot-toast';

// ─── Tab definitions ────────────────────────────────────────────────
type TabId = 'today' | 'list' | 'stats';

const tabs: { id: TabId; label: string; icon: typeof Pill }[] = [
  { id: 'today', label: 'Checklist du jour', icon: CheckCircle2 },
  { id: 'list', label: 'Mes medicaments', icon: Pill },
  { id: 'stats', label: 'Observance', icon: BarChart3 },
];

// ─── Main Page ──────────────────────────────────────────────────────
export default function MedicationsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="page-transition max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gradient-cyan">Medicaments</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="glow-btn px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-cardio-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'today' && <TodayChecklist />}
      {activeTab === 'list' && <MedicationList onAdd={() => setShowAddModal(true)} />}
      {activeTab === 'stats' && <AdherenceStatsView />}

      {/* Add modal */}
      {showAddModal && <AddMedicationModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}

// ─── Tab 1: Today's Checklist ───────────────────────────────────────
function TodayChecklist() {
  const { data: checklist, isLoading, error } = useTodayChecklist();
  const logMutation = useLogMedication();

  const todayStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleLog = (medicationId: string, scheduledAt: string, status: 'TAKEN' | 'SKIPPED') => {
    logMutation.mutate(
      { id: medicationId, status, scheduledAt },
      {
        onSuccess: () => {
          toast.success(
            status === 'TAKEN' ? 'Prise enregistree' : 'Prise ignoree'
          );
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-400/40 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">Impossible de charger la checklist</p>
      </div>
    );
  }

  const items: TodayChecklistItem[] = checklist || [];

  return (
    <div className="space-y-4">
      {/* Today's date */}
      <div className="flex items-center gap-2 text-slate-300">
        <CalendarDays className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-medium capitalize">{todayStr}</span>
      </div>

      {items.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-cyan-500/20 mx-auto mb-3" />
          <p className="text-slate-400">Aucun medicament prevu pour aujourd&apos;hui</p>
          <p className="text-slate-500 text-sm mt-1">
            Ajoutez des medicaments avec des rappels pour les voir ici
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.medication.id} className="glass-card rounded-xl p-4">
              {/* Medication header */}
              <div className="flex items-center gap-2 mb-3">
                <Pill className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-slate-200">{item.medication.name}</span>
                {item.medication.dosage && (
                  <span className="text-xs text-slate-400 bg-cardio-800 px-2 py-0.5 rounded">
                    {item.medication.dosage}
                  </span>
                )}
              </div>

              {/* Reminders */}
              <div className="space-y-2">
                {item.reminders.map((reminder, index) => {
                  const time = new Date(reminder.scheduledAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const isTaken = reminder.status === 'TAKEN';
                  const isSkipped = reminder.status === 'SKIPPED';
                  const isDone = isTaken || isSkipped;
                  const isPending = reminder.status === 'PENDING';
                  const isMissed = reminder.status === 'MISSED';

                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition ${
                        isTaken
                          ? 'bg-green-500/10 border border-green-500/20'
                          : isSkipped
                          ? 'bg-amber-500/10 border border-amber-500/20'
                          : isMissed
                          ? 'bg-red-500/10 border border-red-500/20'
                          : 'bg-cardio-800/50 border border-cyan-500/10'
                      }`}
                    >
                      {/* Left: time and status */}
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span
                          className={`text-sm font-medium ${
                            isTaken
                              ? 'text-green-400'
                              : isSkipped
                              ? 'text-amber-400'
                              : isMissed
                              ? 'text-red-400'
                              : 'text-slate-200'
                          }`}
                        >
                          {time}
                        </span>
                        {isTaken && (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Pris
                          </span>
                        )}
                        {isSkipped && (
                          <span className="text-xs text-amber-400 flex items-center gap-1">
                            <SkipForward className="w-3.5 h-3.5" /> Ignore
                          </span>
                        )}
                        {isMissed && (
                          <span className="text-xs text-red-400">Manque</span>
                        )}
                      </div>

                      {/* Right: action buttons */}
                      {isPending && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleLog(item.medication.id, reminder.scheduledAt, 'TAKEN')
                            }
                            disabled={logMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" /> Pris
                          </button>
                          <button
                            onClick={() =>
                              handleLog(item.medication.id, reminder.scheduledAt, 'SKIPPED')
                            }
                            disabled={logMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition disabled:opacity-50"
                          >
                            <SkipForward className="w-3.5 h-3.5" /> Ignorer
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Medication List ─────────────────────────────────────────
function MedicationList({ onAdd }: { onAdd: () => void }) {
  const [showActive, setShowActive] = useState<boolean | undefined>(true);

  const { data: medications, isLoading, error } = useMedications(showActive);

  const items = medications || [];

  return (
    <div className="space-y-4">
      {/* Filter toggle */}
      <div className="flex items-center gap-2">
        {[
          { value: true, label: 'Actifs' },
          { value: false, label: 'Inactifs' },
          { value: undefined, label: 'Tous' },
        ].map((option) => (
          <button
            key={String(option.value)}
            onClick={() => setShowActive(option.value)}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              showActive === option.value
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-cardio-800/50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-400/40 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Impossible de charger les medicaments</p>
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <Pill className="w-12 h-12 text-cyan-500/20 mx-auto mb-3" />
          <p className="text-slate-400">Aucun medicament trouve</p>
          <button
            onClick={onAdd}
            className="mt-3 text-sm text-cyan-400 hover:text-cyan-300 transition"
          >
            + Ajouter un medicament
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((med) => (
            <MedicationCard key={med.id} medication={med} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Adherence Stats ─────────────────────────────────────────
function AdherenceStatsView() {
  const [days, setDays] = useState(7);
  const { data: stats, isLoading, error } = useAdherenceStats(days);

  return (
    <div className="space-y-6">
      {/* Period toggle */}
      <div className="flex items-center gap-2">
        {[
          { value: 7, label: '7 jours' },
          { value: 30, label: '30 jours' },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => setDays(option.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              days === option.value
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-cardio-800/50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-400/40 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Impossible de charger les statistiques</p>
        </div>
      ) : stats ? (
        <>
          {/* Big percentage card */}
          <div className="glass-card rounded-xl p-8 text-center">
            <p className="text-slate-400 text-sm mb-2">Taux d&apos;observance</p>
            <p
              className={`text-6xl font-bold ${
                stats.adherencePercent >= 80
                  ? 'text-green-400'
                  : stats.adherencePercent >= 50
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}
            >
              {Math.round(stats.adherencePercent)}%
            </p>
            <p className="text-slate-500 text-sm mt-2">
              sur les {days} derniers jours
            </p>
          </div>

          {/* Breakdown bar */}
          <div className="glass-card rounded-xl p-6">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Repartition des prises</h3>

            {/* Stacked bar */}
            {stats.totalDoses > 0 ? (
              <div className="mb-4">
                <div className="flex rounded-full overflow-hidden h-4 bg-cardio-800">
                  {stats.taken > 0 && (
                    <div
                      className="bg-green-500 transition-all duration-500"
                      style={{ width: `${(stats.taken / stats.totalDoses) * 100}%` }}
                    />
                  )}
                  {stats.skipped > 0 && (
                    <div
                      className="bg-amber-500 transition-all duration-500"
                      style={{ width: `${(stats.skipped / stats.totalDoses) * 100}%` }}
                    />
                  )}
                  {stats.missed > 0 && (
                    <div
                      className="bg-red-500 transition-all duration-500"
                      style={{ width: `${(stats.missed / stats.totalDoses) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <div className="flex rounded-full overflow-hidden h-4 bg-cardio-800" />
              </div>
            )}

            {/* Legend */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-xs text-slate-400">Pris</span>
                </div>
                <p className="text-lg font-bold text-green-400">{stats.taken}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-xs text-slate-400">Ignores</span>
                </div>
                <p className="text-lg font-bold text-amber-400">{stats.skipped}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-xs text-slate-400">Manques</span>
                </div>
                <p className="text-lg font-bold text-red-400">{stats.missed}</p>
              </div>
            </div>

            {/* Total */}
            <div className="mt-4 pt-4 border-t border-cyan-500/10 text-center">
              <span className="text-xs text-slate-500">
                Total : {stats.totalDoses} prises prevues
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="glass-card rounded-xl p-8 text-center">
          <BarChart3 className="w-12 h-12 text-cyan-500/20 mx-auto mb-3" />
          <p className="text-slate-400">Aucune donnee disponible</p>
          <p className="text-slate-500 text-sm mt-1">
            Commencez a enregistrer vos prises pour voir vos statistiques
          </p>
        </div>
      )}
    </div>
  );
}
