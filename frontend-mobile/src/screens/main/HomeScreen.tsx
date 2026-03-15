import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import api from '../../services/api';

export default function HomeScreen() {
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
});
