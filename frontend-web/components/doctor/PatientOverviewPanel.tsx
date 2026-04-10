'use client';

import { useState, useMemo } from 'react';
import { Search, Users } from 'lucide-react';
import PatientMiniCard from './PatientMiniCard';

interface PatientOverviewPanelProps {
  patients: any[];
}

const riskSortOrder: Record<string, number> = {
  CRITIQUE: 0,
  ELEVE: 1,
  MODERE: 2,
  FAIBLE: 3,
};

export default function PatientOverviewPanel({ patients }: PatientOverviewPanelProps) {
  const [search, setSearch] = useState('');

  const filteredAndSorted = useMemo(() => {
    const query = search.toLowerCase().trim();

    // Filter by name or email
    const filtered = query
      ? patients.filter((p) => {
          const firstName = (p.user?.firstName || '').toLowerCase();
          const lastName = (p.user?.lastName || '').toLowerCase();
          const email = (p.user?.email || '').toLowerCase();
          return (
            firstName.includes(query) ||
            lastName.includes(query) ||
            `${firstName} ${lastName}`.includes(query) ||
            email.includes(query)
          );
        })
      : patients;

    // Sort: risk priority first, then most recent measurement
    return [...filtered].sort((a, b) => {
      const riskA = riskSortOrder[a.lastRiskLevel] ?? 4;
      const riskB = riskSortOrder[b.lastRiskLevel] ?? 4;
      if (riskA !== riskB) return riskA - riskB;

      // Secondary: most recent measurement first
      const dateA = a.lastMeasuredAt ? new Date(a.lastMeasuredAt).getTime() : 0;
      const dateB = b.lastMeasuredAt ? new Date(b.lastMeasuredAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [patients, search]);

  return (
    <div className="glass-card rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cardio-700/50">
        <h3 className="text-sm font-semibold text-slate-200">Patients</h3>
        <span className="text-xs bg-cyan-500/15 text-cyan-400 px-2 py-0.5 rounded-full font-medium">
          {patients.length}
        </span>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-cardio-700/50">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Rechercher un patient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-cardio-800/50 border border-cardio-700/50 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition"
          />
        </div>
      </div>

      {/* Patient list */}
      <div className="max-h-[300px] sm:max-h-[400px] lg:max-h-[500px] overflow-y-auto dark-scrollbar">
        {filteredAndSorted.length > 0 ? (
          filteredAndSorted.map((patient) => (
            <PatientMiniCard key={patient.id} patient={patient} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500">
            <Users className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">Aucun patient</p>
          </div>
        )}
      </div>
    </div>
  );
}
