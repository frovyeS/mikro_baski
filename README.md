# Mikro Baskı

Ölçülü baskı tasarımı için tarayıcı tabanlı vektör editör. Kartvizit, davetiye, broşür, afiş ve etiket gibi baskı işleri için; masaüstünde, tablette ve telefonda çalışır. React + Vite, kurulum gerektirmez.

## Özellikler
- **Ölçülü belge:** A3–A6, Letter, kartvizit, davetiye, DL broşür, poster, etiket veya özel ölçü. mm / cm / in / px birimleri. Kesim payı (bleed) ve güvenli alan göstergeleri, cetveller, ızgara.
- **Nesneler:** metin, dikdörtgen (köşe yuvarlama), elips, üçgen, yıldız, çizgi, görsel, QR kodu. Sürükleyerek çizme, 8 yönlü yeniden boyutlandırma, döndürme, çoklu seçim, akıllı kılavuzlar ve yakalama.
- **Düzenleme:** sınırsız geri al / yinele, kopyala–yapıştır, çoğalt, hizala, sıralama, kilitle / gizle, katman paneli, görselleri sürükle-bırak veya yapıştır.
- **Yazı tipleri:** Inter, Montserrat, Playfair Display, Lora, Roboto Mono, Bebas Neue. Uygulamayla birlikte gelir (Türkçe karakter destekli); her cihazda ve PDF/SVG/PNG çıktısında birebir aynı görünür.
- **Dışa aktarım:** PDF (vektör, fontlar gömülü ya da yüksek çözünürlüklü görüntü), PNG (150/300/600 dpi), SVG (fontlar gömülü). Kesim payı ve kesim işaretleri seçeneği.
- **Baskı kontrolü:** sayfa dışı öğeler, kesim payına uzamayan kenar öğeleri, güvenli alan, görsel dpi, küçük yazı, ince çizgi, QR boyutu/kontrastı.
- **Proje dosyası:** `.mikrobaski` olarak kaydet / aç (eski sürüm dosyaları otomatik dönüştürülür). Tarayıcıda otomatik kayıt.
- **Uygulama gibi kurulum (PWA):** telefonda "Ana ekrana ekle", çevrimdışı çalışma.
- Açık / koyu / sistem teması.

## GitHub Pages ile yayınlama (terminal gerekmez)
1. Bu klasördeki **tüm dosyaları** (gizli `.github` klasörü dahil) deponun ana dizinine yükleyin.
2. GitHub → **Settings → Pages → Source → GitHub Actions** seçin.
3. **Actions** sekmesinde "Deploy Mikro Baskı to GitHub Pages" işinin yeşil tikle bitmesini bekleyin. Adres Pages ayarında görünür.

Depoda eski bir `deploy.yml` varsa silin; yalnızca `.github/workflows/main.yml` kalmalı.

## Geliştirme
```bash
npm install
npm run dev
```

## Notlar
- Tasarım RGB'dir; CMYK dönüşümünü matbaa yapar.
- Baskı kontrolü temel bir ön denetimdir; matbaa onayının yerini tutmaz.
- Yazı tipleri SIL Open Font License (OFL) altındadır.
