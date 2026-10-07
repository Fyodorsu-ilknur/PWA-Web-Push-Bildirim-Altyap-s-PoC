# 🛡️ Güvenli Kampüs PoC - PWA Web Push Notification & Add to Home Screen

Bu proje; mobil uygulama mağazalarına (Apple App Store / Google Play Store) bağımlı olmadan, **PWA (Progressive Web App)** ve **W3C Web Push (VAPID)** standartlarını kullanarak iOS ve Android cihazlara anlık web bildirimleri göndermek ve uygulamayı ana ekrana ekletmek (Add to Home Screen) amacıyla hazırlanmış eksiksiz bir Proof of Concept (PoC) çalışmasıdır.

---

## 🚀 Öne Çıkan Özellikler

1. **PWA Standalone Modu & Web App Manifest**:
   - `public/manifest.json`: Uygulama adı ("Güvenli Kampüs PoC"), 192x192 ve 512x512 maskable PNG ikonlar, SVG vektör ikon, Apple Touch Icon ve koyu tema entegrasyonu.
   - iOS 16.4+ Safari ve Android Chrome tam ekran (standalone) desteği.

2. **Arka Plan Service Worker (`public/sw.js`)**:
   - `push` olayı ile gelen şifreli VAPID bildirim paketini yakalar, JSON verisini çözer ve işletim sistemi bildirim merkezine iletir.
   - `notificationclick` olayı ile bildirime tıklandığında uygulamayı ön plana getirir veya hedef URL'yi yeni sekmede açar.
   - Tarayıcı/uygulama tamamen kapalıyken bile işletim sistemi düzeyinde bildirim tetiklenir.

3. **Modern & Responsive UI**:
   - Glassmorphism ve koyu kampüs/güvenlik teması.
   - Gerçek zamanlı bildirim izin durumu (İzin Verildi / Bekliyor / Engellendi).
   - Çalışma modu tespiti (PWA Standalone mu yoksa Tarayıcı Sekmesi mi).
   - Cihaz ve işletim sistemi tespiti (Apple iOS, Android, Masaüstü).
   - Android için otomatik PWA yükleme butonu (`beforeinstallprompt`).
   - iOS Safari kullanıcıları için özel adım adım "Ana Ekrana Ekle" görsel rehberi.

4. **Yönetim & Bildirim Tetikleme Paneli (`/admin`)**:
   - Başlık (Title), Mesaj Metni (Body) ve Tıklanınca Açılacak URL girilebilen modern form.
   - Hızlı test şablonları (🚨 Acil Güvenlik Uyarısı, 📚 Ders İptali, 🚌 Kampüs Ring Servisi).
   - Tüm cihazlara toplu gönderim (Broadcast) veya tek bir cihaza özel bildirim gönderme.
   - Aktif kayıtlı cihazların listesi, platform türleri ve canlı gönderim terminal logları.

5. **Güvenli VAPID Backend Mimarisi (`server.js`)**:
   - `web-push` kütüphanesi ile RFC 8292 standardında VAPID imzalama.
   - İlk çalıştırmada otomatik VAPID anahtarı oluşturma ve `.env` dosyasına kaydetme.
   - Süresi dolan veya kullanıcı tarafından iptal edilen (410 Gone / 404 Not Found) cihazları otomatik temizleme.
   - `data/subscriptions.json` ile sunucu yeniden başlasa dahi kalıcı abonelik kaydı.

---

## 📁 Proje Dosya Yapısı

```
bildirimtestweb/
├── package.json               # Bağımlılıklar ve npm scriptleri
├── server.js                  # Express backend + Web Push API + Statik dosya sunumu
├── generate-keys.js           # VAPID anahtarı üretme scripti
├── generate-icons.js          # PWA PNG & SVG ikonlarını oluşturan script
├── .env                       # VAPID anahtarları ve port ayarları
├── .env.example               # Örnek çevre değişkenleri şablonu
├── .gitignore                 # Git yoksayma kuralları
├── data/
│   └── subscriptions.json     # Kayıtlı cihaz aboneliklerinin tutulduğu dosya
└── public/
    ├── index.html             # Kullanıcı arayüzü & PWA ana ekranı
    ├── admin.html             # Yönetim paneli & bildirim gönderme formu
    ├── sw.js                  # Push bildirimlerini yakalayan Service Worker
    ├── manifest.json          # PWA kurulum manifesti
    ├── css/
    │   └── style.css          # Modern glassmorphism stil şablonu
    ├── js/
    │   ├── app.js             # Kullanıcı tarafı bildirim abone olma ve PWA mantığı
    │   └── admin.js           # Admin paneli gönderim ve loglama mantığı
    └── icons/
        ├── icon-192.png       # 192x192 PWA ikonu
        ├── icon-512.png       # 512x512 PWA ikonu
        ├── apple-touch-icon.png # iOS ana ekran ikonu
        ├── badge.png          # Bildirim küçük durum ikonu
        └── icon.svg           # Yüksek çözünürlüklü vektör ikon
```

---

## 🛠️ Kurulum

### 1. Bağımlılıkları Yükleyin:
```bash
npm install
```

