# Contract Conduit - Security Controls

## Authentication

- Replit OpenID Connect (OIDC) authentication
- Session-based with `isAuthenticated` middleware on all protected routes
- Public routes explicitly marked (flyer viewer, health check)

## Input Validation

- Transaction creation validates: required fields, field lengths, numeric ranges
- Zod schemas for structured input validation on insert operations
- Request body size limited to 50MB for file uploads, standard JSON otherwise

## Rate Limiting

| Endpoint Group | Limit | Window |
|----------------|-------|--------|
| All API routes | 100 requests | 15 minutes |
| Transaction creation | 5 requests | 1 minute |
| AI generation (flyers, graphics, taglines, headlines) | 3 requests | 1 minute |
| Authentication | 20 requests | 15 minutes |

Rate limits return HTTP 429 with `Retry-After` header.

## PII Protection

Structured logging automatically redacts sensitive fields:
- `email`, `phone`, `*.email`, `*.phone`
- `*.agentEmail`, `*.agentPhone`
- `req.headers.authorization`, `req.headers.cookie`

Redacted values appear as `[REDACTED]` in log output.

## Audit Trail

All Slack bot operations are logged to the `audit_logs` database table:
- Channel creation, user invites, message posts
- File uploads, MLS notifications, marketing materials
- Coming soon announcements, photography requests

Each audit entry includes: action, actor, target entity, metadata, timestamp.

## External API Security

- API keys stored as encrypted secrets (never in code)
- Circuit breakers prevent cascading failures from external service outages
- Timeout protection on all external HTTP calls
- Kill switches available for Slack notifications (`DISABLE_SLACK_NOTIFICATIONS`)

## Content Security Policy

- Frame ancestors restricted to Replit and Render domains
- X-Frame-Options header removed in favor of CSP

## Environment Variable Management

- Required variables validated at startup
- Missing optional variables logged as warnings
- No secrets exposed in health check or error responses
