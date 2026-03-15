import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { teleconsultationSocket } from '../../services/socket';

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderRole: string;
  createdAt: string;
}

export default function TeleconsultationChatScreen({ route, navigation }: any) {
  const { teleconsultationId, otherPartyName } = route.params;
  const { user } = useAuthStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Load existing messages
  const fetchMessages = useCallback(async () => {
    try {
      const { data } = await api.get(`/teleconsultations/${teleconsultationId}/messages`);
      setMessages(Array.isArray(data) ? data : data.data || []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [teleconsultationId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // WebSocket connection for real-time messages
  useEffect(() => {
    teleconsultationSocket.connect('/teleconsultation').then(() => {
      teleconsultationSocket.emit('join_room', {
        teleconsultationId,
        userId: user?.id,
      });
    });

    const handleNewMessage = (message: Message) => {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    };

    teleconsultationSocket.on('new_message', handleNewMessage);

    return () => {
      teleconsultationSocket.emit('leave_room', { teleconsultationId });
      teleconsultationSocket.off('new_message', handleNewMessage);
      teleconsultationSocket.disconnect();
    };
  }, [teleconsultationId, user?.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setInputText('');

    try {
      const { data } = await api.post(`/teleconsultations/${teleconsultationId}/messages`, {
        content: text,
      });

      // Add message locally if not already received via socket
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data];
      });

      // Also emit through WebSocket for real-time delivery
      teleconsultationSocket.emit('send_message', {
        teleconsultationId,
        senderId: user?.id,
        senderRole: user?.role,
        content: text,
      });
    } catch (err: any) {
      Alert.alert('Erreur', 'Impossible d\'envoyer le message');
      setInputText(text); // Restore text on failure
    } finally {
      setSending(false);
    }
  };

  const handleEndConsultation = async () => {
    Alert.alert(
      'Terminer la consultation',
      'Voulez-vous vraiment terminer cette teleconsultation ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Terminer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.patch(`/teleconsultations/${teleconsultationId}/status`, {
                status: 'ENDED',
              });
              Alert.alert('Information', 'La teleconsultation est terminee.');
              navigation.goBack();
            } catch {
              Alert.alert('Erreur', 'Impossible de terminer la consultation');
            }
          },
        },
      ],
    );
  };

  const isOwnMessage = (msg: Message) => msg.senderId === user?.id;

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const own = isOwnMessage(item);

    // Show date separator
    const showDateSeparator =
      index === 0 ||
      formatDate(item.createdAt) !== formatDate(messages[index - 1].createdAt);

    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>{formatDate(item.createdAt)}</Text>
          </View>
        )}
        <View style={[styles.messageRow, own && styles.messageRowOwn]}>
          <View style={[styles.messageBubble, own ? styles.ownBubble : styles.otherBubble]}>
            {!own && (
              <Text style={styles.senderLabel}>
                {item.senderRole === 'PATIENT' ? 'Patient' : 'Medecin'}
              </Text>
            )}
            <Text style={[styles.messageText, own && styles.ownMessageText]}>
              {item.content}
            </Text>
            <Text style={[styles.messageTime, own && styles.ownMessageTime]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>{'< Retour'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName} numberOfLines={1}>{otherPartyName}</Text>
          <View style={styles.onlineDot} />
        </View>
        <TouchableOpacity onPress={handleEndConsultation} style={styles.endButton}>
          <Text style={styles.endButtonText}>Terminer</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Debut de la conversation</Text>
            <Text style={styles.emptySubtext}>Envoyez un message pour commencer</Text>
          </View>
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ecrivez un message..."
          placeholderTextColor="#9ca3af"
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>{'>'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backText: {
    fontSize: 15,
    color: '#2563eb',
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  endButton: {
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  endButtonText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
  },
  // Messages
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '78%',
    borderRadius: 16,
    padding: 12,
  },
  ownBubble: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  senderLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    color: '#1f2937',
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    color: '#9ca3af',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  ownMessageTime: {
    color: '#dbeafe',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#d1d5db',
    marginTop: 4,
  },
  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: '#1f2937',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
