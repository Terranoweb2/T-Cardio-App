import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import api from '../../services/api';

export default function AddMeasurementScreen() {
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!systolic || !diastolic) { Alert.alert('Erreur', 'Remplissez systolique et diastolique'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/measurements', {
        systolic: parseInt(systolic), diastolic: parseInt(diastolic),
        pulse: pulse ? parseInt(pulse) : undefined,
        measuredAt: new Date().toISOString(),
      });
      if (data.isEmergency) {
        Alert.alert('URGENCE', 'Valeurs critiques! Contactez votre medecin immediatement.');
      } else {
        Alert.alert('Enregistre', `Risque: ${data.riskLevel}`);
      }
      setSystolic(''); setDiastolic(''); setPulse('');
    } catch (err: any) {
      Alert.alert('Erreur', err.response?.data?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Nouvelle mesure</Text>

      <View style={styles.row}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Systolique</Text>
          <TextInput style={styles.bigInput} value={systolic} onChangeText={setSystolic}
            keyboardType="numeric" placeholder="120" maxLength={3} />
          <Text style={styles.unit}>mmHg</Text>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Diastolique</Text>
          <TextInput style={styles.bigInput} value={diastolic} onChangeText={setDiastolic}
            keyboardType="numeric" placeholder="80" maxLength={3} />
          <Text style={styles.unit}>mmHg</Text>
        </View>
      </View>

      <Text style={styles.label}>Pouls (optionnel)</Text>
      <TextInput style={styles.input} value={pulse} onChangeText={setPulse}
        keyboardType="numeric" placeholder="72 bpm" maxLength={3} />

      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Enregistrement...' : 'Enregistrer'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16, paddingTop: 48 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  inputGroup: { flex: 1, alignItems: 'center' },
  label: { fontSize: 14, color: '#6b7280', marginBottom: 8 },
  bigInput: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#2563eb', borderRadius: 16, padding: 20, fontSize: 32, fontWeight: 'bold', textAlign: 'center', width: '100%' },
  unit: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 24 },
  button: { backgroundColor: '#2563eb', borderRadius: 16, padding: 18, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
