import Link from 'next/link';
import Image from 'next/image';

const demos = [
  {
    id: 'medecin',
    name: 'Application Medecin',
    description:
      'Decouvrez comment T-Cardio Pro aide les medecins a gerer leurs patients, teleconsulter et suivre les urgences cardiaques.',
    features: [
      'Tableau de bord centralise',
      'Dossiers patients complets',
      'Teleconsultation video HD',
      'Systeme d\'urgence intelligent',
      'Ordonnances numeriques',
      'Portefeuille medecin',
    ],
    videoSrc: '/demos/demo-medecin-apk.mp4',
    gradient: 'from-cyan-600 to-teal-600',
    accent: 'cyan',
    duration: '1:30',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5.25 14.25m0 0l3.841 3.841a2.25 2.25 0 001.591.659h5.714M5.25 14.25h14.5M19.5 10.5V6.75a2.25 2.25 0 00-2.25-2.25h-1.372c-.516 0-1.009.205-1.372.569L12.75 6.75"
        />
      </svg>
    ),
  },
  {
    id: 'patient',
    name: 'Application Patient',
    description:
      'Voyez comment les patients utilisent T-Cardio Pro pour suivre leur sante cardiaque et consulter a distance.',
    features: [
      'Espace sante personnalise',
      'Suivi des constantes vitales',
      'Teleconsultation a domicile',
      'Urgences cardiaques 24/7',
      'Ordonnances PDF',
      'Portefeuille credits',
    ],
    videoSrc: '/demos/demo-patient-apk.mp4',
    gradient: 'from-violet-600 to-purple-600',
    accent: 'violet',
    duration: '1:30',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    ),
  },
];

export default function DemosPage() {
  return (
    <div className="min-h-screen bg-cardio-900">
      {/* Header */}
      <div className="bg-gradient-to-b from-cardio-950 to-cardio-900 text-white py-12 sm:py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex justify-center mb-5">
            <Image src="/logo-T-Cardio.png" alt="T-Cardio Pro" width={80} height={80} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">
            Demonstrations <span className="text-gradient-cyan">Video</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Decouvrez T-Cardio Pro en action. Regardez nos videos de demonstration pour les applications
            medecin et patient.
          </p>
        </div>
      </div>

      {/* Demo Cards */}
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        <div className="space-y-10 sm:space-y-14">
          {demos.map((demo, index) => (
            <div key={demo.id} className="glass-card rounded-2xl overflow-hidden">
              {/* Card Header */}
              <div className={`bg-gradient-to-r ${demo.gradient} px-6 py-5 flex items-center gap-4`}>
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex-shrink-0">
                  {demo.icon}
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">{demo.name}</h2>
                  <p className="text-white/70 text-sm mt-0.5">Duree : {demo.duration}</p>
                </div>
              </div>

              {/* Video + Info */}
              <div className={`grid grid-cols-1 ${index % 2 === 0 ? 'lg:grid-cols-[1.6fr_1fr]' : 'lg:grid-cols-[1fr_1.6fr]'} gap-0`}>
                {/* Video */}
                <div className={`${index % 2 !== 0 ? 'lg:order-2' : ''} bg-black/40 p-4 sm:p-6`}>
                  <div className="relative w-full rounded-xl overflow-hidden shadow-2xl" style={{ aspectRatio: '16/9' }}>
                    <video
                      className="w-full h-full object-cover rounded-xl"
                      controls
                      preload="metadata"
                      poster={`/demos/${demo.id}-poster.jpg`}
                    >
                      <source src={demo.videoSrc} type="video/mp4" />
                      Votre navigateur ne supporte pas la lecture video.
                    </video>
                  </div>
                </div>

                {/* Description */}
                <div className={`${index % 2 !== 0 ? 'lg:order-1' : ''} p-5 sm:p-6 flex flex-col justify-center`}>
                  <p className="text-slate-400 text-sm sm:text-base mb-5 leading-relaxed">
                    {demo.description}
                  </p>

                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                    Fonctionnalites presentees
                  </h3>
                  <ul className="space-y-2 mb-6">
                    {demo.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                        <svg
                          className={`w-4 h-4 ${demo.accent === 'cyan' ? 'text-cyan-400' : 'text-violet-400'} flex-shrink-0`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/download"
                    className={`inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm text-white transition-all ${
                      demo.accent === 'cyan'
                        ? 'bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 shadow-lg shadow-cyan-500/20'
                        : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/20'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Telecharger l&apos;application
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Section */}
      <div className="max-w-4xl mx-auto px-4 pb-12 sm:pb-16">
        <div className="glass-card rounded-2xl p-6 sm:p-8 text-center">
          <h2 className="text-xl font-bold text-slate-100 mb-3">
            Pret a essayer T-Cardio Pro ?
          </h2>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto mb-6">
            Telechargez l&apos;application adaptee a votre profil et commencez a utiliser la telecardiologie intelligente
            des aujourd&apos;hui.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/download"
              className="glow-btn py-3 px-8 rounded-xl font-semibold text-sm inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Telecharger les applications
            </Link>
            <Link
              href="/login"
              className="glass-card py-3 px-8 rounded-xl font-semibold text-sm text-slate-300 hover:text-white hover:border-cyan-500/30 transition-all inline-flex items-center gap-2"
            >
              Se connecter
            </Link>
          </div>
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
            href="/download"
            className="text-sm text-slate-400 hover:text-cyan-400 transition"
          >
            Telecharger les APK
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
