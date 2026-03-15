'use client';

import { useEffect, useState } from 'react';
import { useAdStore } from '@/stores/adStore';
import { useActiveAds } from '@/hooks/useAdvertisements';

const POPUP_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export default function PopupAd() {
  useActiveAds();
  const popups = useAdStore((s) => s.popups);
  const [currentAd, setCurrentAd] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (popups.length === 0) return;

    const now = Date.now();
    const sortedPopups = [...popups].sort((a, b) => b.priority - a.priority);

    for (const popup of sortedPopups) {
      const lastShown = localStorage.getItem(`popup_shown_${popup.id}`);
      if (!lastShown || (now - parseInt(lastShown, 10)) > POPUP_COOLDOWN_MS) {
        setCurrentAd(popup);
        setVisible(true);
        break;
      }
    }
  }, [popups]);

  const handleClose = () => {
    if (currentAd) {
      localStorage.setItem(`popup_shown_${currentAd.id}`, String(Date.now()));
    }
    setVisible(false);
    setCurrentAd(null);
  };

  if (!visible || !currentAd) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl w-full max-w-md overflow-hidden animate-fadeIn">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-cardio-800/90 hover:bg-cardio-700 transition"
          aria-label="Fermer"
        >
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Image */}
        {currentAd.imageUrl && (
          <div className="relative w-full h-48 bg-gradient-to-br from-cardio-700 to-cardio-800">
            <img
              src={currentAd.imageUrl}
              alt={currentAd.title}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        {/* Content */}
        <div className="relative p-6">
          {!currentAd.imageUrl && (
            <button
              onClick={handleClose}
              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-cardio-700/50 transition"
              aria-label="Fermer"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 text-xs font-medium">
              Annonce
            </span>
          </div>

          <h3 className="text-lg font-bold text-slate-100 mb-2 pr-8">{currentAd.title}</h3>
          <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{currentAd.content}</p>

          <div className="flex gap-3 mt-5">
            {currentAd.linkUrl && (
              <a
                href={currentAd.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleClose}
                className="flex-1 glow-btn px-4 py-2.5 text-sm rounded-xl text-center"
              >
                En savoir plus
              </a>
            )}
            <button
              onClick={handleClose}
              className={`px-4 py-2.5 text-sm font-medium rounded-xl transition ${
                currentAd.linkUrl
                  ? 'text-slate-400 hover:bg-cardio-700/50'
                  : 'flex-1 bg-cardio-700/50 text-slate-300 hover:bg-cardio-700'
              }`}
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
