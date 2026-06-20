# run.md

Local development and verification for agents and automation.

## Startup

```bash
npm run dev
```

## Health check

- **base_url**: `http://localhost:3000`
- **health_endpoint**: `/health`

```bash
curl -sf "http://localhost:3000/health" || echo "service not ready"
```

## Tests

```bash
npm test
```

## Auth

Set required API keys in .env (never commit secrets).
