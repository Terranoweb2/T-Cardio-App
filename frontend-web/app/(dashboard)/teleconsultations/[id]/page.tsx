'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useSocket } from '@/contexts/SocketContext';
import { getTeleconsultationSocket } from '@/lib/socket';
import ChatWindow from '@/components/teleconsultation/ChatWindow';
import ChatInput from '@/components/teleconsultation/ChatInput';
import VideoCall from '@/components/teleconsultation/VideoCall';
import PostConsultationModal from '@/components/teleconsultation/PostConsultationModal';
import PatientRatingModal from '@/components/teleconsultation/PatientRatingModal';

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSizeBytes?: number;
}

interface Teleconsultation {
  id: string;
  motif: string;
  reason: string;
  status: string;
  summary?: string;
  followUpNeeded?: boolean;
  followUpDate?: string;
  scheduledAt: string | null;
  createdAt: string;
  patientId: string;
  doctorId: string;
  patientName?: string;
  patientEmail?: string;
  doctorName?: string;
  doctorEmail?: string;
  patient?: { id: string; email: string; firstName?: string; lastName?: string };
  doctor?: { id: string; email: string; firstName?: string; lastName?: string };
}

export default function TeleconsultationDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Chargement...</p>
        </div>
      </div>
    }>
      <TeleconsultationDetailContent />
    </Suspense>
  );
}

function TeleconsultationDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const { user } = useAuthStore();
  const { dismissIncomingCall } = useSocket();

  // Check if we should auto-accept an incoming call (redirected from global incoming call modal)
  const autoAccept = searchParams.get('autoAccept') === 'true';

  const [teleconsultation, setTeleconsultation] = useState<Teleconsultation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'video'>(autoAccept ? 'video' : 'chat');
  const [showPostConsultation, setShowPostConsultation] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [doctorAvailableToday, setDoctorAvailableToday] = useState<boolean | null>(null);
  const [pendingAutoAccept, setPendingAutoAccept] = useState(autoAccept);
  const [socketReady, setSocketReady] = useState(false);
  const socketRef = useRef<ReturnType<typeof getTeleconsultationSocket> | null>(null);
  const joinedRef = useRef(false);

  // When arriving with autoAccept, dismiss the global incoming call modal
  useEffect(() => {
    if (autoAccept) {
      dismissIncomingCall();
    }
  }, [autoAccept, dismissIncomingCall]);

  // Load teleconsultation details
  useEffect(() => {
    setLoading(true);
    api
      .get(`/teleconsultations/${id}`)
      .then((r) => {
        setTeleconsultation(r.data.data || r.data);
      })
      .catch(() => {
        setError('Impossible de charger la teleconsultation.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Check doctor availability for today
  useEffect(() => {
    if (!teleconsultation || !user) return;
    const isDoc = user.role === 'MEDECIN' || user.role === 'CARDIOLOGUE';
    if (isDoc) {
      // Doctors have no restriction
      setDoctorAvailableToday(true);
      return;
    }
    // Patient: check if doctor takes consultations today
    if (teleconsultation.doctorId) {
      api.get(`/doctors/${teleconsultation.doctorId}/available-today`)
        .then((r) => {
          const data = r.data?.data ?? r.data;
          setDoctorAvailableToday(data.available ?? true);
        })
        .catch(() => {
          // If check fails, don't block calls
          setDoctorAvailableToday(true);
        });
    }
  }, [teleconsultation?.doctorId, user?.role]);

  // Load message history
  useEffect(() => {
    setMessagesLoading(true);
    api
      .get(`/teleconsultations/${id}/messages`)
      .then((r) => {
        const data = r.data.data || r.data || [];
        const normalized = (Array.isArray(data) ? data : []).map((m: any) => ({
          id: m.id,
          content: m.content || m.message || '',
          senderId: m.senderId || m.userId || '',
          senderName:
            m.senderName ||
            m.sender?.firstName
              ? `${m.sender?.firstName || ''} ${m.sender?.lastName || ''}`.trim()
              : m.sender?.email || m.senderId || 'Inconnu',
          createdAt: m.createdAt || m.timestamp || new Date().toISOString(),
          fileUrl: m.fileUrl || undefined,
          fileName: m.fileName || undefined,
          fileType: m.fileType || undefined,
          fileSizeBytes: m.fileSizeBytes || undefined,
        }));
        setMessages(normalized);
      })
      .catch(() => {})
      .finally(() => setMessagesLoading(false));
  }, [id]);

  // WebSocket connection
  useEffect(() => {
    const socket = getTeleconsultationSocket();
    socketRef.current = socket;
    joinedRef.current = false;

    const joinRoom = () => {
      if (!joinedRef.current && user?.id) {
        joinedRef.current = true;
        console.log('[TeleconsultationPage] Joining room:', id, 'as user:', user.id);
        socket.emit('join_room', { teleconsultationId: id, userId: user.id });
        // Mark socket as ready after the server processes join_room
        setTimeout(() => {
          setSocketReady(true);
          // If arriving with autoAccept (from incoming call notification), request re-signaling
          // in case we missed the initial call_incoming/offer (we joined the room late)
          if (pendingAutoAccept) {
            setTimeout(() => {
              console.log('[TeleconsultationPage] Emitting call_check for autoAccept re-signaling');
              socket.emit('call_check', { teleconsultationId: id });
            }, 300);
          }
        }, 500);
      }
    };

    socket.connect();

    socket.on('connect', () => {
      console.log('[TeleconsultationPage] Socket connected');
      joinedRef.current = false; // Reset on reconnect to re-join room
      joinRoom();
    });

    // If already connected, join immediately
    if (socket.connected) {
      joinRoom();
    }

    // On reconnect, re-join the room
    socket.on('reconnect', () => {
      console.log('[TeleconsultationPage] Socket reconnected');
      joinedRef.current = false;
      joinRoom();
    });

    socket.on('call_ended', () => {
      // Refresh teleconsultation data
      api.get(`/teleconsultations/${id}`)
        .then((r) => setTeleconsultation(r.data.data || r.data))
        .catch(() => {});
    });

    socket.on('new_message', (msg: any) => {
      const newMsg: Message = {
        id: msg.id || `ws_${Date.now()}_${Math.random()}`,
        content: msg.content || msg.message || '',
        senderId: msg.senderId || msg.userId || '',
        senderName:
          msg.senderName ||
          (msg.sender?.firstName
            ? `${msg.sender.firstName} ${msg.sender.lastName || ''}`.trim()
            : msg.sender?.email || 'Inconnu'),
        createdAt: msg.createdAt || msg.timestamp || new Date().toISOString(),
        fileUrl: msg.fileUrl || undefined,
        fileName: msg.fileName || undefined,
        fileType: msg.fileType || undefined,
        fileSizeBytes: msg.fileSizeBytes || undefined,
      };

      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    });

    return () => {
      socket.emit('leave_room', { teleconsultationId: id });
      socket.off('new_message');
      socket.off('call_ended');
      socket.off('connect');
      socket.off('reconnect');
      joinedRef.current = false;
    };
  }, [id, user?.id]);

  // Send message
  const handleSend = useCallback(
    async (content: string, fileData?: { fileUrl: string; fileName: string; fileType: string; fileSizeBytes: number }) => {
      if (!user) return;

      // Emit via WebSocket
      socketRef.current?.emit('send_message', {
        teleconsultationId: id,
        senderId: user.id,
        senderRole: user.role,
        content: content || (fileData ? `Fichier: ${fileData.fileName}` : ''),
        ...(fileData ? {
          fileUrl: fileData.fileUrl,
          fileName: fileData.fileName,
          fileType: fileData.fileType,
          fileSizeBytes: fileData.fileSizeBytes,
        } : {}),
      });

      // Also POST to REST endpoint for persistence
      try {
        await api.post(`/teleconsultations/${id}/messages`, { content: content || (fileData ? `Fichier: ${fileData.fileName}` : '') });
      } catch {
        // Message was still sent via WS
      }
    },
    [id, user],
  );

  // Helper to get display names
  const getPatientName = () => {
    if (!teleconsultation) return '--';
    if (teleconsultation.patientName) return teleconsultation.patientName;
    if (teleconsultation.patient?.firstName)
      return `${teleconsultation.patient.firstName} ${teleconsultation.patient.lastName || ''}`.trim();
    return teleconsultation.patientEmail || teleconsultation.patient?.email || '--';
  };

  const getDoctorName = () => {
    if (!teleconsultation) return '--';
    if (teleconsultation.doctorName) return teleconsultation.doctorName;
    if (teleconsultation.doctor?.firstName)
      return `Dr. ${teleconsultation.doctor.firstName} ${teleconsultation.doctor.lastName || ''}`.trim();
    return teleconsultation.doctorEmail || teleconsultation.doctor?.email || '--';
  };

  const getRemoteName = () => {
    if (!teleconsultation || !user) return 'Correspondant';
    const isDoctor = user.role === 'MEDECIN' || user.role === 'CARDIOLOGUE';
    return isDoctor ? getPatientName() : getDoctorName();
  };

  const getUserDisplayName = () => {
    if (!user) return 'Vous';
    const isDoctor = user.role === 'MEDECIN' || user.role === 'CARDIOLOGUE';
    return isDoctor ? getDoctorName() : getPatientName();
  };

  const statusConfig: Record<string, { label: string; color: string; dotColor: string }> = {
    PLANNED: {
      label: 'Planifiee',
      color: 'bg-cyan-500/15 text-cyan-400',
      dotColor: 'bg-cyan-500',
    },
    ACTIVE: {
      label: 'En cours',
      color: 'bg-green-500/15 text-green-400',
      dotColor: 'bg-green-500',
    },
    ENDED: {
      label: 'Terminee',
      color: 'bg-cardio-800 text-slate-400',
      dotColor: 'bg-slate-500',
    },
    CANCELLED: {
      label: 'Annulee',
      color: 'bg-red-500/15 text-red-400',
      dotColor: 'bg-red-400',
    },
  };

  const isDoctor = user?.role === 'MEDECIN' || user?.role === 'CARDIOLOGUE';
  const isPatient = user?.role === 'PATIENT';

  // Show rating modal for patient when consultation ends
  useEffect(() => {
    if (isPatient && teleconsultation?.status === 'ENDED' && !ratingSubmitted) {
      // Check if already reviewed (review field would be set)
      const tc = teleconsultation as any;
      if (!tc.review) {
        const timer = setTimeout(() => setShowRatingModal(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [teleconsultation?.status, isPatient, ratingSubmitted]);

  const isChatDisabled =
    teleconsultation?.status === 'ENDED' ||
    teleconsultation?.status === 'CANCELLED';

  const isConsultationActive =
    teleconsultation?.status === 'ACTIVE' ||
    teleconsultation?.status === 'PLANNED';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error || !teleconsultation) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-red-500 text-sm mb-4">{error || 'Teleconsultation introuvable.'}</p>
          <button
            onClick={() => router.back()}
            className="text-cyan-400 hover:text-cyan-300 text-sm underline"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  const currentStatus = statusConfig[teleconsultation.status] || {
    label: teleconsultation.status,
    color: 'bg-cardio-800 text-slate-400',
    dotColor: 'bg-slate-500',
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="glass-card border-b border-cyan-500/10 px-3 sm:px-6 py-3 sm:py-4 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <button
              onClick={() => router.back()}
              className="text-slate-500 hover:text-slate-400 transition shrink-0"
              title="Retour"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-100 truncate">Teleconsultation</h1>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {teleconsultation.motif || teleconsultation.reason || 'Pas de motif renseigne'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 flex-wrap justify-end">
            {/* End consultation button (doctor only) */}
            {teleconsultation.status === 'ACTIVE' && isDoctor && (
              <button
                onClick={async () => {
                  try {
                    await api.patch(`/teleconsultations/${id}/status`, { status: 'ENDED' });
                    setTeleconsultation((prev) => prev ? { ...prev, status: 'ENDED' } : prev);
                    setShowPostConsultation(true);
                  } catch {}
                }}
                className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-600 transition"
              >
                Terminer
              </button>
            )}

            {/* Tab switch: Chat / Video */}
            {isConsultationActive && (
              <div className="flex items-center bg-cardio-800 rounded-lg p-0.5">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    activeTab === 'chat'
                      ? 'glass-card text-slate-100'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Chat
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('video')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    activeTab === 'video'
                      ? 'glass-card text-slate-100'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9.75a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25H4.5A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    Video
                  </span>
                </button>
              </div>
            )}

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${currentStatus.color}`}
            >
              <span className={`w-2 h-2 rounded-full ${currentStatus.dotColor}`} />
              {currentStatus.label}
            </span>
          </div>
        </div>

        {/* Info bar */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-6 mt-2 sm:mt-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span>
              <span className="text-slate-500">Patient : </span>
              <span className="text-slate-300 font-medium">{getPatientName()}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>
              <span className="text-slate-500">Praticien : </span>
              <span className="text-slate-300 font-medium">{getDoctorName()}</span>
            </span>
          </div>
          {teleconsultation.scheduledAt && (
            <div className="flex items-center gap-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span>
                {new Date(teleconsultation.scheduledAt).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'UTC',
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Summary banner (shown when consultation ended and has summary) */}
      {teleconsultation.status === 'ENDED' && teleconsultation.summary && (
        <div className="bg-cyan-500/10 border-b border-cyan-500/20 px-3 sm:px-6 py-3 shrink-0">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-medium text-cyan-300">Resume de la consultation</p>
              <p className="text-sm text-cyan-400 mt-0.5 whitespace-pre-line">{teleconsultation.summary}</p>
              {teleconsultation.followUpNeeded && (
                <p className="text-xs text-cyan-400 mt-1">
                  Suivi prevu{teleconsultation.followUpDate ? ` le ${new Date(teleconsultation.followUpDate).toLocaleDateString('fr-FR')}` : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main content area */}
      {activeTab === 'video' && isConsultationActive ? (
        <div className="flex-1 overflow-y-auto p-4 bg-cardio-800">
          <VideoCall
            socket={socketRef.current}
            teleconsultationId={id}
            userId={user?.id || ''}
            userName={getUserDisplayName()}
            remoteName={getRemoteName()}
            isActive={isConsultationActive}
            doctorAvailableToday={doctorAvailableToday ?? true}
            onEmergencyCall={undefined}
            emergencyActive={false}
            autoAccept={pendingAutoAccept && socketReady}
            onAutoAcceptHandled={() => setPendingAutoAccept(false)}
          />
        </div>
      ) : (
        <>
          {/* Chat area */}
          <ChatWindow
            messages={messages}
            currentUserId={user?.id || ''}
            loading={messagesLoading}
          />

          {/* Input area */}
          <ChatInput onSend={handleSend} disabled={isChatDisabled} teleconsultationId={id} />
        </>
      )}

      {/* Post-consultation modal (doctor) */}
      {showPostConsultation && (
        <PostConsultationModal
          teleconsultationId={id}
          onClose={() => setShowPostConsultation(false)}
          onSaved={() => {
            api.get(`/teleconsultations/${id}`)
              .then((r) => setTeleconsultation(r.data.data || r.data))
              .catch(() => {});
          }}
        />
      )}

      {/* Patient rating modal */}
      {showRatingModal && (
        <PatientRatingModal
          teleconsultationId={id}
          onClose={() => setShowRatingModal(false)}
          onSaved={() => {
            setRatingSubmitted(true);
          }}
        />
      )}

    </div>
  );
}