### 2. VAPID Anahtarlarını Oluşturun (Opsiyonel):
Sunucu ilk çalıştığında `.env` dosyası yoksa otomatik olarak oluşturur. İsterseniz elle de oluşturabilirsiniz:
```bash
node generate-keys.js
```

### 3. Sunucuyu Başlatın:
```bash
npm start
# veya geliştirici modunda otomatik izleme ile:
npm run dev
```

Sunucu varsayılan olarak `http://localhost:3001` portunda çalışacaktır.

---

## 📱 5 Adımda Cihaz ve Bildirim Test Rehberi

> ⚠️ **KRİTİK BİLGİ (HTTPS GEREKSİNİMİ):**  
> W3C Web Push ve Service Worker standartları, güvenlik nedeniyle **yalnızca `localhost` üzerinde veya geçerli bir `HTTPS` bağlantısında** çalışır.  
> Cep telefonunuzdan (özellikle iOS Safari'den) test etmek için sunucunun HTTPS ile sunulması şarttır!

---

### Adım 1: Masaüstü Tarayıcısında (Localhost) Hızlı Doğrulama
1. Tarayıcınızda `http://localhost:3001` adresini açın.
2. **"Bildirimlere İzin Ver ve Abone Ol"** butonuna tıklayın ve tarayıcının sorduğu izne **"İzin Ver"** deyin.
3. Ekranda beliren **"⚡ Kendime Test Bildirimi At"** butonuna tıklayın.
4. Bildirimin ekranınızın sağ alt/üst köşesinde belirdiğini ve tıklandığında sayfaya odaklandığını görün.

---

### Adım 2: Mobil Cihazlar İçin Güvenli Tünel (HTTPS) Başlatma
Mobil cihazınızdan `http://192.168.x.x:3001` şeklinde girildiğinde tarayıcılar (özellikle iOS) HTTPS olmadığı için bildirim izni vermez. Bu nedenle ücretsiz bir HTTPS tüneli açmanız önerilir:

**Seçenek A - ngrok ile:**
```bash
ngrok http 3001
```
Terminalde size verilen `https://xxxx.ngrok-free.app` adresini kopyalayın.

**Seçenek B - localtunnel ile (Ek kurulum gerektirmeden npx ile):**
```bash
npx localtunnel --port 3001
```
Verilen `https://xxxx.loca.lt` adresini kopyalayın.

---

### Adım 3: Android (Google Chrome) Cihazda Test
1. Android telefonunuzdaki Chrome tarayıcısında yukarıdaki **HTTPS adresini** açın.
2. Sayfada beliren **"📱 Uygulamayı Yükle"** butonuna (veya Chrome menüsünden *Uygulamayı Yükle / Ana Ekrana Ekle*) tıklayın.
3. Uygulama ana ekranınıza native bir uygulama gibi kurulacaktır.
4. Sayfadaki **"Bildirimlere İzin Ver ve Abone Ol"** butonuna dokunun ve izni onaylayın.
5. Cihazınız artık sunucuya kaydedildi!

---

### Adım 4: iPhone (iOS Safari 16.4+) Cihazda Test
> **Önemli:** Apple, Web Push bildirimlerini Safari tarayıcı sekmesi içindeyken engeller; **yalnızca Ana Ekrana Eklenen PWA'lar için** izin verir!
1. iPhone'unuzda **Safari** tarayıcısını açıp **HTTPS adresinize** gidin.
2. Safari'nin alt ortasındaki **Paylaş (Share)** simgesine (içinden yukarı ok çıkan kare) dokunun.
3. Aşağı kaydırıp **"Ana Ekrana Ekle" (Add to Home Screen)** seçeneğini seçin ve sağ üstteki **Ekle** butonuna basın.
4. Safari'yi tamamen kapatın.
5. iPhone ana ekranınıza gelen **"Güvenli Kampüs"** simgesine dokunarak uygulamayı açın (artık adres çubuğu olmayan bağımsız bir uygulama olarak açılacaktır).
6. **"Bildirimlere İzin Ver ve Abone Ol"** butonuna dokunun ve gelen sistem penceresinde **"İzin Ver"** deyin.

---

### Adım 5: Yönetim Panelinden (`/admin`) Bildirim Gönderme ve Tetikleme
1. Bilgisayarınızdan `http://localhost:3001/admin` sayfasına girin.
2. Sağ taraftaki **"Kayıtlı Cihazlar"** tablosunda test ettiğiniz Android veya iOS cihazının listelendiğini görün.
3. Sol taraftaki formdan:
   - Hızlı şablonlardan **"🚨 Acil Güvenlik Uyarısı"** butonuna tıklayın.
   - İster **"Tüm Kayıtlı Cihazlar (Genel Yayın)"** seçeneğini, isterseniz sadece telefonunuzu seçin.
4. **Telefonunuzun ekranını kilitleyin veya uygulamayı arka plana atın.**
5. Admin panelinde **"🚀 Bildirimi Gönder"** butonuna basın.
6. **Sonuç:** Telefonunuzun kilit ekranında veya bildirim çubuğunda "🚨 ACİL KAMPÜS GÜVENLİK UYARISI" başlığıyla bildirim belirecek; bildirime dokunduğunuzda Güvenli Kampüs uygulaması anında açılacaktır!
