'use client';

interface CallControlsProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  callDuration: number;
  screenSharing?: boolean;
  onToggleScreenShare?: () => void;
  audioOnly?: boolean;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CallControls({
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  onEndCall,
  callDuration,
  screenSharing = false,
  onToggleScreenShare,
  audioOnly = false,
}: CallControlsProps) {
  return (
    <div className="relative flex items-center justify-center gap-2.5 sm:gap-4 py-3 sm:py-4 bg-gray-900/95 backdrop-blur-sm px-3">
      {/* Duration */}
      <div className="absolute left-2 sm:left-4 text-white/70 text-xs sm:text-sm font-mono tabular-nums">
        {formatDuration(callDuration)}
      </div>

      {/* Microphone toggle */}
      <button
        onClick={onToggleAudio}
        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
          audioEnabled
            ? 'bg-gray-700 hover:bg-gray-600 text-white'
            : 'bg-red-600 hover:bg-red-500 text-white'
        }`}
        title={audioEnabled ? 'Couper le micro' : 'Activer le micro'}
      >
        {audioEnabled ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 19L5 5m7 13.75a6 6 0 006-6v-1.5M5.25 11.25a6.002 6.002 0 006.033 6M12 18.75v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25" />
          </svg>
        )}
      </button>

      {/* Video toggle (hidden in audio-only mode) */}
      {!audioOnly && (
        <button
          onClick={onToggleVideo}
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
            videoEnabled
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-red-600 hover:bg-red-500 text-white'
          }`}
          title={videoEnabled ? 'Couper la camera' : 'Activer la camera'}
        >
          {videoEnabled ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9.75a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25H4.5A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 01-2.25-2.25V9m12.841 9.091L16.5 19.5m-1.409-.409l-7.182-7.182M3 3l18 18" />
            </svg>
          )}
        </button>
      )}

      {/* Screen share toggle */}
      {onToggleScreenShare && !audioOnly && (
        <button
          onClick={onToggleScreenShare}
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all hidden sm:flex ${
            screenSharing
              ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title={screenSharing ? 'Arreter le partage' : 'Partager l\'ecran'}
        >
          {screenSharing ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
          )}
        </button>
      )}

      {/* End call */}
      <button
        onClick={onEndCall}
        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-all shadow-lg shadow-red-600/30 hover:scale-105"
        title="Raccrocher"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
        </svg>
      </button>
    </div>
  );
}
