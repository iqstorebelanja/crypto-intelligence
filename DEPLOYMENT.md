# CRYPTO INTELLIGENCE AI — PRODUCTION DEPLOYMENT & LAUNCH HARDENING RUNBOOK (PHASE 25)

## 1. ARCHITECTURE OVERVIEW

Crypto Intelligence AI is an institutional-grade, multi-exchange quantitative crypto market intelligence terminal with:
- **Backend**: Node.js + Express with TSX runtime / compiled CJS bundle (`dist/server.cjs`).
- **Frontend**: React 19 + TypeScript SPA bundled by Vite with Tailwind CSS v4, Recharts, and Workbox PWA.
- **Engine Layer**: Native quantitative models (RSI, MA20/50/200, Bollinger Bands, Market Structure, Volume Pressure, Multi-Timeframe Confluence, Downside Risk Defense). Zero reliance on unofficial TradingView scraping.
- **Data Layers**: Multi-Exchange connectors (Binance, Bybit, OKX, Pionex), On-Chain Whale Surveillance, and Multi-Chain DEX Liquidity Indexer (Uniswap v3, Raydium, Curve).
- **Security & Authorization**: Authoritative server-side Entitlement (FREE, TRIAL, PRO), Session Tokens with CSRF / IDOR protection, Role-Based Access Control (RBAC), and Centralized Rate Limiting.
- **Storage**: In-Memory transactional store with secondary indexing, automated snapshots, versioned backups (`DatabaseBackupService`), and zero-loss restore.

---

## 2. PRODUCTION ENVIRONMENT SEPARATION

| Parameter | Development | Staging | Production |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `development` | `staging` | `production` |
| `APP_URL` | `http://localhost:3000` | `https://staging.yourdomain.com` | `https://your-production-domain.com` |
| `PORT` | `3000` | `3000` | `3000` / `8080` (Cloud Run) |
| `DEBUG` | `true` | `false` | `false` |
| `EXTERNAL_INTELLIGENCE_MOCK_MODE` | `false` | `false` | `false` |
| `CORS Allowlist` | Localhost + dev preview | Staging origin | Strict production domain only |
| `Secure Cookies` | Lax / Unsecure if HTTP | Strict / Secure | Strict / Secure (HTTPS only) |

---

## 3. REQUIRED ENVIRONMENT VARIABLES

> **CRITICAL SECURITY NOTICE**: Never commit secrets or actual credential values to version control. The variable names below must be configured via your cloud deployment provider (e.g. Cloud Run, Kubernetes Secrets, or Doppler/HashiCorp Vault):

- `NODE_ENV` — `production`
- `PORT` — Port number for Express server (`3000` or Cloud Run `8080`)
- `APP_URL` — Canonical public HTTPS domain (e.g. `https://crypto-intelligence.ai`)
- `GEMINI_API_KEY` — Google Gemini API key for server-authoritative AI Trader terminal
- `EXTERNAL_INTELLIGENCE_ENABLED` — `true`
- `WHALE_PROVIDER_ENABLED` — `true`
- `DEX_PROVIDER_ENABLED` — `true`
- `ONCHAIN_PROVIDER_ENABLED` — `true`
- `WHALE_PROVIDER_API_KEY` — Whale Alert or blockchain node API key (optional for base fallback)
- `WHALE_PROVIDER_BASE_URL` — Base API URL for on-chain whale activity
- `DEX_PROVIDER_API_KEY` — DEX indexer API key (optional for public RPC)
- `DEX_PROVIDER_BASE_URL` — Base API URL for DEX pool data
- `EXTERNAL_INTELLIGENCE_MOCK_MODE` — `false` (must be OFF in production)
- `PAYMENT_GATEWAY_API_KEY` — Stripe or web payment gateway secret key (e.g. `sk_live_...`)
- `PAYMENT_GATEWAY_WEBHOOK_SECRET` — Webhook signing secret (e.g. `whsec_...`)

---

## 4. BUILD & START COMMANDS

### Build Process
```bash
# 1. Typecheck and lint codebase
npm run lint

# 2. Compile React frontend SPA and esbuild backend bundle
npm run build
```

### Production Execution
```bash
# Start production server
npm start
# (Runs node dist/server.cjs in production mode, serving precompiled static assets from ./dist)
```

