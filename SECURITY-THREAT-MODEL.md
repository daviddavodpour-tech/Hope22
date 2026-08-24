# Security Threat Model

## Assets
Credentials, refresh tokens, payment state, uploaded evidence, user identity data, audit logs.

## Principal threats
- Credential stuffing → auth rate limiting, bcrypt, generic auth errors.
- Token theft/replay → short-lived access tokens, refresh rotation/family tracking, session versioning, secure mobile storage.
- IDOR/BOLA → ownership checks and repository-level state checks.
- File abuse → upload size/content validation, S3 key isolation, intent expiry.
- Payment replay → idempotency keys, outbox dedupe keys, provider idempotency.
- SSRF via storage → controlled S3 endpoint/config, no user-defined endpoint.
- CORS/browser abuse → explicit production origins.
- Secret leakage → production startup invariants and CI secret scanning/audit workflow.
- Worker duplication → `FOR UPDATE SKIP LOCKED`, leases and terminal failure states.
