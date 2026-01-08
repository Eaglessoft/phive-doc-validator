# PHIVE Document Validator

A web-based REST API service for validating XML documents against Peppol and EN16931 standards using the PHIVE library.

## Features

- 📄 Upload XML files or paste content
- ✅ Support for Peppol and EN16931 validation rules
- 🔍 Search and filter validation rules
- 📊 Detailed validation results (errors and warnings)
- 💾 Download JSON and XML results
- 🌐 Modern and user-friendly web interface

## Technologies

- **Backend**: Java 17, Servlet API
- **Validation**: PHIVE 11.1.1 (Philip Helger)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Build Tool**: Maven

## Installation

### Requirements

- Java 17 or higher
- Maven 3.6+
- Apache Tomcat 9+ or compatible servlet container

### Build

```bash
mvn clean package
```

After building, the `target/phive-validation-api.war` file will be created.

### Deployment

Deploy the WAR file to Tomcat or another servlet container.

### Docker

When using Docker, you need to clone the PHIVE and phive-rules repositories into the directory before building:

```bash
# Clone PHIVE repository
git clone https://github.com/phax/phive.git

# Clone phive-rules repository
git clone https://github.com/phax/phive-rules.git
```

After cloning the repositories, you can proceed with the Docker build process.

## API Endpoints

### POST /validate
Validates an XML file against the specified rule.

**Parameters:**
- `file`: XML file to validate
- `rule`: Validation rule in VESID format (e.g., `eu.peppol.bis3:invoice:2024.11`)

**Example:**
```bash
curl -X POST -F "file=@document.xml" -F "rule=eu.peppol.bis3:invoice:2024.11" http://localhost:8080/phive-validation-api/validate
```

### GET /list-rules
Lists all available validation rules.

**Example:**
```bash
curl http://localhost:8080/phive-validation-api/list-rules
```

### GET /api
Returns service status and information.

## Usage

1. Access the web interface from your browser
2. Upload your XML file or paste the content
3. Select a validation rule
4. Click the "Validate" button
5. View the results and download if needed

## License

License information for this project can be found in the `LICENSE` file.

## Resources

- [PHIVE GitHub](https://github.com/phax/phive)
- [PHIVE Rules GitHub](https://github.com/phax/phive-rules)
- [Peppol](https://peppol.eu/)
- [EN 16931](https://ec.europa.eu/cefdigital/wiki/display/CEFDIGITAL/eInvoicing)

