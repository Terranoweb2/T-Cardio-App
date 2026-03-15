import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

export default function LoginScreen({ navigation }: any) {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      await login(data.user, data.accessToken, data.refreshToken);
    } catch (err: any) {
      Alert.alert('Erreur', err.response?.data?.message || 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>T-Cardio Pro</Text>
      <Text style={styles.subtitle}>Connexion</Text>

      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail}
        keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Mot de passe" value={password}
        onChangeText={setPassword} secureTextEntry />

      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Connexion...' : 'Se connecter'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>Pas de compte ? Creer un compte</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f9fafb' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#2563eb', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 18, color: '#6b7280', textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, padding: 16, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: '#2563eb', textAlign: 'center', marginTop: 16 },
});
