import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import api from '../../services/api';

interface Doctor {
  id: string;
  firstName?: string;
  lastName?: string;
  specialty?: string;
  role?: string;
}

interface CooldownStatus {
  allowed: boolean;
  reason?: string;
  cooldownEndsAt?: string;
}

interface EmergencyEvent {
  id: string;
  status: string;
  triggerType: string;
  triggerValue: any;
  createdAt: string;
  acknowledgedAt?: string;
}

export default function EmergencyScreen() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [cooldowns, setCooldowns] = useState<Record<string, CooldownStatus>>({});
  const [cooldownTimers, setCooldownTimers] = useState<Record<string, string>>({});
  const doctorsRef = useRef<Doctor[]>([]);

  const fetchCooldowns = useCallback(async (doctorList: Doctor[]) => {
    const results: Record<string, CooldownStatus> = {};
    for (const doc of doctorList) {
      try {
        const r = await api.get(`/emergency-calls/cooldown?doctorId=${doc.id}`);
        results[doc.id] = r.data;
      } catch {
        results[doc.id] = { allowed: true };
      }
    }
    setCooldowns(results);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [docsRes, emergRes] = await Promise.all([
        api.get('/patients/my-doctors').catch(() => ({ data: [] })),
        api.get('/emergency-calls/patient').catch(() => ({ data: [] })),
      ]);

      const rawDocs = Array.isArray(docsRes.data) ? docsRes.data : [];
      const doctorList: Doctor[] = rawDocs.map((d: any) => ({
        id: d.doctor?.id || d.doctorId || d.id,
        firstName: d.doctor?.firstName || d.firstName,
        lastName: d.doctor?.lastName || d.lastName,
        specialty: d.doctor?.specialty || d.specialty,
        role: d.doctor?.role || d.role,
      }));

      setDoctors(doctorList);
      doctorsRef.current = doctorList;
      setEmergencies(Array.isArray(emergRes.data) ? emergRes.data : []);
      await fetchCooldowns(doctorList);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchCooldowns]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cooldown timer tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      const timers: Record<string, string> = {};
      let needsRefresh = false;

      for (const [docId, cd] of Object.entries(cooldowns)) {
        if (!cd.allowed && cd.cooldownEndsAt) {
          const remaining = new Date(cd.cooldownEndsAt).getTime() - Date.now();
          if (remaining > 0) {
            const min = Math.floor(remaining / 60_000);
            const sec = Math.floor((remaining % 60_000) / 1000);
            timers[docId] = `${min}:${sec.toString().padStart(2, '0')}`;
          } else {
            needsRefresh = true;
          }
        }
      }

      setCooldownTimers(timers);
      if (needsRefresh) {
        fetchCooldowns(doctorsRef.current);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldowns, fetchCooldowns]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const getDoctorLabel = (role?: string): string => {
    if (role === 'CARDIOLOGUE') return 'Cardiologue';
    if (role === 'MEDECIN') return 'Medecin';
    return role || 'Praticien';
  };

  const handleEmergencyPress = (doctor: Doctor) => {
    const cd = cooldowns[doctor.id];
    if (cd && !cd.allowed) {
      Alert.alert(
        'Cooldown actif',
        cd.reason || 'Veuillez patienter avant de relancer un appel.'
      );
      return;
    }

    const doctorName = `Dr. ${doctor.firstName || ''} ${doctor.lastName || ''}`.trim();

    Alert.alert(
      `Appel d'urgence - ${doctorName}`,
      'Choisissez le type d\'urgence :',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Urgence gratuite',
          onPress: () => triggerEmergency(doctor, 'free'),
        },
        {
          text: 'Urgence payante',
          style: 'destructive',
          onPress: () => triggerEmergency(doctor, 'paid'),
        },
      ]
    );
  };

  const triggerEmergency = async (doctor: Doctor, emergencyType: 'free' | 'paid') => {
    setTriggerLoading(true);
    try {
      await api.post('/emergency-calls/trigger', {
        doctorId: doctor.id,
        emergencyType,
      });

      const typeLabel = emergencyType === 'paid' ? 'payant' : 'gratuit';
      const doctorName = `Dr. ${doctor.firstName || ''} ${doctor.lastName || ''}`.trim();
      Alert.alert(
        'Appel envoye',
        `Appel d'urgence ${typeLabel} envoye a ${doctorName}. Veuillez patienter.`
      );

      // Refresh data
      api.get('/emergency-calls/patient')
        .then(r => setEmergencies(Array.isArray(r.data) ? r.data : []))
        .catch(() => {});
      fetchCooldowns(doctorsRef.current);
    } catch (err: any) {
      Alert.alert(
        'Erreur',
        err?.response?.data?.message || 'Erreur lors de l\'envoi de l\'appel d\'urgence.'
      );
    } finally {
      setTriggerLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    const map: Record<string, { label: string; bg: string; text: string }> = {
      ACTIVE: { label: 'En cours', bg: '#dc26261a', text: '#f87171' },
      ACKNOWLEDGED: { label: 'Accepte', bg: '#22c55e1a', text: '#4ade80' },
      RESOLVED: { label: 'Expire', bg: '#6b72801a', text: '#9ca3af' },
      FALSE_POSITIVE: { label: 'Faux positif', bg: '#f59e0b1a', text: '#fbbf24' },
    };
    return map[status] || { label: status, bg: '#6b72801a', text: '#9ca3af' };
  };

  const renderDoctorCard = ({ item: doc }: { item: Doctor }) => {
    const cd = cooldowns[doc.id];
    const isBlocked = cd && !cd.allowed;
    const timer = cooldownTimers[doc.id];

    return (
      <View style={[styles.doctorCard, isBlocked && styles.doctorCardBlocked]}>
        <View style={styles.doctorInfo}>
          <View style={styles.doctorAvatar}>
            <Text style={styles.doctorAvatarText}>
              {(doc.firstName?.[0] || '').toUpperCase()}
              {(doc.lastName?.[0] || '').toUpperCase()}
            </Text>
          </View>
          <View style={styles.doctorTextContainer}>
            <Text style={styles.doctorName} numberOfLines={1}>
              Dr. {doc.firstName || ''} {doc.lastName || ''}
            </Text>
            <Text style={styles.doctorSpecialty} numberOfLines={1}>
              {doc.specialty || getDoctorLabel(doc.role)}
            </Text>
          </View>
        </View>

        {isBlocked ? (
          <View style={styles.cooldownContainer}>
            <View style={styles.cooldownBadge}>
              <Text style={styles.cooldownIcon}>[T]</Text>
              <Text style={styles.cooldownText}>{timer || 'Cooldown'}</Text>
            </View>
            {cd?.reason && (
              <Text style={styles.cooldownReason} numberOfLines={2}>{cd.reason}</Text>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.emergencyButton, triggerLoading && styles.emergencyButtonDisabled]}
            onPress={() => handleEmergencyPress(doc)}
            disabled={triggerLoading}
            activeOpacity={0.7}
          >
            <Text style={styles.emergencyButtonIcon}>!!</Text>
            <Text style={styles.emergencyButtonText}>URGENCE</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderEmergencyItem = ({ item: e }: { item: EmergencyEvent }) => {
    const data = e.triggerValue || {};
    const statusCfg = getStatusConfig(e.status);
    const date = new Date(e.createdAt);

    return (
      <View style={styles.historyItem}>
        <View style={styles.historyLeft}>
          <Text style={styles.historyLabel}>
            Appel d'urgence {data.emergencyType === 'paid' ? 'payant' : 'gratuit'}
          </Text>
          <Text style={styles.historyDate}>
            {date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
            {' a '}
            {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
          <Text style={[styles.statusBadgeText, { color: statusCfg.text }]}>
            {statusCfg.label}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={doctors}
        keyExtractor={(item) => item.id}
        renderItem={renderDoctorCard}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Appels d'urgence</Text>
            <View style={styles.sectionHeader}>
              <View style={styles.redDot} />
              <Text style={styles.sectionTitle}>Contacter un praticien</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Selectionnez votre praticien pour lancer un appel d'urgence. Il sera notifie immediatement.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyDoctors}>
            <Text style={styles.emptyText}>Aucun praticien associe.</Text>
            <Text style={styles.emptySubtext}>
              Associez-vous a un praticien depuis votre tableau de bord.
            </Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.historySection}>
            <View style={styles.historySectionHeader}>
              <Text style={styles.historySectionTitle}>Historique des urgences</Text>
            </View>
            {emergencies.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyHistoryText}>Aucun appel d'urgence</Text>
              </View>
            ) : (
              emergencies.map((e) => (
                <View key={e.id}>
                  {renderEmergencyItem({ item: e })}
                </View>
              ))
            )}
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a1628',
  },
  listContent: {
    padding: 16,
    paddingTop: 48,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 20,
  },
  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 18,
  },
  // Doctor cards
  doctorCard: {
    backgroundColor: '#1a2744',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.08)',
  },
  doctorCardBlocked: {
    opacity: 0.7,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  doctorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  doctorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2563eb22',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  doctorAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#60a5fa',
  },
  doctorTextContainer: {
    flex: 1,
  },
  doctorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  doctorSpecialty: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  // Emergency button
  emergencyButton: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emergencyButtonDisabled: {
    opacity: 0.5,
  },
  emergencyButtonIcon: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  emergencyButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  // Cooldown
  cooldownContainer: {
    alignItems: 'flex-start',
  },
  cooldownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  cooldownIcon: {
    fontSize: 11,
    color: '#fbbf24',
    fontWeight: 'bold',
  },
  cooldownText: {
    fontSize: 12,
    color: '#fbbf24',
    fontWeight: '600',
  },
  cooldownReason: {
    fontSize: 11,
    color: 'rgba(251, 191, 36, 0.7)',
    marginTop: 6,
  },
  // Empty states
  emptyDoctors: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
    textAlign: 'center',
  },
  // History section
  historySection: {
    marginTop: 24,
    backgroundColor: '#1a2744',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.08)',
  },
  historySectionHeader: {
    backgroundColor: '#162038',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56, 189, 248, 0.08)',
  },
  historySectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56, 189, 248, 0.05)',
  },
  historyLeft: {
    flex: 1,
    marginRight: 12,
  },
  historyLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#e2e8f0',
  },
  historyDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyHistory: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 13,
    color: '#64748b',
  },
});
