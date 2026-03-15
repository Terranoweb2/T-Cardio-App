'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { useWebRTC, CallState } from '@/hooks/useWebRTC';
import { useSocket } from '@/contexts/SocketContext';
import VideoPlayer from './VideoPlayer';
import CallControls from './CallControls';
import IncomingCallModal from './IncomingCallModal';
import { startCallForegroundService, stopCallForegroundService } from '@/lib/background-service';

interface VideoCallProps {
  socket: Socket | null;
  teleconsultationId: string;
  userId: string;
  userName?: string;
  remoteName?: string;
  isActive: boolean;
  doctorAvailableToday?: boolean;
  onEmergencyCall?: () => void;
  emergencyActive?: boolean;
  autoAccept?: boolean;
  onAutoAcceptHandled?: () => void;
}

export default function VideoCall({
  socket,
  teleconsultationId,
  userId,
  userName = 'Vous',
  remoteName = 'Correspondant',
  isActive,
  doctorAvailableToday,
  onEmergencyCall,
  emergencyActive,
  autoAccept,
  onAutoAcceptHandled,
}: VideoCallProps) {
  const {
    callState,
    localStream,
    remoteStream,
    audioEnabled,
    videoEnabled,
    remoteAudioEnabled,
    remoteVideoEnabled,
    callDuration,
    incomingFrom,
    audioOnly,
    screenSharing,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  } = useWebRTC({
    socket,
    teleconsultationId,
    userId,
  });

  // Listen for incoming call via the global emergency socket (SocketContext)
  // This handles the case where the user is already on the teleconsultation page
  // and receives an incoming call notification
  const { incomingCall, dismissIncomingCall } = useSocket();
  const [showIncomingFromGlobal, setShowIncomingFromGlobal] = useState(false);

  // Track when the global incoming call matches this teleconsultation
  useEffect(() => {
    if (
      incomingCall &&
      incomingCall.teleconsultationId === teleconsultationId &&
      (callState === 'idle' || callState === 'incoming')
    ) {
      console.log('[VideoCall] Incoming call from global socket detected');
      setShowIncomingFromGlobal(true);
    }
    // If the incoming call was for a different teleconsultation, or call already started, clear
    if (incomingCall && incomingCall.teleconsultationId !== teleconsultationId) {
      setShowIncomingFromGlobal(false);
    }
  }, [incomingCall, teleconsultationId, callState]);

  // Clear showIncomingFromGlobal when callState transitions away from idle/incoming
  useEffect(() => {
    if (callState !== 'idle' && callState !== 'incoming' && showIncomingFromGlobal) {
      // Only clear if we transitioned to calling/connected (i.e., call was accepted)
      if (callState === 'calling' || callState === 'connected') {
        setShowIncomingFromGlobal(false);
      }
    }
  }, [callState, showIncomingFromGlobal]);

  const handleAcceptFromGlobal = useCallback(() => {
    console.log('[VideoCall] Accepting call from global incoming notification');
    setShowIncomingFromGlobal(false);
    dismissIncomingCall();
    acceptCall();
  }, [acceptCall, dismissIncomingCall]);

  const handleRejectFromGlobal = useCallback(() => {
    console.log('[VideoCall] Rejecting call from global incoming notification');
    setShowIncomingFromGlobal(false);
    dismissIncomingCall();
    rejectCall();
  }, [rejectCall, dismissIncomingCall]);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // PiP draggable state
  const [pipPos, setPipPos] = useState({ x: -1, y: -1 }); // -1 = default position
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const pipRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // PiP drag handlers (mouse + touch)
  const handlePipDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const container = videoContainerRef.current;
    const pip = pipRef.current;
    if (!container || !pip) return;

    const containerRect = container.getBoundingClientRect();
    const pipRect = pip.getBoundingClientRect();

    // If first drag and using default position, calculate current position
    const currentX = pipPos.x === -1 ? pipRect.left - containerRect.left : pipPos.x;
    const currentY = pipPos.y === -1 ? pipRect.top - containerRect.top : pipPos.y;

    dragRef.current = { startX: clientX, startY: clientY, startPosX: currentX, startPosY: currentY };
    setIsDragging(true);
  }, [pipPos]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current || !videoContainerRef.current || !pipRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const containerRect = videoContainerRef.current.getBoundingClientRect();
      const pipRect = pipRef.current.getBoundingClientRect();

      let newX = dragRef.current.startPosX + (clientX - dragRef.current.startX);
      let newY = dragRef.current.startPosY + (clientY - dragRef.current.startY);

      // Bounds checking
      newX = Math.max(4, Math.min(newX, containerRect.width - pipRect.width - 4));
      newY = Math.max(4, Math.min(newY, containerRect.height - pipRect.height - 4));

      setPipPos({ x: newX, y: newY });
    };

    const handleEnd = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  // Auto-accept incoming call when redirected from global incoming call modal
  // ONLY accept when callState === 'incoming' — the offer has been received and processed
  // Never auto-accept from 'idle' state (the offer hasn't arrived yet → no PeerConnection)
  const autoAcceptHandled = useRef(false);
  useEffect(() => {
    if (autoAccept && !autoAcceptHandled.current && callState === 'incoming') {
      autoAcceptHandled.current = true;
      const timer = setTimeout(() => {
        console.log('[VideoCall] Auto-accepting call (incoming state confirmed)');
        acceptCall();
        onAutoAcceptHandled?.();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [autoAccept, callState, acceptCall, onAutoAcceptHandled]);

  // Foreground service: keep app alive during calls (Android)
  useEffect(() => {
    if (callState === 'connected' || callState === 'calling') {
      startCallForegroundService();
    } else {
      stopCallForegroundService();
    }
    return () => {
      stopCallForegroundService();
    };
  }, [callState]);

  const remoteLabel = remoteName.startsWith('Dr.') ? 'medecin' : 'patient';

  // Show incoming call modal (from teleconsultation socket OR emergency socket)
  if (callState === 'incoming' || showIncomingFromGlobal) {
    return (
      <IncomingCallModal
        callerName={showIncomingFromGlobal && incomingCall ? incomingCall.callerName : remoteName}
        onAccept={showIncomingFromGlobal ? handleAcceptFromGlobal : acceptCall}
        onReject={showIncomingFromGlobal ? handleRejectFromGlobal : rejectCall}
      />
    );
  }

  // Idle state — show call buttons
  if (callState === 'idle' && isActive) {
    return (
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 sm:p-6 border border-gray-700">
        <div className="text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-cyan-600/20 flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9.75a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25H4.5A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">Teleconsultation</h3>

          {doctorAvailableToday === false ? (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 sm:p-4 mb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <span className="text-yellow-400 font-medium text-sm">Indisponible aujourd&apos;hui</span>
              </div>
              <p className="text-slate-400 text-xs sm:text-sm">
                Votre medecin ne prend pas de teleconsultations aujourd&apos;hui.
              </p>
              <p className="text-slate-500 text-xs mt-1">
                Les appels normaux sont desactives. Utilisez le bouton d&apos;urgence si necessaire.
              </p>
            </div>
          ) : (
            <>
              <p className="text-slate-400 text-xs sm:text-sm mb-4 sm:mb-5">
                Demarrez un appel avec votre {remoteLabel}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                <button
                  onClick={() => startCall()}
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-medium transition-all hover:scale-105 shadow-lg shadow-green-600/25 flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9.75a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25H4.5A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  Appel video
                </button>
                <button
                  onClick={() => startCall({ audioOnly: true })}
                  className="w-full sm:w-auto bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-medium transition-all hover:scale-105 shadow-lg shadow-gray-700/25 flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                  Appel audio
                </button>
              </div>
            </>
          )}

          {onEmergencyCall && (
            <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-700">
              <button
                onClick={onEmergencyCall}
                disabled={emergencyActive}
                className={`px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-medium transition-all flex items-center gap-2 mx-auto text-sm sm:text-base ${
                  emergencyActive
                    ? 'bg-red-800 text-red-200 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-500 text-white hover:scale-105 shadow-lg shadow-red-600/25 animate-pulse'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                {emergencyActive ? 'URGENCE ENVOYEE' : 'URGENCE'}
              </button>
              {emergencyActive && (
                <p className="text-green-400 text-xs mt-2">
                  Votre medecin a ete notifie. Restez en ligne.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Calling (ringing) — waiting for remote to accept
  if (callState === 'calling') {
    return (
      <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-700">
        <div className="relative aspect-video max-h-[60vh] sm:max-h-[500px]">
          {audioOnly ? (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 min-h-[200px]">
              <div className="text-center px-4">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <svg className="w-10 h-10 sm:w-12 sm:h-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div className="flex items-center gap-2 justify-center mb-2 sm:mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-white text-base sm:text-lg font-medium">Appel audio en cours...</span>
                </div>
                <p className="text-gray-300 text-xs sm:text-sm">En attente de {remoteName}</p>
              </div>
            </div>
          ) : (
            <>
              <VideoPlayer
                stream={localStream}
                muted
                mirror
                className="w-full h-full rounded-t-xl"
                label={userName}
                videoEnabled={videoEnabled}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="text-center px-4">
                  <div className="flex items-center gap-2 mb-2 sm:mb-3 justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-white text-base sm:text-lg font-medium">Appel en cours...</span>
                  </div>
                  <p className="text-gray-300 text-xs sm:text-sm">En attente de {remoteName}</p>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex justify-center py-3 sm:py-4 bg-gray-900">
          <button
            onClick={() => endCall('cancelled')}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-all"
            title="Annuler"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Connected - full call UI
  if (callState === 'connected') {
    const pipStyle: React.CSSProperties = pipPos.x !== -1 ? {
      position: 'absolute',
      left: `${pipPos.x}px`,
      top: `${pipPos.y}px`,
      right: 'auto',
    } : {};

    return (
      <div
        ref={videoContainerRef}
        className={`bg-gray-900 rounded-xl overflow-hidden border border-gray-700 shadow-2xl ${isFullscreen ? 'flex flex-col h-full' : ''}`}
      >
        {/* Video/Audio area */}
        <div className={`relative ${isFullscreen ? 'flex-1' : 'aspect-video max-h-[60vh] sm:max-h-[500px]'}`}>
          {audioOnly ? (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 min-h-[200px]">
              <VideoPlayer
                stream={remoteStream}
                className="hidden"
                audioEnabled={remoteAudioEnabled}
                videoEnabled={false}
              />
              <div className="text-center px-4">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-green-600/20 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <svg className="w-10 h-10 sm:w-12 sm:h-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <p className="text-white font-medium text-base sm:text-lg">{remoteName}</p>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">Appel audio en cours</p>
                {!remoteAudioEnabled && (
                  <p className="text-yellow-400 text-xs mt-2 flex items-center justify-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 19L5 5m7 13.75a6 6 0 006-6v-1.5M5.25 11.25a6.002 6.002 0 006.033 6M12 18.75v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25" />
                    </svg>
                    Micro coupe
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Remote video (main) */}
              <VideoPlayer
                stream={remoteStream}
                className="w-full h-full"
                label={remoteName}
                audioEnabled={remoteAudioEnabled}
                videoEnabled={remoteVideoEnabled}
              />

              {/* Local video (PiP overlay - draggable) */}
              <div
                ref={pipRef}
                onMouseDown={handlePipDragStart}
                onTouchStart={handlePipDragStart}
                className={`absolute w-24 h-[68px] sm:w-36 sm:h-[100px] md:w-40 md:h-28 rounded-lg overflow-hidden shadow-lg border-2 border-gray-600 z-10 cursor-grab active:cursor-grabbing select-none ${isDragging ? '' : 'transition-all'} ${pipPos.x === -1 ? 'top-2 right-2 sm:top-3 sm:right-3' : ''}`}
                style={pipStyle}
              >
                <VideoPlayer
                  stream={localStream}
                  muted
                  mirror
                  className="w-full h-full"
                  videoEnabled={videoEnabled}
                />
              </div>

              {/* Fullscreen toggle button */}
              <button
                onClick={toggleFullscreen}
                className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 w-8 h-8 sm:w-9 sm:h-9 bg-black/50 hover:bg-black/70 rounded-lg flex items-center justify-center backdrop-blur-sm z-10 transition-all"
                title={isFullscreen ? 'Quitter plein ecran' : 'Plein ecran'}
              >
                {isFullscreen ? (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                )}
              </button>

              {/* Screen sharing indicator */}
              {screenSharing && (
                <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex items-center gap-1.5 bg-cyan-600/80 rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 backdrop-blur-sm">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                  </svg>
                  <span className="text-white text-[10px] sm:text-xs">Partage</span>
                </div>
              )}

              {/* Connection quality indicator */}
              {!screenSharing && (
                <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex items-center gap-1 sm:gap-1.5 bg-black/50 rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 backdrop-blur-sm">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-400" />
                  <span className="text-white text-[10px] sm:text-xs">Connecte</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        <CallControls
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onEndCall={() => endCall()}
          callDuration={callDuration}
          screenSharing={screenSharing}
          onToggleScreenShare={toggleScreenShare}
          audioOnly={audioOnly}
        />
      </div>
    );
  }

  // Ended state
  if (callState === 'ended') {
    return (
      <div className="bg-gray-900 rounded-xl p-6 sm:p-8 border border-gray-700 text-center">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-3 sm:mb-4">
          <svg className="w-7 h-7 sm:w-8 sm:h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
          </svg>
        </div>
        <p className="text-slate-400 text-sm">Appel termine</p>
      </div>
    );
  }

  // Default: not active consultation
  return null;
}
