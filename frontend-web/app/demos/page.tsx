'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';

const demos = [
  {
    id: 'medecin',
    name: 'Application Medecin',
    subtitle: 'Interface praticien',
    description:
      'Decouvrez comment T-Cardio Pro revolutionne la pratique quotidienne des cardiologues. Gestion centralisee des patients, teleconsultation HD securisee, systeme d\'alerte intelligent pour les urgences cardiaques et generation automatique d\'ordonnances numeriques.',
    features: [
      'Tableau de bord centralise avec vue d\'ensemble',
      'Dossiers patients complets et historiques',
      'Teleconsultation video HD securisee',
      'Systeme d\'urgence cardiaque intelligent',
      'Ordonnances numeriques avec signature',
      'Portefeuille et facturation medecin',
    ],
    videoSrc: '/demos/demo-medecin-apk.mp4',
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)',
    duration: '1 min 30',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    downloadLabel: 'Telecharger l\'APK Medecin',
  },
  {
    id: 'patient',
    name: 'Application Patient',
    subtitle: 'Interface patient',
    description:
      'Voyez comment les patients utilisent T-Cardio Pro pour suivre leur sante cardiaque au quotidien. Acces rapide aux teleconsultations, suivi des constantes vitales, alertes d\'urgence 24/7 et gestion simplifiee des ordonnances et rendez-vous.',
    features: [
      'Espace sante personnalise et intuitif',
      'Suivi des constantes vitales en temps reel',
      'Teleconsultation a domicile en un clic',
      'Bouton d\'urgence cardiaque 24/7',
      'Ordonnances PDF telechargeable',
      'Portefeuille credits et paiements',
    ],
    videoSrc: '/demos/demo-patient-apk.mp4',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    duration: '1 min 30',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    downloadLabel: 'Telecharger l\'APK Patient',
  },
];

