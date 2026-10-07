// Service Worker for Güvenli Kampüs PoC
const CACHE_NAME = 'guvenli-kampus-v1';

// Install event - activate immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installed');
  self.skipWaiting();
});

// Activate event - claim all clients immediately
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated and claiming clients');
  event.waitUntil(self.clients.claim());
});

// Push event - triggered when a Web Push message arrives from the server
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  let payload = {
    title: 'Güvenli Kampüs Bildirimi',
    body: 'Yeni bir duyuru veya güvenlik uyarısı alındı.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge.png',
    url: '/',
    tag: 'kampus-bildirim',
    timestamp: Date.now()
  };

  if (event.data) {
    try {
      const data = event.data.json();
      payload = {
        ...payload,
        ...data
      };
    } catch (err) {
      console.warn('[SW] Could not parse push payload as JSON, using raw text:', err);
      payload.body = event.data.text() || payload.body;
    }
  }

  const notificationOptions = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/badge.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: payload.tag || `kampus-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    data: {
      url: payload.url || '/',
      timestamp: payload.timestamp || Date.now()
    },
    actions: [
      {
        action: 'open_url',
        title: 'Detayı Aç'
      },
      {
        action: 'dismiss',
        title: 'Kapat'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, notificationOptions)
  );
});

// Notification click event - handle user clicking on the banner or action buttons
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification);
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) 
    ? event.notification.data.url 
    : '/';

  // Open the target URL or focus existing window if already open
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const resolvedTarget = new URL(targetUrl, self.location.origin).href;

      for (const client of clientList) {
        if (client.url === resolvedTarget && 'focus' in client) {
          return client.focus();
        }
      }

      // If existing window is open on the origin, navigate and focus
      if (clientList.length > 0 && 'focus' in clientList[0]) {
        const client = clientList[0];
        if ('navigate' in client) {
          client.navigate(resolvedTarget);
        }
        return client.focus();
      }

      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(resolvedTarget);
      }
    })
  );
});

// Push subscription change (fallback if provider invalidates subscription)
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed:', event);
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then((newSubscription) => {
        return fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: newSubscription,
            deviceInfo: { userAgent: navigator.userAgent, autoRenewed: true }
          })
        });
      })
      .catch((err) => console.error('[SW] Failed to renew subscription:', err))
  );
});
