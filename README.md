# Mikro Baskı

Tarayıcı tabanlı, ölçülü baskı tasarımı MVP'si. React + Vite.

## Çalıştırma
```bash
npm install
npm run dev
```

## Özellikler
- A4/A5/A3 ve özel ölçüler, mm/cm/in/px dönüşümleri
- SVG tabanlı tuval, ölçülü grid ve güvenli alan/bleed göstergeleri
- Metin, şekil, görsel ve QR ekleme
- Nesne seçimi, sürükleme, özellik düzenleme, katman sırası, silme, çoğaltma
- Undo/redo, LocalStorage autosave, JSON proje import/export
- SVG, PNG, PDF export (PDF %100 ölçü; çıktı ayarlarını yazıcıda doğrulayın)
- Baskı ön kontrolü, tema

## MVP sınırları
Bu prototip gelişmiş grup/multi-select, akıllı hizalama, çok sayfalı belge, font gömme/path dönüşümü, gerçek CMYK profilleri, kesim işaretleri ve gelişmiş DPI analizi içermez. PDF/SVG dışa aktarım öncesi ve baskı sonrası ölçüleri kontrol edin. SVG import yok; kullanıcı yüklediği SVG/vektör dosyaları konusunda dikkatli olmalıdır. QR üretimi URL/metin içindir.

## GitHub Pages yayınlama

Bu proje React + Vite kaynak projesidir. Depo ana dizininde bulunan `.github/workflows/deploy.yml` dosyası GitHub Actions ile `npm install` ve `npm run build` çalıştırır; ardından yalnızca `dist/` çıktısını GitHub Pages'e gönderir. `vite.config` içindeki `base: './'` ayarı, depo adı altındaki Pages adreslerinde dosya yollarını göreli tutar.

GitHub'da **Settings → Pages → Source → GitHub Actions** seçin. Sonra varsayılan dalınıza (genellikle `main`) commit gönderin ve **Actions** sekmesindeki yayın işinin yeşil tikle tamamlanmasını bekleyin. Terminal kullanmanız gerekmez.
