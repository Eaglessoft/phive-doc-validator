# PEPPOL E-Invoice XML Document Validator - Embed Guide

This documentation explains how to embed the PEPPOL E-Invoice XML Document Validator into your website.

## Features

- 📄 Paste XML content directly
- 📤 Upload XML files
- ✅ Support for PEPPOL and EN16931 validation rules
- 📊 Detailed validation results (errors and warnings)
- 💾 Download JSON and XML results
- 🎨 Modern design with Eaglessoft brand colors
- 🔒 Scoped CSS and JavaScript (no global conflicts)

## Installation

### Method 1: GitHub Raw CDN (Recommended) 🚀

No need to download files, use them directly from GitHub CDN:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Page</title>
    <!-- CSS from GitHub Raw CDN -->
    <link rel="stylesheet" href="https://raw.githubusercontent.com/eaglessoft/phive-doc-validator/main/embed/embed.css">
</head>
<body>
    <h1>My Page</h1>
    
    <p>Validator below:</p>
    
    <!-- Validator container -->
    <div class="peppol-e-invoice-xml-document-validator"></div>
    
    <p>Other content...</p>
    
    <!-- JavaScript from GitHub Raw CDN - API URL must be directly written in script tag (required) -->
    <script src="https://raw.githubusercontent.com/eaglessoft/phive-doc-validator/main/embed/embed.js" 
            data-api-url="https://tools.docnaut.com/peppol-e-invoice-xml-document-validator"></script>
</body>
</html>
```

**Note**: Update the GitHub repository URL and branch name according to your project.

### Method 2: Local Files

If you want to host the files on your own server:

#### 1. Download Files

Add the following files to your project:

- `embed.css` - Scoped CSS styles for the validator
- `embed.js` - Validator JavaScript code (IIFE format)

#### 2. Add to HTML

Add the CSS file to your page's `<head>` section:

```html
<link rel="stylesheet" href="embed.css">
```

Add the root container where you want to embed the validator in your page's `<body>` section:

```html
<div class="peppol-e-invoice-xml-document-validator">
    <!-- Validator will be automatically loaded here -->
</div>
```

Add the JavaScript file before your `</body>` tag. **API URL must be directly written in script tag (required)**:

```html
<script src="embed.js" data-api-url="https://tools.docnaut.com/peppol-e-invoice-xml-document-validator"></script>
```

#### 3. Complete Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Page</title>
    <link rel="stylesheet" href="embed.css">
</head>
<body>
    <h1>My Page</h1>
    
    <p>Validator below:</p>
    
    <!-- Validator container -->
    <div class="peppol-e-invoice-xml-document-validator"></div>
    
    <p>Other content...</p>
    
    <!-- API URL must be directly written in script tag (required) -->
    <script src="embed.js" data-api-url="https://tools.docnaut.com/peppol-e-invoice-xml-document-validator"></script>
</body>
</html>
```

## API Endpoint

**IMPORTANT**: The API URL is not hardcoded in the code. It **must be directly written** in the script tag (required):

```html
<script src="embed.js" data-api-url="https://tools.docnaut.com/peppol-e-invoice-xml-document-validator"></script>
```

If the `data-api-url` attribute is not provided, the validator will not work and will log an error message to the console.

**Usage examples**:

With GitHub Raw CDN:
```html
<!-- From GitHub Raw CDN - Elegant and easy! -->
<script src="https://raw.githubusercontent.com/eaglessoft/phive-doc-validator/main/embed/embed.js" 
        data-api-url="https://tools.docnaut.com/peppol-e-invoice-xml-document-validator"></script>
```

With local file:
```html
<!-- When providing to company, API URL will be directly written in script tag -->
<script src="embed.js" data-api-url="https://tools.docnaut.com/peppol-e-invoice-xml-document-validator"></script>
```

## Usage

1. **Paste XML**: Select the "Paste Content" tab and paste XML content into the textarea
2. **Upload File**: Select the "Upload File" tab and choose an XML file
3. **Select Rule**: Choose a validation rule from the dropdown menu
4. **Validate**: Click the "Validate" button
5. **View Results**: Validation results are displayed within the same container

## Customization

### CSS Customization

All CSS styles are scoped with the `.peppol-e-invoice-xml-document-validator` prefix, so they won't affect your page's other styles. You can customize colors and styles by editing the `embed.css` file if desired.

### JavaScript Customization

The JavaScript code is written in `(function(){})();` IIFE format and does not pollute the global scope. The code only works with elements inside the `.peppol-e-invoice-xml-document-validator` container.

## Browser Support

- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)

## Technical Details

- **CSS**: All styles are scoped with `.peppol-e-invoice-xml-document-validator` prefix
- **JavaScript**: IIFE format, does not pollute global scope
- **API**: Uses RESTful API (POST /validate, GET /list-rules)
- **File Format**: XML files and content are supported

## Troubleshooting

### Validator not visible

- Make sure `embed.css` file is loaded
- Make sure `embed.js` file is loaded
- Make sure there is a div with `.peppol-e-invoice-xml-document-validator` class
- Check the browser console for errors

### API error

- Check your internet connection
- Make sure the API endpoint is accessible: `https://tools.docnaut.com/peppol-e-invoice-xml-document-validator`
- If you're getting CORS errors, check the API server's CORS settings

### Style issues

- Check if there are conflicts with your page's CSS
- Make sure `embed.css` file is loaded correctly
- Check in browser developer tools if CSS is being applied

## Support

For questions or issues:

- Visit [Eaglessoft](https://eaglessoft.com/) website
- Contact us through [Eaglessoft Contact](https://eaglessoft.com/contact) page

## License

This validator is developed by [Eaglessoft](https://eaglessoft.com/).

---

**Made with ❤️ by [Eaglessoft](https://eaglessoft.com/)**
