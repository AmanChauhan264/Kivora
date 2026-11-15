# Kivora Backend Service (`@kivora/backend`)

Centralized backend API service for the Kivora multi-vendor marketplace platform. Built with Node.js, Express, TypeScript, PostgreSQL (Prisma ORM), and Redis.

---

## 1. Authentication & Security Engine

The authentication engine implements industry-standard security practices:

- **Password Hashing:** Argon2id (`memoryCost: 65536, timeCost: 3, parallelism: 4`). Passwords are never stored in plaintext and never returned in API payloads.
- **Short-Lived Access Tokens:** Signed with `JWT_ACCESS_SECRET`, TTL 15 minutes, explicit `token_type: 'access'`, unique `jti`, issuer `kivora-backend`, audience `kivora-app`.
- **Cryptographically Random Opaque Refresh Tokens:** 256-bit cryptographically secure random tokens (`crypto.randomBytes(32).toString('hex')`) stored exclusively as SHA-256 hashes in PostgreSQL with session lineage (`familyId`).
- **Concurrency-Safe Token Rotation (SEC-01):** Atomic conditional database update (`isRevoked: false`) guarantees only one concurrent rotation succeeds; race condition collisions immediately revoke the entire compromised family.
- **CSRF Defense (SEC-02):** Ambient cookie requests to state-changing endpoints (`/refresh`, `/logout`) require valid `Origin` (matching `CORS_ORIGIN`) and custom anti-CSRF headers (`X-Requested-With` or `X-CSRF-Token`). Mobile and API clients using Bearer tokens are exempt.
- **Real-Time Access Token Revocation (SEC-03):** Redis-backed blacklist revokes access tokens on `/logout` (`revoked:jti:<jti>`) and `/logout-all` (`revoked:user:<userId>`) with graceful in-memory fallback.
- **CORS Hardening (SEC-04):** Explicit origin allowlist without wildcard reflections and clean rejection (`callback(null, false)`) prevents cross-origin data exposure.
- **Trusted Reverse Proxy (SEC-05):** Express `trust proxy 1` configuration enables safe client IP extraction (`req.ip`) for rate limiting without trusting spoofable client headers.
- **Secure Administrator Provisioning (SEC-06):** Seed script requires explicit `INITIAL_ADMIN_PASSWORD` meeting strict complexity requirements; hardcoded fallbacks are strictly rejected.
- **Token Type Isolation (SEC-07):** Strict verification of `token_type` claims prevents cross-token substitution attacks.
- **Timing Attack Mitigation:** Constant-time hash verification on non-existent user accounts during login prevents email enumeration.
- **Rate Limiting:** Redis-backed sliding-window rate limiter (with in-memory fallback) protects login, registration, and refresh endpoints.
- **Role-Based Authorization:** Strict `requireRole`, `requireApprovedSeller`, and `requireStoreOwnership` middleware guards sensitive resources.

---

## 2. API Endpoints

### Public Endpoints

- `GET /api/v1/health` — Centralized health check for PostgreSQL and Redis.
- `POST /api/v1/auth/register/customer` — Registers customer account with `CustomerProfile`.
- `POST /api/v1/auth/register/seller` — Registers seller account with `SellerProfile` and `Store` (KYC pending).
- `POST /api/v1/auth/login` — Authenticates credentials and issues token pair (and sets HttpOnly cookie).
- `POST /api/v1/auth/refresh` — Rotates refresh token (reads from request body or HttpOnly cookie).
- `POST /api/v1/auth/logout` — Revokes current refresh token and clears cookie.

### Protected Endpoints (`Authorization: Bearer <token>`)

- `GET /api/v1/auth/me` — Returns authenticated user profile.
- `POST /api/v1/auth/logout-all` — Revokes all active refresh tokens across all devices.

---

## 3. Storage Guidance for Client Applications

### Web Applications (Seller Web & Admin Web)

- Refresh tokens are stored in `HttpOnly`, `Secure` (production), `SameSite=Strict/Lax` cookies, shielding them from XSS exfiltration.
- Access tokens should be kept in memory or non-persistent browser runtime.

### Mobile Applications (Expo React Native)

- Refresh credentials must be stored securely using `expo-secure-store` (backed by iOS Keychain and Android Keystore).
- Avoid `AsyncStorage` for sensitive cryptographic credentials.

---

## 4. Scripts

```bash
# Development server with hot reload
pnpm --filter @kivora/backend dev

# Run Vitest test suite
pnpm --filter @kivora/backend test

# Seed taxonomy categories
pnpm --filter @kivora/backend prisma:seed

# Provision platform administrator
pnpm --filter @kivora/backend exec tsx prisma/seed-admin.ts

# Apply database migrations
pnpm --filter @kivora/backend prisma:deploy

# Inspect migration status
pnpm --filter @kivora/backend prisma:status
```
