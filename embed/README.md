# PEPPOL E-Invoice XML Document Validator - Embed Guide

Bu dokümantasyon, PEPPOL E-Invoice XML Document Validator'ı web sitenize nasıl gömebileceğinizi açıklar.

## Özellikler

- 📄 XML içeriğini doğrudan yapıştırma
- 📤 XML dosyası yükleme
- ✅ PEPPOL ve EN16931 doğrulama kuralları desteği
- 📊 Detaylı doğrulama sonuçları (hata ve uyarılar)
- 💾 JSON ve XML sonuçlarını indirme
- 🎨 Eaglessoft marka renkleri ile modern tasarım
- 🔒 Scoped CSS ve JavaScript (global çakışma yok)

## Kurulum

### 1. Dosyaları İndirin

Aşağıdaki dosyaları projenize ekleyin:

- `embed.css` - Validator için scoped CSS stilleri
- `embed.js` - Validator JavaScript kodu (IIFE formatında)

### 2. HTML'e Ekleyin

Sayfanızın `<head>` bölümüne CSS dosyasını ekleyin:

```html
<link rel="stylesheet" href="embed.css">
```

Sayfanızın `<body>` bölümünde validator'ı gömek istediğiniz yere root container'ı ekleyin:

```html
<div class="peppol-e-invoice-xml-document-validator">
    <!-- Validator buraya otomatik olarak yüklenecek -->
</div>
```

Sayfanızın `</body>` etiketinden önce JavaScript dosyasını ekleyin. **API URL script tag'inde direkt yazılı olmalı (zorunlu)**:

```html
<script src="embed.js" data-api-url="https://tools.docnaut.com/peppol-e-invoice-xml-document-validator"></script>
```

### 3. Tam Örnek

```html
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Benim Sayfam</title>
    <link rel="stylesheet" href="embed.css">
</head>
<body>
    <h1>Benim Sayfam</h1>
    
    <p>Validator aşağıda:</p>
    
    <!-- Validator container -->
    <div class="peppol-e-invoice-xml-document-validator"></div>
    
    <p>Diğer içerik...</p>
    
    <!-- API URL script tag'inde direkt yazılı (zorunlu) -->
    <script src="embed.js" data-api-url="https://tools.docnaut.com/peppol-e-invoice-xml-document-validator"></script>
</body>
</html>
```

## API Endpoint

**ÖNEMLİ**: API URL'si kod içinde yazılı değildir. Script tag'inde **direkt yazılı olmalıdır** (zorunlu):

```html
<script src="embed.js" data-api-url="https://tools.docnaut.com/peppol-e-invoice-xml-document-validator"></script>
```

Eğer `data-api-url` attribute'u verilmezse, validator çalışmayacak ve konsola hata mesajı yazacaktır.

**Örnek kullanım**:
```html
<!-- Şirkete verirken script tag'inde direkt yazılı olacak -->
<script src="embed.js" data-api-url="https://tools.docnaut.com/peppol-e-invoice-xml-document-validator"></script>
```

## Kullanım

1. **XML Yapıştırma**: "Paste Content" sekmesini seçin ve XML içeriğini textarea'ya yapıştırın
2. **Dosya Yükleme**: "Upload File" sekmesini seçin ve XML dosyasını seçin
3. **Kural Seçme**: Dropdown menüden bir doğrulama kuralı seçin
4. **Doğrulama**: "Validate" butonuna tıklayın
5. **Sonuçları Görüntüleme**: Doğrulama sonuçları aynı container içinde gösterilir

## Özelleştirme

### CSS Özelleştirme

Tüm CSS stilleri `.peppol-e-invoice-xml-document-validator` prefix'i ile scoped olduğu için, sayfanızın diğer stillerini etkilemez. İsterseniz `embed.css` dosyasını düzenleyerek renkleri ve stilleri özelleştirebilirsiniz.

### JavaScript Özelleştirme

JavaScript kodu `(function(){})();` IIFE formatında yazılmıştır ve global scope'u kirletmez. Kod sadece `.peppol-e-invoice-xml-document-validator` container'ı içindeki elementlerle çalışır.

## Tarayıcı Desteği

- Chrome (son 2 versiyon)
- Firefox (son 2 versiyon)
- Safari (son 2 versiyon)
- Edge (son 2 versiyon)

## Teknik Detaylar

- **CSS**: Tüm stiller `.peppol-e-invoice-xml-document-validator` prefix'i ile scoped
- **JavaScript**: IIFE formatında, global scope'u kirletmez
- **API**: RESTful API kullanır (POST /validate, GET /list-rules)
- **Dosya Formatı**: XML dosyaları ve içerikleri desteklenir

## Sorun Giderme

### Validator görünmüyor

- `embed.css` dosyasının yüklendiğinden emin olun
- `embed.js` dosyasının yüklendiğinden emin olun
- `.peppol-e-invoice-xml-document-validator` class'ına sahip bir div olduğundan emin olun
- Tarayıcı konsolunda hata olup olmadığını kontrol edin

### API hatası

- İnternet bağlantınızı kontrol edin
- API endpoint'inin erişilebilir olduğundan emin olun: `https://tools.docnaut.com/peppol-e-invoice-xml-document-validator`
- CORS hatası alıyorsanız, API sunucusunun CORS ayarlarını kontrol edin

### Stil sorunları

- Sayfanızın CSS'i ile çakışma olup olmadığını kontrol edin
- `embed.css` dosyasının doğru yüklendiğinden emin olun
- Tarayıcı geliştirici araçlarında CSS'in uygulandığını kontrol edin

## Destek

Sorularınız veya sorunlarınız için:

- [Eaglessoft](https://eaglessoft.com/) web sitesini ziyaret edin
- [Eaglessoft İletişim](https://eaglessoft.com/contact) sayfasından bize ulaşın

## Lisans

Bu validator [Eaglessoft](https://eaglessoft.com/) tarafından geliştirilmiştir.

---

**Made with ❤️ by [Eaglessoft](https://eaglessoft.com/)**

