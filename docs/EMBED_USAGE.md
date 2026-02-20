# Embed Integration Guide

You can embed the validator with one script and one HTML tag.

## Quick Start

```html
<script src="https://cdn.jsdelivr.net/gh/eaglessoft/phive-doc-validator@main/embed/embed.js"></script>
<peppol-validator></peppol-validator>
```

`embed.js` automatically loads `embed.css` from the same path by default.

## API URL Behavior

API URL is resolved in this order:

1. `api-url` attribute on `<peppol-validator>`
2. `data-api-url` on script tag (legacy support)
3. Built-in default:
   - `https://tools.docnaut.com/peppol-e-invoice-xml-document-validator`

Example:

```html
<peppol-validator api-url="https://your-domain.com"></peppol-validator>
```

## CSS Loading Options

### Default (auto CSS enabled)

No extra step is required. JS injects `embed.css` automatically.

### Manual CSS (disable auto CSS)

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/eaglessoft/phive-doc-validator@main/embed/embed.css">
<script src="https://cdn.jsdelivr.net/gh/eaglessoft/phive-doc-validator@main/embed/embed.js"></script>
<peppol-validator auto-css="false"></peppol-validator>
```

### Custom CSS URL for auto load

```html
<script src=".../embed.js" data-css-url="https://cdn.example.com/custom/embed.css"></script>
<peppol-validator></peppol-validator>
```

## CSS Customization (Quick)

You can style the widget by overriding the existing class names in your page CSS.

Example:

```css
.peppol-e-invoice-xml-document-validator .peppol-btn-primary {
  background: #0f766e;
  border-radius: 10px;
}

.peppol-e-invoice-xml-document-validator .peppol-main-title {
  font-size: 1.8rem;
}
```

Recommended approach:

1. Include default `embed.css` first.
2. Add your override CSS after it.
3. Keep selectors scoped under `.peppol-e-invoice-xml-document-validator`.

### CSS Variables (Recommended)

`embed.css` now exposes theme variables on `.peppol-e-invoice-xml-document-validator`.
You can override them directly:

```css
.peppol-e-invoice-xml-document-validator {
  --peppol-color-primary: #0f766e;
  --peppol-color-primary-strong: #115e59;
  --peppol-color-text: #0f172a;
  --peppol-color-text-muted: #475569;
  --peppol-color-surface: #ffffff;
  --peppol-color-border: #cbd5e1;
  --peppol-radius-md: 10px;
  --peppol-shadow-lg: 0 8px 20px rgba(15, 118, 110, 0.2);
}
```

Main variables:

- `--peppol-font-family`
- `--peppol-font-mono`
- `--peppol-color-primary`
- `--peppol-color-primary-strong`
- `--peppol-color-text`
- `--peppol-color-text-muted`
- `--peppol-color-surface`
- `--peppol-color-border`
- `--peppol-color-success`
- `--peppol-color-warning`
- `--peppol-color-danger`
- `--peppol-radius-sm`
- `--peppol-radius-md`
- `--peppol-radius-lg`
- `--peppol-shadow-sm`
- `--peppol-shadow-lg`
- `--peppol-shadow-primary-sm`
- `--peppol-shadow-primary-md`
- `--peppol-shadow-primary-lg`

## Legacy Compatibility

Old integration still works:

```html
<div class="peppol-e-invoice-xml-document-validator" data-api-url="https://your-api-url"></div>
<script src=".../embed.js"></script>
```

Legacy mode also supports `data-auto-css="false"`.

## Endpoints Used

- `GET {api-base}/list-rules`
- `POST {api-base}/validate`

## Sample File

- Example HTML page: `embed/sample.html`
