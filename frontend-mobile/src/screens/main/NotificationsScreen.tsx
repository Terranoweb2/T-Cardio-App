import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import api from '../../services/api';
import { emergencySocket } from '../../services/socket';

interface Notification {
  id: string;
  type: 'EMERGENCY' | 'AI_RISK' | 'THRESHOLD' | 'SYSTEM' | 'INFO';
  title: string;
  message: string;
  severity?: string;
  isRead: boolean;
  createdAt: string;
  patientId?: string;
  patientName?: string;
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const [notifRes, countRes] = await Promise.all([
        api.get('/notifications?limit=50'),
        api.get('/notifications/unread-count'),
      ]);
      const data = notifRes.data.data || notifRes.data || [];
      setNotifications(Array.isArray(data) ? data : []);
      setUnreadCount(countRes.data.count || 0);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Listen for real-time notifications through socket
  useEffect(() => {
    emergencySocket.connect('/emergency');

    const handleEmergency = (data: any) => {
      Alert.alert('ALERTE URGENCE', data.message || 'Alerte critique recue');
      fetchNotifications();
    };

    const handleEmergencyAlert = (data: any) => {
      Alert.alert('Alerte', data.message || 'Nouvelle alerte');
      fetchNotifications();
    };

    emergencySocket.on('emergency', handleEmergency);
    emergencySocket.on('emergency_alert', handleEmergencyAlert);

    return () => {
      emergencySocket.off('emergency', handleEmergency);
      emergencySocket.off('emergency_alert', handleEmergencyAlert);
    };
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      Alert.alert('Erreur', 'Impossible de marquer les notifications comme lues');
    }
  };

  const getTypeConfig = (type: string, severity?: string) => {
    const configs: Record<string, { icon: string; color: string; bg: string }> = {
      EMERGENCY: { icon: '!!', color: '#dc2626', bg: '#fef2f2' },
      AI_RISK: { icon: 'IA', color: '#f59e0b', bg: '#fffbeb' },
      THRESHOLD: { icon: '/!\\', color: '#ef4444', bg: '#fef2f2' },
      SYSTEM: { icon: 'i', color: '#6b7280', bg: '#f3f4f6' },
      INFO: { icon: 'i', color: '#2563eb', bg: '#eff6ff' },
    };
    return configs[type] || configs.INFO;
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'A l\'instant';
    if (minutes < 60) return `Il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Il y a ${days}j`;
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const typeConfig = getTypeConfig(item.type, item.severity);

    return (
      <TouchableOpacity
        style={[styles.card, !item.isRead && styles.cardUnread]}
        onPress={() => !item.isRead && handleMarkAsRead(item.id)}
        activeOpacity={item.isRead ? 1 : 0.7}
      >
        <View style={styles.cardRow}>
          <View style={[styles.typeIcon, { backgroundColor: typeConfig.bg }]}>
            <Text style={[styles.typeIconText, { color: typeConfig.color }]}>
              {typeConfig.icon}
            </Text>
          </View>

          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, !item.isRead && styles.cardTitleUnread]} numberOfLines={1}>
                {item.title}
              </Text>
              {!item.isRead && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.cardMessage} numberOfLines={2}>
              {item.message}
            </Text>
            <View style={styles.cardMeta}>
              <Text style={styles.cardTime}>{formatTimeAgo(item.createdAt)}</Text>
              {item.patientName && (
                <Text style={styles.cardPatient}>Patient: {item.patientName}</Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
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
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllAsRead}>
            <Text style={styles.markAllText}>Tout marquer lu</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{'( )'}</Text>
            <Text style={styles.emptyText}>Aucune notification</Text>
            <Text style={styles.emptySubtext}>
              Vous recevrez des alertes sur votre sante ici
            </Text>
          </View>
        }
        contentContainerStyle={notifications.length === 0 ? { flex: 1 } : undefined}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  countBadge: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  markAllText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
    backgroundColor: '#fafbff',
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeIconText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  cardTitleUnread: {
    fontWeight: '700',
    color: '#1f2937',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
    marginLeft: 8,
  },
  cardMessage: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    marginBottom: 6,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTime: {
    fontSize: 11,
    color: '#9ca3af',
  },
  cardPatient: {
    fontSize: 11,
    color: '#9ca3af',
    fontStyle: 'italic',
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
