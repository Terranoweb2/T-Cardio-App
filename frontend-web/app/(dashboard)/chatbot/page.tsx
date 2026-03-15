'use client';

import { useEffect, useState, useRef } from 'react';
import api from '@/lib/api';
import { MessageCircle, Plus, Send, Trash2, Loader2, Activity, Heart } from 'lucide-react';
import QuickActions from '@/components/chatbot/QuickActions';
import TypingIndicator from '@/components/chatbot/TypingIndicator';
import MessageBubble from '@/components/chatbot/MessageBubble';
import SuggestedFollowups from '@/components/chatbot/SuggestedFollowups';

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages?: Array<{ content: string; role: string; createdAt: string }>;
}

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export default function ChatbotPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [analyzingMeasurements, setAnalyzingMeasurements] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const res = await api.get('/chatbot/conversations');
      setConversations(res.data);
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  };

  const createConversation = async () => {
    try {
      const res = await api.post('/chatbot/conversations', {});
      setConversations((prev) => [res.data, ...prev]);
      selectConversation(res.data.id);
      setShowSidebar(false);
    } catch (err) {
      console.error('Failed to create conversation', err);
    }
  };

  // Create conversation with automatic measurement analysis
  const createWithMeasurements = async () => {
    setAnalyzingMeasurements(true);
    setShowSidebar(false);
    try {
      const res = await api.post('/chatbot/conversations/with-measurements');
      const { conversation, initialMessage } = res.data;

      // Add to conversations list
      setConversations((prev) => [{ ...conversation, messages: [] }, ...prev]);
      setActiveConvId(conversation.id);

      // Load the full conversation messages
      const convRes = await api.get(`/chatbot/conversations/${conversation.id}`);
      setMessages(convRes.data.messages || []);
      loadConversations();
    } catch (err) {
      console.error('Failed to create conversation with measurements', err);
      // Fallback: create normal conversation
      await createConversation();
    } finally {
      setAnalyzingMeasurements(false);
    }
  };

  const selectConversation = async (id: string) => {
    setActiveConvId(id);
    setLoading(true);
    setShowSidebar(false);
    try {
      const res = await api.get(`/chatbot/conversations/${id}`);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error('Failed to load messages', err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeConvId || thinking) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { id: `tmp-${Date.now()}`, role: 'USER', content: userMsg, createdAt: new Date().toISOString() }]);
    setThinking(true);

    try {
      const res = await api.post(`/chatbot/conversations/${activeConvId}/send`, { message: userMsg });
      setMessages((prev) => [...prev, res.data]);
      loadConversations();
    } catch (err) {
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: 'ASSISTANT', content: 'Erreur de connexion. Veuillez reessayer.', createdAt: new Date().toISOString() }]);
    } finally {
      setThinking(false);
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      await api.delete(`/chatbot/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        setActiveConvId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete conversation', err);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] lg:h-[calc(100vh-80px)] flex flex-col overflow-hidden max-w-full">
      <div className="flex items-center justify-between mb-2 sm:mb-4">
        <h1 className="text-lg sm:text-xl font-bold text-gradient-cyan">Chatbot Sante</h1>
        <button onClick={() => setShowSidebar(!showSidebar)} className="md:hidden p-2 glass-card rounded-lg">
          <MessageCircle className="w-5 h-5 text-cyan-400" />
        </button>
      </div>

      <div className="flex-1 flex gap-2 sm:gap-4 min-h-0 overflow-hidden">
        {/* Conversation list */}
        <div className={`${showSidebar ? 'fixed inset-0 z-50 bg-black/60' : 'hidden'} md:relative md:block md:bg-transparent md:z-auto`}>
          <div className={`${showSidebar ? 'absolute right-0 top-0 h-full w-72 sm:w-80' : ''} md:w-64 lg:w-72 md:relative glass-card rounded-xl p-3 flex flex-col h-full`}>
            <button
              onClick={createWithMeasurements}
              disabled={analyzingMeasurements}
              className="bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/30 hover:border-red-400/50 rounded-lg px-4 py-2.5 text-sm flex items-center gap-2 mb-2 transition-all disabled:opacity-50"
            >
              <Heart className="w-4 h-4 text-red-400" />
              <span className="text-red-300 font-medium">Analyser mes constantes</span>
            </button>
            <button onClick={createConversation} className="glow-btn rounded-lg px-4 py-2.5 text-sm flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4" /> Nouvelle conversation
            </button>
            <div className="flex-1 overflow-y-auto space-y-1 dark-scrollbar">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                    activeConvId === conv.id ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-300 hover:bg-cardio-700/50'
                  }`}
                  onClick={() => selectConversation(conv.id)}
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span className="text-sm truncate flex-1">{conv.title || 'Conversation'}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {conversations.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4">Aucune conversation</p>
              )}
            </div>
          </div>
          {showSidebar && <div className="absolute inset-0 -z-10" onClick={() => setShowSidebar(false)} />}
        </div>

        {/* Chat area */}
        <div className="flex-1 glass-card rounded-xl flex flex-col min-h-0 min-w-0 overflow-hidden">
          {analyzingMeasurements ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <div className="relative mx-auto mb-6 w-20 h-20">
                  <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                  <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30">
                    <Activity className="w-10 h-10 text-red-400 animate-pulse" />
                  </div>
                </div>
                <h2 className="text-lg font-semibold text-slate-300 mb-2">Analyse de vos constantes en cours...</h2>
                <p className="text-sm text-slate-500 max-w-sm">
                  L&apos;IA analyse vos dernieres mesures de tension arterielle et de pouls pour vous donner des conseils personnalises.
                </p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                  <span className="text-sm text-cyan-400">Veuillez patienter...</span>
                </div>
              </div>
            </div>
          ) : !activeConvId ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <div className="relative mx-auto mb-6 w-20 h-20">
                  <div className="flex items-center justify-center w-20 h-20 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                    <Heart className="w-10 h-10 text-cyan-500/50" />
                  </div>
                </div>
                <h2 className="text-lg font-semibold text-slate-300 mb-2">Chatbot Sante T-Cardio</h2>
                <p className="text-sm text-slate-500 max-w-sm mb-6">
                  Analysez vos constantes ou posez vos questions sur l&apos;hypertension et la sante cardiovasculaire.
                </p>

                <div className="flex flex-col gap-3 max-w-xs mx-auto">
                  <button
                    onClick={createWithMeasurements}
                    className="bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/30 hover:border-red-400/50 rounded-xl px-6 py-3 text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Activity className="w-5 h-5 text-red-400" />
                    <span className="text-red-300 font-medium">Analyser mes constantes</span>
                  </button>
                  <button onClick={createConversation} className="glow-btn rounded-xl px-6 py-3 text-sm flex items-center justify-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    <span>Poser une question</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 sm:p-4 space-y-3 sm:space-y-4 dark-scrollbar">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-6">
                    <p className="text-sm text-slate-500">Envoyez un message pour commencer...</p>
                    <QuickActions onAction={(text) => { setInput(text); }} />
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <MessageBubble
                        key={msg.id}
                        role={msg.role === 'USER' ? 'user' : 'assistant'}
                        content={msg.content}
                        timestamp={msg.createdAt}
                      />
                    ))}
                    {/* Show suggested follow-ups after the last assistant message */}
                    {!thinking && messages.length > 0 && messages[messages.length - 1].role !== 'USER' && (
                      <SuggestedFollowups
                        suggestions={["Que signifie ma tension ?", "Conseils pour baisser ma tension", "Quand consulter un medecin ?"]}
                        onSelect={(text) => { setInput(text); }}
                      />
                    )}
                  </>
                )}
                {thinking && (
                  <div className="flex justify-start">
                    <div className="bg-cardio-800 border border-cardio-700 rounded-2xl px-4 py-3">
                      <TypingIndicator />
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
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Posez votre question..."
                    className="flex-1 min-w-0 glass-input rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm"
                    disabled={thinking}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || thinking}
                    className="glow-btn p-2 sm:p-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
                <p className="text-[9px] sm:text-[10px] text-slate-600 mt-1 sm:mt-1.5 text-center">
                  Ce chatbot ne remplace pas un avis medical.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
