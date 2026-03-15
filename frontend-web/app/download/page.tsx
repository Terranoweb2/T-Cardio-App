import Link from 'next/link';
import Image from 'next/image';

const apps = [
  {
    name: 'T-Cardio Patient',
    description: 'Suivez vos mesures tensionnelles et consultez votre cardiologue a distance.',
    features: ['Mesures tensionnelles', 'Teleconsultation video', 'Alertes en temps reel', 'Suivi personnalise'],
    downloadUrl: '/T-Cardio-Patient.apk',
    icon: (
      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    name: 'T-Cardio Medecin',
    description: 'Gerez vos patients et teleconsultez en temps reel depuis votre mobile.',
    features: ['Gestion des patients', 'Analyse T-Cardio', 'Teleconsultation video', 'Notes medicales'],
    downloadUrl: '/T-Cardio-Medecin.apk',
    icon: (
      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5.25 14.25m0 0l3.841 3.841a2.25 2.25 0 001.591.659h5.714M5.25 14.25h14.5M19.5 10.5V6.75a2.25 2.25 0 00-2.25-2.25h-1.372c-.516 0-1.009.205-1.372.569L12.75 6.75" />
      </svg>
    ),
  },
  {
    name: 'T-Cardio Admin',
    description: 'Administrez la plateforme T-Cardio Pro et gerez les utilisateurs.',
    features: ['Dashboard administrateur', 'Gestion utilisateurs', 'Configuration seuils', 'Audit et paiements'],
    downloadUrl: '/T-Cardio-Admin.apk',
    icon: (
      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
];

const steps = [
  { step: '1', text: 'Telechargez le fichier APK correspondant a votre profil' },
  { step: '2', text: 'Ouvrez le fichier telecharge sur votre telephone Android' },
  { step: '3', text: 'Autorisez l\'installation depuis des sources inconnues si demande' },
  { step: '4', text: 'Installez et lancez l\'application' },
];

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-cardio-900">
      {/* Header */}
      <div className="bg-gradient-to-b from-cardio-950 to-cardio-900 text-white py-12 sm:py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex justify-center mb-5">
            <Image src="/logo-T-Cardio.png" alt="T-Cardio Pro" width={80} height={80} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">
            Applications <span className="text-gradient-cyan">Android</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Telechargez l&apos;application adaptee a votre profil pour acceder a T-Cardio Pro depuis votre mobile.
          </p>
        </div>
      </div>

      {/* App Cards */}
      <div className="max-w-5xl mx-auto px-4 -mt-8 sm:-mt-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {apps.map((app) => (
            <div
              key={app.name}
              className="glass-card rounded-2xl overflow-hidden hover:border-cyan-500/30 transition-all"
            >
              {/* Card Header */}
              <div className="bg-gradient-to-r from-cyan-600 to-teal-600 p-5 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mb-3">
                  {app.icon}
                </div>
                <h2 className="text-xl font-bold text-white">{app.name}</h2>
              </div>

              {/* Card Body */}
              <div className="p-5">
                <p className="text-slate-400 text-sm mb-4">{app.description}</p>

                <ul className="space-y-2 mb-5">
                  {app.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                      <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="text-xs text-slate-500 mb-4 flex items-center justify-between">
                  <span>Version 1.4</span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Android APK
                  </span>
                </div>

                <a
                  href={app.downloadUrl}
                  download
                  className="block w-full text-center glow-btn py-3 rounded-xl font-semibold text-sm"
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Telecharger
                  </span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Installation Steps */}
      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
        <h2 className="text-xl font-bold text-slate-100 text-center mb-8">
          Comment installer l&apos;application ?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {steps.map((s) => (
            <div key={s.step} className="flex items-start gap-3 glass-card p-4 rounded-xl">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/15 text-cyan-400 flex items-center justify-center text-sm font-bold">
                {s.step}
              </span>
              <p className="text-sm text-slate-300 pt-1">{s.text}</p>
            </div>
          ))}
        </div>

        {/* Info box */}
        <div className="mt-8 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-amber-300">
            Les applications necessitent Android 7.0 ou superieur et une connexion internet active.
            Votre telephone vous demandera peut-etre d&apos;autoriser l&apos;installation depuis des sources inconnues dans les parametres.
          </p>
        </div>
      </div>

      {/* Footer Links */}
      <div className="border-t border-cyan-500/10 bg-cardio-800/50 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="text-sm text-slate-400 hover:text-cyan-400 transition flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Retour a l&apos;accueil
          </Link>
          <span className="hidden sm:inline text-slate-600">|</span>
          <Link
            href="/demos"
            className="text-sm text-slate-400 hover:text-cyan-400 transition"
          >
            Voir les demonstrations
          </Link>
          <span className="hidden sm:inline text-slate-600">|</span>
          <Link
            href="/login"
            className="text-sm text-cyan-400 hover:text-cyan-300 transition font-medium"
          >
            Acceder a la version web
          </Link>
        </div>
      </div>
    </div>
  );
}
