# SITAREMLES — Satış Demo Senaryosu

## Hazırlık (Demo Öncesi)
- [ ] `apps/web` ve `apps/mobile` sunucuları çalışır durumda olsun
- [ ] Test hesapları hazır: admin-a@test.com / Test1234!
- [ ] Telefon, bilgisayarla aynı Wi-Fi ağında olsun (mobil QR testi için)

## Demo Akışı (15-20 dakika)

### 1. Landing Page (1 dk)
`localhost:3000` — SITAREMLES'in ne olduğunu, temel özellikleri göster.

### 2. Web Panel — Yönetici Deneyimi (5 dk)
- Giriş yap, Dashboard'u göster
- **Vardiya Planlama**: Manuel atama + "🤖 Akıllı Plan Oluştur" butonunu göster, AI'ın taslak ürettiğini canlı izlet
- **Giriş-Çıkış Raporu**: Şube içi/dışı ayrımını, mesafe hesabını göster
- **İzin Onay Kuyruğu**: Bekleyen talebi onayla, anında mobile yansıdığını vurgula

### 3. Mobil Uygulama — Personel Deneyimi (5 dk)
- QR kod ile giriş-çıkış (bilgisayar ekranındaki QR'ı telefonla okut)
- Haftalık vardiya görüntüleme
- İzin talebi oluşturma + bakiye görüntüleme
- Avans/masraf talebi (fiş fotoğrafı ile)

### 4. AI Ajanları — Farklılaşma Noktası (5 dk)
- **HR Insights Agent**: "Hangi şubede en çok şüpheli giriş var?" gibi bir soru sor, canlı cevap al
- **Audit Agent**: Şüpheli giriş tespitini ve Gemini özetini göster
- **AI Kullanım Paneli**: Şeffaflık için — kaç çağrı yapıldığını göster

### 5. Süper Admin Paneli (2 dk)
- Yeni bir müşteri şirketi oluşturmanın ne kadar kolay olduğunu göster (B2B ölçeklenebilirlik mesajı)

## Sık Sorulan Sorular İçin Hazır Cevaplar
- **"Verilerimiz güvende mi?"** → RLS ile şirketler arası tam izolasyon, penetrasyon testiyle doğrulanmış (Gün 17)
- **"Bordro hesaplıyor mu?"** → Hayır, puantaj özeti çıkarıp mevcut bordro/mali müşavir sürecinize CSV ile entegre olur
- **"AI verilerimizi eğitim için mi kullanıyor?"** → Şu an test aşamasında ücretsiz katmandayız; üretime geçerken faturalı katmana geçilecek, bu riski ortadan kaldırır
- **"Fiyatlandırma?"** → [Faz sonrası netleştirilecek — Trial/Starter/Pro/Enterprise planları altyapısı hazır]