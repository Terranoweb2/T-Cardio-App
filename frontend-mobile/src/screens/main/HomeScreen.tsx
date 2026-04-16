import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../../services/api';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState<any>(null);
  const [latestAi, setLatestAi] = useState<any>(null);

  useEffect(() => {
    api.get('/measurements/stats?days=30').then((r) => setStats(r.data)).catch(() => {});
    api.get('/ai/latest').then((r) => setLatestAi(r.data)).catch(() => {});
  }, []);

  const riskColor = (level: string) => {
    const colors: Record<string, string> = { FAIBLE: '#22c55e', MODERE: '#f59e0b', ELEVE: '#ef4444', CRITIQUE: '#dc2626' };
    return colors[level] || '#9ca3af';
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Tableau de bord</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Tension moyenne (30j)</Text>
        <Text style={styles.cardValue}>{stats ? `${stats.systolic?.avg}/${stats.diastolic?.avg}` : '--/--'}</Text>
        <Text style={styles.cardUnit}>mmHg</Text>
      </View>

      <View style={styles.row}>
        <View style={[styles.card, styles.halfCard]}>
          <Text style={styles.cardLabel}>Mesures</Text>
          <Text style={styles.cardValue}>{stats?.count || 0}</Text>
        </View>
        <View style={[styles.card, styles.halfCard]}>
          <Text style={styles.cardLabel}>Risque IA</Text>
          {latestAi?.riskLevel ? (
            <Text style={[styles.cardValue, { color: riskColor(latestAi.riskLevel) }]}>{latestAi.riskLevel}</Text>
          ) : <Text style={styles.cardValueMuted}>--</Text>}
        </View>
      </View>

      <TouchableOpacity
        style={styles.emergencyBanner}
        onPress={() => navigation.navigate('More', { screen: 'Emergency' })}
        activeOpacity={0.8}
      >
        <View style={styles.emergencyBannerContent}>
          <Text style={styles.emergencyIcon}>!!</Text>
          <View style={styles.emergencyTextContainer}>
            <Text style={styles.emergencyBannerTitle}>Urgences</Text>
            <Text style={styles.emergencyBannerSubtitle}>Contacter un praticien en urgence</Text>
          </View>
          <Text style={styles.emergencyArrow}>{'>'}</Text>
        </View>
      </TouchableOpacity>

      {latestAi?.patientSummary && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Resume IA</Text>
          <Text style={styles.aiText}>{latestAi.patientSummary}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1f2937', marginBottom: 16, marginTop: 48 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  row: { flexDirection: 'row', gap: 12 },
  halfCard: { flex: 1 },
  cardLabel: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  cardValue: { fontSize: 28, fontWeight: 'bold', color: '#2563eb' },
  cardValueMuted: { fontSize: 28, fontWeight: 'bold', color: '#d1d5db' },
  cardUnit: { fontSize: 12, color: '#9ca3af' },
  aiText: { fontSize: 14, color: '#374151', lineHeight: 20, marginTop: 8 },
  emergencyBanner: {
    backgroundColor: '#dc2626',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#dc2626',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  emergencyBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emergencyIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 40,
    height: 40,
    borderRadius: 20,
    textAlign: 'center',
    lineHeight: 40,
    marginRight: 12,
    overflow: 'hidden',
  },
  emergencyTextContainer: {
    flex: 1,
  },
  emergencyBannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  emergencyBannerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  emergencyArrow: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: 'bold',
  },
});
