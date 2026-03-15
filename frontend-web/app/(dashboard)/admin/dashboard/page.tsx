'use client';

import { useEffect, useState } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { COLORS, defaultLineOptions, defaultBarOptions, defaultDoughnutOptions, formatChartDate } from '@/lib/chart-config';
import api from '@/lib/api';
import { Loader2, TrendingUp, Users, CreditCard, Video, AlertTriangle, Star } from 'lucide-react';

export default function AdminDashboardPage() {
 const [stats, setStats] = useState<any>(null);
 const [revenue, setRevenue] = useState<any>(null);
 const [userGrowth, setUserGrowth] = useState<any>(null);
 const [subscriptions, setSubscriptions] = useState<any>(null);
 const [topDoctors, setTopDoctors] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
  Promise.all([
   api.get('/admin/stats').then((r) => setStats(r.data)).catch(() => {}),
   api.get('/admin/stats/revenue?days=30').then((r) => setRevenue(r.data)).catch(() => {}),
   api.get('/admin/stats/user-growth?days=30').then((r) => setUserGrowth(r.data)).catch(() => {}),
   api.get('/admin/stats/subscriptions').then((r) => setSubscriptions(r.data)).catch(() => {}),
   api.get('/admin/stats/top-doctors?limit=5').then((r) => setTopDoctors(r.data)).catch(() => {}),
  ]).finally(() => setLoading(false));
 }, []);

 if (loading) {
  return (
   <div className="flex justify-center items-center py-20">
    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
   </div>
  );
 }

 if (!stats) {
  return (
   <div className="glass-card p-12 rounded-xl text-center">
    <p className="text-slate-400">Impossible de charger les statistiques</p>
   </div>
  );
 }

 // KPI cards
 const kpiCards = [
  {
   label: 'Revenu ce mois',
   value: revenue?.monthlyRevenue ? `${(revenue.monthlyRevenue).toLocaleString('fr-FR')} XOF` : '0 XOF',
   icon: TrendingUp,
   color: 'text-cyan-400',
   bg: 'bg-cyan-500/10',
  },
  {
   label: 'Abonnements actifs',
   value: subscriptions?.activeTotal ?? 0,
   icon: CreditCard,
   color: 'text-teal-400',
   bg: 'bg-teal-500/10',
  },
  {
   label: 'Utilisateurs totaux',
   value: stats.totalUsers ?? 0,
   icon: Users,
   color: 'text-indigo-400',
   bg: 'bg-indigo-500/10',
  },
  {
   label: 'Medecins en attente',
   value: stats.pendingDoctors ?? 0,
   icon: AlertTriangle,
   color: stats.pendingDoctors > 0 ? 'text-amber-400' : 'text-slate-300',
   bg: stats.pendingDoctors > 0 ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-cardio-800/50',
  },
 ];

 // Revenue chart data
 const revenueChartData = {
  labels: revenue?.daily?.map((d: any) => formatChartDate(d.date)) || [],
  datasets: [{
   label: 'Revenus (XOF)',
   data: revenue?.daily?.map((d: any) => d.total) || [],
   borderColor: COLORS.primary,
   backgroundColor: 'rgba(6, 182, 212, 0.1)',
   fill: true,
   tension: 0.4,
   pointRadius: 2,
   pointHoverRadius: 5,
  }],
 };

 // User growth chart data
 const growthChartData = {
  labels: userGrowth?.daily?.map((d: any) => formatChartDate(d.date)) || [],
  datasets: [{
   label: 'Nouveaux utilisateurs',
   data: userGrowth?.daily?.map((d: any) => d.count) || [],
   backgroundColor: 'rgba(6, 182, 212, 0.6)',
   borderColor: COLORS.primary,
   borderWidth: 1,
   borderRadius: 4,
  }],
 };

 // Subscription doughnut data
 const subPlans = subscriptions?.plans || [];
 const basicCount = subPlans.find((p: any) => p.plan === 'BASIC')?.count ?? 0;
 const proCount = subPlans.find((p: any) => p.plan === 'PRO')?.count ?? 0;
 const noSub = subscriptions?.withoutSubscription ?? 0;

 const subscriptionChartData = {
  labels: ['BASIC', 'PRO', 'Sans abonnement'],
  datasets: [{
   data: [basicCount, proCount, noSub],
   backgroundColor: ['rgba(99, 102, 241, 0.7)', 'rgba(20, 184, 166, 0.7)', 'rgba(100, 116, 139, 0.4)'],
   borderColor: ['#6366f1', '#14b8a6', '#64748b'],
   borderWidth: 1,
  }],
 };

 // Summary cards (existing stats)
 const summaryCards = [
  { label: 'Patients', value: stats.totalPatients, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  { label: 'Medecins verifies', value: stats.totalDoctors, color: 'text-teal-400', bg: 'bg-teal-500/10' },
  { label: 'Mesures totales', value: stats.totalMeasurements, color: 'text-green-400', bg: 'bg-green-500/10' },
  { label: 'Analyses T-Cardio', value: stats.totalAiAnalyses, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { label: 'Alertes totales', value: stats.totalAlerts, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  {
   label: 'Urgences actives',
   value: stats.activeEmergencies,
   color: stats.activeEmergencies > 0 ? 'text-red-400' : 'text-slate-300',
   bg: stats.activeEmergencies > 0 ? 'bg-red-500/10 border border-red-500/20' : 'bg-cardio-800/50',
  },
  {
   label: 'Mesures (30j)',
   value: stats.last30Days?.measurements ?? 0,
   color: 'text-cyan-400',
   bg: 'bg-cyan-500/10',
  },
  {
   label: 'Analyses (30j)',
   value: stats.last30Days?.aiAnalyses ?? 0,
   color: 'text-purple-400',
   bg: 'bg-purple-500/10',
  },
 ];

 return (
  <div>
   <h1 className="text-lg sm:text-2xl font-bold mb-6">Administration</h1>

   {/* KPI Cards */}
   <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
    {kpiCards.map((card) => (
     <div key={card.label} className={`p-5 rounded-xl ${card.bg}`}>
      <div className="flex items-center gap-2 mb-2">
       <card.icon className={`w-4 h-4 ${card.color}`} />
       <p className="text-sm text-slate-400">{card.label}</p>
      </div>
      <p className={`text-xl sm:text-3xl font-bold ${card.color}`}>{card.value}</p>
     </div>
    ))}
   </div>

   {/* Charts Grid */}
   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
    {/* Revenue Chart */}
    <div className="glass-card p-5 rounded-xl">
     <h2 className="text-sm font-semibold text-slate-200 mb-4">Revenus - 30 derniers jours</h2>
     <div style={{ height: 260 }}>
      {revenue?.daily?.length > 0 ? (
       <Line data={revenueChartData} options={{
        ...defaultLineOptions,
        plugins: {
         ...defaultLineOptions.plugins,
         legend: { display: false },
        },
        scales: {
         ...defaultLineOptions.scales,
         y: {
          ...defaultLineOptions.scales?.y,
          ticks: {
           ...((defaultLineOptions.scales?.y as any)?.ticks || {}),
           callback: (v: any) => `${(v / 1000).toFixed(0)}k`,
          },
         },
        },
       }} />
      ) : (
       <div className="flex items-center justify-center h-full text-slate-500 text-sm">Pas de donnees</div>
      )}
     </div>
     {revenue?.totalRevenue > 0 && (
      <p className="text-xs text-slate-400 mt-2">
       Total 30j : <span className="text-cyan-400 font-semibold">{revenue.totalRevenue.toLocaleString('fr-FR')} XOF</span>
      </p>
     )}
    </div>

    {/* User Growth Chart */}
    <div className="glass-card p-5 rounded-xl">
     <h2 className="text-sm font-semibold text-slate-200 mb-4">Croissance utilisateurs - 30 jours</h2>
     <div style={{ height: 260 }}>
      {userGrowth?.daily?.length > 0 ? (
       <Bar data={growthChartData} options={{
        ...defaultBarOptions,
        plugins: {
         ...defaultBarOptions.plugins,
         legend: { display: false },
        },
       }} />
      ) : (
       <div className="flex items-center justify-center h-full text-slate-500 text-sm">Pas de donnees</div>
      )}
     </div>
     {userGrowth?.totalNewUsers > 0 && (
      <p className="text-xs text-slate-400 mt-2">
       Total 30j : <span className="text-cyan-400 font-semibold">+{userGrowth.totalNewUsers} utilisateurs</span>
      </p>
     )}
    </div>
   </div>

   {/* Bottom row: Subscriptions + Top Doctors */}
   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
    {/* Subscription Doughnut */}
    <div className="glass-card p-5 rounded-xl">
     <h2 className="text-sm font-semibold text-slate-200 mb-4">Repartition des abonnements</h2>
     <div style={{ height: 240 }}>
      {subscriptions ? (
       <Doughnut data={subscriptionChartData} options={{
        ...defaultDoughnutOptions,
        cutout: '60%',
       }} />
      ) : (
       <div className="flex items-center justify-center h-full text-slate-500 text-sm">Pas de donnees</div>
      )}
     </div>
    </div>

    {/* Top Doctors */}
    <div className="glass-card p-5 rounded-xl">
     <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
      <Video className="w-4 h-4 text-cyan-400" />
      Top 5 medecins
     </h2>
     {topDoctors.length > 0 ? (
      <div className="overflow-x-auto">
       <table className="w-full text-sm">
        <thead>
         <tr className="text-slate-400 text-xs">
          <th className="text-left pb-3">#</th>
          <th className="text-left pb-3">Medecin</th>
          <th className="text-right pb-3">Consult.</th>
          <th className="text-right pb-3">Note</th>
          <th className="text-right pb-3">Solde</th>
         </tr>
        </thead>
        <tbody className="divide-y divide-cyan-500/10">
         {topDoctors.map((doc: any, i: number) => (
          <tr key={doc.id} className="hover:bg-cardio-800/50">
           <td className="py-2.5 text-slate-500 font-mono">{i + 1}</td>
           <td className="py-2.5 text-slate-200 font-medium">{doc.name}</td>
           <td className="py-2.5 text-right text-cyan-400 font-semibold">{doc.consultations}</td>
           <td className="py-2.5 text-right">
            {doc.totalRatings > 0 ? (
             <span className="flex items-center justify-end gap-1">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-yellow-400">{doc.averageRating.toFixed(1)}</span>
             </span>
            ) : (
             <span className="text-slate-500 text-xs">-</span>
            )}
           </td>
           <td className="py-2.5 text-right text-slate-400">
            {doc.walletBalance.toLocaleString('fr-FR')} <span className="text-xs">XOF</span>
           </td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     ) : (
      <p className="text-slate-500 text-sm text-center py-8">Aucun medecin</p>
     )}
    </div>
   </div>

   {/* Summary Cards */}
   <h2 className="text-sm font-semibold text-slate-300 mb-4">Vue d'ensemble</h2>
   <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
    {summaryCards.map((card) => (
     <div key={card.label} className={`p-4 rounded-xl ${card.bg}`}>
      <p className="text-xs text-slate-400">{card.label}</p>
      <p className={`text-lg sm:text-2xl font-bold mt-1 ${card.color}`}>{card.value ?? 0}</p>
     </div>
    ))}
   </div>
  </div>
 );
}
