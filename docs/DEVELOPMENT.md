# Development Guide

This guide explains how to run the project locally for development using VS Code (recommended), Dev Containers, Maven, and Cargo.

## Recommended Setup

- IDE: Visual Studio Code
- Extension: `Dev Containers` (Microsoft)
- Docker: required

## Start Development Environment (VS Code + Dev Container)

1. Open the repository in VS Code.
2. Run: `Dev Containers: Reopen in Container`.
3. Wait until container build/start is complete.
4. Verify tools inside container:

```bash
java -version
mvn -version
```

Dev container configuration is located at:

- `.devcontainer/devcontainer.json`
- `.devcontainer/Containerfile`

## Project Run Flow (Maven + Cargo)

VS Code tasks are defined in `.vscode/tasks.json`.

### Main tasks

- `build_package`
  - Command: `mvn -DskipTests clean package`
  - Produces build artifacts before runtime.

- `cargo_start`
  - Command: `mvn -DskipTests cargo:run`
  - Starts Tomcat through Cargo on `8080`.

- `cargo_stop`
  - Command: `mvn -DskipTests -Dcargo.jvmargs= cargo:stop || true`
  - Stops Cargo-managed Tomcat.

- `dev_up`
  - Runs `build_package` then `cargo_start`.

- `dev_down`
  - Runs `cargo_stop`.

## How to Run in VS Code

1. Open `Terminal -> Run Task...`
2. Run `dev_up`
3. Open app: `http://localhost:8080/`
4. When done, run `dev_down`

## How to Run from Terminal

From repository root:

```bash
mvn -DskipTests clean package
mvn -DskipTests cargo:run
```

Stop runtime in another terminal:

```bash
mvn -DskipTests -Dcargo.jvmargs= cargo:stop
```

## Useful Endpoints During Development

- UI: `http://localhost:8080/`
- Rules: `http://localhost:8080/list-rules`
- API info: `http://localhost:8080/api`
- Validate: `http://localhost:8080/validate`

Note: `/index.html` is intentionally blocked and returns `404`.

## Test and Verification

Tasks use `-DskipTests` for faster local iteration.
Run tests manually before opening a PR:

```bash
mvn -q test
```

## Repository Notes

- `.vscode/` is part of the repository and should be committed when task/launch/workspace settings are updated.
- Keep development docs in sync with task or devcontainer changes.
