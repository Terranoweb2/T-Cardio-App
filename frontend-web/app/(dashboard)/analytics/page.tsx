'use client';

import { useState } from 'react';
import { useChartData, useVariability, useMorningEvening, useTrends } from '@/hooks/useAnalytics';
import ChartWrapper from '@/components/charts/ChartWrapper';
import BpLineChart from '@/components/charts/BpLineChart';
import RiskDoughnutChart from '@/components/charts/RiskDoughnutChart';
import MorningEveningBarChart from '@/components/charts/MorningEveningBarChart';
import BpStatsCard from '@/components/charts/BpStatsCard';

export default function AnalyticsPage() {
 const [period, setPeriod] = useState(30);

 const { data: chartData = [], isLoading: loadingChart } = useChartData(period);
 const { data: variability, isLoading: loadingVar } = useVariability(period);
 const { data: morningEvening, isLoading: loadingME } = useMorningEvening(period);
 const { data: trends } = useTrends(period);

 const loading = loadingChart || loadingVar || loadingME;

 return (
  <div>
   <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
    <h1 className="text-xl sm:text-2xl font-bold">Analytique</h1>
    <div className="flex gap-2 overflow-x-auto pb-1">
     {[7, 30, 90].map((d) => (
      <button
       key={d}
       onClick={() => setPeriod(d)}
       className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 transition ${
        period === d
         ? 'glow-btn '
         : 'glass-card border border-cyan-500/10 text-slate-400 hover:bg-cardio-800/50'
       }`}
      >
       {d} jours
      </button>
     ))}
    </div>
   </div>

   {/* Stats cards */}
   <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
    <BpStatsCard
     title="Systolique moyenne"
     value={variability?.systolic?.mean ? `${variability.systolic.mean} mmHg` : '--'}
     subtitle={variability?.systolic?.stdDev ? `Ecart-type: ${variability.systolic.stdDev}` : undefined}
     trend={trends?.systolic?.direction}
     sparklineData={chartData.map((d: any) => d.systolic)}
     sparklineColor="#ef4444"
    />
    <BpStatsCard
     title="Diastolique moyenne"
     value={variability?.diastolic?.mean ? `${variability.diastolic.mean} mmHg` : '--'}
     subtitle={variability?.diastolic?.stdDev ? `Ecart-type: ${variability.diastolic.stdDev}` : undefined}
     trend={trends?.diastolic?.direction}
     sparklineData={chartData.map((d: any) => d.diastolic)}
     sparklineColor="#3b82f6"
    />
    <BpStatsCard
     title="Nombre de mesures"
     value={variability?.measurementCount?.toString() || '0'}
     subtitle={`Sur les ${period} derniers jours`}
    />
   </div>

   {/* Main BP trend chart */}
   <div className="mb-4 sm:mb-6">
    <ChartWrapper
     title="Evolution de la tension arterielle"
     subtitle={`${period} derniers jours — Systolique et diastolique`}
     height="h-64 sm:h-80"
     loading={loading}
     empty={chartData.length < 2}
    >
     <BpLineChart measurements={chartData} showPulse showZones />
    </ChartWrapper>
   </div>

   {/* Two charts side by side */}
   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
    <ChartWrapper
     title="Distribution des niveaux de risque"
     subtitle={`Repartition sur ${period} jours`}
     height="h-64 sm:h-72"
     loading={loading}
     empty={chartData.length === 0}
    >
     <RiskDoughnutChart measurements={chartData} />
    </ChartWrapper>

    <ChartWrapper
     title="Comparaison matin / soir"
     subtitle="Moyennes systolique et diastolique"
     height="h-64 sm:h-72"
     loading={loading}
     empty={!morningEvening?.morning && !morningEvening?.evening}
    >
     <MorningEveningBarChart data={morningEvening || {}} />
    </ChartWrapper>
   </div>

   {/* Detailed stats table */}
   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
    <div className="glass-card p-4 sm:p-6 rounded-xl shadow">
     <h3 className="font-semibold mb-4">Variabilite tensionnelle</h3>
     {variability ? (
      <div className="space-y-3">
       <div className="flex justify-between items-center py-2 border-b border-cyan-500/10">
        <span className="text-sm text-slate-400">Coefficient de variation (Sys)</span>
        <span className={`text-sm font-medium ${variability.systolic?.cv > 10 ? 'text-red-400' : 'text-green-400'}`}>
         {variability.systolic?.cv}%
        </span>
       </div>
       <div className="flex justify-between items-center py-2 border-b border-cyan-500/10">
        <span className="text-sm text-slate-400">Coefficient de variation (Dia)</span>
        <span className={`text-sm font-medium ${variability.diastolic?.cv > 10 ? 'text-red-400' : 'text-green-400'}`}>
         {variability.diastolic?.cv}%
        </span>
       </div>
       <p className="text-xs text-slate-500 mt-2">Un CV &gt; 10% indique une forte variabilite</p>
      </div>
     ) : (
      <p className="text-sm text-slate-500">Pas assez de donnees</p>
     )}
    </div>

    <div className="glass-card p-4 sm:p-6 rounded-xl shadow">
     <h3 className="font-semibold mb-4">Tendances</h3>
     {trends ? (
      <div className="space-y-3">
       <div className="flex justify-between items-center py-2 border-b border-cyan-500/10">
        <span className="text-sm text-slate-400">Tendance systolique</span>
        <span className={`text-sm font-medium flex items-center gap-1 ${
         trends.systolic?.direction === 'rising' ? 'text-red-400' :
         trends.systolic?.direction === 'falling' ? 'text-green-400' : 'text-slate-400'
        }`}>
         {trends.systolic?.direction === 'rising' ? '↑ Hausse' :
          trends.systolic?.direction === 'falling' ? '↓ Baisse' : '→ Stable'}
         <span className="text-xs text-slate-500 ml-1 hidden sm:inline">({trends.systolic?.slope})</span>
        </span>
       </div>
       <div className="flex justify-between items-center py-2 border-b border-cyan-500/10">
        <span className="text-sm text-slate-400">Tendance diastolique</span>
        <span className={`text-sm font-medium flex items-center gap-1 ${
         trends.diastolic?.direction === 'rising' ? 'text-red-400' :
         trends.diastolic?.direction === 'falling' ? 'text-green-400' : 'text-slate-400'
        }`}>
         {trends.diastolic?.direction === 'rising' ? '↑ Hausse' :
          trends.diastolic?.direction === 'falling' ? '↓ Baisse' : '→ Stable'}
         <span className="text-xs text-slate-500 ml-1 hidden sm:inline">({trends.diastolic?.slope})</span>
        </span>
       </div>
       {trends.pulse && (
       <div className="flex justify-between items-center py-2 border-b border-cyan-500/10">
        <span className="text-sm text-slate-400">Tendance pouls</span>
        <span className={`text-sm font-medium flex items-center gap-1 ${
         trends.pulse?.direction === 'rising' ? 'text-red-400' :
         trends.pulse?.direction === 'falling' ? 'text-green-400' : 'text-slate-400'
        }`}>
         {trends.pulse?.direction === 'rising' ? '↑ Hausse' :
          trends.pulse?.direction === 'falling' ? '↓ Baisse' : '→ Stable'}
         <span className="text-xs text-slate-500 ml-1 hidden sm:inline">({trends.pulse?.slope})</span>
        </span>
       </div>
       )}
       <p className="text-xs text-slate-500 mt-2">Base sur {trends.period?.measurementCount} mesures</p>
      </div>
     ) : (
      <p className="text-sm text-slate-500">Pas assez de donnees</p>
     )}
    </div>
   </div>
  </div>
 );
}
