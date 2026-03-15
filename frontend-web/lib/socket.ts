import { io, Socket } from 'socket.io-client';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001';

let emergencySocket: Socket | null = null;
let teleconsultationSocket: Socket | null = null;
let messagingSocket: Socket | null = null;

// Store user info for re-joining rooms on reconnect
let currentUserId: string | null = null;
let currentRole: string | null = null;

function createSocket(namespace: string): Socket {
  return io(`${BACKEND_URL}${namespace}`, {
    auth: (cb) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      cb({ token });
    },
    transports: ['websocket', 'polling'],
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 200,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 15000,
  });
}

export function getEmergencySocket(): Socket {
  if (!emergencySocket) {
    emergencySocket = createSocket('/emergency');
  }
  return emergencySocket;
}

export function getTeleconsultationSocket(): Socket {
  if (!teleconsultationSocket) {
    teleconsultationSocket = createSocket('/teleconsultation');
  }
  return teleconsultationSocket;
}

export function getMessagingSocket(): Socket {
  if (!messagingSocket) {
    messagingSocket = createSocket('/messaging');
  }
  return messagingSocket;
}

export function connectSockets(userId: string, role: string) {
  currentUserId = userId;
  currentRole = role;

  const emergency = getEmergencySocket();

  // Remove ALL old 'connect' listeners to avoid duplicates
  emergency.removeAllListeners('connect');

  // Re-join room on every connect/reconnect
  emergency.on('connect', () => {
    console.log('[Socket] Emergency socket connected — joining room');
    emergency.emit('join', { userId, role });
  });

  // Reconnect handler — log for debugging
  emergency.on('reconnect', (attempt: number) => {
    console.log(`[Socket] Emergency socket reconnected after ${attempt} attempts`);
  });

  emergency.on('disconnect', (reason: string) => {
    console.log(`[Socket] Emergency socket disconnected: ${reason}`);
  });

  if (!emergency.connected) {
    emergency.connect();
  } else {
    // Already connected — join room now
    emergency.emit('join', { userId, role });
  }

  // Setup visibility/online listeners for reconnection
  setupAutoReconnect(emergency, userId, role);
}

/**
 * Re-connect socket + re-join room when app comes back to foreground
 * or when network comes back online.
 */
let autoReconnectSetup = false;
let lastJoinTimestamp = 0;

function setupAutoReconnect(socket: Socket, userId: string, role: string) {
  // Only setup listeners ONCE
  if (autoReconnectSetup) return;
  autoReconnectSetup = true;

  const reconnect = () => {
    // Debounce: skip if we joined less than 2 seconds ago
    const now = Date.now();
    if (now - lastJoinTimestamp < 2000) return;
    lastJoinTimestamp = now;

    // Reconnect emergency socket
    if (!socket.connected) {
      console.log('[Socket] Reconnecting emergency socket after visibility/online change...');
      socket.connect();
    } else {
      // Already connected — re-join room (server may have lost the assignment)
      console.log('[Socket] Re-joining emergency room after foreground/online');
      socket.emit('join', { userId: currentUserId, role: currentRole });
    }

    // Also reconnect teleconsultation socket if it exists and is disconnected
    if (teleconsultationSocket && !teleconsultationSocket.connected) {
      console.log('[Socket] Reconnecting teleconsultation socket...');
      teleconsultationSocket.connect();
    }

    // Also reconnect messaging socket if it exists and is disconnected
    if (messagingSocket && !messagingSocket.connected) {
      console.log('[Socket] Reconnecting messaging socket...');
      messagingSocket.connect();
    }
  };

  // Page visibility (browser tab switch, app background/foreground)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      setTimeout(reconnect, 100);
    }
  });

  // Network back online
  window.addEventListener('online', () => setTimeout(reconnect, 200));

  // Heartbeat: periodically check if sockets are connected (every 30s)
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if (currentUserId && socket && !socket.connected) {
      console.log('[Socket] Heartbeat detected disconnected emergency socket — reconnecting');
      socket.connect();
    }
    if (teleconsultationSocket && !teleconsultationSocket.connected) {
      console.log('[Socket] Heartbeat detected disconnected teleconsultation socket — reconnecting');
      teleconsultationSocket.connect();
    }
  }, 30_000);

  // Capacitor: app state change (foreground/background)
  if (typeof window !== 'undefined') {
    import('@capacitor/app').then(({ App }) => {
      App.addListener('appStateChange', (state) => {
        console.log('[Socket] App state:', state.isActive ? 'FOREGROUND' : 'BACKGROUND');
        if (state.isActive) {
          setTimeout(reconnect, 500);
        }
      });
    }).catch(() => {
      // Not a native platform — ignore
    });
  }
}

export function disconnectSockets() {
  currentUserId = null;
  currentRole = null;
  autoReconnectSetup = false;

  if (emergencySocket) {
    emergencySocket.removeAllListeners();
    emergencySocket.disconnect();
    emergencySocket = null;
  }
  if (teleconsultationSocket) {
    teleconsultationSocket.disconnect();
    teleconsultationSocket = null;
  }
  if (messagingSocket) {
    messagingSocket.disconnect();
    messagingSocket = null;
  }
}
