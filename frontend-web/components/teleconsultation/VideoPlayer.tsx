'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface VideoPlayerProps {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  className?: string;
  label?: string;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
}

export default function VideoPlayer({
  stream,
  muted = false,
  mirror = false,
  className = '',
  label,
  audioEnabled = true,
  videoEnabled = true,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playBlocked, setPlayBlocked] = useState(false);
  // Track whether we have a live video track — updated via event listeners
  const [hasLiveVideo, setHasLiveVideo] = useState(false);

  // Check if stream has a live video track and update state
  const checkVideoTracks = useCallback(() => {
    if (!stream) {
      setHasLiveVideo(false);
      return;
    }
    const videoTracks = stream.getVideoTracks();
    const isLive = videoTracks.some(t => t.enabled && t.readyState === 'live');
    setHasLiveVideo(isLive);
  }, [stream]);

  // Assign stream to video element + listen for loadedmetadata as a signal that frames are flowing
  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && stream) {
      videoEl.srcObject = stream;
      videoEl.play().catch((err) => {
        console.warn('Video autoplay blocked:', err?.message);
        if (err?.name === 'NotAllowedError') {
          setPlayBlocked(true);
        }
      });

      // When the video element receives actual frame data, recheck track state
      const onMetadata = () => checkVideoTracks();
      videoEl.addEventListener('loadedmetadata', onMetadata);

      checkVideoTracks();

      return () => {
        videoEl.removeEventListener('loadedmetadata', onMetadata);
      };
    }
    checkVideoTracks();
  }, [stream, checkVideoTracks]);

  // Listen for track state changes on the stream (unmute, ended, addtrack, removetrack)
  // This is CRITICAL for remote streams where video tracks start as 'muted' or arrive later
  useEffect(() => {
    if (!stream) return;

    const onTrackChange = () => checkVideoTracks();

    // Listen on all current video tracks for unmute/ended events
    const videoTracks = stream.getVideoTracks();
    videoTracks.forEach(track => {
      track.addEventListener('unmute', onTrackChange);
      track.addEventListener('mute', onTrackChange);
      track.addEventListener('ended', onTrackChange);
    });

    // When new tracks are added to the stream dynamically, attach listeners to them too
    const onAddTrack = (event: MediaStreamTrackEvent) => {
      if (event.track.kind === 'video') {
        event.track.addEventListener('unmute', onTrackChange);
        event.track.addEventListener('mute', onTrackChange);
        event.track.addEventListener('ended', onTrackChange);
      }
      onTrackChange();
    };

    stream.addEventListener('addtrack', onAddTrack);
    stream.addEventListener('removetrack', onTrackChange);

    // Initial check
    checkVideoTracks();

    // Poll PERMANENTLY at 1s intervals as a safety net for all edge cases
    // (cheap operation: just reads track properties)
    const pollInterval = setInterval(checkVideoTracks, 1000);

    return () => {
      videoTracks.forEach(track => {
        track.removeEventListener('unmute', onTrackChange);
        track.removeEventListener('mute', onTrackChange);
        track.removeEventListener('ended', onTrackChange);
      });
      stream.removeEventListener('addtrack', onAddTrack);
      stream.removeEventListener('removetrack', onTrackChange);
      clearInterval(pollInterval);
    };
  }, [stream, checkVideoTracks]);

  // Dedicated audio element for reliable remote audio playback
  // This ensures audio plays even when video is hidden (audio-only calls)
  useEffect(() => {
    if (!stream || muted) return;

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    // Create an audio-only MediaStream from the remote stream's audio tracks
    const audioStream = new MediaStream(audioTracks);

    if (audioRef.current) {
      audioRef.current.srcObject = audioStream;
      audioRef.current.play().catch((err) => {
        console.warn('Audio autoplay blocked:', err.message);
        setPlayBlocked(true);
      });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
    };
  }, [stream, muted]);

  // User gesture to resume playback if autoplay was blocked
  const handleResumeAudio = () => {
    if (audioRef.current) {
      audioRef.current.play().then(() => setPlayBlocked(false)).catch(() => {});
    }
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const showPlaceholder = !stream || !videoEnabled || !hasLiveVideo;

  return (
    <div className={`relative overflow-hidden bg-gray-900 ${className}`}>
      {showPlaceholder ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-3">
              <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            {!videoEnabled && (
              <p className="text-slate-400 text-xs">Camera desactivee</p>
            )}
          </div>
        </div>
      ) : null}

      {/* Hidden audio element — guarantees audio even when video is opacity-0 */}
      {!muted && <audio ref={audioRef} autoPlay playsInline />}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`w-full h-full object-cover ${mirror ? 'scale-x-[-1]' : ''} ${showPlaceholder ? 'opacity-0 absolute' : ''}`}
      />

      {/* Autoplay blocked banner — user must click to resume audio */}
      {playBlocked && !muted && (
        <button
          onClick={handleResumeAudio}
          className="absolute top-2 right-2 z-10 glow-btn text-xs px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 transition animate-pulse"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
          </svg>
          Activer le son
        </button>
      )}

      {/* Label overlay */}
      {label && (
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
          <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
            {label}
          </span>
          {!audioEnabled && (
            <span className="bg-red-600/80 text-white p-1 rounded-md" title="Micro coupe">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 19L5 5m0 0l14 14M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
