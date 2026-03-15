'use client';

import { useAdStore } from '@/stores/adStore';
import { useActiveAds } from '@/hooks/useAdvertisements';

export default function TickerBanner() {
  useActiveAds();
  const tickers = useAdStore((s) => s.tickers);
  const tickerDismissed = useAdStore((s) => s.tickerDismissed);
  const dismissTicker = useAdStore((s) => s.dismissTicker);

  if (tickerDismissed || tickers.length === 0) return null;

  const messages = tickers
    .sort((a, b) => b.priority - a.priority)
    .map((t) => ({ text: t.content, linkUrl: t.linkUrl, id: t.id }));

  return (
    <div className="relative bg-gradient-to-r from-cardio-800 via-cardio-700 to-cardio-800 border-y border-cyan-500/10 text-white overflow-hidden">
      <button
        onClick={dismissTicker}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
        aria-label="Masquer le bandeau"
      >
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="py-2 pr-10">
        <div className="ticker-scroll flex whitespace-nowrap">
          {[0, 1].map((pass) => (
            <div key={pass} className="flex items-center shrink-0">
              {messages.map((msg, idx) => (
                <span key={`${pass}-${msg.id}-${idx}`} className="inline-flex items-center">
                  {msg.linkUrl ? (
                    <a
                      href={msg.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-cyan-300 hover:text-cyan-200 hover:underline cursor-pointer px-2"
                    >
                      {msg.text}
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-slate-300 px-2">{msg.text}</span>
                  )}
                  {idx < messages.length - 1 && (
                    <span className="text-cyan-500/50 mx-3">&bull;</span>
                  )}
                  {idx === messages.length - 1 && (
                    <span className="text-cyan-500/50 mx-6">&bull;&bull;&bull;</span>
                  )}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
