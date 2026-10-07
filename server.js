const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const webPush = require('web-push');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Auto-check or generate VAPID keys if missing
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
let vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@guvenlikampus.poc';

if (!vapidPublicKey || !vapidPrivateKey) {
  console.log('[Server] VAPID keys not found in environment, generating on startup...');
  const generated = webPush.generateVAPIDKeys();
  vapidPublicKey = generated.publicKey;
  vapidPrivateKey = generated.privateKey;
  
  const envPath = path.join(__dirname, '.env');
  const envContent = `PORT=${PORT}
VAPID_PUBLIC_KEY=${vapidPublicKey}
VAPID_PRIVATE_KEY=${vapidPrivateKey}
VAPID_EMAIL=${vapidEmail}
`;
  try {
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log(`[Server] Saved new VAPID keys to ${envPath}`);
  } catch (err) {
    console.warn('[Server] Could not write .env file, continuing with in-memory keys:', err.message);
  }
}

// Configure Web Push with VAPID details
webPush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
console.log('[Server] Web Push configured with VAPID Public Key:', vapidPublicKey.substring(0, 16) + '...');

// Persistent subscription storage in data/subscriptions.json
const dataDir = path.join(__dirname, 'data');
const subsFilePath = path.join(dataDir, 'subscriptions.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let subscriptions = [];
function loadSubscriptions() {
  try {
    if (fs.existsSync(subsFilePath)) {
      const data = fs.readFileSync(subsFilePath, 'utf8');
      subscriptions = JSON.parse(data);
      console.log(`[Server] Loaded ${subscriptions.length} subscription(s) from disk`);
    } else {
      subscriptions = [];
    }
  } catch (e) {
    console.error('[Server] Error reading subscriptions file:', e);
    subscriptions = [];
  }
}

function saveSubscriptions() {
  try {
    fs.writeFileSync(subsFilePath, JSON.stringify(subscriptions, null, 2), 'utf8');
  } catch (e) {
    console.error('[Server] Error saving subscriptions:', e);
  }
}

loadSubscriptions();

// ================= API ENDPOINTS =================

// 1. Get VAPID Public Key for client subscription
app.get('/api/vapid-public-key', (req, res) => {
  res.json({
    success: true,
    publicKey: vapidPublicKey
  });
});

// 2. Health & Status Check
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    name: 'Güvenli Kampüs PoC Server',
    activeSubscribers: subscriptions.length,
    vapidConfigured: !!(vapidPublicKey && vapidPrivateKey),
    time: new Date().toISOString()
  });
});

// 3. Register / Subscribe Device
app.post('/api/subscribe', (req, res) => {
  const { subscription, deviceInfo } = req.body;

  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({
      success: false,
      message: 'Geçersiz subscription nesnesi. Endpoint ve keys zorunludur.'
    });
  }

  // Check if already subscribed
  const existingIndex = subscriptions.findIndex(sub => sub.endpoint === subscription.endpoint);
  const now = new Date().toISOString();

  const record = {
    id: 'sub_' + Math.random().toString(36).substring(2, 9),
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    userAgent: deviceInfo?.userAgent || req.headers['user-agent'] || 'Bilinmiyor',
    platform: deviceInfo?.platform || 'Web',
    deviceType: deviceInfo?.deviceType || 'Bilinmiyor',
    createdAt: existingIndex !== -1 ? subscriptions[existingIndex].createdAt : now,
    updatedAt: now,
    ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress
  };

  if (existingIndex !== -1) {
    subscriptions[existingIndex] = { ...subscriptions[existingIndex], ...record };
    console.log(`[Server] Subscription updated for endpoint: ${subscription.endpoint.substring(0, 35)}...`);
  } else {
    subscriptions.push(record);
    console.log(`[Server] New subscription registered! Total subscribers: ${subscriptions.length}`);
  }

  saveSubscriptions();

  res.status(201).json({
    success: true,
    message: 'Abonelik başarıyla kaydedildi.',
    totalSubscribers: subscriptions.length,
    id: record.id
  });
});

// 4. Unsubscribe Device
app.post('/api/unsubscribe', (req, res) => {
  const { endpoint } = req.body;

  if (!endpoint) {
    return res.status(400).json({
      success: false,
      message: 'Endpoint parametresi zorunludur.'
    });
  }

  const initialCount = subscriptions.length;
  subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
  saveSubscriptions();

  const removed = initialCount - subscriptions.length;
  console.log(`[Server] Unsubscribed endpoint. Removed: ${removed}. Remaining: ${subscriptions.length}`);

  res.json({
    success: true,
    message: removed > 0 ? 'Abonelik iptal edildi.' : 'Abonelik bulunamadı.',
    totalSubscribers: subscriptions.length
  });
});

