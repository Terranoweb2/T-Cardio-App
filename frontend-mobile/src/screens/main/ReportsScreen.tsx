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
  Linking,
} from 'react-native';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

interface Report {
  id: string;
  title?: string;
  periodStart: string;
  periodEnd: string;
  riskLevel?: string;
  status?: string;
  createdAt: string;
  fileUrl?: string;
  doctorNotes?: string;
}

export default function ReportsScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { user } = useAuthStore();
  const isPatient = user?.role === 'PATIENT';

  const fetchReports = useCallback(async () => {
    try {
      const endpoint = isPatient ? '/reports/my' : '/reports/doctor';
      const { data } = await api.get(endpoint);
      setReports(Array.isArray(data) ? data : data.data || []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isPatient]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReports();
  }, [fetchReports]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.post('/reports/generate/my', { periodDays: 30 });
      Alert.alert('Succes', 'Votre rapport a ete genere avec succes');
      fetchReports();
    } catch (err: any) {
      Alert.alert('Erreur', err.response?.data?.message || 'Impossible de generer le rapport');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (reportId: string) => {
    setDownloadingId(reportId);
    try {
      const { data } = await api.get(`/reports/${reportId}/download`);
      if (data.downloadUrl) {
        await Linking.openURL(data.downloadUrl);
      } else {
        Alert.alert('Erreur', 'Le lien de telechargement n\'est pas disponible');
      }
    } catch (err: any) {
      Alert.alert('Erreur', err.response?.data?.message || 'Impossible de telecharger le rapport');
    } finally {
      setDownloadingId(null);
    }
  };

  const riskColor = (level: string) => {
    const colors: Record<string, string> = {
      FAIBLE: '#22c55e',
      MODERE: '#f59e0b',
      ELEVE: '#ef4444',
      CRITIQUE: '#dc2626',
    };
    return colors[level] || '#9ca3af';
  };

  const formatPeriod = (start: string, end: string) => {
    const s = new Date(start).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    const e = new Date(end).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${s} - ${e}`;
  };

  const renderItem = ({ item }: { item: Report }) => {
    const isDownloading = downloadingId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIcon}>
            <Text style={styles.cardIconText}>PDF</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>
              {item.title || `Rapport du ${new Date(item.createdAt).toLocaleDateString('fr-FR')}`}
            </Text>
            <Text style={styles.cardPeriod}>{formatPeriod(item.periodStart, item.periodEnd)}</Text>
          </View>
          {item.riskLevel && (
            <View style={[styles.riskBadge, { backgroundColor: riskColor(item.riskLevel) + '20' }]}>
              <Text style={[styles.riskBadgeText, { color: riskColor(item.riskLevel) }]}>
                {item.riskLevel}
              </Text>
            </View>
          )}
        </View>

        {item.doctorNotes && (
          <Text style={styles.notes} numberOfLines={2}>
            Note: {item.doctorNotes}
          </Text>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.cardDate}>
            Cree le {new Date(item.createdAt).toLocaleDateString('fr-FR')}
          </Text>
          <TouchableOpacity
            style={[styles.downloadBtn, isDownloading && styles.downloadBtnDisabled]}
            onPress={() => handleDownload(item.id)}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <Text style={styles.downloadBtnText}>Telecharger</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
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
      <Text style={styles.title}>Mes rapports</Text>

      {isPatient && (
        <TouchableOpacity
          style={[styles.generateBtn, generating && { opacity: 0.5 }]}
          onPress={handleGenerate}
          disabled={generating}
        >
          <Text style={styles.generateBtnText}>
            {generating ? 'Generation en cours...' : 'Generer un rapport (30 jours)'}
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{'[ ]'}</Text>
            <Text style={styles.emptyText}>Aucun rapport</Text>
            {isPatient && (
              <Text style={styles.emptySubtext}>
                Generez votre premier rapport pour suivre votre evolution
              </Text>
            )}
          </View>
        }
        contentContainerStyle={reports.length === 0 ? { flex: 1 } : undefined}
      />
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  generateBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 15,
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
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  cardPeriod: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  riskBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  notes: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  cardDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  downloadBtn: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  downloadBtnDisabled: {
    opacity: 0.5,
  },
  downloadBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
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
    paddingHorizontal: 32,
  },
});
