'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { queryKeys } from '@/lib/query-client';
import { usePatientUpdates } from '@/hooks/usePatientUpdates';
import ChartWrapper from '@/components/charts/ChartWrapper';
import RiskDoughnutChart from '@/components/charts/RiskDoughnutChart';
import { Star } from 'lucide-react';

export default function DoctorDashboardPage() {
 const user = useAuthStore((s) => s.user);

 // Auto-refresh when any patient updates their profile
 usePatientUpdates();

 const { data: patients = [], isLoading } = useQuery({
  queryKey: queryKeys.doctor.patients,
  queryFn: async () => {
   const { data } = await api.get('/doctors/patients');
   return data.data || data;
  },
 });

 const { data: doctorProfile } = useQuery({
  queryKey: ['doctor', 'profile'],
  queryFn: async () => {
   const { data } = await api.get('/doctors/profile');
   return data.data || data;
  },
 });

 const riskBadge = (level: string) => {
  const colors: Record<string, string> = {
   FAIBLE: 'bg-green-500/15 text-green-400',
   MODERE: 'bg-amber-500/15 text-amber-400',
   ELEVE: 'bg-red-500/15 text-red-400',
   CRITIQUE: 'bg-red-500/20 text-red-300',
  };
  return (
   <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[level] || 'bg-cardio-800'}`}>
    {level}
   </span>
  );
 };

 const totalPatients = patients.length;
 const patientsAtRisk = patients.filter(
  (p: any) => p.lastRiskLevel === 'ELEVE' || p.lastRiskLevel === 'CRITIQUE'
 ).length;
 const pendingTeleconsultations = patients.reduce(
  (acc: number, p: any) => acc + (p.pendingTeleconsultations || 0), 0
 );

 return (
  <div>
   <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 truncate">
    Bonjour{user ? `, Dr. ${user.email}` : ''}
   </h1>

   <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
    <div className="glass-card p-4 sm:p-6 rounded-xl shadow">
     <p className="text-sm text-slate-400">Total patients</p>
     <p className="text-2xl sm:text-3xl font-bold text-cyan-400">{totalPatients}</p>
    </div>

    <div className="glass-card p-4 sm:p-6 rounded-xl shadow">
     <p className="text-sm text-slate-400">Patients a risque</p>
     <p className="text-2xl sm:text-3xl font-bold text-red-400">{patientsAtRisk}</p>
     <p className="text-xs text-slate-500">ELEVE / CRITIQUE</p>
    </div>

    <div className="glass-card p-4 sm:p-6 rounded-xl shadow">
     <p className="text-sm text-slate-400">Teleconsultations</p>
     <p className="text-2xl sm:text-3xl font-bold text-cyan-400">{pendingTeleconsultations}</p>
     <p className="text-xs text-slate-500">En attente</p>
    </div>

    <div className="glass-card p-4 sm:p-6 rounded-xl shadow">
     <p className="text-sm text-slate-400 flex items-center gap-1">
      <Star className="w-3.5 h-3.5 text-yellow-400" /> Satisfaction
     </p>
     {doctorProfile?.totalRatings > 0 ? (
      <>
       <div className="flex items-baseline gap-1.5">
        <p className="text-2xl sm:text-3xl font-bold text-yellow-400">
         {doctorProfile.averageRating?.toFixed(1)}
        </p>
        <span className="text-sm text-slate-500">/5</span>
       </div>
       <p className="text-xs text-slate-500">{doctorProfile.totalRatings} avis</p>
      </>
     ) : (
      <>
       <p className="text-2xl sm:text-3xl font-bold text-slate-500">-</p>
       <p className="text-xs text-slate-500">Aucun avis</p>
      </>
     )}
    </div>
   </div>

   {/* Risk distribution chart */}
   {patients.length > 0 && (
    <div className="mb-6 sm:mb-8">
     <ChartWrapper
      title="Distribution des risques parmi vos patients"
      subtitle="Basee sur la derniere mesure de chaque patient"
      height="h-64"
      empty={patients.every((p: any) => !p.lastRiskLevel)}
     >
      <RiskDoughnutChart
       measurements={patients
        .filter((p: any) => p.lastRiskLevel)
        .map((p: any) => ({ riskLevel: p.lastRiskLevel }))}
      />
     </ChartWrapper>
    </div>
   )}

   <div className="glass-card rounded-xl overflow-hidden">
    <div className="px-4 sm:px-6 py-4 border-b border-cyan-500/10">
     <h2 className="text-lg font-semibold">Mes patients</h2>
    </div>

    {isLoading ? (
     <div className="p-12 text-center text-slate-500">Chargement...</div>
    ) : patients.length === 0 ? (
     <div className="p-12 text-center text-slate-500">Aucun patient associe</div>
    ) : (
     <>
      {/* Desktop table */}
      <div className="hidden md:block">
       <table className="w-full">
        <thead className="bg-cardio-800">
         <tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Patient</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Email</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Derniere mesure</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Risque</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Date</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Action</th>
         </tr>
        </thead>
        <tbody className="divide-y divide-cyan-500/10">
         {patients.map((p: any) => (
          <tr key={p.id} className={p.lastRiskLevel === 'CRITIQUE' ? 'bg-red-500/10' : ''}>
           <td className="px-4 py-3 text-sm font-medium">
            {p.firstName} {p.lastName}
           </td>
           <td className="px-4 py-3 text-sm text-slate-400">{p.email}</td>
           <td className="px-4 py-3 text-sm font-medium">
            {p.lastSystolic && p.lastDiastolic
             ? `${p.lastSystolic}/${p.lastDiastolic} mmHg`
             : '--/--'}
           </td>
           <td className="px-4 py-3">
            {p.lastRiskLevel ? riskBadge(p.lastRiskLevel) : (
             <span className="text-xs text-slate-500">N/A</span>
            )}
           </td>
           <td className="px-4 py-3 text-sm text-slate-400">
            {p.lastMeasuredAt
             ? new Date(p.lastMeasuredAt).toLocaleDateString('fr-FR')
             : '--'}
           </td>
           <td className="px-4 py-3">
            <Link
             href={`/doctor/patients/${p.id}`}
             className="text-cyan-400 hover:text-cyan-300 text-sm font-medium"
            >
             Voir details
            </Link>
           </td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-cyan-500/10">
       {patients.map((p: any) => (
        <Link
         key={p.id}
         href={`/doctor/patients/${p.id}`}
         className={`block p-4 active:bg-cardio-700/30 transition ${p.lastRiskLevel === 'CRITIQUE' ? 'bg-red-500/10' : ''}`}
        >
         <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-sm truncate mr-2">
           {p.firstName} {p.lastName}
          </span>
          {p.lastRiskLevel ? riskBadge(p.lastRiskLevel) : (
           <span className="text-xs text-slate-500">N/A</span>
          )}
         </div>
         <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="truncate mr-2">{p.email}</span>
          <span className="shrink-0 font-medium text-slate-300">
           {p.lastSystolic && p.lastDiastolic
            ? `${p.lastSystolic}/${p.lastDiastolic}`
            : '--/--'}
          </span>
         </div>
         {p.lastMeasuredAt && (
          <p className="text-xs text-slate-500 mt-1">
           {new Date(p.lastMeasuredAt).toLocaleDateString('fr-FR')}
          </p>
         )}
        </Link>
       ))}
      </div>
     </>
    )}
   </div>
  </div>
 );
}