---

## 5. HEALTH & READINESS PROBES

The application exposes structured, non-leaking health endpoints for load balancers and container orchestrators:

- **Liveness Probe**: `GET /api/health/live`
  - Returns `{"status": "HEALTHY", "timestamp": ...}`
  - Used by Kubernetes/Cloud Run to ensure the process is alive.

- **Readiness Probe**: `GET /api/health/ready`
  - Validates core application and database state.
  - Returns HTTP 200 when ready to receive traffic, HTTP 503 if unavailable.

- **System Diagnostics**: `GET /api/health` and `GET /api/kesehatan`
  - Breakdown by subsystems:
    1. `APPLICATION`: Uptime, heap memory, version.
    2. `DATABASE`: Users count, active sessions, alerts count, backups available.
    3. `EXTERNAL_PROVIDERS`: Total and active external feeds (degraded provider will NOT bring down core scanner).
    4. `NOTIFICATION`: Push subscriptions count, delivery history.
    5. `CACHE`: In-memory cache hit ratio, entry count, memory footprint.

---

## 6. BACKUP & RESTORE PROCEDURES

### Automated Backups
- The server automatically captures consistent in-memory snapshots on startup and every 6 hours via `DatabaseBackupService`.
- Retains the last 10 snapshots with SHA-256 integrity checksums.

### On-Demand Backup (Admin)
```bash
curl -X POST \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  https://your-production-domain.com/api/admin/database/backup
```

### Listing Available Backups (Admin)
```bash
curl -s \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  https://your-production-domain.com/api/admin/database/backups
```

### Restoring from Backup (Admin)
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -d '{"backupId": "bkp_1791173129385_va37"}' \
  https://your-production-domain.com/api/admin/database/restore
```
The server validates the SHA-256 payload checksum before applying the restore. If a hash mismatch or corrupted payload is detected, the restore aborts immediately.

---

## 7. DISASTER RECOVERY RUNBOOK

### Scenario A: External Provider (Whale Alert / DEX) Outage
- **Symptoms**: `/api/external-intelligence/health` reports `DEGRADED`.
- **Mitigation**:
  1. The application automatically falls back to cached on-chain state and isolates the failing provider.
  2. Core exchange feeds (Binance, Bybit, OKX, Pionex), quantitative scoring (Bull Score, Downside Risk), and alerts continue operating without interruption.
  3. No operator intervention required; providers automatically reconnect on recovery.

### Scenario B: AI Trader API Rate-Limit (HTTP 429) or Temporary Downtime
- **Symptoms**: AI Trader queries return `AI service temporarily busy`.
- **Mitigation**:
  1. Server-authoritative AI quota engine rolls back token deductions atomically.
  2. Free tier users are not charged ad impressions for failed queries.
  3. Pre-computed technical summaries remain accessible directly in the Coin Detail dashboard.

### Scenario C: Secret Rotation (Gemini API Key or Provider Keys)
- **Mitigation Procedure**:
  1. Update secret value in Cloud Run or secret manager.
  2. Trigger graceful container rolling restart (`SIGTERM`).
  3. Server completes in-flight requests, flushes logs, closes WebSocket connections, and restarts cleanly with new credentials in under 2 seconds.

---

## 8. PRODUCTION DEPLOYMENT CHECKLIST

- [x] Production environment separated from development (`NODE_ENV=production`).
- [x] Zero hardcoded secrets, passwords, or tokens in source code or client bundles.
- [x] Database backup scheduler and restore endpoints active and verified.
- [x] Strict CORS allowlist with credentials enforcement.
- [x] Production security headers active (`nosniff`, `SAMEORIGIN`, `strict-origin-when-cross-origin`, `Permissions-Policy`, `HSTS`).
- [x] Centralized rate limiting active on auth, AI, alerts, scanner, and community.
- [x] Server-authoritative entitlement active (Free tier data masked at server level; PRO uninhibited).
- [x] PWA manifest and service worker configured (`NetworkOnly` for all authenticated API routes).
- [x] Liveness, readiness, and `/api/kesehatan` endpoints verified.
- [x] Graceful shutdown traps configured for `SIGTERM` and `SIGINT`.
- [x] 100% of automated test suites passing (92/92 test cases).
