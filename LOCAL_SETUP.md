# VoyageLedger ERP — Local Development Environment Setup

This guide provides instructions for setting up, running, and testing VoyageLedger ERP entirely in a local environment with zero cloud dependencies.

---

## 1. Prerequisites
- **Node.js**: >= 18.x
- **PostgreSQL**: Local instance running on port `5432` (e.g., PostgreSQL 16)
- **Package Manager**: `npm`

---

## 2. Environment Configuration

Copy `.env.local.example` to `.env.local` (and `.env` for Prisma CLI):

```bash
cp .env.local.example .env.local
```

### Local Environment Variables (.env.local)
```env
APP_ENV="local"
NODE_ENV="development"
PORT=3000

# Local PostgreSQL Connection
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/travel_erp_local?schema=public"

# GCP Isolated/Mock Identifiers
GCP_PROJECT_ID="travel-accounting-2026-local"
GCS_BUCKET_NAME="travel-accounting-local-docs-2026"
GOOGLE_APPLICATION_CREDENTIALS=""

# Local Auth Secrets
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="local-dev-secret-key-voyage-ledger-2026-afg"
SESSION_SECRET="local-dev-session-secret-key-voyage-ledger-2026"

# Afghanistan Localization Defaults
NEXT_PUBLIC_APP_NAME="VoyageLedger ERP (Local Dev)"
NEXT_PUBLIC_COMPANY_NAME="Ariana Silk Road Travel & Tours (Local Dev)"
NEXT_PUBLIC_DEFAULT_CURRENCY="AFN"
NEXT_PUBLIC_DEFAULT_COUNTRY="Afghanistan"
```

---

## 3. Database Initialization & Seeding

Run the all-in-one local database setup script:
```bash
npm run db:setup:local
```

This command automatically:
1. Creates the `travel_erp_local` database if it does not already exist.
2. Synchronizes the PostgreSQL schema via `prisma db push`.
3. Seeds baseline fictional data via `prisma/seed_local.ts`.

### Fictional Local Test Credentials
- **Admin Account**: `admin@voyageledger.af` / `Admin@Local2026!`
- **Travel Agent Account**: `agent@voyageledger.af` / `Agent@Local2026!`

---

## 4. Running Tests

Run the full automated test suite (including environment safety validation):
```bash
npm test
```

---

## 5. Building & Running Locally

### Development Server
```bash
npm run dev
```
Access at: [http://localhost:3000](http://localhost:3000)

### Production-Mode Build & Start
```bash
npm run build
npm run start
```
Access at: [http://localhost:3000](http://localhost:3000)

### Health Check Verification
```bash
curl http://localhost:3000/api/health
```

### Understanding `APP_ENV` vs `NODE_ENV`
The `/api/health` endpoint reports two distinct environment parameters:
- **`environment` (`APP_ENV`)**: Identifies the logical application tier (`local`, `staging`, `production`). In local development, this is always `"local"`.
- **`nodeEnv` (`NODE_ENV`)**: Identifies the Next.js runtime mode:
  - When running the dev server via `npm run dev`, `NODE_ENV="development"`.
  - When running the compiled production bundle via `npm run build && npm run start`, Next.js internally sets `NODE_ENV="production"` to disable HMR overhead and enable performance optimizations.
  - Reporting `environment: "local"` alongside `nodeEnv: "production"` during `next start` is completely intentional and confirms the compiled production build is running in the local environment tier.

---

## 6. Safety Guards & Environment Isolation

The application includes startup safety validation in `src/lib/db.ts`:
- **Local Guard**: Refuses connections if `DATABASE_URL` contains production or cloud staging markers, or if `GCS_BUCKET_NAME` targets production.
- **Staging Guard**: Refuses connections to production databases or production GCS buckets.
- **Production Guard**: Refuses connections to local, test, or staging databases.
