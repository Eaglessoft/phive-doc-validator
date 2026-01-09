# PHIVE Document Validator

A web-based REST API service for validating XML documents against Peppol and EN16931 standards using the PHIVE library. Developed by [Eaglessoft](https://eaglessoft.com/).

## About Eaglessoft

[Eaglessoft](https://eaglessoft.com/) is a Belgium-based company connecting businesses, governments, and platforms through secure and compliant e-invoicing and integration solutions — globally. We specialize in PEPPOL Access Points, ERP integrations, SAP e-Compliance add-ons, and document validation services.

Visit [https://eaglessoft.com/](https://eaglessoft.com/) to learn more about our solutions and services.

## Features

- 📄 Upload XML files or paste content directly
- ✅ Support for Peppol and EN16931 validation rules
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

The service will be available at `http://localhost:8080`

The PHIVE libraries and rules are automatically downloaded as Maven dependencies during the build process. No manual cloning is required.

### Local Development

#### Requirements

- Java 17 or higher
- Maven 3.6+
- Apache Tomcat 9+ or compatible servlet container

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

- Service configuration
- Port mapping (8080:8080)
- Health checks
- Volume mounts for output files
- Environment variables for JVM options

### Customization

To customize the Docker setup:

- Modify `Containerfile` for build changes
- Update `docker-compose.yml` for runtime configuration
- Adjust JVM options in `docker-compose.yml` if needed

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
├── Containerfile
├── docker-compose.yml
├── pom.xml
└── README.md
```

## Supported Validation Rules

The service supports validation rules from:

- **Peppol**: All Peppol BIS 3.x invoice validation rules
- **EN 16931**: European standard for electronic invoicing

Rules are automatically loaded from PHIVE libraries. Use the `/list-rules` endpoint or the web interface to see all available rules.

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
