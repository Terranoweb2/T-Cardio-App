/* T-Cardio Pro — Service Worker for Push Notifications */

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.body || '',
    icon: '/logo-T-Cardio.png',
    badge: '/logo-T-Cardio.png',
    tag: data.tag || 'default',
    data: data.data || {},
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200],
  };

  // Incoming call — persistent with actions
  if (data.data && data.data.type === 'call') {
    options.requireInteraction = true;
    options.actions = [
      { action: 'accept', title: 'Accepter' },
      { action: 'decline', title: 'Refuser' },
    ];
    options.vibrate = [500, 200, 500, 200, 500];
  }

  // Missed call — persistent with callback action
  if (data.data && data.data.type === 'missed_call') {
    options.requireInteraction = true;
    options.actions = [
      { action: 'callback', title: 'Rappeler' },
    ];
    options.vibrate = [300, 100, 300];
  }

  // Emergency — persistent
  if (data.data && data.data.type === 'emergency') {
    options.requireInteraction = true;
    options.vibrate = [1000, 200, 1000];
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'T-Cardio Pro', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let url = '/dashboard';

  if (data.type === 'call' && data.teleconsultationId) {
    if (event.action === 'accept') {
      url = '/teleconsultations/' + data.teleconsultationId + '?autoAccept=true';
    } else if (event.action === 'decline') {
      // Just close the notification
      return;
    } else {
      url = '/teleconsultations/' + data.teleconsultationId;
    }
  } else if (data.type === 'message' && data.conversationId) {
    url = '/messaging?conversation=' + data.conversationId;
  } else if (data.type === 'missed_call' && data.teleconsultationId) {
    url = '/teleconsultations/' + data.teleconsultationId;
  } else if (data.type === 'emergency') {
    url = '/notifications';
  } else if (data.type === 'reminder') {
    url = '/measurements/add';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      // Focus an existing window if available
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if ('focus' in client) {
          return client.focus().then(function (c) {
            if (c.navigate) c.navigate(url);
            return c;
          });
        }
      }
      // Open a new window
      return self.clients.openWindow(url);
    })
  );
});
