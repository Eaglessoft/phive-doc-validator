# Contributing Guide

This document defines the expected development workflow for this repository.

## Contribution Flow

1. Open or pick a GitHub Issue.
2. Create a branch from the latest target branch.
3. Implement only the scoped change.
4. Run tests and checks locally.
5. Open a Pull Request (PR) and request review.

## Issue Reporting (GitHub)

Use GitHub Issues for bugs, enhancements, and technical tasks.

### Bug Report Requirements

Include:

- Clear title and short summary
- Reproduction steps
- Expected behavior
- Actual behavior
- Environment details (OS, Java version, Tomcat version, Docker version if relevant)
- Application version or commit SHA
- Logs and stack traces (remove sensitive data)
- Screenshot/video for UI issues

### Feature Request Requirements

Include:

- Problem statement
- Proposed solution
- Alternative options considered
- API/UI impact
- Backward compatibility impact

## Branching Rules

Use one branch per issue.

Branch naming:

- `feature/<issue-id>-short-description`
- `fix/<issue-id>-short-description`
- `chore/<issue-id>-short-description`

Examples:

- `feature/123-add-validation-summary`
- `fix/456-handle-empty-request-body`

## Pull Request Conditions (GitHub)

A PR is ready for review only if all conditions below are met.

### 1. Traceability

- PR links a GitHub Issue: `Fixes #<id>` or `Refs #<id>`.
- PR scope matches the linked issue.

### 2. Build and Test

Run before opening PR:

```bash
mvn -q test
```

For container-related changes, also run:

```bash
docker build -t phive-validation-api -f Containerfile .
```

### 3. Code Quality

- No unrelated refactors
- No dead code
- No breaking API/interface changes unless issue explicitly requires it
- Logging levels are appropriate (no noisy production logs)

### 4. Documentation

Update docs if behavior/configuration/runtime usage changes.

Typical files:

- `README.md`
- `docs/DEVELOPMENT.md`

### 5. Security

- Do not commit secrets, private keys, or tokens
- Do not expose sensitive data in logs, screenshots, or examples

### 6. PR Description Must Include

- Summary
- Linked issue(s)
- What changed
- How to test
- Compatibility impact
- Screenshots (if UI changed)

## Review and Merge Policy

- At least one reviewer approval is required
- All review comments must be addressed
- CI checks must pass (when configured)
- Squash merge is preferred unless maintainers request otherwise

## Commit Message Guidance

Use short imperative messages.

Examples:

- `feat: add runtime log format selection`
- `fix: correct 404 page base path`
- `docs: update deployment instructions`
