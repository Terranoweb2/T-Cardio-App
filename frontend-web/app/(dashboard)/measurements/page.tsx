'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMeasurements } from '@/hooks/useMeasurements';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function MeasurementsPage() {
  const [period, setPeriod] = useState(30);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useMeasurements({ days: period, page, limit: 20 });
  const measurements = data?.data || [];
  const meta = data?.meta;

  const riskBadge = (level: string) => {
    const colors: Record<string, string> = {
      FAIBLE: 'bg-green-500/15 text-green-400', MODERE: 'bg-amber-500/15 text-amber-400',
      ELEVE: 'bg-red-500/15 text-red-400', CRITIQUE: 'bg-red-500/20 text-red-300',
    };
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[level] || 'bg-cardio-800'}`}>{level}</span>;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Historique des mesures</h1>
        <Link href="/measurements/add" className="glow-btn px-4 py-2 rounded-lg transition text-sm text-center">
          + Nouvelle mesure
        </Link>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => { setPeriod(d); setPage(1); }}
            className={`px-4 py-1 rounded-lg text-sm whitespace-nowrap shrink-0 ${period === d ? 'bg-gradient-to-r from-cyan-600 via-teal-600 to-cyan-700 text-white' : 'glass-card border border-cyan-500/10 text-slate-400'}`}>
            {d} jours
          </button>
        ))}
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">Chargement...</div>
        ) : measurements.length === 0 ? (
          <div className="p-12 text-center text-slate-500">Aucune mesure sur cette periode</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full">
                <thead className="bg-cardio-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Systolique</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Diastolique</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Pouls</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Risque</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-500/10">
                  {measurements.map((m: any) => (
                    <tr key={m.id} className={m.isEmergency ? 'bg-red-500/10' : ''}>
                      <td className="px-4 py-3 text-sm">
                        {format(new Date(m.measuredAt), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{m.systolic}</td>
                      <td className="px-4 py-3 text-sm font-medium">{m.diastolic}</td>
                      <td className="px-4 py-3 text-sm">{m.pulse || '-'}</td>
                      <td className="px-4 py-3">{m.riskLevel && riskBadge(m.riskLevel)}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{m.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-cyan-500/10">
              {measurements.map((m: any) => (
                <div key={m.id} className={`p-4 ${m.isEmergency ? 'bg-red-500/10' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-lg font-bold text-red-400">{m.systolic}</span>
                        <span className="text-slate-500 mx-0.5">/</span>
                        <span className="text-lg font-bold text-cyan-400">{m.diastolic}</span>
                        <span className="text-xs text-slate-500 ml-1">mmHg</span>
                      </div>
                      {m.pulse && (
                        <span className="text-xs text-slate-400 bg-cardio-800 px-2 py-0.5 rounded">
                          {m.pulse} bpm
                        </span>
                      )}
                    </div>
                    {m.riskLevel && riskBadge(m.riskLevel)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{format(new Date(m.measuredAt), 'dd/MM/yyyy HH:mm', { locale: fr })}</span>
                    <span>{m.source}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4 overflow-x-auto pb-2">
          {Array.from({ length: meta.totalPages }, (_, i) => (
            <button key={i} onClick={() => setPage(i + 1)}
              className={`px-3 py-1 rounded text-sm shrink-0 ${page === i + 1 ? 'bg-gradient-to-r from-cyan-600 via-teal-600 to-cyan-700 text-white' : 'glass-card border border-cyan-500/10'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
