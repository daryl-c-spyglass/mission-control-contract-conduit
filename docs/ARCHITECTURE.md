# Contract Conduit - Architecture Overview

## System Architecture

Contract Conduit follows a monolithic full-stack architecture with a React frontend and Node.js/Express backend, sharing TypeScript types through a common schema.

### Directory Structure

```
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── components/      # Reusable UI components
│       ├── pages/           # Route-level page components
│       ├── hooks/           # Custom React hooks
│       └── lib/             # Client utilities
├── server/                  # Express backend
│   ├── lib/                 # Core infrastructure modules
│   │   ├── logger.ts        # Structured logging (pino)
│   │   ├── audit.ts         # Audit trail service
│   │   ├── resilience.ts    # Circuit breakers, timeouts, retries
│   │   └── envGuard.ts      # Environment variable validation
│   ├── middleware/           # Express middleware
│   │   ├── requestId.ts     # Request correlation IDs
│   │   ├── requestLogger.ts # HTTP request/response logging
│   │   └── rateLimit.ts     # Rate limiting
│   ├── cron/                # Scheduled tasks
│   ├── services/            # Business logic services
│   ├── routes.ts            # API route definitions
│   ├── storage.ts           # Data access layer (Drizzle ORM)
│   ├── slack.ts             # Slack API integration
│   ├── repliers.ts          # Repliers MLS API integration
│   ├── gmail.ts             # Gmail integration
│   ├── fub.ts               # Follow Up Boss CRM integration
│   └── index.ts             # Server entry point
├── shared/                  # Shared types and schemas
│   └── schema.ts            # Drizzle ORM schema + Zod validators
└── docs/                    # Documentation
```

### Data Flow

1. **Client** sends requests via TanStack Query to Express API
2. **Express middleware** adds request IDs, logging, rate limiting
3. **Route handlers** validate input, call storage or external services
4. **Storage layer** uses Drizzle ORM against PostgreSQL
5. **External calls** go through circuit breakers with timeout protection

### External Service Integration

| Service | Purpose | Resilience |
|---------|---------|------------|
| Repliers API | MLS property data | 15s timeout, 5-failure circuit breaker, 60s reset |
| Slack API | Team notifications | 10s timeout, 5-failure circuit breaker, 30s reset |
| OpenAI API | AI content generation | 30s timeout, 3-failure circuit breaker, 120s reset |
| Gmail API | Email routing | OAuth managed through integration |
| Follow Up Boss | CRM data | Standard HTTP calls |
| Mapbox | Property maps | Client-side only |

### Database

PostgreSQL via Drizzle ORM. Key tables:
- `transactions` - Property deal tracking
- `coordinators` - Team member management
- `audit_logs` - Compliance audit trail
- `cma_reports` - Comparative market analysis
- `flyers` - Marketing flyer storage
- `notification_settings` - Per-user notification preferences

### Observability

- **Structured Logging**: Pino with JSON output, module-specific loggers, PII redaction
- **Audit Trail**: Database-backed action logging for compliance
- **Request Correlation**: UUID-based request IDs propagated through all log entries
- **Health Check**: GET /health endpoint for uptime monitoring