// 5. Get List of Subscribed Devices (For Admin UI)
app.get('/api/subscriptions', (req, res) => {
  const sanitized = subscriptions.map(sub => ({
    id: sub.id,
    endpointMasked: sub.endpoint.substring(0, 28) + '...' + sub.endpoint.slice(-8),
    endpointFull: sub.endpoint,
    deviceType: sub.deviceType,
    platform: sub.platform,
    userAgent: sub.userAgent,
    createdAt: sub.createdAt,
    updatedAt: sub.updatedAt
  }));

  res.json({
    success: true,
    count: sanitized.length,
    subscribers: sanitized
  });
});

// 6. Send Push Notification (Single or Broadcast)
app.post('/api/send-notification', async (req, res) => {
  const { title, body, url, targetEndpoint, badge, icon, tag } = req.body;

  if (!title || !body) {
    return res.status(400).json({
      success: false,
      message: 'Başlık (title) ve Mesaj (body) alanları zorunludur.'
    });
  }

  // Determine target audience
  let targets = [];
  if (targetEndpoint && targetEndpoint !== 'all') {
    const single = subscriptions.find(s => s.endpoint === targetEndpoint);
    if (!single) {
      return res.status(404).json({
        success: false,
        message: 'Belirtilen hedef cihaz aboneliği bulunamadı.'
      });
    }
    targets = [single];
  } else {
    targets = [...subscriptions];
  }

  if (targets.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Gönderilecek aktif abone cihaz bulunmuyor. Lütfen önce bir cihazdan bildirimlere abone olun.'
    });
  }

  const notificationPayload = JSON.stringify({
    title: title.trim(),
    body: body.trim(),
    url: url && url.trim() ? url.trim() : '/',
    icon: icon || '/icons/icon-192.png',
    badge: badge || '/icons/badge.png',
    tag: tag || `kampus-${Date.now()}`,
    timestamp: Date.now()
  });

  const deadEndpoints = [];
  let successfulSends = 0;
  let failedSends = 0;
  const dispatchLogs = [];

  const promises = targets.map(async (targetSub) => {
    const pushSubscription = {
      endpoint: targetSub.endpoint,
      keys: targetSub.keys
    };

    try {
      await webPush.sendNotification(pushSubscription, notificationPayload, {
        TTL: 24 * 60 * 60, // 24 hours Time To Live
        urgency: 'high'
      });
      successfulSends++;
      dispatchLogs.push({
        id: targetSub.id,
        status: 'DELIVERED',
        platform: targetSub.platform
      });
    } catch (err) {
      failedSends++;
      const statusCode = err.statusCode || err.code;
      console.warn(`[Push Error] Endpoint: ${targetSub.endpoint.substring(0, 30)}... Code: ${statusCode}`);

      // 404 Not Found or 410 Gone means subscriber unregistered or browser revoked
      if (statusCode === 404 || statusCode === 410) {
        deadEndpoints.push(targetSub.endpoint);
        dispatchLogs.push({
          id: targetSub.id,
          status: 'EXPIRED_REMOVED',
          statusCode
        });
      } else {
        dispatchLogs.push({
          id: targetSub.id,
          status: 'FAILED',
          statusCode,
          error: err.message
        });
      }
    }
  });

  await Promise.all(promises);

  // Clean up dead subscriptions
  if (deadEndpoints.length > 0) {
    subscriptions = subscriptions.filter(sub => !deadEndpoints.includes(sub.endpoint));
    saveSubscriptions();
    console.log(`[Server] Cleaned up ${deadEndpoints.length} expired subscriptions. Remaining: ${subscriptions.length}`);
  }

  res.json({
    success: true,
    message: `${successfulSends} cihaza bildirim başarıyla iletildi.`,
    sentCount: successfulSends,
    failedCount: failedSends,
    removedExpiredCount: deadEndpoints.length,
    remainingSubscribers: subscriptions.length,
    logs: dispatchLogs
  });
});

// Route redirects
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// SPA fallback for HTML pages only, return 404 JSON for unknown API endpoints
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API endpoint bulunamadı.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🛡️  GÜVENLİ KAMPÜS PoC - WEB PUSH SUNUCUSU ÇALIŞIYOR`);
  console.log(`======================================================`);
  console.log(`📡 Yerel URL      : http://localhost:${PORT}`);
  console.log(`📱 Kullanıcı Arayüzü: http://localhost:${PORT}/`);
  console.log(`⚙️  Yönetici Paneli  : http://localhost:${PORT}/admin`);
  console.log(`🔑 VAPID Public Key: ${vapidPublicKey}`);
  console.log(`💾 Aktif Abone    : ${subscriptions.length}`);
  console.log(`======================================================\n`);
});
