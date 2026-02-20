# PHIVE Validation API

This project is developed by [Eaglessoft](https://eaglessoft.com/) and uses phive (phax) as the validation engine for XML document validation.

## Features

- Validates XML files against PHIVE rulesets.
- Provides a web UI (`/`) and API endpoints.
- Supports runtime configuration for context path, log format, and log level via environment variables.

## Requirements

- Docker

## Documentation

- Development setup and local run flow: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)
- Contribution rules (issues and PR conditions): [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)
- Technical structure summary: [`docs/TECHNICAL_OVERVIEW.md`](docs/TECHNICAL_OVERVIEW.md)
- Embed/Web Component integration: [`docs/EMBED_USAGE.md`](docs/EMBED_USAGE.md)
- Infrastructure examples:
  - Kubernetes: [`infra/k8s-example.yaml`](infra/k8s-example.yaml)
  - Docker Compose: [`infra/docker-compose.yml`](infra/docker-compose.yml)

## Build the Container

```bash
docker build -t phive-validation-api -f Containerfile .
```

Note: Maven tests are executed during the container build stage.

## Run the Container

### 1) Run on root context (default)

```bash
docker run --rm -p 8080:8080 phive-validation-api
```

### 2) Run with a custom context path

```bash
docker run --rm -p 8080:8080 \
  -e CONTEXT_PATH=/validator \
  phive-validation-api
```

## Access URLs

Default (`CONTEXT_PATH=/`):

- UI: `http://localhost:8080/`
- Rule list: `http://localhost:8080/list-rules`
- API info: `http://localhost:8080/api`
- Validate endpoint: `http://localhost:8080/validate`

Custom context example (`CONTEXT_PATH=/validator`):

- UI: `http://localhost:8080/validator/`
- Rule list: `http://localhost:8080/validator/list-rules`
- API info: `http://localhost:8080/validator/api`
- Validate endpoint: `http://localhost:8080/validator/validate`

Note: `/index.html` is intentionally blocked (404). Use `/` as the entry URL.

## API Usage

### 1) List available rules

```bash
curl -s http://localhost:8080/list-rules
```

### 2) Validate a file

```bash
curl -s -X POST "http://localhost:8080/validate" \
  -F "rule=eu.peppol.bis3:invoice:2024.11" \
  -F "file=@./sample.xml;type=application/xml"
```

It is recommended to query `/list-rules` first and use one of the returned rule IDs.

## Environment Variables

- `CONTEXT_PATH` (default: `/`)
  - Application context path.
  - Example: `/validator`
- `LOG_FORMAT` (default: `json`)
  - Supported values: `json`, `plain`
- `LOG_LEVEL` (default: `WARN`)
  - Examples: `DEBUG`, `INFO`, `WARN`, `ERROR`
- `LOGBACK_CONFIG_FILE` (optional)
  - Absolute path to a custom logback config file.
  - If provided, it overrides `LOG_FORMAT`.
- `ALLOWED_ORIGINS` (optional)
  - CORS allowlist, comma-separated.
  - Example: `https://a.example.com,https://b.example.com`
- `JSON_PRETTY_PRINT` (optional, default: false)
  - If `true` or `1`, API JSON responses are returned in pretty format.

## Example Runtime Configurations

### JSON logs + root context

```bash
docker run --rm -p 8080:8080 \
  -e LOG_FORMAT=json \
  -e LOG_LEVEL=WARN \
  phive-validation-api
```

### Plain logs + custom context + CORS

```bash
docker run --rm -p 8080:8080 \
  -e CONTEXT_PATH=/validator \
  -e LOG_FORMAT=plain \
  -e LOG_LEVEL=INFO \
  -e ALLOWED_ORIGINS=https://your-ui.example.com \
  phive-validation-api
```

## Troubleshooting

- If the UI does not open, make sure you are using `/` (not `/index.html`).
- If using a custom context path, add the same prefix to all endpoint URLs.
- Custom 404/500 error pages are configured via `web.xml`.
- If log output is not in the expected format, verify `LOG_FORMAT` or `LOGBACK_CONFIG_FILE`.
