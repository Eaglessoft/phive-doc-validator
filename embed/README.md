# PEPPOL Validator - HTML Embed

Bu validator'ı herhangi bir HTML sayfasına kolayca ekleyebilirsiniz. Kod GitHub üzerinden jsDelivr CDN ile sunulmaktadır.

## Hızlı Kurulum

### Adım 1: CSS'i Ekleyin

Sayfanızın `<head>` bölümüne şu satırı ekleyin:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/eaglessoft/phive-doc-validator@main/embed/embed.css">
```

### Adım 2: Container Div'i Ekleyin

Validator'ın görünmesini istediğiniz yere şu div'i ekleyin:

```html
<div class="peppol-e-invoice-xml-document-validator"></div>
```

### Adım 3: JavaScript'i Ekleyin

Sayfanızın `</body>` etiketinden önce şu script'i ekleyin:

```html
<script src="https://cdn.jsdelivr.net/gh/eaglessoft/phive-doc-validator@main/embed/embed.js" 
        data-api-url="YOUR_API_URL_HERE"></script>
```

**ÖNEMLİ:** `YOUR_API_URL_HERE` kısmını validator servisinizin base URL'i ile değiştirin.

**Örnekler:**
- Production: `https://tools.docnaut.com`
- Local development: `http://localhost:8080`
- Custom domain: `https://your-domain.com`

**Not:** URL'in sonunda `/` olmamalı. Validator otomatik olarak `/list-rules` ve `/validate` endpoint'lerini ekler.

## Tam HTML Örneği

```html
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PEPPOL Validator</title>
    
    <!-- PEPPOL Validator CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/eaglessoft/phive-doc-validator@main/embed/embed.css">
</head>
<body>
    <h1>PEPPOL E-Invoice XML Document Validator</h1>
    
    <!-- PEPPOL Validator Container -->
    <div class="peppol-e-invoice-xml-document-validator"></div>
    
    <!-- PEPPOL Validator JavaScript -->
    <script src="https://cdn.jsdelivr.net/gh/eaglessoft/phive-doc-validator@main/embed/embed.js" 
            data-api-url="YOUR_API_URL_HERE"></script>
</body>
</html>
```

## WordPress Kullanımı

### Elementor HTML Widget

1. Elementor editöründe sayfayı düzenleyin
2. **HTML Widget** ekleyin
3. Aşağıdaki kodu yapıştırın:

```html
<!-- PEPPOL Validator CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/eaglessoft/phive-doc-validator@main/embed/embed.css">

<!-- PEPPOL Validator Container -->
<div class="peppol-e-invoice-xml-document-validator" style="margin: 20px 0; padding: 20px;"></div>

<!-- PEPPOL Validator JavaScript -->
<script>
(function() {
    'use strict';
    if (window.peppolValidatorLoaded) return;
    window.peppolValidatorLoaded = true;
    
    if (!document.querySelector('link[href*="embed.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/gh/eaglessoft/phive-doc-validator@main/embed/embed.css';
        document.head.appendChild(link);
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/gh/eaglessoft/phive-doc-validator@main/embed/embed.js';
    script.setAttribute('data-api-url', 'YOUR_API_URL_HERE');
    script.async = true;
    (document.body || document.documentElement).appendChild(script);
})();
</script>
```

### Custom HTML Widget

**Appearance → Widgets** bölümünden **Custom HTML** widget'ına şu kodu ekleyin:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/eaglessoft/phive-doc-validator@main/embed/embed.css">
<div class="peppol-e-invoice-xml-document-validator"></div>
<script src="https://cdn.jsdelivr.net/gh/eaglessoft/phive-doc-validator@main/embed/embed.js" 
        data-api-url="YOUR_API_URL_HERE"></script>
```

**Not**: Bazı WordPress temaları `<script>` tag'lerini widget'lardan kaldırır. Bu durumda Elementor HTML Widget yöntemini kullanın.

### functions.php ile Kalıcı Kurulum

WordPress `functions.php` dosyanıza şu kodu ekleyin:

```php
function peppol_validator_enqueue_styles() {
    wp_enqueue_style('peppol-validator', 'https://cdn.jsdelivr.net/gh/eaglessoft/phive-doc-validator@main/embed/embed.css', array(), '1.0');
}
add_action('wp_enqueue_scripts', 'peppol_validator_enqueue_styles');

