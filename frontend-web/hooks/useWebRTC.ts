'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { Socket } from 'socket.io-client';

// ICE servers for NAT traversal
// STUN for direct connections + TURN as fallback for symmetric NAT (mobile 4G/LTE)
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:161.35.110.36:3478',
      username: 'tcardio',
      credential: 'tcardio2026turn',
    },
    {
      urls: 'turn:161.35.110.36:3478?transport=tcp',
      username: 'tcardio',
      credential: 'tcardio2026turn',
    },
  ],
  iceTransportPolicy: 'all',
};

export type CallState = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';

interface UseWebRTCOptions {
  socket: Socket | null;
  teleconsultationId: string;
  userId: string;
  onCallStateChange?: (state: CallState) => void;
}

export function useWebRTC({ socket, teleconsultationId, userId, onCallStateChange }: UseWebRTCOptions) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(true);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [incomingFrom, setIncomingFrom] = useState<string | null>(null);
  const [audioOnly, setAudioOnly] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Flag to prevent recursive endCall from onconnectionstatechange → close → onconnectionstatechange
  const isEndingRef = useRef(false);
  // Flag to track that acceptCall was called and getLocalStream is pending
  const pendingAcceptRef = useRef(false);

  // Ref to track callState without causing re-registrations of socket handlers
  const callStateRef = useRef<CallState>('idle');
  callStateRef.current = callState;

  // Keep socket ref current for callbacks inside peerConnection handlers
  const socketRef = useRef<Socket | null>(null);
  socketRef.current = socket;

  const teleconsultationIdRef = useRef(teleconsultationId);
  teleconsultationIdRef.current = teleconsultationId;

  const updateCallState = useCallback((state: CallState) => {
    callStateRef.current = state;
    setCallState(state);
    onCallStateChange?.(state);
  }, [onCallStateChange]);

  // Call duration timer
  useEffect(() => {
    if (callState === 'connected') {
      setCallDuration(0);
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [callState]);

  // Cleanup helpers (defined BEFORE endCall to avoid circular deps)
  const cleanupPeerConnection = useCallback(() => {
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    if (peerConnectionRef.current) {
      // Remove event handlers before closing to prevent recursive triggers
      const pc = peerConnectionRef.current;
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
      peerConnectionRef.current = null;
    }
    remoteStreamRef.current = new MediaStream();
    setRemoteStream(null);
    iceCandidateQueue.current = [];
  }, []);

  const cleanupMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    setLocalStream(null);
    setAudioEnabled(true);
    setVideoEnabled(true);
    setScreenSharing(false);
    setAudioOnly(false);
  }, []);

  // End an active call — uses refs to always have current socket/teleconsultationId
  const endCall = useCallback((reason = 'user_hangup') => {
    // Prevent recursive calls (close triggers onconnectionstatechange → endCall again)
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    console.log(`[WebRTC] endCall called with reason: ${reason}, state: ${callStateRef.current}`);

    if (socketRef.current) {
      socketRef.current.emit('call_end', {
        teleconsultationId: teleconsultationIdRef.current,
        reason,
      });
    }
    updateCallState('ended');
    cleanupPeerConnection();
    cleanupMedia();
    setIncomingFrom(null);
    setScreenSharing(false);
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }

    // Reset to idle after brief delay
    setTimeout(() => {
      updateCallState('idle');
      setCallDuration(0);
      isEndingRef.current = false;
    }, 2000);
  }, [updateCallState, cleanupPeerConnection, cleanupMedia]);

  // Store endCall in ref so peerConnection handlers always have the latest version
  const endCallRef = useRef(endCall);
  endCallRef.current = endCall;

  // Get local media stream
  const getLocalStream = useCallback(async (options?: { audioOnly?: boolean }) => {
    const isAudioOnly = options?.audioOnly ?? false;
    setAudioOnly(isAudioOnly);

    try {
      const constraints: MediaStreamConstraints = isAudioOnly
        ? {
            video: false,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          }
        : {
            video: {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              facingMode: 'user',
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (isAudioOnly) setVideoEnabled(false);
      return stream;
    } catch (err: any) {
      console.error('Failed to get media devices:', err);
      // Try audio only if video fails
      if (!isAudioOnly) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          localStreamRef.current = stream;
          setLocalStream(stream);
          setVideoEnabled(false);
          setAudioOnly(true);
          return stream;
        } catch (audioErr) {
          console.error('Failed to get any media device:', audioErr);
          throw audioErr;
        }
      }
      throw err;
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    // Close any existing connection first
    if (peerConnectionRef.current) {
      const old = peerConnectionRef.current;
      old.onicecandidate = null;
      old.ontrack = null;
      old.onconnectionstatechange = null;
      old.oniceconnectionstatechange = null;
      old.close();
      peerConnectionRef.current = null;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    console.log('[WebRTC] PeerConnection created');

    // Handle remote tracks
    // CRITICAL: ontrack fires once per track (audio, then video). Both times event.streams[0]
    // is the SAME MediaStream object. If we call setRemoteStream(sameRef), React's Object.is()
    // comparison returns true and SKIPS the re-render. Fix: create a new MediaStream wrapper
    // each time to guarantee React always sees a new reference and re-renders VideoPlayer.
    pc.ontrack = (event) => {
      const track = event.track;
      console.log(`[WebRTC] ontrack: kind=${track.kind}, readyState=${track.readyState}, muted=${track.muted}`);

      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
      } else {
        // Fallback: manually accumulate tracks (older browsers)
        const existingTracks = remoteStreamRef.current.getTracks();
        if (!existingTracks.find(t => t.id === track.id)) {
          remoteStreamRef.current.addTrack(track);
        }
      }

      // Log all tracks for debugging
      const allTracks = remoteStreamRef.current.getTracks();
      console.log(`[WebRTC] Remote stream: ${allTracks.length} tracks: ${allTracks.map(t => `${t.kind}(${t.readyState})`).join(', ')}`);

      // Create a NEW MediaStream to force React re-render (same underlying tracks, new wrapper)
      setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
    };

    // Handle ICE candidates — use socketRef for current socket
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc_ice_candidate', {
          teleconsultationId: teleconsultationIdRef.current,
          targetUserId: '',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Log ICE gathering state
    pc.onicegatheringstatechange = () => {
      console.log(`[WebRTC] ICE gathering state: ${pc.iceGatheringState}`);
    };

    // Monitor connection state
    // Uses endCallRef.current so it always calls the latest endCall
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[WebRTC] Connection state: ${state}, call state: ${callStateRef.current}`);

      if (state === 'connected') {
        // Clear any pending disconnect timer
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
        updateCallState('connected');
      } else if (state === 'failed') {
        // ICE failed — try ICE restart first before giving up
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
        if (callStateRef.current === 'connected' || callStateRef.current === 'calling') {
          console.log('[WebRTC] Connection failed — attempting ICE restart...');
          try {
            // ICE restart: create a new offer with iceRestart flag
            pc.createOffer({ iceRestart: true }).then(async (offer) => {
              await pc.setLocalDescription(offer);
              socketRef.current?.emit('webrtc_offer', {
                teleconsultationId: teleconsultationIdRef.current,
                targetUserId: '',
                sdp: { type: offer.type, sdp: offer.sdp },
              });
              console.log('[WebRTC] ICE restart offer sent');
              // Give the restart 15 seconds to recover
              disconnectTimerRef.current = setTimeout(() => {
                disconnectTimerRef.current = null;
                const currentPcState = peerConnectionRef.current?.connectionState;
                if (currentPcState !== 'connected') {
                  console.log('[WebRTC] ICE restart failed — ending call');
                  endCallRef.current('connection_lost');
                }
              }, 15000);
            }).catch((err) => {
              console.error('[WebRTC] ICE restart failed:', err);
              endCallRef.current('connection_lost');
            });
          } catch (err) {
            console.error('[WebRTC] ICE restart error:', err);
            endCallRef.current('connection_lost');
          }
        }
      } else if (state === 'disconnected') {
        // Temporary disconnection — attempt ICE restart and wait 30 seconds
        // WebRTC may recover automatically (e.g., network switch, brief hiccup)
        if (!disconnectTimerRef.current && callStateRef.current === 'connected') {
          console.log('[WebRTC] Disconnected — attempting ICE restart, waiting 30s...');
          // Attempt ICE restart proactively
          try {
            pc.createOffer({ iceRestart: true }).then(async (offer) => {
              await pc.setLocalDescription(offer);
              socketRef.current?.emit('webrtc_offer', {
                teleconsultationId: teleconsultationIdRef.current,
                targetUserId: '',
                sdp: { type: offer.type, sdp: offer.sdp },
              });
              console.log('[WebRTC] ICE restart offer sent (from disconnected state)');
            }).catch((err) => {
              console.warn('[WebRTC] ICE restart from disconnected failed:', err);
            });
          } catch (err) {
            console.warn('[WebRTC] ICE restart error (disconnected):', err);
          }

          disconnectTimerRef.current = setTimeout(() => {
            disconnectTimerRef.current = null;
            // Re-check: only end if still disconnected AND still in active call
            const currentPcState = peerConnectionRef.current?.connectionState;
            if (currentPcState === 'disconnected' || currentPcState === 'failed') {
              console.log('[WebRTC] Still disconnected after 30s — ending call');
              if (callStateRef.current === 'connected') {
                endCallRef.current('connection_lost');
              }
            } else {
              console.log(`[WebRTC] Connection recovered to: ${currentPcState}`);
            }
          }, 30000);
        }
      }
      // 'closed' state: do nothing — this is triggered by our own close() call
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE connection state: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        // Clear disconnect timer if ICE recovers
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
        // Only transition to 'connected' if we're in 'calling' state
        if (callStateRef.current === 'calling') {
          updateCallState('connected');
        }
      } else if (pc.iceConnectionState === 'failed') {
        // ICE negotiation failed — try ICE restart
        console.log('[WebRTC] ICE connection failed — attempting restart via iceconnectionstate');
        if (callStateRef.current === 'connected' || callStateRef.current === 'calling') {
          pc.createOffer({ iceRestart: true }).then(async (offer) => {
            await pc.setLocalDescription(offer);
            socketRef.current?.emit('webrtc_offer', {
              teleconsultationId: teleconsultationIdRef.current,
              targetUserId: '',
              sdp: { type: offer.type, sdp: offer.sdp },
            });
            console.log('[WebRTC] ICE restart offer sent (from ICE failed)');
          }).catch((err) => {
            console.error('[WebRTC] ICE restart from ICE failed:', err);
          });
        }
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [updateCallState]);

  // Start a call (initiator)
  const startCall = useCallback(async (options?: { audioOnly?: boolean }) => {
    if (!socket) return;
    isEndingRef.current = false;

    try {
      updateCallState('calling');

      const stream = await getLocalStream(options);
      const pc = createPeerConnection();

      // Add local tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Signal call start
      socket.emit('call_start', { teleconsultationId });

      // Create and send offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      socket.emit('webrtc_offer', {
        teleconsultationId,
        targetUserId: '',
        sdp: { type: offer.type, sdp: offer.sdp },
      });

      console.log('[WebRTC] Offer sent');
    } catch (err) {
      console.error('Failed to start call:', err);
      updateCallState('idle');
      cleanupMedia();
    }
  }, [socket, teleconsultationId, getLocalStream, createPeerConnection, updateCallState, cleanupMedia]);

  // Accept an incoming call
  // CRITICAL: Get local stream BEFORE any signaling to ensure tracks are in the SDP answer.
  // Only ONE path should create the SDP answer (guard via pc.localDescription check).
  const acceptCall = useCallback(async () => {
    if (!socket) return;
    isEndingRef.current = false;
    pendingAcceptRef.current = true;

    try {
      // Step 1: Get local stream FIRST — before any signaling
      // This ensures tracks are ready before the answer SDP is created
      const stream = await getLocalStream();
      console.log('[WebRTC] acceptCall: Local stream acquired:', stream.getTracks().map(t => `${t.kind}:${t.readyState}`).join(', '));

      // Step 2: Add tracks to PeerConnection IMMEDIATELY
      // IMPORTANT: After setRemoteDescription(offer), PC creates transceivers with senders
      // that have track=null. So getSenders().length > 0 even without tracks attached.
      // We must check if any sender actually has a track, not just the array length.
      const pc = peerConnectionRef.current;
      if (pc) {
        const senders = pc.getSenders();
        const hasTracksAttached = senders.some(s => s.track !== null);
        if (!hasTracksAttached) {
          stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
          });
          console.log('[WebRTC] acceptCall: Tracks added to PeerConnection');
        } else {
          console.log('[WebRTC] acceptCall: Senders already have tracks, skipping addTrack');
        }
      }

      // Step 3: Signal acceptance AFTER tracks are ready
      socket.emit('call_accept', { teleconsultationId });
      updateCallState('calling');
      pendingAcceptRef.current = false;

      // Step 4: If handleOffer already set remoteDescription, create answer now
      // Guard: only if no answer has been created yet (prevents double-answer race)
      if (pc && pc.remoteDescription && !pc.localDescription) {
        console.log('[WebRTC] acceptCall: Remote description exists, creating answer with tracks');
        const answer = await pc.createAnswer();

        // Log SDP to verify video direction is sendrecv (not recvonly)
        const answerSdp = answer.sdp || '';
        const mediaLines = answerSdp.split('\n').filter((l: string) =>
          l.startsWith('m=') || l.startsWith('a=sendrecv') ||
          l.startsWith('a=recvonly') || l.startsWith('a=sendonly') || l.startsWith('a=inactive')
        );
        console.log('[WebRTC] acceptCall: Answer SDP media directions:', mediaLines.join(' | '));

        await pc.setLocalDescription(answer);

        socket.emit('webrtc_answer', {
          teleconsultationId,
          targetUserId: '',
          sdp: { type: answer.type, sdp: answer.sdp },
        });

        console.log('[WebRTC] acceptCall: Answer sent (tracks included in SDP)');

        // Process queued ICE candidates
        while (iceCandidateQueue.current.length > 0) {
          const candidate = iceCandidateQueue.current.shift()!;
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } else {
        console.log('[WebRTC] acceptCall: Waiting for handleOffer to create answer');
      }
    } catch (err) {
      console.error('Failed to accept call:', err);
      pendingAcceptRef.current = false;
      updateCallState('idle');
      cleanupMedia();
    }
  }, [socket, teleconsultationId, getLocalStream, updateCallState, cleanupMedia]);

  // Reject / decline incoming call
  const rejectCall = useCallback(() => {
    if (!socket) return;
    socket.emit('call_end', { teleconsultationId, reason: 'rejected' });
    updateCallState('idle');
    setIncomingFrom(null);
    cleanupPeerConnection();
    cleanupMedia();
  }, [socket, teleconsultationId, updateCallState, cleanupPeerConnection, cleanupMedia]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
        socket?.emit('media_toggle', {
          teleconsultationId,
          kind: 'audio',
          enabled: audioTrack.enabled,
        });
      }
    }
  }, [socket, teleconsultationId]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
        socket?.emit('media_toggle', {
          teleconsultationId,
          kind: 'video',
          enabled: videoTrack.enabled,
        });
      }
    }
  }, [socket, teleconsultationId]);

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !socket) return;

    if (screenSharing) {
      // Stop screen sharing, restore camera
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }

      // Restore camera track
      const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
      if (cameraTrack) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(cameraTrack);
        }
      }

      setScreenSharing(false);
      socket.emit('media_toggle', {
        teleconsultationId,
        kind: 'screen',
        enabled: false,
      });
    } else {
      // Start screen sharing
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        // Replace the video track in peer connection
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(screenTrack);
        }

        setScreenSharing(true);
        socket.emit('media_toggle', {
          teleconsultationId,
          kind: 'screen',
          enabled: true,
        });

        // When user stops sharing via browser UI
        screenTrack.onended = async () => {
          const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
          if (cameraTrack && sender) {
            await sender.replaceTrack(cameraTrack);
          }
          setScreenSharing(false);
          screenStreamRef.current = null;
          socket.emit('media_toggle', {
            teleconsultationId,
            kind: 'screen',
            enabled: false,
          });
        };
      } catch (err) {
        console.error('Screen sharing failed:', err);
        // User cancelled the screen picker
      }
    }
  }, [socket, teleconsultationId, screenSharing]);

  // Socket event handlers — registered ONCE, using refs for mutable state
  useEffect(() => {
    if (!socket) return;

    // Incoming call (via teleconsultation socket — in-room)
    const handleCallIncoming = (data: { fromUserId: string; teleconsultationId: string }) => {
      console.log('[WebRTC] call_incoming received, current state:', callStateRef.current);
      if (callStateRef.current !== 'idle') return;
      setIncomingFrom(data.fromUserId);
      updateCallState('incoming');
    };

    // Call accepted by remote
    const handleCallAccepted = (data: { fromUserId: string }) => {
      console.log('[WebRTC] call_accepted by remote:', data.fromUserId);
      // The peer that started the call knows the remote accepted — WebRTC will connect via offer/answer
    };

    // Call ended by remote
    const handleCallEnded = (data: { fromUserId: string; reason: string }) => {
      console.log(`[WebRTC] call_ended by remote: ${data.fromUserId}, reason: ${data.reason}`);
      if (isEndingRef.current) return; // Already ending
      isEndingRef.current = true;
      updateCallState('ended');
      cleanupPeerConnection();
      cleanupMedia();
      setIncomingFrom(null);
      setTimeout(() => {
        updateCallState('idle');
        setCallDuration(0);
        isEndingRef.current = false;
      }, 2000);
    };

    // WebRTC offer received (responder)
    const handleOffer = async (data: { fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
      console.log(`[WebRTC] Offer received from ${data.fromUserId}, current state: ${callStateRef.current}, signalingState: ${peerConnectionRef.current?.signalingState || 'no-pc'}`);

      let pc = peerConnectionRef.current;

      // ──── RENEGOTIATION: if we already have an active connection, handle re-offer properly ────
      if (pc && pc.signalingState === 'stable' && pc.localDescription) {
        console.log('[WebRTC] Re-offer received on stable connection — handling renegotiation');
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          // Re-add local tracks if needed (check track attachment, not array length)
          const senders = pc.getSenders();
          const hasTracksAttached = senders.some(s => s.track !== null);
          if (localStreamRef.current && !hasTracksAttached) {
            localStreamRef.current.getTracks().forEach(track => {
              pc!.addTrack(track, localStreamRef.current!);
            });
          }
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketRef.current?.emit('webrtc_answer', {
            teleconsultationId: teleconsultationIdRef.current,
            targetUserId: data.fromUserId,
            sdp: { type: answer.type, sdp: answer.sdp },
          });
          console.log('[WebRTC] Renegotiation answer sent');
        } catch (err) {
          console.error('[WebRTC] Renegotiation failed:', err);
        }
        return;
      }

      // ──── DUPLICATE OFFER: if we already sent an answer for this, ignore ────
      if (pc && pc.signalingState === 'have-remote-offer' && pc.remoteDescription) {
        console.log('[WebRTC] Duplicate offer received while already have-remote-offer, updating remote description');
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        } catch (err) {
          console.error('[WebRTC] Failed to update remote description:', err);
        }
        // Don't create another answer — let the existing flow handle it
        return;
      }

      // ──── FIRST OFFER: normal flow ────
      if (pc && pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer') {
        console.log(`[WebRTC] PC in unexpected state: ${pc.signalingState}, recreating`);
        pc = createPeerConnection();
      } else if (!pc) {
        pc = createPeerConnection();
      }

      try {
        // Handle the case where we're in 'have-local-offer' state (glare)
        if (pc.signalingState === 'have-local-offer') {
          console.log('[WebRTC] Glare detected — rolling back local offer');
          await pc.setLocalDescription({ type: 'rollback' });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        console.log('[WebRTC] Remote description set from offer');
      } catch (err) {
        console.error('Failed to set remote description from offer:', err);
        return;
      }

      // Helper to add tracks, create answer, and send it
      const createAndSendAnswer = async (stream: MediaStream) => {
        // GUARD: prevent duplicate answer creation (acceptCall may have already created one)
        if (pc!.localDescription) {
          console.log('[WebRTC] createAndSendAnswer: Answer already created, skipping');
          pendingAcceptRef.current = false;
          return;
        }

        const senders = pc!.getSenders();
        const hasTracksAttached = senders.some(s => s.track !== null);
        if (!hasTracksAttached) {
          stream.getTracks().forEach(track => {
            pc!.addTrack(track, stream);
          });
          console.log('[WebRTC] createAndSendAnswer: Tracks added:', stream.getTracks().map(t => `${t.kind}:${t.readyState}`).join(', '));
        } else {
          console.log('[WebRTC] createAndSendAnswer: Senders already have tracks, skipping addTrack');
        }

        const answer = await pc!.createAnswer();

        // Log SDP to verify video direction is sendrecv (not recvonly)
        const answerSdp = answer.sdp || '';
        const mediaLines = answerSdp.split('\n').filter((l: string) =>
          l.startsWith('m=') || l.startsWith('a=sendrecv') ||
          l.startsWith('a=recvonly') || l.startsWith('a=sendonly') || l.startsWith('a=inactive')
        );
        console.log('[WebRTC] createAndSendAnswer: SDP media directions:', mediaLines.join(' | '));

        await pc!.setLocalDescription(answer);

        socketRef.current?.emit('webrtc_answer', {
          teleconsultationId: teleconsultationIdRef.current,
          targetUserId: data.fromUserId,
          sdp: { type: answer.type, sdp: answer.sdp },
        });

        console.log('[WebRTC] Answer sent in response to offer');

        // Process queued ICE candidates
        while (iceCandidateQueue.current.length > 0) {
          const candidate = iceCandidateQueue.current.shift()!;
          await pc!.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingAcceptRef.current = false;
      };

      // If local stream is already available (call accepted), create answer immediately
      if (localStreamRef.current) {
        await createAndSendAnswer(localStreamRef.current);
      } else if (pendingAcceptRef.current) {
        // acceptCall was invoked but getLocalStream is still pending
        // Poll until localStreamRef becomes available (max 10 seconds)
        console.log('[WebRTC] Offer received while getLocalStream is pending — waiting for stream...');
        let attempts = 0;
        const maxAttempts = 50; // 50 * 200ms = 10 seconds
        const waitForStream = setInterval(async () => {
          attempts++;
          if (localStreamRef.current) {
            clearInterval(waitForStream);
            // Guard: acceptCall may have already created the answer
            if (pc!.localDescription) {
              console.log('[WebRTC] Answer already created by acceptCall, skipping polling path');
              pendingAcceptRef.current = false;
              return;
            }
            console.log(`[WebRTC] Local stream became available after ${attempts * 200}ms`);
            try {
              await createAndSendAnswer(localStreamRef.current);
            } catch (err) {
              console.error('[WebRTC] Failed to create answer after waiting for stream:', err);
            }
          } else if (attempts >= maxAttempts) {
            clearInterval(waitForStream);
            console.error('[WebRTC] Timed out waiting for local stream (10s)');
            pendingAcceptRef.current = false;
          }
        }, 200);
      } else {
        console.log('[WebRTC] Offer stored, waiting for acceptCall to create answer');
      }
    };

    // WebRTC answer received (initiator)
    const handleAnswer = async (data: { fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
      console.log(`[WebRTC] Answer received from ${data.fromUserId}, signalingState: ${peerConnectionRef.current?.signalingState}`);
      const pc = peerConnectionRef.current;
      if (!pc) {
        console.warn('[WebRTC] No peer connection for answer');
        return;
      }

      // Only accept answer if we're in have-local-offer state
      if (pc.signalingState !== 'have-local-offer') {
        console.warn(`[WebRTC] Unexpected signaling state for answer: ${pc.signalingState}, ignoring duplicate answer`);
        return;
      }

      try {
        // Log the SDP to verify it contains video tracks
        const sdpStr = data.sdp.sdp || '';
        const hasVideo = sdpStr.includes('m=video');
        const hasAudio = sdpStr.includes('m=audio');
        console.log(`[WebRTC] Answer SDP contains: audio=${hasAudio}, video=${hasVideo}`);

        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        console.log('[WebRTC] Remote description set from answer');

        // Log the transceivers to verify bidirectional media
        const transceivers = pc.getTransceivers();
        transceivers.forEach((t, i) => {
          console.log(`[WebRTC] Transceiver ${i}: direction=${t.direction}, currentDirection=${t.currentDirection}, kind=${t.receiver.track?.kind}`);
        });
      } catch (err) {
        console.error('Failed to set remote description from answer:', err);
        return;
      }

      // Process queued ICE candidates
      while (iceCandidateQueue.current.length > 0) {
        const candidate = iceCandidateQueue.current.shift()!;
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    // ICE candidate received
    const handleICECandidate = async (data: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('Failed to add ICE candidate:', err);
        }
      } else {
        // Queue candidates until remote description is set
        iceCandidateQueue.current.push(data.candidate);
      }
    };

    // Remote media toggle
    const handleMediaToggled = (data: { fromUserId: string; kind: 'audio' | 'video' | 'screen'; enabled: boolean }) => {
      if (data.kind === 'audio') setRemoteAudioEnabled(data.enabled);
      if (data.kind === 'video') setRemoteVideoEnabled(data.enabled);
    };

    // When another user joins the room — if we are calling and haven't connected yet, resend our offer
    // This handles the case where the responder joined AFTER the offer was sent
    const handleUserJoined = async (data: { userId: string }) => {
      console.log(`[WebRTC] User joined room: ${data.userId}`);
      const pc = peerConnectionRef.current;
      // Only resend offer if we're the initiator (calling) AND not yet connected
      // Do NOT resend if connection is already established or answer was received
      if (callStateRef.current === 'calling' && pc && pc.localDescription && pc.signalingState === 'have-local-offer' && !pc.remoteDescription) {
        console.log('[WebRTC] Resending offer to newly joined user (no answer received yet)');
        socketRef.current?.emit('webrtc_offer', {
          teleconsultationId: teleconsultationIdRef.current,
          targetUserId: data.userId,
          sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
        });
      } else {
        console.log(`[WebRTC] User joined but not resending offer (state=${callStateRef.current}, signalingState=${pc?.signalingState}, hasRemoteDesc=${!!pc?.remoteDescription})`);
      }
    };

    // User disconnected from the signaling room (socket.io disconnect)
    // This does NOT mean the WebRTC peer connection is lost — only the socket.
    // If WebRTC is already connected, the P2P connection continues working.
    const handleUserDisconnected = (data: { userId: string }) => {
      console.log(`[WebRTC] User disconnected from room: ${data.userId}, current state: ${callStateRef.current}`);
      const current = callStateRef.current;

      if (current === 'connected') {
        // WebRTC P2P connection is still alive — don't end the call.
        // The onconnectionstatechange handler will detect if the P2P connection actually drops.
        console.log('[WebRTC] User disconnected from socket but WebRTC is still connected — keeping call alive');
        return;
      }

      // For calling/incoming states, the call hasn't connected yet — end it
      if (current === 'calling' || current === 'incoming') {
        if (isEndingRef.current) return;
        isEndingRef.current = true;
        updateCallState('ended');
        cleanupPeerConnection();
        cleanupMedia();
        setIncomingFrom(null);
        setTimeout(() => {
          updateCallState('idle');
          setCallDuration(0);
          isEndingRef.current = false;
        }, 2000);
      }
    };

    // When the other party requests re-signaling (they joined late and missed our call_start)
    const handleCallResignalRequest = (data: { requestingUserId: string; teleconsultationId: string }) => {
      console.log(`[WebRTC] call_resignal_request from ${data.requestingUserId}, our state: ${callStateRef.current}`);
      if (callStateRef.current === 'calling' && peerConnectionRef.current?.localDescription) {
        // Re-send our offer to the newly joined user
        console.log('[WebRTC] Re-sending offer + call_start for late joiner');
        socketRef.current?.emit('webrtc_offer', {
          teleconsultationId: teleconsultationIdRef.current,
          targetUserId: data.requestingUserId,
          sdp: {
            type: peerConnectionRef.current.localDescription.type,
            sdp: peerConnectionRef.current.localDescription.sdp,
          },
        });
        // Re-emit call_start so the other side gets call_incoming
        socketRef.current?.emit('call_start', { teleconsultationId: teleconsultationIdRef.current });
      }
    };

    socket.on('call_incoming', handleCallIncoming);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('call_ended', handleCallEnded);
    socket.on('webrtc_offer', handleOffer);
    socket.on('webrtc_answer', handleAnswer);
    socket.on('webrtc_ice_candidate', handleICECandidate);
    socket.on('media_toggled', handleMediaToggled);
    socket.on('user_joined', handleUserJoined);
    socket.on('user_disconnected', handleUserDisconnected);
    socket.on('call_resignal_request', handleCallResignalRequest);

    return () => {
      socket.off('call_incoming', handleCallIncoming);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('call_ended', handleCallEnded);
      socket.off('webrtc_offer', handleOffer);
      socket.off('webrtc_answer', handleAnswer);
      socket.off('webrtc_ice_candidate', handleICECandidate);
      socket.off('media_toggled', handleMediaToggled);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_disconnected', handleUserDisconnected);
      socket.off('call_resignal_request', handleCallResignalRequest);
    };
    // IMPORTANT: callState removed from deps — using callStateRef instead
    // This prevents socket handler re-registration during state transitions
  }, [socket, teleconsultationId, createPeerConnection, updateCallState, cleanupPeerConnection, cleanupMedia]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupPeerConnection();
      cleanupMedia();
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, []);

  return {
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
  };
}
