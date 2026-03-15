import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import api from '../../services/api';

export default function MeasurementsScreen() {
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    api.get(`/measurements?days=${period}&limit=50`).then((r) => setMeasurements(r.data.data)).catch(() => {});
  }, [period]);

  const riskColor = (level: string) => {
    const colors: Record<string, string> = { FAIBLE: '#22c55e', MODERE: '#f59e0b', ELEVE: '#ef4444', CRITIQUE: '#dc2626' };
    return colors[level] || '#9ca3af';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mes mesures</Text>
      <View style={styles.filters}>
        {[7, 30, 90].map((d) => (
          <TouchableOpacity key={d} onPress={() => setPeriod(d)}
            style={[styles.filterBtn, period === d && styles.filterActive]}>
            <Text style={[styles.filterText, period === d && styles.filterTextActive]}>{d}j</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList data={measurements} keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.card, item.isEmergency && styles.emergencyCard]}>
            <View style={styles.cardRow}>
              <Text style={styles.bpValue}>{item.systolic}/{item.diastolic}</Text>
              <Text style={styles.bpUnit}>mmHg</Text>
              {item.pulse && <Text style={styles.pulse}>{item.pulse} bpm</Text>}
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.date}>{new Date(item.measuredAt).toLocaleString('fr-FR')}</Text>
              {item.riskLevel && (
                <View style={[styles.badge, { backgroundColor: riskColor(item.riskLevel) + '20' }]}>
                  <Text style={[styles.badgeText, { color: riskColor(item.riskLevel) }]}>{item.riskLevel}</Text>
                </View>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucune mesure</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16, paddingTop: 48 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db' },
  filterActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterText: { fontSize: 13, color: '#6b7280' },
  filterTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8 },
  emergencyCard: { borderLeftWidth: 4, borderLeftColor: '#dc2626' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  bpValue: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  bpUnit: { fontSize: 13, color: '#9ca3af' },
  pulse: { fontSize: 13, color: '#6b7280' },
  date: { fontSize: 12, color: '#9ca3af' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
});
