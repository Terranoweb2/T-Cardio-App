import * as SecureStore from 'expo-secure-store';

const API_URL = 'http://localhost:3001';

type EventCallback = (...args: any[]) => void;

interface SocketMessage {
  event: string;
  data: any;
}

/**
 * Lightweight Socket.IO-like client for React Native.
 * Since socket.io-client is not in package.json, we use a minimal
 * WebSocket wrapper that follows the socket.io protocol basics.
 * Connects to /emergency and /teleconsultation namespaces.
 */
class SocketService {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private namespace: string = '';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isConnected: boolean = false;
  private userId: string = '';
  private userRole: string = '';

  async connect(namespace: string = '/emergency'): Promise<void> {
    this.namespace = namespace;

    try {
      const token = await SecureStore.getItemAsync('accessToken');
      const userStr = await SecureStore.getItemAsync('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        this.userId = user.id;
        this.userRole = user.role;
      }

      const wsUrl = API_URL.replace('http', 'ws') + namespace;
      const urlWithAuth = token ? `${wsUrl}?token=${token}` : wsUrl;

      this.ws = new WebSocket(urlWithAuth);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Auto-join room on connect
        if (namespace === '/emergency' && this.userId) {
          this.emit('join', { userId: this.userId, role: this.userRole });
        }

        this.notifyListeners('connect', {});
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed: SocketMessage = JSON.parse(event.data);
          this.notifyListeners(parsed.event, parsed.data);
        } catch {
          // Ignore non-JSON messages
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyListeners('disconnect', {});
        this.attemptReconnect();
      };

      this.ws.onerror = () => {
        this.notifyListeners('error', { message: 'WebSocket error' });
      };
    } catch (err) {
      console.warn('[SocketService] Connection failed:', err);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    this.reconnectTimeout = setTimeout(() => {
      this.connect(this.namespace);
    }, delay);
  }

  emit(event: string, data: any): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({ event, data }));
    }
  }

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback?: EventCallback): void {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
    } else {
      this.listeners.delete(event);
    }
  }

  private notifyListeners(event: string, data: any): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.warn('[SocketService] Listener error:', err);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // prevent reconnect
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.listeners.clear();
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getUserId(): string {
    return this.userId;
  }

  getUserRole(): string {
    return this.userRole;
  }
}

// Singleton instances for each namespace
export const emergencySocket = new SocketService();
export const teleconsultationSocket = new SocketService();

export default SocketService;
