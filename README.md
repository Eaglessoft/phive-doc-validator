# PHIVE Document Validator

A web-based REST API service for validating XML documents against **1065+ validation rules** from 27 countries using the PHIVE library. Developed by [Eaglessoft](https://eaglessoft.com/).

## 🆕 Recent Updates

### Version 1.2.0 - Auto-Discovery & Complete Coverage
**Perfect Coverage**: ALL 27 PHIVE modules with **1065+ validation rulesets** - 100% module load rate! 🎉

**🔄 Auto-Update System**: 
- ✅ **Build-time module discovery** - automatically detects all locally built phive-rules
- ✅ **GitHub Actions integration** - weekly rebuild checks for new rules
- ✅ **Zero hardcoding** - new modules are discovered and loaded automatically
- ✅ **Fallback safety** - uses known working configuration if discovery fails

**Previously (v1.1.0)**: ~900 rules, 25/27 modules (manual configuration)

**Now (v1.2.0)**: 
- ✅ **27/27 modules loaded** (100% success rate)
- ✅ **1065+ validation rulesets** 
- ✅ All UBL versions (2.0 - 2.4)
- ✅ All Peppol variants (International, Legacy, Italy, AU-NZ, Singapore, PINT)
- ✅ XRechnung (Germany), ZUGFeRD/Factur-X (Germany/France)
- ✅ fatturaPA (Italy), ebInterface (Austria), OIOUBL (Denmark)
- ✅ EHF (Norway), Finvoice (Finland), Svefaktura (Sweden)
- ✅ CII, CIUS-PT, CIUS-RO, France CTC, Simplerinvoicing, Energie eFactuur, eRacun
- ✅ ISDOC (Czech), KSeF (Poland), SETU, TEAPPS, UBL.BE, ZATCA (Saudi Arabia)

See [RULESET_UPDATE_NOTES.md](RULESET_UPDATE_NOTES.md) for complete details.

## About Eaglessoft

[Eaglessoft](https://eaglessoft.com/) is a Belgium-based company connecting businesses, governments, and platforms through secure and compliant e-invoicing and integration solutions — globally. We specialize in PEPPOL Access Points, ERP integrations, SAP e-Compliance add-ons, and document validation services.

Visit [https://eaglessoft.com/](https://eaglessoft.com/) to learn more about our solutions and services.

## Features

- 📄 Upload XML files or paste content directly
- ✅ Support for **1065+ validation rules** from 27 countries (100% PHIVE coverage)
- 🔄 **Auto-discovery system** - automatically detects and loads new validation modules
- 🔁 **Auto-update** - weekly rebuild checks for new rules from phive-rules repository
- 🌍 Global coverage: Peppol, EN16931, UBL, CII, XRechnung, ZUGFeRD, fatturaPA, and 20+ more
- 🔍 Search and filter validation rules with real-time search
- 📊 Detailed validation results (errors and warnings)
- 💾 Download JSON and XML results
- 🌐 Modern and user-friendly web interface
- 🚀 RESTful API for programmatic access
- 🐳 Docker support for easy deployment

## Technologies

- **Backend**: Java 17, Servlet API
- **Validation**: PHIVE 11.1.1 (Philip Helger)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Build Tool**: Maven 3.9+
- **Container**: Docker with multi-stage build
- **Runtime**: Apache Tomcat 9.0.85

## Quick Start

### Using Docker (Recommended)

The easiest way to run the PHIVE Document Validator is using Docker Compose:

```bash
docker-compose up --build
```

The service will be available at:
- `http://localhost/peppol-e-invoice-xml-document-validator/` (with context path)
- `http://localhost/` (root path for local testing)

The Apache reverse proxy handles routing and context path management automatically.

The PHIVE libraries and rules are automatically downloaded as Maven dependencies during the build process. No manual cloning is required.

**Note**: The service includes **900+ validation rulesets**. Initial build may take 5-10 minutes to download all dependencies. Container startup takes 10-15 seconds to load all rules.

### Local Development

#### Requirements

- Java 17 or higher
- Maven 3.6+
- Apache Tomcat 9+ or compatible servlet container
- **Minimum RAM**: 1GB (Recommended: 2GB+) - Required for loading 900+ validation rulesets
- **Disk Space**: ~500MB for dependencies and build artifacts

#### Build

```bash
mvn clean package
```

After building, the `target/phive-validation-api.war` file will be created.

#### Deployment

Deploy the WAR file to Tomcat or another servlet container:

1. Copy `target/phive-validation-api.war` to your Tomcat `webapps/` directory
2. Start Tomcat
3. Access the web interface at `http://localhost:8080/phive-validation-api/`

## API Endpoints

The service provides RESTful API endpoints for document validation:

### POST /validate

Validates an XML file or content against the specified rule.

**Parameters:**
- `file` (multipart/form-data): XML file to validate (optional if using paste content)
- `pasteContent` (form-data): XML content as text (optional if using file upload)
- `rule` (form-data, required): Validation rule in VESID format (e.g., `eu.peppol.bis3:invoice:2024.11`)

**Example using curl:**

```bash
# Validate a file
curl -X POST -F "file=@document.xml" -F "rule=eu.peppol.bis3:invoice:2024.11" http://localhost:8080/validate

# Validate pasted content
curl -X POST -F "pasteContent=<Invoice>...</Invoice>" -F "rule=eu.peppol.bis3:invoice:2024.11" http://localhost:8080/validate
```

**Response:** JSON validation result with detailed errors and warnings

### GET /list-rules

Lists all available validation rules.

**Example:**

```bash
curl http://localhost:8080/list-rules
```

**Response:** JSON array of available rules with VESID, name, and deprecation status

### GET /api

Returns service status and information.

**Example:**

```bash
curl http://localhost:8080/api
```

**Response:** JSON object with service name, version, status, and available rules count

## Web Interface Usage

1. Access the web interface from your browser at `http://localhost:8080`
2. Choose input method:
   - **Upload File**: Select an XML file from your computer
   - **Paste Content**: Paste XML content directly into the text area
3. Select a validation rule from the dropdown (use search to filter rules)
4. Click the "Validate" button
5. View the detailed results including:
   - Validation summary (success/error status)
   - Error and warning counts
   - Detailed validation messages
   - Download options (JSON/XML)

## CI/CD with GitHub Actions

This project includes GitHub Actions workflows for automated building and testing. The workflows automatically:

- Build the project using Maven
- Run tests
- Build Docker images
- Deploy to container registries (if configured)

Check the `.github/workflows/` directory for workflow configurations.

## Docker Details

### Containerfile

The project uses a multi-stage Docker build:

1. **Build stage**: Uses Maven to compile and package the application
2. **Runtime stage**: Uses Alpine Linux with Tomcat for minimal image size

### Docker Compose

The `docker-compose.yml` file includes:

- **phive-validation-api**: The main validation service running on Tomcat (port 8080)
- **apache**: Apache HTTP Server reverse proxy (port 80)
- Service configuration
- Health checks
- Volume mounts for output files
- Environment variables for JVM options (1GB heap for 900+ rulesets)
- CORS configuration via `ALLOWED_ORIGINS` environment variable
- Network configuration for service communication

### Apache Reverse Proxy

The project includes an Apache HTTP Server reverse proxy configuration that handles context path routing. This allows the application to work correctly with the `/peppol-e-invoice-xml-document-validator/` context path while proxying requests to Tomcat's root context.

**Configuration:**
- Apache configuration file: `apache/httpd.conf`
- Apache listens on port 80 (mapped from container)
- Tomcat service runs on port 8080 (internal network only)
- Context path `/peppol-e-invoice-xml-document-validator/` is automatically handled
- Root path `/` also works for local testing

**Access Points:**
- `http://localhost/peppol-e-invoice-xml-document-validator/` - With context path
- `http://localhost/` - Root path (for local testing)

The Apache reverse proxy automatically removes the context path prefix when forwarding requests to Tomcat, ensuring seamless operation without modifying the application code.

### CORS Configuration

The service supports Cross-Origin Resource Sharing (CORS) for embed usage. Configure allowed origins using the `ALLOWED_ORIGINS` environment variable:

**Format**: Comma-separated list of allowed origins
```bash
ALLOWED_ORIGINS=https://example.com,https://www.example.com,https://another-domain.com
```

**Examples**:

- **Allow all origins** (default): Leave `ALLOWED_ORIGINS` unset or empty
- **Allow specific domains**: Set `ALLOWED_ORIGINS=https://example.com,https://www.example.com`
- **Docker Compose**: Add to `environment` section:
  ```yaml
  environment:
    - ALLOWED_ORIGINS=https://example.com,https://www.example.com
  ```

**Note**: When `ALLOWED_ORIGINS` is set, only requests from the specified origins will be allowed. If unset, all origins are allowed (`*`).

### Customization

To customize the Docker setup:

- Modify `Containerfile` for build changes
- Update `docker-compose.yml` for runtime configuration
- Adjust JVM options in `docker-compose.yml` if needed
- Configure CORS via `ALLOWED_ORIGINS` environment variable

## Project Structure

```
phive-doc-validator/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/phive/validation/api/
│   │   │       └── ValidationService.java
│   │   └── webapp/
│   │       ├── index.html
│   │       ├── app.js
│   │       ├── styles.css
│   │       ├── sources/
│   │       │   └── EAGLESSOFT-White@3x.png
│   │       └── WEB-INF/
│   │           └── web.xml
├── apache/
│   └── httpd.conf
├── Containerfile
├── docker-compose.yml
├── pom.xml
└── README.md
```

## Supported Validation Rules

The service supports **900+ validation rules** from multiple standards and countries:

### 🌍 International Standards
- **UBL (Universal Business Language)** - All versions (2.0, 2.1, 2.2, 2.3, 2.4)
- **CII (Cross Industry Invoice)** - All profiles and versions
- **EN 16931** - European standard for electronic invoicing (all versions)
- **Peppol** - International e-procurement network (all BIS profiles)
- **Peppol PINT** - International variants (EU, Japan, Malaysia, UAE, Singapore)

### 🇪🇺 European Standards
- **Peppol BIS 3** - All profiles (Invoice, Credit Note, Order, Catalogue, etc.)
- **OpenPeppol** - Latest versions (3.x and 2024.x releases)

### 🌏 Country-Specific Standards

#### 🇩🇪 Germany
- **XRechnung** (all versions: 1.2, 2.x, 3.x)
- **ZUGFeRD** (versions 2.0, 2.1, 2.2, 2.3)

#### 🇫🇷 France
- **Factur-X** (all profiles: MINIMUM, BASIC, EN 16931, EXTENDED)
- **France CTC** (Continuous Transaction Controls)

#### 🇮🇹 Italy
- **fatturaPA** (all versions: 1.2, 1.2.1, 1.2.2)
- **AGID** (Italian public administration standards)

#### 🇦🇹 Austria
- **ebInterface** (versions 3.0, 4.x, 5.0, 6.x)

#### 🇩🇰 Denmark
- **OIOUBL** (all versions and document types)

#### 🇳🇴 Norway
- **EHF** (Norwegian e-invoicing format - all profiles)

#### 🇸🇪 Sweden
- **Svefaktura** (Swedish standard)

#### 🇫🇮 Finland
- **Finvoice** (all versions: 1.3, 2.x, 3.0)

#### 🇳🇱 Netherlands
- **Simplerinvoicing** (all versions with G-Account extensions)
- **NLCIUS** (Dutch CIUS)
- **Energie eFactuur** (Energy sector invoicing)
- **TEAPPS**

#### 🇧🇪 Belgium
- **UBL.BE** (Belgian UBL profile)

#### 🇪🇸 Spain
- **Facturae** (all versions: 3.0, 3.1, 3.2.x)

#### 🇵🇹 Portugal
- **CIUS-PT** (Portuguese CIUS)

#### 🇷🇴 Romania
- **CIUS-RO** (Romanian CIUS)

#### 🇭🇷 Croatia
- **HR eRacun** (Croatian e-invoicing)

#### 🇵🇱 Poland
- **KSeF** (Polish e-invoicing system)

#### 🇨🇿 Czech Republic
- **ISDOC** (Czech standard)

#### 🇸🇦 Saudi Arabia
- **ZATCA/FATOORA** (Saudi Arabian e-invoicing)

#### 🌏 Asia Pacific
- **A-NZ Peppol** (Australia/New Zealand)
- **SG Peppol** (Singapore)
- **Peppol PINT Japan** (Japanese profiles)
- **Peppol PINT Malaysia** (Malaysian profiles)

### 🏢 Industry-Specific Standards
- **SETU** (Staffing Exchange Transaction Utilities)
- **Peppol Directory** (Business Card standards)

### 📊 Total Coverage
- **900+ validation rulesets**
- **25+ countries**
- **30+ different standards**
- **All major e-invoicing formats**

Use the `/list-rules` endpoint or the web interface to see all available rules with their exact VESID identifiers.

## License

This project is licensed under the Apache License 2.0. See the `LICENSE` file for details.

## Resources

- [Eaglessoft Website](https://eaglessoft.com/) - Learn more about our e-invoicing and compliance solutions
- [PHIVE GitHub](https://github.com/phax/phive) - PHIVE validation library
- [PHIVE Rules GitHub](https://github.com/phax/phive-rules) - PHIVE validation rules
- [Peppol](https://peppol.eu/) - Peppol network information
- [EN 16931](https://ec.europa.eu/cefdigital/wiki/display/CEFDIGITAL/eInvoicing) - European e-invoicing standard

## Support

For support, questions, or feature requests:

- Visit [Eaglessoft](https://eaglessoft.com/) for enterprise support
- Check our [documentation](https://eaglessoft.com/) and [FAQs](https://eaglessoft.com/)
- Contact us through [https://eaglessoft.com/contact](https://eaglessoft.com/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## About

This project is maintained by [Eaglessoft](https://eaglessoft.com/), a leading provider of e-invoicing and compliance solutions. We help businesses stay compliant with global e-invoicing regulations through our PEPPOL Access Points, ERP integrations, and validation services.

---

**Made with ❤️ by [Eaglessoft](https://eaglessoft.com/)**
