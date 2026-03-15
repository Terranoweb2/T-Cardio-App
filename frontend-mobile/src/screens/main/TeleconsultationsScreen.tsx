import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

interface Teleconsultation {
  id: string;
  status: 'PLANNED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';
  scheduledAt: string;
  durationMinutes?: number;
  reason?: string;
  doctor?: { firstName: string; lastName: string };
  patient?: { firstName: string; lastName: string };
  createdAt: string;
}

export default function TeleconsultationsScreen({ navigation }: any) {
  const [teleconsultations, setTeleconsultations] = useState<Teleconsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [motif, setMotif] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { user } = useAuthStore();
  const isPatient = user?.role === 'PATIENT';

  const fetchTeleconsultations = useCallback(async () => {
    try {
      const endpoint = isPatient ? '/teleconsultations/patient' : '/teleconsultations/doctor';
      const { data } = await api.get(endpoint);
      setTeleconsultations(Array.isArray(data) ? data : data.data || []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isPatient]);

  useEffect(() => {
    fetchTeleconsultations();
  }, [fetchTeleconsultations]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTeleconsultations();
  }, [fetchTeleconsultations]);

  const handleRequestConsultation = async () => {
    if (!motif.trim()) {
      Alert.alert('Erreur', 'Veuillez indiquer le motif de la consultation');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/teleconsultations/request', { motif: motif.trim() });
      Alert.alert('Succes', 'Votre demande de teleconsultation a ete envoyee');
      setShowRequestModal(false);
      setMotif('');
      fetchTeleconsultations();
    } catch (err: any) {
      Alert.alert('Erreur', err.response?.data?.message || 'Impossible d\'envoyer la demande');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      PLANNED: { bg: '#dbeafe', text: '#2563eb', label: 'Planifiee' },
      ACTIVE: { bg: '#dcfce7', text: '#16a34a', label: 'En cours' },
      ENDED: { bg: '#f3f4f6', text: '#6b7280', label: 'Terminee' },
      CANCELLED: { bg: '#fef2f2', text: '#dc2626', label: 'Annulee' },
    };
    const c = config[status] || config.PLANNED;
    return (
      <View style={[styles.badge, { backgroundColor: c.bg }]}>
        <Text style={[styles.badgeText, { color: c.text }]}>{c.label}</Text>
      </View>
    );
  };

  const handleOpenChat = (item: Teleconsultation) => {
    if (item.status === 'ENDED' || item.status === 'CANCELLED') {
      Alert.alert('Information', 'Cette teleconsultation est terminee.');
      return;
    }
    navigation.navigate('TeleconsultationChat', {
      teleconsultationId: item.id,
      otherPartyName: isPatient
        ? `Dr. ${item.doctor?.firstName || ''} ${item.doctor?.lastName || ''}`
        : `${item.patient?.firstName || ''} ${item.patient?.lastName || ''}`,
    });
  };

  const renderItem = ({ item }: { item: Teleconsultation }) => {
    const date = new Date(item.scheduledAt);
    const otherParty = isPatient
      ? `Dr. ${item.doctor?.firstName || ''} ${item.doctor?.lastName || ''}`.trim()
      : `${item.patient?.firstName || ''} ${item.patient?.lastName || ''}`.trim();

    return (
      <TouchableOpacity style={styles.card} onPress={() => handleOpenChat(item)} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName}>{otherParty || 'En attente'}</Text>
          {getStatusBadge(item.status)}
        </View>

        <View style={styles.cardDetails}>
          <Text style={styles.cardDate}>
            {date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
            {' a '}
            {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {item.durationMinutes && (
            <Text style={styles.cardDuration}>{item.durationMinutes} min</Text>
          )}
        </View>

        {item.reason && (
          <Text style={styles.cardReason} numberOfLines={2}>
            {item.reason}
          </Text>
        )}

        {(item.status === 'PLANNED' || item.status === 'ACTIVE') && (
          <View style={styles.cardAction}>
            <Text style={styles.cardActionText}>
              {item.status === 'ACTIVE' ? 'Rejoindre le chat' : 'Voir les details'}
            </Text>
            <Text style={styles.cardArrow}>&gt;</Text>
          </View>
        )}
      </TouchableOpacity>
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Teleconsultations</Text>
        {isPatient && (
          <TouchableOpacity
            style={styles.requestButton}
            onPress={() => setShowRequestModal(true)}
          >
            <Text style={styles.requestButtonText}>+ Demander</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={teleconsultations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{'(  )'}</Text>
            <Text style={styles.emptyText}>Aucune teleconsultation</Text>
            {isPatient && (
              <Text style={styles.emptySubtext}>
                Demandez une teleconsultation avec votre medecin
              </Text>
            )}
          </View>
        }
        contentContainerStyle={teleconsultations.length === 0 ? { flex: 1 } : undefined}
      />

      {/* Request modal for patients */}
      <Modal visible={showRequestModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Demander une teleconsultation</Text>
            <Text style={styles.modalLabel}>Motif de la consultation</Text>
            <TextInput
              style={styles.modalInput}
              value={motif}
              onChangeText={setMotif}
              placeholder="Decrivez la raison de votre demande..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowRequestModal(false);
                  setMotif('');
                }}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, submitting && { opacity: 0.5 }]}
                onPress={handleRequestConsultation}
                disabled={submitting}
              >
                <Text style={styles.modalSubmitText}>
                  {submitting ? 'Envoi...' : 'Envoyer'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 16,
    paddingTop: 48,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  requestButton: {
    backgroundColor: '#2563eb',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 13,
    color: '#6b7280',
  },
  cardDuration: {
    fontSize: 12,
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  cardReason: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  cardAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  cardActionText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  cardArrow: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 36,
    color: '#d1d5db',
    marginBottom: 12,
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
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSubmitBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
