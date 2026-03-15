import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

export default function RegisterScreen({ navigation }: any) {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { email, password, role: 'PATIENT' });
      await login(data.user, data.accessToken, data.refreshToken);
    } catch (err: any) {
      Alert.alert('Erreur', err.response?.data?.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inscription Patient</Text>

      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail}
        keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Mot de passe (8 car. min)" value={password}
        onChangeText={setPassword} secureTextEntry />

      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Inscription...' : 'Creer mon compte'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Deja inscrit ? Se connecter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f9fafb' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2563eb', textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, padding: 16, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: '#2563eb', textAlign: 'center', marginTop: 16 },
});
