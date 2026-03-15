import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import api from '../../services/api';

export default function AnalysisScreen() {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get('/ai/latest').then((r) => setAnalysis(r.data)).catch(() => {}); }, []);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/ai/analyze', { days: 30 });
      setAnalysis(data);
    } catch {} finally { setLoading(false); }
  };

  const riskColor = (level: string) => {
    const colors: Record<string, string> = { FAIBLE: '#22c55e', MODERE: '#f59e0b', ELEVE: '#ef4444', CRITIQUE: '#dc2626' };
    return colors[level] || '#9ca3af';
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Analyse IA</Text>

      <TouchableOpacity style={[styles.button, loading && { opacity: 0.5 }]} onPress={runAnalysis} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Analyse en cours...' : 'Lancer une analyse'}</Text>
      </TouchableOpacity>

      {analysis ? (
        <View style={styles.results}>
          <View style={[styles.riskBadge, { backgroundColor: riskColor(analysis.riskLevel) + '20', borderColor: riskColor(analysis.riskLevel) }]}>
            <Text style={[styles.riskText, { color: riskColor(analysis.riskLevel) }]}>Risque: {analysis.riskLevel}</Text>
          </View>

          {analysis.patientSummary && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Resume</Text>
              <Text style={styles.cardText}>{analysis.patientSummary}</Text>
            </View>
          )}

          {analysis.alerts?.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Alertes</Text>
              {analysis.alerts.map((a: any, i: number) => (
                <Text key={i} style={styles.alertText}>- [{a.severity}] {a.message}</Text>
              ))}
            </View>
          )}

          <Text style={styles.disclaimer}>Cette analyse ne remplace pas l'avis de votre medecin.</Text>
        </View>
      ) : (
        <Text style={styles.empty}>Aucune analyse disponible. Lancez votre premiere analyse.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16, paddingTop: 48 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  button: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 20 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  results: { gap: 12 },
  riskBadge: { borderWidth: 1, borderRadius: 12, padding: 16, alignItems: 'center' },
  riskText: { fontSize: 18, fontWeight: 'bold' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  cardText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  alertText: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  disclaimer: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 16 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
});
