# Technical Overview

Short summary of project structure and runtime flow.

## Main Folders

- `src/main/java/com/phive/validation/api`
  - Backend servlet and request handling classes.
- `src/main/webapp`
  - UI assets (`index.html`, `app.js`, `styles.css`) and error pages (`404.html`, `500.html`).
- `src/main/webapp/WEB-INF`
  - `web.xml` servlet mappings and error-page config.
- `src/main/resources`
  - Logging configuration (`logback*.xml`).
- `.vscode`
  - Shared VS Code tasks and launch configuration (committed).
- `.devcontainer`
  - Dev container definition for local development environment.
- `scripts`
  - Runtime entrypoint script used by container image.
- `docs`
  - Project documentation.

## Backend Class Layout

- `ValidationService`
  - Main API servlet exposing endpoints such as `/api`, `/list-rules`, `/validate`.
- `ValidationRequestHandler`
  - Handles validation request parsing and validation execution flow.
- `ValidationModuleBootstrap`
  - Bootstraps PHIVE validation modules/rules into registry.
- `RuleResponseBuilder`
  - Builds rule list responses sent to clients.
- `IndexServlet`
  - Serves root entry (`/`) and blocks direct `/index.html` access with `404`.

## Runtime Flow (High Level)

1. Application starts in servlet container (Tomcat).
2. Validation modules are initialized and registered.
3. UI is served from `/`.
4. Client calls API endpoints for rule listing and validation.
5. Validation is executed with PHIVE rules and JSON response is returned.

## Container Runtime Notes

- Container deploys app from `/opt/app`.
- `CONTEXT_PATH` controls root/custom context path (default `/`).
- Runtime script creates Tomcat context XML dynamically.
- Logging defaults:
  - `LOG_FORMAT=json`
  - `LOG_LEVEL=WARN`