function peppol_validator_enqueue_scripts() {
    wp_enqueue_script('peppol-validator', 'https://cdn.jsdelivr.net/gh/eaglessoft/phive-doc-validator@main/embed/embed.js', array(), '1.0', true);
    // Script'e data-api-url attribute'u ekle
    add_filter('script_loader_tag', function($tag, $handle) {
        if ($handle === 'peppol-validator') {
            return str_replace('<script ', '<script data-api-url="YOUR_API_URL_HERE" ', $tag);
        }
        return $tag;
    }, 10, 2);
}
add_action('wp_enqueue_scripts', 'peppol_validator_enqueue_scripts');
```

Sonra sayfanızda validator container'ı ekleyin:

```html
<div class="peppol-e-invoice-xml-document-validator"></div>
```

## Önemli Notlar

1. **Container Div Zorunlu**: `.peppol-e-invoice-xml-document-validator` class'ına sahip bir div olmalı
2. **API URL Zorunlu**: `data-api-url` attribute'u script tag'inde mutlaka olmalı ve gerçek API URL'iniz ile değiştirilmelidir
3. **Sıralama**: CSS'i `<head>`'de, container'ı body'de, JS'i `</body>` öncesinde ekleyin
4. **jsDelivr CDN**: Direkt `<link>` ve `<script>` tag'leri çalışır, doğru Content-Type header'ları ile sunar

## CDN URL'leri

- CSS: `https://cdn.jsdelivr.net/gh/eaglessoft/phive-doc-validator@main/embed/embed.css`
- JS: `https://cdn.jsdelivr.net/gh/eaglessoft/phive-doc-validator@main/embed/embed.js`

## Sorun Giderme

- **Validator görünmüyor**: 
  - Browser console'u kontrol edin (F12)
  - Network sekmesinde CSS ve JS dosyalarının yüklendiğini kontrol edin
  - `data-api-url` attribute'unun doğru API URL'i içerdiğinden emin olun

- **API URL hatası**: 
  - `YOUR_API_URL_HERE` kısmını validator servisinizin base URL'i ile değiştirdiğinizden emin olun
  - API URL'inin sonunda `/` olmamalı (örn: `https://tools.docnaut.com` ✅, `https://tools.docnaut.com/` ❌)
  - Validator otomatik olarak `/list-rules` ve `/validate` endpoint'lerini ekler
  - **Örnek API URL'leri:**
    - Production: `https://tools.docnaut.com`
    - Local: `http://localhost:8080`
    - Custom: `https://your-domain.com`

- **jsDelivr CDN Sorunları**: 
  - jsDelivr genellikle sorunsuz çalışır
  - Eğer dosyalar yüklenmiyorsa, GitHub repository'nin public olduğundan emin olun
  - Branch adını kontrol edin (`main` branch kullanılıyor)

- **WordPress Script Tag Sorunları**: 
  - Bazı WordPress temaları widget'lardan `<script>` tag'lerini kaldırır
  - Elementor HTML Widget yöntemini kullanın (IIFE ile script injection)
  - Veya "Insert Headers and Footers" plugin'i kullanın
  - Veya `functions.php` ile kalıcı kurulum yapın

- **CSS çakışması**: 
  - Validator CSS'i scoped olduğu için diğer stillerinizi etkilemez
  - Tüm CSS class'ları `.peppol-e-invoice-xml-document-validator` ile başlar

## Özellikler

- ✅ Paste Content ve Upload File desteği
- ✅ Line numbers ile XML editörü
- ✅ Custom dropdown ile rule selection
- ✅ Search ve deprecated filter
- ✅ Detaylı validation sonuçları
- ✅ JSON ve XML download desteği
- ✅ Responsive tasarım
- ✅ Scoped CSS (diğer stillerinizi etkilemez)

## Dosyalar

- `embed.js` - Validator JavaScript kodu
- `embed.css` - Validator CSS stilleri
- `embed.html` - Tam HTML örnek sayfası
- `HTML_SNIPPET.html` - Basit HTML snippet örneği
- `HTML_SNIPPET_WORDPRESS.html` - WordPress için snippet örneği
- `SIMPLE_HTML_SNIPPET.html` - En basit snippet örneği