export default function DemosPage() {
  const [scrolled, setScrolled] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  useEffect(() => {
    // Override global overflow:hidden from globals.css (needed for dashboard but breaks public pages)
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.height = 'auto';
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';

    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      // Restore for dashboard pages
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.style.overflow = '';
      document.body.style.height = '';
    };
  }, []);

  return (
    <div
      style={{
        background: '#060e1a',
        color: '#e2e8f0',
        minHeight: '100vh',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        overflowX: 'hidden',
      }}
    >
      {/* ── Sticky Navbar ── */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: scrolled ? 'rgba(6, 14, 26, 0.85)' : 'rgba(6, 14, 26, 0.6)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: scrolled
            ? '1px solid rgba(6, 182, 212, 0.15)'
            : '1px solid rgba(255,255,255,0.04)',
          padding: '0 24px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.3s ease',
        }}
      >
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <Image src="/logo-T-Cardio.png" alt="T-Cardio Pro" width={36} height={36} style={{ borderRadius: '8px' }} />
          <span style={{ color: '#06b6d4', fontWeight: 700, fontSize: '18px', letterSpacing: '-0.3px' }}>
            T-Cardio Pro
          </span>
        </Link>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Link
            href="/download"
            style={{
              color: '#94a3b8',
              fontSize: '14px',
              textDecoration: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              transition: 'color 0.2s',
            }}
          >
            Telecharger
          </Link>
          <Link
            href="/login"
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
              color: '#fff',
              padding: '9px 22px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 2px 12px rgba(6, 182, 212, 0.25)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
          >
            Se connecter
          </Link>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section
        style={{
          textAlign: 'center',
          padding: '56px 24px 40px',
          position: 'relative',
        }}
      >
        {/* Subtle glow behind hero */}
        <div
          style={{
            position: 'absolute',
            top: '-80px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '600px',
            height: '300px',
            background: 'radial-gradient(ellipse, rgba(6,182,212,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(6, 182, 212, 0.08)',
            border: '1px solid rgba(6, 182, 212, 0.15)',
            borderRadius: '100px',
            padding: '6px 18px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#06b6d4',
            fontWeight: 500,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Demonstrations video
        </div>
        <h1
          style={{
            fontSize: 'clamp(28px, 5vw, 44px)',
            fontWeight: 800,
            color: '#ffffff',
            margin: '0 0 12px',
            letterSpacing: '-0.5px',
            lineHeight: 1.15,
          }}
        >
          Decouvrez T-Cardio Pro{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            en action
          </span>
        </h1>
        <p
          style={{
            color: '#64748b',
            fontSize: 'clamp(15px, 2vw, 17px)',
            margin: '0 auto',
            maxWidth: '520px',
            lineHeight: 1.6,
          }}
        >
          Explorez les interfaces medecin et patient a travers nos demonstrations
          video interactives.
        </p>
      </section>

      {/* ── Demo Sections ── */}
      <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '0 20px' }}>
        {demos.map((demo, index) => (
          <section
            key={demo.id}
            style={{
              marginBottom: index < demos.length - 1 ? '80px' : '60px',
            }}
          >
            {/* Section header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '28px',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '3px',
                  background: demo.gradient,
                  borderRadius: '4px',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: `${demo.color}12`,
                    border: `1px solid ${demo.color}25`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {demo.icon}
                </div>
                <div>
                  <h2
                    style={{
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '22px',
                      margin: 0,
                      letterSpacing: '-0.3px',
                    }}
                  >
                    {demo.name}
                  </h2>
                  <span style={{ color: '#475569', fontSize: '13px' }}>{demo.subtitle}</span>
                </div>
              </div>
              <span
                style={{
                  marginLeft: 'auto',
                  background: `${demo.color}12`,
                  color: demo.color,
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '5px 14px',
                  borderRadius: '100px',
                  border: `1px solid ${demo.color}20`,
                  whiteSpace: 'nowrap',
                }}
              >
                {demo.duration}
              </span>
            </div>

            {/* Video container */}
            <div
              style={{
                background: '#0a0f1a',
                borderRadius: '16px',
                overflow: 'hidden',
                border: `1px solid ${demo.color}18`,
                boxShadow: `0 4px 60px ${demo.color}08, 0 0 0 1px rgba(255,255,255,0.02)`,
              }}
            >
              {/* Video title bar */}
              <div
                style={{
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: 'rgba(255,255,255,0.01)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: demo.color,
                      boxShadow: `0 0 8px ${demo.color}60`,
                    }}
                  />
                  <span style={{ fontWeight: 600, fontSize: '14px', color: '#cbd5e1' }}>
                    {demo.name}
                  </span>
                  <span style={{ color: '#334155', fontSize: '13px' }}>|</span>
                  <span style={{ color: '#475569', fontSize: '13px' }}>demo.mp4</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#1e293b' }} />
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#1e293b' }} />
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#1e293b' }} />
                </div>
              </div>

              {/* Video player */}
              <div style={{ background: '#000', aspectRatio: '16/9', position: 'relative' }}>
                <video
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                  controls
                  preload="metadata"
                  playsInline
                  poster=""
                >
                  <source src={demo.videoSrc} type="video/mp4" />
                  Votre navigateur ne supporte pas la lecture video.
                </video>
              </div>
            </div>

            {/* Info grid below video */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
                gap: '16px',
                marginTop: '20px',
              }}
            >
              {/* Description card */}
              <div
                onMouseEnter={() => setHoveredCard(`${demo.id}-desc`)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  position: 'relative',
                  background: '#0f172a',
                  borderRadius: '14px',
                  padding: '28px',
                  border:
                    hoveredCard === `${demo.id}-desc`
                      ? `1px solid ${demo.color}35`
                      : '1px solid rgba(255,255,255,0.05)',
                  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                  boxShadow:
                    hoveredCard === `${demo.id}-desc`
                      ? `0 4px 30px ${demo.color}10`
                      : 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '14px',
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={demo.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <h3 style={{ color: '#ffffff', fontWeight: 700, fontSize: '15px', margin: 0 }}>
                    A propos de cette demo
                  </h3>
                </div>
                <p
                  style={{
                    color: '#94a3b8',
                    fontSize: '14px',
                    lineHeight: 1.75,
                    margin: '0 0 24px',
                  }}
                >
                  {demo.description}
                </p>
                <Link
                  href="/download"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: demo.gradient,
                    color: '#fff',
                    padding: '10px 22px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    boxShadow: `0 2px 16px ${demo.color}30`,
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {demo.downloadLabel}
                </Link>
              </div>

              {/* Features card */}
              <div
                onMouseEnter={() => setHoveredCard(`${demo.id}-feat`)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  background: '#0f172a',
                  borderRadius: '14px',
                  padding: '28px',
                  border:
                    hoveredCard === `${demo.id}-feat`
                      ? `1px solid ${demo.color}35`
                      : '1px solid rgba(255,255,255,0.05)',
                  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                  boxShadow:
                    hoveredCard === `${demo.id}-feat`
                      ? `0 4px 30px ${demo.color}10`
                      : 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '14px',
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={demo.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                  </svg>
                  <h3 style={{ color: '#ffffff', fontWeight: 700, fontSize: '15px', margin: 0 }}>
                    Fonctionnalites cles
                  </h3>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {demo.features.map((f, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        fontSize: '13.5px',
                        color: '#cbd5e1',
                        lineHeight: 1.4,
                      }}
                    >
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          minWidth: '20px',
                          borderRadius: '6px',
                          background: `${demo.color}12`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: '1px',
                        }}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={demo.color}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Divider between sections */}
            {index < demos.length - 1 && (
              <div
                style={{
                  marginTop: '60px',
                  height: '1px',
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
                }}
              />
            )}
          </section>
        ))}
      </div>

      {/* ── CTA Section ── */}
      <section
        style={{
          maxWidth: '1120px',
          margin: '0 auto 60px',
          padding: '0 20px',
        }}
      >
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            textAlign: 'center',
            background: '#0f172a',
            borderRadius: '20px',
            padding: '56px 32px',
            border: '1px solid rgba(6, 182, 212, 0.1)',
          }}
        >
          {/* Glow effects */}
          <div
            style={{
              position: 'absolute',
              top: '-60px',
              left: '20%',
              width: '300px',
              height: '200px',
              background: 'radial-gradient(ellipse, rgba(6,182,212,0.06) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-60px',
              right: '20%',
              width: '300px',
              height: '200px',
              background: 'radial-gradient(ellipse, rgba(139,92,246,0.06) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(6, 182, 212, 0.15)',
              marginBottom: '20px',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>

          <h2
            style={{
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 'clamp(22px, 3.5vw, 30px)',
              margin: '0 0 10px',
              letterSpacing: '-0.3px',
            }}
          >
            Pret a transformer votre pratique cardiologique ?
          </h2>
          <p
            style={{
              color: '#64748b',
              fontSize: '15px',
              margin: '0 auto 28px',
              maxWidth: '460px',
              lineHeight: 1.6,
            }}
          >
            Telechargez les applications et commencez la telecardiologie
            intelligente des aujourd&apos;hui.
          </p>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <Link
              href="/download"
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                color: '#fff',
                padding: '13px 30px',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '15px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 20px rgba(6, 182, 212, 0.3)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Telecharger les APK
            </Link>
            <Link
              href="/login"
              style={{
                border: '1px solid rgba(139, 92, 246, 0.3)',
                background: 'rgba(139, 92, 246, 0.06)',
                color: '#c4b5fd',
                padding: '13px 30px',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '15px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'border-color 0.2s, background 0.2s',
              }}
            >
              Acceder a la version web
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          padding: '40px 24px',
          maxWidth: '1120px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Image src="/logo-T-Cardio.png" alt="T-Cardio Pro" width={28} height={28} style={{ borderRadius: '6px' }} />
            <span style={{ color: '#475569', fontSize: '13px' }}>
              &copy; 2026 T-Cardio Pro - Terrano Web Solutions
            </span>
          </div>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <Link href="/" style={{ color: '#475569', fontSize: '13px', textDecoration: 'none', transition: 'color 0.2s' }}>
              Accueil
            </Link>
            <Link href="/download" style={{ color: '#475569', fontSize: '13px', textDecoration: 'none', transition: 'color 0.2s' }}>
              Telecharger
            </Link>
            <Link href="/login" style={{ color: '#475569', fontSize: '13px', textDecoration: 'none', transition: 'color 0.2s' }}>
              Connexion
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
