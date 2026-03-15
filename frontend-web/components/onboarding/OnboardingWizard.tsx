'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Heart, User, Activity, ArrowRight, ArrowLeft, X } from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: 'Bienvenue sur T-Cardio Pro',
      icon: <Image src="/logo-T-Cardio.png" alt="T-Cardio" width={80} height={80} className="animate-float" />,
      content: (
        <>
          <p className="text-slate-300 text-center leading-relaxed mb-2">
            Votre application de suivi cardiovasculaire personnalisee.
          </p>
          <p className="text-slate-400 text-sm text-center">
            Mesurez votre tension, suivez vos tendances et restez connecte avec votre medecin.
          </p>
        </>
      ),
    },
    {
      title: 'Completez votre profil',
      icon: <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-600/30 to-teal-600/30 border-2 border-cyan-500/30 flex items-center justify-center"><User className="w-10 h-10 text-cyan-400" /></div>,
      content: (
        <>
          <p className="text-slate-300 text-center leading-relaxed mb-4">
            Un profil complet aide votre medecin a mieux vous suivre.
          </p>
          <div className="space-y-2 text-sm text-slate-400">
            <div className="flex items-center gap-2"><Heart className="w-4 h-4 text-cyan-400" /> Informations personnelles (nom, age)</div>
            <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-400" /> Antecedents medicaux</div>
            <div className="flex items-center gap-2"><User className="w-4 h-4 text-cyan-400" /> Contact d&apos;urgence</div>
          </div>
          <p className="text-xs text-slate-500 text-center mt-4">
            Vous pourrez completer votre profil plus tard dans les parametres.
          </p>
        </>
      ),
    },
    {
      title: 'Connectez votre tensiometre',
      icon: <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-600/30 to-cyan-600/30 border-2 border-teal-500/30 flex items-center justify-center"><Activity className="w-10 h-10 text-teal-400" /></div>,
      content: (
        <>
          <p className="text-slate-300 text-center leading-relaxed mb-4">
            T-Cardio peut lire automatiquement vos mesures via Bluetooth ou photo.
          </p>
          <div className="glass-card rounded-xl p-4 mb-4">
            <p className="text-sm text-cyan-400 font-semibold mb-2">Methodes de saisie :</p>
            <div className="space-y-2 text-sm text-slate-400">
              <p>1. Saisie manuelle des valeurs</p>
              <p>2. Photo du tensiometre (OCR automatique)</p>
              <p>3. Bluetooth (bientot disponible)</p>
            </div>
          </div>
        </>
      ),
    },
    {
      title: 'Premiere mesure',
      icon: <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-600/30 to-teal-600/30 border-2 border-cyan-500/30 flex items-center justify-center"><Heart className="w-10 h-10 text-red-400 animate-glow-pulse" /></div>,
      content: (
        <>
          <p className="text-slate-300 text-center leading-relaxed mb-4">
            Quelques conseils pour une mesure fiable :
          </p>
          <div className="space-y-3 text-sm">
            <div className="glass-card rounded-lg p-3 flex items-start gap-2">
              <span className="text-cyan-400 font-bold">1</span>
              <p className="text-slate-400">Asseyez-vous au calme pendant 5 minutes avant la mesure</p>
            </div>
            <div className="glass-card rounded-lg p-3 flex items-start gap-2">
              <span className="text-cyan-400 font-bold">2</span>
              <p className="text-slate-400">Placez le brassard au niveau du coeur</p>
            </div>
            <div className="glass-card rounded-lg p-3 flex items-start gap-2">
              <span className="text-cyan-400 font-bold">3</span>
              <p className="text-slate-400">Ne parlez pas et ne bougez pas pendant la mesure</p>
            </div>
          </div>
        </>
      ),
    },
  ];

  const currentStep = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-cardio-950/95 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl p-6 sm:p-8 w-full max-w-md animate-slide-up">
        {/* Skip button */}
        <div className="flex justify-end mb-2">
          <button onClick={onSkip} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition">
            Passer <X className="w-3 h-3" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex justify-center gap-2 mb-6">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? 'w-8 bg-cyan-400' : i < step ? 'w-4 bg-cyan-600' : 'w-4 bg-cardio-700'
            }`} />
          ))}
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-6">{currentStep.icon}</div>

        {/* Title */}
        <h2 className="text-xl font-bold text-center text-slate-100 mb-4">{currentStep.title}</h2>

        {/* Content */}
        <div className="mb-8">{currentStep.content}</div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Retour
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={() => {
              if (isLast) {
                onComplete();
              } else {
                setStep(step + 1);
              }
            }}
            className="glow-btn rounded-xl px-6 py-2.5 text-sm font-semibold flex items-center gap-2"
          >
            {isLast ? 'Commencer' : 'Suivant'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
