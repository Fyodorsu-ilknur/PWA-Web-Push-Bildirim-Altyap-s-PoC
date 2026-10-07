// Client-side Application Logic for Güvenli Kampüs PoC

let swRegistration = null;
let currentSubscription = null;
let deferredPrompt = null;

// Convert VAPID base64 string to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:1.1rem; margin-left:0.5rem;" onclick="this.parentElement.remove()">×</button>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.4s ease';
    setTimeout(() => toast.remove(), 400);
  }, 4500);
}

// Device & Environment Detection
function detectEnvironment() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone === true;

  const platformEl = document.getElementById('detectedPlatform');
  const standaloneEl = document.getElementById('detectedMode');
  const iosGuideBox = document.getElementById('iosInstallGuide');
  const installBanner = document.getElementById('installBanner');

  if (platformEl) {
    platformEl.textContent = isIOS ? 'Apple iOS' : isAndroid ? 'Android OS' : 'Masaüstü / Diğer';
  }

  if (standaloneEl) {
    standaloneEl.textContent = isStandalone ? 'Ana Ekran (Standalone PWA)' : 'Tarayıcı Sekmesi';
    const dot = document.getElementById('modeDot');
    if (dot) {
      dot.className = isStandalone ? 'status-dot active' : 'status-dot warning';
    }
  }

  // Show iOS-specific guide if on iOS and not yet in standalone mode
  if (isIOS && !isStandalone && iosGuideBox) {
    iosGuideBox.style.display = 'block';
  }

  return { isIOS, isAndroid, isStandalone, userAgent: ua };
}

// Initialize Service Worker
async function initServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    updateNotificationStatus('Desteklenmiyor (Tarayıcınız Service Worker desteklemiyor)', 'blocked');
    showToast('Tarayıcınız Service Worker desteklemiyor.', 'error');
    return;
  }

  if (!('PushManager' in window)) {
    // Note: On iOS Safari, PushManager is only available when saved to Home Screen (iOS 16.4+)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      updateNotificationStatus('iOS Uyarısı: Web Push için uygulamayı "Ana Ekrana Ekle"melisiniz!', 'warning');
    } else {
      updateNotificationStatus('Desteklenmiyor (Tarayıcınız Push Manager desteklemiyor)', 'blocked');
    }
    return;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    swRegistration = reg;
    console.log('[App] Service Worker registered with scope:', reg.scope);

    // Wait until service worker is active
    await navigator.serviceWorker.ready;

    // Check existing subscription
    currentSubscription = await reg.pushManager.getSubscription();
    updateUIState();
  } catch (error) {
    console.error('[App] Service Worker registration failed:', error);
    updateNotificationStatus('Hata: Service Worker başlatılamadı', 'blocked');
  }
}

// Update UI State based on current permissions and subscription
function updateUIState() {
  const perm = Notification.permission;
  const btnSubscribe = document.getElementById('btnSubscribe');
  const btnUnsubscribe = document.getElementById('btnUnsubscribe');
  const btnTestSelf = document.getElementById('btnTestSelf');

  if (perm === 'denied') {
    updateNotificationStatus('Engellendi (Tarayıcı ayarlarından bildirim iznini açın)', 'blocked');
    if (btnSubscribe) {
      btnSubscribe.disabled = true;
      btnSubscribe.textContent = 'Bildirim İzni Engellenmiş';
    }
    if (btnUnsubscribe) btnUnsubscribe.style.display = 'none';
    if (btnTestSelf) btnTestSelf.style.display = 'none';
    return;
  }

  if (currentSubscription) {
    updateNotificationStatus('Aktif ve Abone Olundu (Bildirimler Hazır)', 'active');
    if (btnSubscribe) {
      btnSubscribe.disabled = true;
      btnSubscribe.style.display = 'none';
    }
    if (btnUnsubscribe) {
      btnUnsubscribe.style.display = 'inline-flex';
    }
    if (btnTestSelf) {
      btnTestSelf.style.display = 'inline-flex';
    }

    const subDetails = document.getElementById('subDetails');
    if (subDetails) {
      subDetails.style.display = 'block';
      const endpoint = currentSubscription.endpoint;
      document.getElementById('subEndpointMasked').textContent = 
        endpoint.substring(0, 32) + '...' + endpoint.slice(-10);
    }
  } else {
    updateNotificationStatus('Abonelik Yok (İzin bekleniyor)', 'warning');
    if (btnSubscribe) {
      btnSubscribe.disabled = false;
      btnSubscribe.style.display = 'inline-flex';
      btnSubscribe.textContent = 'Bildirimlere İzin Ver ve Abone Ol';
    }
    if (btnUnsubscribe) btnUnsubscribe.style.display = 'none';
    if (btnTestSelf) btnTestSelf.style.display = 'none';
    const subDetails = document.getElementById('subDetails');
    if (subDetails) subDetails.style.display = 'none';
  }
}

function updateNotificationStatus(text, statusClass) {
  const label = document.getElementById('notificationStatus');
  const dot = document.getElementById('statusDot');
  if (label) label.textContent = text;
  if (dot) {
    dot.className = `status-dot ${statusClass}`;
  }
}

