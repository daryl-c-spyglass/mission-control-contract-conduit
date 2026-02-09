# Contract Conduit - Operations Runbook

## Health Check

```
GET /health
```

Returns JSON with status, uptime (seconds), environment, and timestamp.

## Environment Variables

### Required
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |

### Optional (feature-dependent)
| Variable | Description |
|----------|-------------|
| `REPLIERS_API_KEY` | Repliers MLS API access |
| `SLACK_BOT_TOKEN` | Slack bot for team notifications |
| `OPENAI_API_KEY` | OpenAI for AI-generated content |
| `GOOGLE_MAPS_API_KEY` | Google Maps integration |
| `MAPBOX_TOKEN` | Mapbox map rendering |

### Operational Controls
| Variable | Description |
|----------|-------------|
| `DISABLE_SLACK_NOTIFICATIONS` | Set to `true` to block all Slack messages |
| `UAT_MODE` | Set to `true` to limit notifications to test users |
| `NODE_ENV` | `development` or `production` |

## Troubleshooting

### Circuit Breaker Open

**Symptom**: Requests to external services fail with "Circuit breaker open" error.

**Resolution**:
1. Check the external service status (Repliers, Slack, or OpenAI)
2. Circuit breakers auto-reset after their timeout period:
   - Repliers: 60 seconds
   - Slack: 30 seconds
   - OpenAI: 120 seconds
3. The next request after reset enters "half-open" state (one test request)
4. If the test succeeds, the circuit closes and normal operation resumes

### Rate Limiting

**Symptom**: HTTP 429 responses.

**Resolution**:
1. Check the `Retry-After` header for when requests will be accepted again
2. Rate limits are per-IP using in-memory storage
3. Limits reset when the server restarts

### MLS Sync Issues

**Symptom**: Transaction data not updating from MLS.

**Resolution**:
1. Check server logs for `module: "repliers-sync"` entries
2. Verify `REPLIERS_API_KEY` is set and valid
3. Sync runs automatically every 15 minutes
4. Manual sync available via API: `POST /api/admin/sync-mls`

### Slack Notification Issues

**Symptom**: Slack messages not being sent.

**Resolution**:
1. Check if `DISABLE_SLACK_NOTIFICATIONS` is set to `true`
2. Verify `SLACK_BOT_TOKEN` is configured
3. Check `GET /api/admin/slack-diagnostics` for detailed status
4. Check logs for `module: "slack"` entries

## Graceful Shutdown

The server handles SIGTERM and SIGINT signals:
1. Stops accepting new connections
2. Waits up to 10 seconds for in-flight requests to complete
3. Exits cleanly

If shutdown takes longer than 10 seconds, the process is force-terminated.

## Audit Log Queries

Audit logs are stored in the `audit_logs` table. Useful queries:

```sql
-- Recent audit entries
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50;

-- Actions by a specific user
SELECT * FROM audit_logs WHERE actor_id = 'user-id' ORDER BY created_at DESC;

-- All actions on a transaction
SELECT * FROM audit_logs WHERE transaction_id = 'txn-id' ORDER BY created_at DESC;

-- Specific action type
SELECT * FROM audit_logs WHERE action = 'slack.channel.create' ORDER BY created_at DESC;
```

## Log Analysis

Logs use structured JSON format (pino). Each entry includes:
- `module`: Source module (e.g., `transactions`, `slack`, `repliers`)
- `requestId`: Correlation ID for tracing requests
- `level`: Log level (10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal)

Filter by module:
```bash
cat logs | jq 'select(.module == "slack")'
```

Filter by level (errors and above):
```bash
cat logs | jq 'select(.level >= 50)'
```
