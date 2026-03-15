import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

interface PatientProfile {
  firstName: string;
  lastName: string;
  weightKg: string;
  heightCm: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const [profile, setProfile] = useState<PatientProfile>({
    firstName: '',
    lastName: '',
    weightKg: '',
    heightCm: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });
  const [originalProfile, setOriginalProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get('/patients/profile');
      const p: PatientProfile = {
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        weightKg: data.weightKg != null ? String(data.weightKg) : '',
        heightCm: data.heightCm != null ? String(data.heightCm) : '',
        emergencyContactName: data.emergencyContactName || '',
        emergencyContactPhone: data.emergencyContactPhone || '',
      };
      setProfile(p);
      setOriginalProfile(p);
    } catch {
      // Profile may not exist yet for new users
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile.firstName.trim() || !profile.lastName.trim()) {
      Alert.alert('Erreur', 'Le prenom et le nom sont obligatoires');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
      };

      if (profile.weightKg) payload.weightKg = parseFloat(profile.weightKg);
      if (profile.heightCm) payload.heightCm = parseInt(profile.heightCm, 10);
      if (profile.emergencyContactName.trim()) {
        payload.emergencyContactName = profile.emergencyContactName.trim();
      }
      if (profile.emergencyContactPhone.trim()) {
        payload.emergencyContactPhone = profile.emergencyContactPhone.trim();
      }

      await api.patch('/patients/profile', payload);
      setOriginalProfile({ ...profile });
      setIsEditing(false);
      Alert.alert('Succes', 'Profil mis a jour avec succes');
    } catch (err: any) {
      Alert.alert('Erreur', err.response?.data?.message || 'Impossible de sauvegarder le profil');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (originalProfile) {
      setProfile({ ...originalProfile });
    }
    setIsEditing(false);
  };

  const hasChanges = () => {
    if (!originalProfile) return true;
    return (
      profile.firstName !== originalProfile.firstName ||
      profile.lastName !== originalProfile.lastName ||
      profile.weightKg !== originalProfile.weightKg ||
      profile.heightCm !== originalProfile.heightCm ||
      profile.emergencyContactName !== originalProfile.emergencyContactName ||
      profile.emergencyContactPhone !== originalProfile.emergencyContactPhone
    );
  };

  const handleLogout = () => {
    Alert.alert('Deconnexion', 'Voulez-vous vraiment vous deconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Deconnexion', style: 'destructive', onPress: logout },
    ]);
  };

  const updateField = (field: keyof PatientProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Profil</Text>
        {!isEditing ? (
          <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
            <Text style={styles.editButtonText}>Modifier</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, (!hasChanges() || saving) && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={!hasChanges() || saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* User info (read-only) */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Compte</Text>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.readOnlyValue}>{user?.email}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Role</Text>
          <Text style={styles.readOnlyValue}>{user?.role}</Text>
        </View>
      </View>

      {/* Personal info */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Informations personnelles</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Prenom *</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={profile.firstName}
              onChangeText={(v) => updateField('firstName', v)}
              placeholder="Votre prenom"
              autoCapitalize="words"
            />
          ) : (
            <Text style={styles.value}>{profile.firstName || '--'}</Text>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Nom *</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={profile.lastName}
              onChangeText={(v) => updateField('lastName', v)}
              placeholder="Votre nom"
              autoCapitalize="words"
            />
          ) : (
            <Text style={styles.value}>{profile.lastName || '--'}</Text>
          )}
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricField}>
            <Text style={styles.label}>Poids (kg)</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={profile.weightKg}
                onChangeText={(v) => updateField('weightKg', v)}
                placeholder="75"
                keyboardType="decimal-pad"
                maxLength={5}
              />
            ) : (
              <Text style={styles.value}>
                {profile.weightKg ? `${profile.weightKg} kg` : '--'}
              </Text>
            )}
          </View>
          <View style={styles.metricField}>
            <Text style={styles.label}>Taille (cm)</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={profile.heightCm}
                onChangeText={(v) => updateField('heightCm', v)}
                placeholder="170"
                keyboardType="numeric"
                maxLength={3}
              />
            ) : (
              <Text style={styles.value}>
                {profile.heightCm ? `${profile.heightCm} cm` : '--'}
              </Text>
            )}
          </View>
        </View>

        {/* BMI display */}
        {profile.weightKg && profile.heightCm && (
          <View style={styles.bmiBox}>
            <Text style={styles.bmiLabel}>IMC (Indice de Masse Corporelle)</Text>
            <Text style={styles.bmiValue}>
              {(parseFloat(profile.weightKg) / Math.pow(parseInt(profile.heightCm, 10) / 100, 2)).toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      {/* Emergency contact */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Contact d'urgence</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Nom du contact</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={profile.emergencyContactName}
              onChangeText={(v) => updateField('emergencyContactName', v)}
              placeholder="Nom du contact d'urgence"
              autoCapitalize="words"
            />
          ) : (
            <Text style={styles.value}>{profile.emergencyContactName || '--'}</Text>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Telephone d'urgence</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={profile.emergencyContactPhone}
              onChangeText={(v) => updateField('emergencyContactPhone', v)}
              placeholder="+33 6 XX XX XX XX"
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.value}>{profile.emergencyContactPhone || '--'}</Text>
          )}
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Deconnexion</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>T-Cardio Pro v1.0.0</Text>
      </View>
    </ScrollView>
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
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  editButton: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  editButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 14,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 6,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  readOnlyValue: {
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1f2937',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricField: {
    flex: 1,
    marginBottom: 14,
  },
  bmiBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bmiLabel: {
    fontSize: 13,
    color: '#2563eb',
    flex: 1,
  },
  bmiValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  logoutBtn: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#d1d5db',
  },
});
