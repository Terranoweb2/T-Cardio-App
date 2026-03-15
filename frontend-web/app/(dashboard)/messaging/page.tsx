'use client';

import { useEffect, useState, useRef } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { getMessagingSocket } from '@/lib/socket';
import { MessageSquare, Send, Loader2, Check, CheckCheck, Plus, X, UserPlus, Bot, BotOff, Clock } from 'lucide-react';
import type { Socket } from 'socket.io-client';

interface ConversationItem {
  id: string;
  patient: { firstName: string | null; lastName: string | null; profilePhotoUrl?: string | null };
  doctor: { firstName: string | null; lastName: string | null; profilePhotoUrl?: string | null };
  lastMessageAt: string | null;
  messages?: Array<{ content: string; senderRole: string; createdAt: string; isRead: boolean }>;
}

interface DirectMessage {
  id: string;
  senderId: string;
  senderRole: string;
  content: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  fileUrl?: string;
  fileName?: string;
  isAiGenerated?: boolean;
}

interface ContactItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  specialty?: string;
  profilePhotoUrl?: string | null;
}

export default function MessagingPage() {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [showNewConv, setShowNewConv] = useState(false);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [creatingConv, setCreatingConv] = useState(false);
  // AI Auto-Reply state
  const [aiAutoReplyEnabled, setAiAutoReplyEnabled] = useState(false);
  const [aiAutoReplyExpiresAt, setAiAutoReplyExpiresAt] = useState<string | null>(null);
  const [showAutoReplyModal, setShowAutoReplyModal] = useState(false);
  const [autoReplyDuration, setAutoReplyDuration] = useState<number | null>(null);
  const [togglingAutoReply, setTogglingAutoReply] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  const isDoctor = user?.role === 'MEDECIN' || user?.role === 'CARDIOLOGUE';

  useEffect(() => {
    loadConversations();
    if (isDoctor) loadAutoReplyStatus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket connection for active conversation
  useEffect(() => {
    if (!activeConvId || !user) return;

    const socket = getMessagingSocket();
    socketRef.current = socket;

    if (!socket.connected) socket.connect();

    socket.emit('join_conversation', { conversationId: activeConvId, userId: user.id });

    socket.on('new_message', (msg: DirectMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('user_typing', () => setTyping(true));
    socket.on('user_stop_typing', () => setTyping(false));
    socket.on('messages_read', () => {
      setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
    });

    socket.on('auto_reply_status', (data: { enabled: boolean; expiresAt: string | null }) => {
      setAiAutoReplyEnabled(data.enabled);
      setAiAutoReplyExpiresAt(data.expiresAt);
    });

    return () => {
      socket.off('new_message');
      socket.off('user_typing');
      socket.off('user_stop_typing');
      socket.off('messages_read');
      socket.off('auto_reply_status');
    };
  }, [activeConvId, user]);

  const loadConversations = async () => {
    try {
      const res = await api.get('/messaging/conversations');
      setConversations(res.data);
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAutoReplyStatus = async () => {
    try {
      const res = await api.get('/messaging/auto-reply/status');
      setAiAutoReplyEnabled(res.data.enabled);
      setAiAutoReplyExpiresAt(res.data.expiresAt);
    } catch (err) {
      console.error('Failed to load auto-reply status', err);
    }
  };

  const handleToggleAutoReply = async (enabled: boolean, durationMinutes?: number) => {
    setTogglingAutoReply(true);
    try {
      const res = await api.patch('/messaging/auto-reply', { enabled, durationMinutes });
      setAiAutoReplyEnabled(res.data.enabled);
      setAiAutoReplyExpiresAt(res.data.expiresAt);
      setShowAutoReplyModal(false);

      // Also notify via socket for real-time sync
      if (socketRef.current?.connected) {
        socketRef.current.emit('toggle_auto_reply', { enabled, durationMinutes });
      }
    } catch (err) {
      console.error('Failed to toggle auto-reply', err);
    } finally {
      setTogglingAutoReply(false);
    }
  };

  const getAutoReplyTimeLeft = () => {
    if (!aiAutoReplyExpiresAt) return 'Indefini';
    const diff = new Date(aiAutoReplyExpiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expire';
    const minutes = Math.ceil(diff / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins.toString().padStart(2, '0')}` : `${hours}h`;
  };

  const selectConversation = async (id: string) => {
    setActiveConvId(id);
    try {
      const res = await api.get(`/messaging/conversations/${id}/messages`);
      setMessages(res.data);
      // Mark as read
      api.patch(`/messaging/conversations/${id}/read`);
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeConvId) return;
    const content = input.trim();
    setInput('');

    // Send via socket for real-time
    if (socketRef.current?.connected && user) {
      socketRef.current.emit('send_message', {
        conversationId: activeConvId,
        senderId: user.id,
        senderRole: user.role,
        content,
      });
    } else {
      // Fallback to REST
      try {
        const res = await api.post(`/messaging/conversations/${activeConvId}/messages`, { content });
        setMessages((prev) => [...prev, res.data]);
      } catch (err) {
        console.error('Failed to send message', err);
      }
    }
  };

  const handleTyping = () => {
    if (socketRef.current?.connected && activeConvId) {
      socketRef.current.emit('typing', { conversationId: activeConvId });
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        socketRef.current?.emit('stop_typing', { conversationId: activeConvId });
      }, 2000);
    }
  };

  const getContactName = (conv: ConversationItem) => {
    const isPatient = user?.role === 'PATIENT';
    const contact = isPatient ? conv.doctor : conv.patient;
    const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
    return isPatient ? `Dr. ${name}` : name || 'Patient';
  };

  const getLastMessage = (conv: ConversationItem) => {
    if (!conv.messages?.length) return 'Aucun message';
    return conv.messages[0].content.substring(0, 50) + (conv.messages[0].content.length > 50 ? '...' : '');
  };

  // Load available contacts for new conversation
  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      const isPatient = user?.role === 'PATIENT';
      if (isPatient) {
        // Patient: load linked doctors
        const res = await api.get('/patients/my-doctors');
        const doctors = (res.data || []).map((link: any) => ({
          id: link.doctor?.id || link.doctorId,
          firstName: link.doctor?.firstName,
          lastName: link.doctor?.lastName,
          specialty: link.doctor?.specialty,
          profilePhotoUrl: link.doctor?.profilePhotoUrl,
        }));
        setContacts(doctors);
      } else {
        // Doctor: load linked patients
        const res = await api.get('/doctors/patients');
        const patients = (res.data?.data || res.data || []).map((link: any) => ({
          id: link.patient?.id || link.patientId || link.id,
          firstName: link.patient?.firstName || link.firstName,
          lastName: link.patient?.lastName || link.lastName,
          profilePhotoUrl: link.patient?.profilePhotoUrl || link.profilePhotoUrl,
        }));
        setContacts(patients);
      }
    } catch (err) {
      console.error('Failed to load contacts', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const openNewConversation = () => {
    setShowNewConv(true);
    loadContacts();
  };

  const startConversation = async (targetId: string) => {
    setCreatingConv(true);
    try {
      const res = await api.post('/messaging/conversations', { targetId });
      const conv = res.data;
      setShowNewConv(false);
      // Reload conversations list and select the new one
      await loadConversations();
      selectConversation(conv.id);
    } catch (err: any) {
      console.error('Failed to create conversation', err);
      alert(err?.response?.data?.message || 'Impossible de creer la conversation');
    } finally {
      setCreatingConv(false);
    }
  };

  const getContactDisplayName = (contact: ContactItem) => {
    const isPatient = user?.role === 'PATIENT';
    const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
    if (isPatient) {
      return `Dr. ${name}`;
    }
    return name || 'Patient';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] lg:h-[calc(100vh-80px)] flex flex-col overflow-hidden max-w-full">
      <h1 className="text-lg sm:text-xl font-bold text-gradient-cyan mb-2 sm:mb-4">Messagerie</h1>

      <div className="flex-1 flex gap-2 sm:gap-4 min-h-0 overflow-hidden">
        {/* Conversations list */}
        <div className={`w-full md:w-72 lg:w-80 glass-card rounded-xl p-2 sm:p-3 flex flex-col ${activeConvId ? 'hidden md:flex' : 'flex'}`}>
          <div className="flex items-center justify-between px-2 mb-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Conversations</h2>
            <button
              onClick={openNewConversation}
              className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-500/40 transition-all text-cyan-400 hover:text-cyan-300"
              title="Nouvelle conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 dark-scrollbar">
            {conversations.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-10 h-10 text-cyan-500/20 mx-auto mb-2" />
                <p className="text-xs text-slate-500 mb-3">Aucune conversation</p>
                <button
                  onClick={openNewConversation}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-500/40 transition-all text-xs text-cyan-400 hover:text-cyan-300"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Demarrer une conversation
                </button>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                    activeConvId === conv.id ? 'bg-cyan-500/10 border border-cyan-500/20' : 'hover:bg-cardio-700/50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600/30 to-teal-600/30 border border-cyan-500/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-cyan-400">
                      {getContactName(conv).slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-200 truncate">{getContactName(conv)}</p>
                    <p className="text-xs text-slate-500 truncate">{getLastMessage(conv)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Messages area */}
        <div className={`flex-1 glass-card rounded-xl flex flex-col min-h-0 min-w-0 overflow-hidden ${!activeConvId ? 'hidden md:flex' : 'flex'}`}>
          {!activeConvId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-cyan-500/20 mx-auto mb-4" />
                <p className="text-sm text-slate-500 mb-4">Selectionnez une conversation</p>
                <button
                  onClick={openNewConversation}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-500/40 transition-all text-sm text-cyan-400 hover:text-cyan-300"
                >
                  <UserPlus className="w-4 h-4" />
                  Nouvelle conversation
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-cyan-500/10 flex items-center gap-3">
                <button onClick={() => setActiveConvId(null)} className="md:hidden text-slate-400 hover:text-cyan-400">
                  &larr;
                </button>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-600/30 to-teal-600/30 border border-cyan-500/20 flex items-center justify-center">
                  <span className="text-xs font-semibold text-cyan-400">
                    {(conversations.find((c) => c.id === activeConvId) ? getContactName(conversations.find((c) => c.id === activeConvId)!) : '').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium text-slate-200 flex-1 truncate">
                  {conversations.find((c) => c.id === activeConvId) ? getContactName(conversations.find((c) => c.id === activeConvId)!) : ''}
                </span>

                {/* AI Auto-Reply Toggle - Doctor only */}
                {isDoctor && (
                  <button
                    onClick={() => aiAutoReplyEnabled ? handleToggleAutoReply(false) : setShowAutoReplyModal(true)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      aiAutoReplyEnabled
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25'
                        : 'bg-cardio-700/50 border-cardio-600/30 text-slate-400 hover:bg-cardio-700 hover:text-slate-300'
                    }`}
                    title={aiAutoReplyEnabled ? 'IA Active - Cliquez pour desactiver' : 'Activer la reponse automatique IA'}
                  >
                    {aiAutoReplyEnabled ? <Bot className="w-3.5 h-3.5" /> : <BotOff className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">
                      {aiAutoReplyEnabled ? `IA Active` : 'IA'}
                    </span>
                    {aiAutoReplyEnabled && aiAutoReplyExpiresAt && (
                      <span className="hidden sm:inline text-[10px] opacity-75">({getAutoReplyTimeLeft()})</span>
                    )}
                  </button>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 dark-scrollbar">
                {messages.length === 0 && (
                  <div className="text-center py-10">
                    <MessageSquare className="w-10 h-10 text-cyan-500/15 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Aucun message. Commencez la conversation !</p>
                  </div>
                )}
                {messages.map((msg) => {
                  const isMe = msg.senderId === user?.id;
                  const isAi = msg.isAiGenerated;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 overflow-hidden ${
                        (isAi && isDoctor)
                          ? 'bg-emerald-500/10 border border-emerald-500/20'
                          : isMe
                            ? 'bg-cyan-500/15 border border-cyan-500/20'
                            : 'bg-cardio-800 border border-cardio-700'
                      }`}>
                        {isAi && isDoctor && (
                          <div className="flex items-center gap-1 mb-1">
                            <Bot className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] font-medium text-emerald-400">
                              Reponse IA
                            </span>
                          </div>
                        )}
                        <p className="text-[13px] sm:text-sm text-slate-200 whitespace-pre-wrap break-words overflow-wrap-anywhere">{msg.content}</p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[10px] text-slate-500">
                            {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isMe && (msg.isRead ? <CheckCheck className="w-3 h-3 text-cyan-400" /> : <Check className="w-3 h-3 text-slate-500" />)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {typing && (
                  <div className="flex justify-start">
                    <div className="bg-cardio-800 border border-cardio-700 rounded-2xl px-4 py-2">
                      <span className="text-xs text-slate-400">En train d&apos;ecrire...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-2 sm:p-3 border-t border-cyan-500/10">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => { setInput(e.target.value); handleTyping(); }}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Ecrire un message..."
                    className="flex-1 min-w-0 glass-input rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    className="glow-btn p-2 sm:p-2.5 rounded-xl disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      {showNewConv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card rounded-2xl w-full max-w-md p-5 border border-cyan-500/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-200">Nouvelle conversation</h3>
              <button onClick={() => setShowNewConv(false)} className="p-1 rounded-lg hover:bg-cardio-700 text-slate-400 hover:text-slate-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              {user?.role === 'PATIENT'
                ? 'Selectionnez un medecin pour demarrer une conversation'
                : 'Selectionnez un patient pour demarrer une conversation'}
            </p>

            {loadingContacts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-8">
                <UserPlus className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">
                  {user?.role === 'PATIENT'
                    ? 'Aucun medecin associe. Utilisez un code d\'invitation pour lier un medecin.'
                    : 'Aucun patient associe.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto dark-scrollbar">
                {contacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => startConversation(contact.id)}
                    disabled={creatingConv}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition-all text-left disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600/30 to-teal-600/30 border border-cyan-500/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-cyan-400">
                        {getContactDisplayName(contact).slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">
                        {getContactDisplayName(contact)}
                      </p>
                      {contact.specialty && (
                        <p className="text-xs text-slate-500 truncate">{contact.specialty}</p>
                      )}
                    </div>
                    {creatingConv && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Auto-Reply Configuration Modal */}
      {showAutoReplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card rounded-2xl w-full max-w-sm p-5 border border-cyan-500/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-semibold text-slate-200">Reponse automatique IA</h3>
              </div>
              <button onClick={() => setShowAutoReplyModal(false)} className="p-1 rounded-lg hover:bg-cardio-700 text-slate-400 hover:text-slate-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              L&apos;IA repondra aux messages de vos patients en votre nom. Vous pourrez reprendre la conversation a tout moment.
            </p>

            <div className="space-y-2 mb-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Duree</p>
              {[
                { label: '30 minutes', value: 30 },
                { label: '1 heure', value: 60 },
                { label: '2 heures', value: 120 },
                { label: '4 heures', value: 240 },
                { label: '8 heures', value: 480 },
                { label: 'Indefini', value: null },
              ].map((option) => (
                <button
                  key={option.label}
                  onClick={() => setAutoReplyDuration(option.value)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left text-sm transition-all border ${
                    autoReplyDuration === option.value
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'border-transparent hover:bg-cardio-700/50 text-slate-300 hover:text-slate-200'
                  }`}
                >
                  <Clock className="w-4 h-4 shrink-0" />
                  {option.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleToggleAutoReply(true, autoReplyDuration ?? undefined)}
              disabled={togglingAutoReply}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 text-sm font-medium transition-all disabled:opacity-50"
            >
              {togglingAutoReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
              Activer la reponse IA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
