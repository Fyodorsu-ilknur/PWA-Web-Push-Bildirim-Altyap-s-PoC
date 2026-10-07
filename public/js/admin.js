// Admin Management Logic for Güvenli Kampüs PoC

// Toast helper
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

function logToConsole(message, type = 'info') {
  const consoleEl = document.getElementById('adminConsole');
  if (!consoleEl) return;

  const time = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  const typeClass = type === 'success' ? 'log-success' : type === 'error' ? 'log-error' : '';
  line.innerHTML = `<span class="log-time">[${time}]</span> <span class="${typeClass}">${message}</span>`;
  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

// Fetch Subscribers
async function fetchSubscribers() {
  try {
    const res = await fetch('/api/subscriptions');
    const data = await res.json();

    const countEl = document.getElementById('subscriberCount');
    const tbody = document.getElementById('subscriberTableBody');
    const targetSelect = document.getElementById('targetSelect');

    if (countEl) countEl.textContent = data.count || 0;

    if (targetSelect) {
      // Preserve "all" option
      targetSelect.innerHTML = '<option value="all">📢 Tüm Kayıtlı Cihazlar (Genel Yayın - Broadcast)</option>';
      if (data.subscribers) {
        data.subscribers.forEach(sub => {
          const opt = document.createElement('option');
          opt.value = sub.endpointFull;
          opt.textContent = `📱 [${sub.platform} - ${sub.deviceType}] ${sub.endpointMasked}`;
          targetSelect.appendChild(opt);
        });
      }
    }

    if (tbody) {
      if (!data.subscribers || data.subscribers.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
              Henüz abone olan cihaz bulunmuyor. Ana sayfadan veya mobil cihazınızdan bildirim izni verin.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = '';
      data.subscribers.forEach((sub, idx) => {
        const tr = document.createElement('tr');
        const formattedDate = new Date(sub.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let platformBadgeColor = '#38bdf8';
        if (sub.platform === 'iOS') platformBadgeColor = '#a855f7';
        if (sub.platform === 'Android') platformBadgeColor = '#10b981';

        tr.innerHTML = `
          <td><strong>#${idx + 1}</strong></td>
          <td>
            <span style="display:inline-block; font-size:0.75rem; font-weight:700; background:${platformBadgeColor}22; color:${platformBadgeColor}; padding:2px 8px; border-radius:4px; margin-right:4px;">
              ${sub.platform}
            </span>
            <span style="font-size:0.75rem; color:var(--text-muted);">${sub.deviceType}</span>
          </td>
          <td>
            <span class="endpoint-pill">${sub.endpointMasked}</span>
          </td>
          <td style="color: var(--text-muted);">${formattedDate}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    logToConsole(`Abone listesi güncellendi (${data.count} cihaz).`);
  } catch (err) {
    console.error('Subscribers fetch error:', err);
    logToConsole('Abone listesi çekilirken hata: ' + err.message, 'error');
  }
}

// Preset Fillers
function applyPreset(type) {
  const titleInput = document.getElementById('notifTitle');
  const bodyInput = document.getElementById('notifBody');
  const urlInput = document.getElementById('notifUrl');

  if (type === 'security') {
    titleInput.value = '🚨 ACİL KAMPÜS GÜVENLİK UYARISI';
    bodyInput.value = 'Mühendislik Fakültesi B Blok çevresinde acil bakım nedeniyle tahliye başlamıştır. Lütfen güvenli toplanma alanına geçin.';
    urlInput.value = '/?ref=emergency';
  } else if (type === 'class') {
    titleInput.value = '📚 Ders İptal Bilgilendirmesi';
    bodyInput.value = 'Yazılım Mimarisi (YZL401) dersi Prof. Dr. Ahmet Yılmaz rahatsızlığı nedeniyle bugün saat 14:00 yerine online yapılacaktır.';
    urlInput.value = '/?ref=courses';
  } else if (type === 'shuttle') {
    titleInput.value = '🚌 Kampüs Ring Servis Saatleri';
    bodyInput.value = 'Metro-Kampüs ek ring seferleri yoğunluk sebebiyle 10 dakikada bire indirilmiştir.';
    urlInput.value = '/?ref=shuttle';
  }
  showToast('Şablon forma uygulandı.', 'info');
}

// Send Notification Handler
async function handleSendNotification(e) {
  e.preventDefault();

  const title = document.getElementById('notifTitle').value.trim();
  const body = document.getElementById('notifBody').value.trim();
  const url = document.getElementById('notifUrl').value.trim();
  const target = document.getElementById('targetSelect').value;
  const btnSend = document.getElementById('btnSendNotification');

  if (!title || !body) {
    showToast('Başlık ve mesaj alanları boş bırakılamaz.', 'error');
    return;
  }

  btnSend.disabled = true;
  btnSend.textContent = 'Gönderiliyor...';
  logToConsole(`Bildirim gönderimi başlatıldı: "${title}"...`);

  try {
    const res = await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body,
        url,
        targetEndpoint: target
      })
    });

    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      logToConsole(`Başarılı: ${data.sentCount} cihaza iletildi. Hatalı: ${data.failedCount}, Temizlenen: ${data.removedExpiredCount}`, 'success');
      
      // Refresh subscriber count in case expired ones were removed
      fetchSubscribers();
    } else {
      showToast(data.message, 'error');
      logToConsole(`Gönderim başarısız: ${data.message}`, 'error');
    }
  } catch (err) {
    console.error('Send error:', err);
    showToast('Bağlantı hatası: ' + err.message, 'error');
    logToConsole('Hata: ' + err.message, 'error');
  } finally {
    btnSend.disabled = false;
    btnSend.textContent = '🚀 Bildirimi Gönder';
  }
}

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  fetchSubscribers();

  const form = document.getElementById('notificationForm');
  if (form) form.addEventListener('submit', handleSendNotification);

  const btnRefresh = document.getElementById('btnRefreshSubscribers');
  if (btnRefresh) btnRefresh.addEventListener('click', () => {
    fetchSubscribers();
    showToast('Abone listesi yenilendi.', 'info');
  });

  // Attach chip events
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const type = chip.getAttribute('data-preset');
      applyPreset(type);
    });
  });
});