// Subscribe to Web Push
async function subscribeUser() {
  const btnSubscribe = document.getElementById('btnSubscribe');
  if (btnSubscribe) {
    btnSubscribe.disabled = true;
    btnSubscribe.textContent = 'İzin İsteniyor...';
  }

  try {
    // 1. Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast('Bildirim izni verilmedi veya reddedildi.', 'error');
      updateUIState();
      return;
    }

    // 2. Fetch VAPID Public Key from backend
    const keyRes = await fetch('/api/vapid-public-key');
    const keyData = await keyRes.json();
    if (!keyData.success || !keyData.publicKey) {
      throw new Error('VAPID public key sunucudan alınamadı.');
    }

    const convertedKey = urlBase64ToUint8Array(keyData.publicKey);

    // 3. Subscribe with PushManager
    if (!swRegistration) {
      swRegistration = await navigator.serviceWorker.ready;
    }

    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey
    });

    currentSubscription = subscription;
    console.log('[App] New subscription created:', subscription);

    // 4. Send subscription to server
    const env = detectEnvironment();
    const saveRes = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription,
        deviceInfo: {
          userAgent: env.userAgent,
          platform: env.isIOS ? 'iOS' : env.isAndroid ? 'Android' : 'Desktop',
          deviceType: env.isStandalone ? 'PWA_Standalone' : 'Browser_Tab'
        }
      })
    });

    const saveData = await saveRes.json();
    if (saveData.success) {
      showToast('Harika! Cihazınız bildirimlere başarıyla kaydedildi.', 'success');
    } else {
      showToast('Abonelik sunucuya kaydedilirken uyarı: ' + saveData.message, 'warning');
    }

    updateUIState();
  } catch (err) {
    console.error('[App] Subscribe error:', err);
    showToast('Abonelik sırasında hata: ' + err.message, 'error');
    updateUIState();
  }
}

// Unsubscribe
async function unsubscribeUser() {
  const btnUnsubscribe = document.getElementById('btnUnsubscribe');
  if (btnUnsubscribe) btnUnsubscribe.disabled = true;

  try {
    if (currentSubscription) {
      const endpoint = currentSubscription.endpoint;
      await currentSubscription.unsubscribe();

      // Tell backend to remove
      await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint })
      });

      currentSubscription = null;
      showToast('Bildirim aboneliğiniz sonlandırıldı.', 'info');
    }
  } catch (err) {
    console.error('[App] Unsubscribe error:', err);
    showToast('Abonelik iptali sırasında hata: ' + err.message, 'error');
  } finally {
    if (btnUnsubscribe) btnUnsubscribe.disabled = false;
    updateUIState();
  }
}

// Quick Test: Send notification to this device only
async function sendTestToSelf() {
  if (!currentSubscription) {
    showToast('Önce bildirimlere abone olmalısınız!', 'error');
    return;
  }

  showToast('Test bildirimi gönderiliyor...', 'info');

  try {
    const res = await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '🛡️ Güvenli Kampüs Test Bildirimi',
        body: 'Bu bildirim Web Push ve Service Worker üzerinden başarıyla cihazınıza ulaştı!',
        url: '/',
        targetEndpoint: currentSubscription.endpoint
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Bildirim gönderildi! Cihaz ekranınızı kontrol edin.', 'success');
    } else {
      showToast('Gönderim hatası: ' + data.message, 'error');
    }
  } catch (e) {
    showToast('Sunucu bağlantı hatası: ' + e.message, 'error');
  }
}

// PWA Install Prompt (Chrome / Android / Chromium Desktop)
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent immediate default prompt
  e.preventDefault();
  deferredPrompt = e;
  console.log('[PWA] beforeinstallprompt event captured');

  const installBanner = document.getElementById('installBanner');
  const btnInstall = document.getElementById('btnInstall');

  if (installBanner) {
    installBanner.style.display = 'block';
  }

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] Install prompt outcome: ${outcome}`);
      deferredPrompt = null;
      if (outcome === 'accepted') {
        installBanner.style.display = 'none';
        showToast('Uygulama başarıyla ana ekrana kuruluyor!', 'success');
      }
    });
  }
});

// App installed event
window.addEventListener('appinstalled', () => {
  console.log('[PWA] App was installed to home screen!');
  const installBanner = document.getElementById('installBanner');
  if (installBanner) installBanner.style.display = 'none';
  showToast('Tebrikler! Güvenli Kampüs ana ekranınıza eklendi.', 'success');
  detectEnvironment();
});

// DOM Ready initialization
document.addEventListener('DOMContentLoaded', () => {
  detectEnvironment();
  initServiceWorker();

  const btnSubscribe = document.getElementById('btnSubscribe');
  const btnUnsubscribe = document.getElementById('btnUnsubscribe');
  const btnTestSelf = document.getElementById('btnTestSelf');

  if (btnSubscribe) btnSubscribe.addEventListener('click', subscribeUser);
  if (btnUnsubscribe) btnUnsubscribe.addEventListener('click', unsubscribeUser);
  if (btnTestSelf) btnTestSelf.addEventListener('click', sendTestToSelf);
});
