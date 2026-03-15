'use client';

import { useRouter } from 'next/navigation';
import { useMySubscription } from '@/hooks/useSubscription';
import { useSubscriptionPlans } from '@/hooks/usePayments';

const planFeatures: Record<string, { features: string[]; color: string; badge?: string }> = {
 BASIC: {
  features: [
   'Acces a l\'application',
   'Mesures tensionnelles',
   'Analyse T-Cardio standard',
   'Messagerie chat',
  ],
  color: 'blue',
 },
 PRO: {
  features: [
   'Acces a l\'application',
   'Mesures tensionnelles',
   'Analyse T-Cardio standard',
   'Messagerie chat',
   'Support prioritaire',
   'Analyses T-Cardio illimitees',
   'Rapports avances',
   'Comptes famille (3 profils)',
   'File d\'attente prioritaire',
  ],
  color: 'amber',
  badge: 'Recommande',
 },
};

export default function AbonnementPage() {
 const router = useRouter();
 const { data: subData, isLoading: subLoading } = useMySubscription();
 const { data: plans, isLoading: plansLoading } = useSubscriptionPlans();

 const subscription = subData?.subscription;
 const isActive = subData?.isActive;

 const daysLeft = subscription?.endDate
  ? Math.max(
    0,
    Math.ceil(
     (new Date(subscription.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    ),
   )
  : 0;

 if (subLoading || plansLoading) {
  return (
   <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-8 h-8 border-4 border-cyan-500/20 border-t-blue-600 rounded-full animate-spin" />
   </div>
  );
 }

 return (
  <div className="max-w-4xl mx-auto px-2 py-4 sm:px-4 sm:py-8">
   <h1 className="text-lg sm:text-2xl font-bold text-slate-100 mb-2">Mon Abonnement</h1>
   <p className="text-slate-400 mb-8">
    Gerez votre abonnement T-Cardio Pro
   </p>

   {/* Current subscription card */}
   {isActive && subscription && (
    <div className="bg-gradient-to-r from-cyan-600 via-teal-600 to-cyan-700 rounded-2xl p-3 sm:p-6 mb-4 sm:mb-8 text-white">
     <div className="flex items-center justify-between mb-3 sm:mb-4">
      <div>
       <p className="text-cyan-200 text-xs sm:text-sm">Plan actuel</p>
       <h2 className="text-xl sm:text-2xl font-bold">
        {subscription.plan === 'PRO' ? 'Professionnel' : 'Basique'}
       </h2>
      </div>
      <div className="glass-card/20 rounded-full px-4 py-1.5">
       <span className="text-sm font-medium">Actif</span>
      </div>
     </div>
     <div className="grid grid-cols-3 gap-1.5 sm:gap-4 text-[11px] sm:text-sm">
      <div>
       <p className="text-cyan-200">Debut</p>
       <p className="font-medium">
        {subscription.startDate
         ? new Date(subscription.startDate).toLocaleDateString('fr-FR')
         : '-'}
       </p>
      </div>
      <div>
       <p className="text-cyan-200">Expiration</p>
       <p className="font-medium">
        {subscription.endDate
         ? new Date(subscription.endDate).toLocaleDateString('fr-FR')
         : '-'}
       </p>
      </div>
      <div>
       <p className="text-cyan-200">Jours restants</p>
       <p className="font-medium text-lg">{daysLeft}</p>
      </div>
     </div>
    </div>
   )}

   {/* Plans grid */}
   <div className="grid md:grid-cols-2 gap-6">
    {(plans || []).map((plan: any) => {
     const config = planFeatures[plan.id] || { features: [], color: 'blue' };
     const isPro = plan.id === 'PRO';
     const isCurrentPlan = isActive && subscription?.plan === plan.id;

     return (
      <div
       key={plan.id}
       className={`relative glass-card rounded-2xl border-2 p-6 transition-all ${
        isPro
         ? 'border-amber-300 '
         : 'border-cyan-500/10'
       } ${isCurrentPlan ? 'ring-2 ring-cyan-500 ring-offset-2' : ''}`}
      >
       {config.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
         <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
          {config.badge}
         </span>
        </div>
       )}

       <div className="text-center mb-6">
        <h3 className={`text-lg font-bold ${isPro ? 'text-amber-400' : 'text-slate-200'}`}>
         {plan.name}
        </h3>
        <div className="mt-3">
         <span className="text-2xl sm:text-4xl font-extrabold text-slate-100">
          {plan.priceXof.toLocaleString('fr-FR')}
         </span>
         <span className="text-slate-400 text-sm ml-1">XOF / an</span>
        </div>
       </div>

       <ul className="space-y-3 mb-6">
        {config.features.map((f, i) => (
         <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
          <svg
           className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isPro ? 'text-amber-500' : 'text-cyan-400'}`}
           fill="none"
           viewBox="0 0 24 24"
           stroke="currentColor"
           strokeWidth={2}
          >
           <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {f}
         </li>
        ))}
       </ul>

       <button
        onClick={() => router.push('/momo-pay')}
        disabled={isCurrentPlan}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 ${
         isCurrentPlan
          ? 'bg-cardio-800 text-slate-500 cursor-not-allowed'
          : isPro
          ? 'bg-amber-500 hover:bg-amber-600 text-white'
          : 'glow-btn'
        }`}
       >
        {isCurrentPlan ? (
         'Plan actuel'
        ) : (
         <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
           <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
          </svg>
          {isActive ? 'Changer via MoMo' : 'Souscrire via MoMo'}
         </>
        )}
       </button>
      </div>
     );
    })}
   </div>
  </div>
 );
}
