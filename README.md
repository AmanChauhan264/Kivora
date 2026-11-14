# Kivora — Multi-Vendor E-Commerce Marketplace

> **Kivora** is an enterprise-grade, multi-vendor e-commerce marketplace platform engineered for Android, iOS, and the modern web. Built with an emphasis on data integrity, high concurrency, clean domain-driven architecture, and an exceptional user experience.

---

## 1. Product Overview

Kivora connects buyers, independent sellers, and platform administrators through a unified ecosystem powered by a centralized backend engine.

- **Customer Mobile Application (Android & iOS):** Built with React Native & Expo (Expo Router v3). Offers modern shopping ergonomics, category exploration, variant selection, unified multi-vendor checkout, offline-first catalog caching, and real-time order tracking.
- **Seller Web Dashboard:** Built with Next.js 14+ & Tailwind CSS. Enables merchants to manage storefronts, configure product variant matrices, monitor stock, fulfill individual sub-orders, and track double-entry earnings and payouts.
- **Admin Web Dashboard:** Built with Next.js 14+ & Tailwind CSS. Empowers platform administrators to supervise marketplace operations, audit KYC applications, manage commissions, inspect orders, and oversee dispute settlements and batch payouts.
- **Centralized Backend API:** High-throughput Node.js + Express + TypeScript service backed by PostgreSQL (Prisma ORM), Redis for distributed locking and atomic stock reservations, and Socket.IO for real-time order state distribution.

---

## 2. Technology Stack

### Mobile Application

- **Framework:** React Native with Expo (Managed Workflow, Expo Router v3)
- **Language:** TypeScript
- **State Management:** Redux Toolkit (client UI state) & TanStack Query v5 (persistent server cache & synchronization)
- **Offline Storage:** `react-query-persist-client` with `AsyncStorage` / `MMKV`
- **Security:** Hardware-backed `Expo SecureStore` (iOS Keychain / Android Keystore) for refresh tokens
- **Design & Typography:** Custom design system featuring **Baloo Bhai 2** typography and Kivora brand tokens

### Backend Service

- **Runtime & Framework:** Node.js, Express.js, TypeScript
- **Database & ORM:** PostgreSQL 16, Prisma ORM
- **Cache & Concurrency:** Redis 7 (distributed locking, stock reservation TTL, rate limiting, pub/sub)
- **Real-Time Communication:** Socket.IO with `@socket.io/redis-adapter`
- **Payment Processing:** Razorpay (Order creation, webhook signature verification, automated refunds, escrow settlement)
- **Payment Processing:** Razorpay (Order creation, webhook signature verification, automated refunds, centralized settlement clearing)
- **Media Management:** Cloudinary (Signed direct uploads, dynamic CDN image optimization)
- **Validation & Security:** Zod, Argon2/Bcrypt, JWT (Access & Refresh token family rotation)

### Web Dashboards (Seller & Admin)

- **Framework:** Next.js 14+ (App Router, Server & Client Components)
- **Styling:** Tailwind CSS with Kivora brand design tokens
- **Data Fetching:** TanStack Query, Next.js Server Actions / Route Handlers
- **Components:** Reusable design system (`@kivora/ui`)

### Monorepo & Tooling

- **Package Manager:** `pnpm` workspaces (v9.x)
- **Build Orchestration:** Turborepo (v2.x)
- **Containerization:** Docker & Docker Compose (PostgreSQL 16, Redis 7)
- **Code Quality:** TypeScript 5.x, ESLint 8.x (Flat Config), Prettier 3.x

---

## 3. Brand Identity & Design System

Kivora uses a distinct brand palette designed to evoke warmth, craftsmanship, and modern digital commerce elegance:

- **Primary Brown:** `#3B2418` — Headers, primary text, brand emblems, dark surface elements
- **Cream:** `#F2E8DA` — Dominant background, surface canvas, card containers
- **Baby Blue:** `#8EC5FF` — Interactive accents, primary action buttons, highlights, selection indicators
- **Typography:** **Baloo Bhai 2** across all mobile screens and web dashboards

> **Accessibility Standard:** Baby Blue (`#8EC5FF`) has high luminance. All interactive buttons and badges using `#8EC5FF` backgrounds feature **Primary Brown (`#3B2418`) text**, achieving an **8.5:1 contrast ratio** exceeding WCAG AAA standards.

---

## 4. Key Architectural Mechanisms

### 4.1 Two-Tier Inventory Concurrency Engine

1. **Tier 1 (Redis Fast Lock):** Reserves stock atomically using Lua scripts with a 15-minute TTL during customer checkout intent (`AVAILABLE` → `RESERVED`).
2. **Tier 2 (PostgreSQL Atomic Commit):** When the verified payment webhook arrives, stock is permanently decremented via an ACID database transaction with atomic conditional update (`WHERE quantity >= $requested_qty`). If rows affected == 0, the transaction aborts and initiates an automated refund (`RESERVED` → `COMMITTED`).
3. **Reconciliation Worker:** Periodic background cron clears expired reservations and reconciles Redis cache with PostgreSQL.

### 4.2 Payment State Machine & Webhook Idempotency

- **Payment States:** `CREATED` → `PENDING` → `CAPTURED` → `PARTIALLY_REFUNDED` / `REFUNDED` / `FAILED`.
- **Authoritative Webhook:** Order fulfillment triggers strictly from verified Razorpay `payment.captured` webhooks (HMAC-SHA256 signature verification).
- **Idempotency Safeguard:** Event IDs are recorded in `ProcessedWebhook` table to acknowledge duplicates without double-processing.
- **Escrow Settlement:** Customer payments are held centrally in the platform escrow account. No automated marketplace split payments are used. Seller disbursements occur in controlled batch cycles after the 7-day return window.
- **Settlement Clearing & Holdback:** Customer payments are collected centrally into the platform settlement account. No automated marketplace split payments are used. Seller disbursements occur via double-entry ledger batch cycles after the 7-day return cooling-off window.

### 4.3 Multi-Vendor Order Splitting & Rollup

- Single parent `Order` splits into autonomous `SellerOrder` records for each merchant.
- Each seller fulfills independently (`CONFIRMED` → `PROCESSING` → `SHIPPED` → `DELIVERED`).
- Seller-specific cancellations trigger partial refunds via Razorpay without disrupting other vendors' sub-orders.
- Customer receives a consolidated order view with independent package tracking timelines.

### 4.4 Double-Entry Seller Ledger & Commission Engine

- Immutable `SellerLedgerEntry` records all credits (order earnings), debits (platform commission, 18% GST on commission, refund reversals), and payouts.
- Commission is calculated on gross item subtotal. Net seller earnings are held in `pendingBalance` until the customer return window expires, moving to `availableBalance` for payout.

---

## 5. Monorepo Structure

```
kivora/
├── apps/
│   ├── backend/          # Node.js Express API service
│   ├── mobile/           # React Native Expo mobile application
│   ├── seller-web/       # Next.js merchant dashboard
│   └── admin-web/        # Next.js platform administrator dashboard
├── packages/
│   ├── types/            # Shared TypeScript domain models & DTOs
│   ├── validation/       # Shared Zod validation schemas
│   ├── config/           # Shared Tailwind, ESLint, and TS configurations
│   └── ui/               # Shared design tokens & web UI components
├── docs/
│   ├── architecture/     # System blueprints, data models, workflows
│   └── api/              # API contracts and specifications
├── docker-compose.yml    # Local development infrastructure (PostgreSQL 16, Redis 7)
├── package.json          # Monorepo root configuration
├── pnpm-workspace.yaml   # pnpm workspace definition
├── turbo.json            # Turborepo task pipeline configuration
├── tsconfig.base.json    # Base TypeScript strict compiler options
└── eslint.config.mjs     # Monorepo-wide ESLint configuration
```

---

## 6. Shared Packages (`packages/*`)

- **`@kivora/types`**: Pure TypeScript leaf package containing domain models, request/response DTOs, enums (`UserRole`, `OrderStatus`, `SellerOrderStatus`, `PaymentStatus`, `StoreStatus`, `LedgerEntryType`), standardized API response interfaces (`ApiResponse<T>`), and real-time Socket event schemas.
- **`@kivora/validation`**: Reusable Zod schemas for input validation across client and server (auth, address, product, store, order, payments).
- **`@kivora/ui`**: Centralized framework-agnostic design tokens (colors, typography, spacing, border radii, shadows, accessibility conventions) and shared web component style presets.
- **`@kivora/config`**: Base presets for ESLint, TypeScript (`base.json`, `node.json`, `react.json`), and Tailwind CSS (`tailwind.config.js`).

---

## 7. Prerequisites & Environment Setup

### System Prerequisites

- **Node.js:** `>= 20.x LTS` (tested on Node 20 / 24)
- **Package Manager:** `pnpm >= 9.x`
- **Docker & Docker Compose:** Optional for running local PostgreSQL & Redis containers
- **Git:** Version 2.x

### Environment File Setup

Copy the root `.env.example` file to create your local `.env`:

```bash
cp .env.example .env
```

---

## 8. Local Development & Docker Commands

Local database (PostgreSQL 16) and caching (Redis 7) services are defined in `docker-compose.yml`.

### Docker Commands

- **Start Services (Detached Mode):**
  ```bash
  docker compose up -d
  ```
- **Stop Services:**
  ```bash
  docker compose down
  ```
- **View Container Logs:**
  ```bash
  docker compose logs -f
  # Or inspect specific container:
  docker compose logs -f postgres
  docker compose logs -f redis
  ```
- **Stop Services & Remove Volumes (Destructive):**
  ```bash
  docker compose down -v
  ```

---

## 9. Available Workspace Scripts

Run these scripts from the repository root:

| Command             | Description                                                                 |
| :------------------ | :-------------------------------------------------------------------------- |
| `pnpm install`      | Installs all monorepo dependencies and links workspace packages.            |
| `pnpm build`        | Executes cached parallel builds across all packages and apps via Turborepo. |
| `pnpm type-check`   | Performs strict TypeScript type-checking across all packages and apps.      |
| `pnpm lint`         | Runs ESLint across all TypeScript and JavaScript files.                     |
| `pnpm format`       | Formats all source files with Prettier.                                     |
| `pnpm format:check` | Verifies that all files conform to Prettier formatting rules.               |
| `pnpm test`         | Runs automated test suites via Turborepo.                                   |
| `pnpm clean`        | Cleans build artifacts and `dist` directories.                              |

### Backend Database & Development Commands

| Command                                         | Description                                                      |
| :---------------------------------------------- | :--------------------------------------------------------------- |
| `pnpm --filter @kivora/backend prisma:generate` | Generates the strongly-typed Prisma Client from `schema.prisma`. |
| `pnpm --filter @kivora/backend prisma:validate` | Validates the Prisma schema syntax and relations.                |
| `pnpm --filter @kivora/backend db:migrate`      | Applies pending database migrations via Prisma Migrate.          |
| `pnpm --filter @kivora/backend db:seed`         | Seeds default categories and platform foundations idempotently.  |
| `pnpm --filter @kivora/backend test`            | Executes backend Vitest test suites (health, env, errors).       |
| `pnpm --filter @kivora/backend dev`             | Starts the backend HTTP server in watch mode via `tsx`.          |

### Backend Database & Development Commands

| Command                                         | Description                                                      |
| :---------------------------------------------- | :--------------------------------------------------------------- |
| `pnpm --filter @kivora/backend prisma:generate` | Generates the strongly-typed Prisma Client from `schema.prisma`. |
| `pnpm --filter @kivora/backend prisma:validate` | Validates the Prisma schema syntax and relations.                |
| `pnpm --filter @kivora/backend db:migrate`      | Applies pending database migrations via Prisma Migrate.          |
| `pnpm --filter @kivora/backend db:seed`         | Seeds default categories and platform foundations idempotently.  |
| `pnpm --filter @kivora/backend test`            | Executes backend Vitest test suites (health, env, errors).       |
| `pnpm --filter @kivora/backend dev`             | Starts the backend HTTP server in watch mode via `tsx`.          |

---

## 10. Development Roadmap & Milestones

- [x] **Phase 0: Architecture & Foundation Planning** — Requirements analysis, system architecture specification, risk analysis, and roadmap establishment.
- [x] **Phase 1: Monorepo Foundation & Tooling** — Scaffolding `pnpm` workspaces, Turborepo pipeline, shared packages (`@kivora/types`, `@kivora/validation`, `@kivora/config`, `@kivora/ui`), and Docker Compose setup.
- [x] **Phase 2: Database Architecture & Backend Core** — PostgreSQL schema design in Prisma, migrations, seed data, Express modular structure, and Redis client.
- [ ] **Phase 3: Authentication & Security Engine** — Multi-role JWT authentication, password hashing, token rotation, and store ownership middleware.
- [ ] **Phase 4: Product Catalog & Inventory Reservation Engine** — Products, categories, variant matrix generator, Cloudinary integration, and two-tier stock reservation engine.
- [ ] **Phase 5: Multi-Vendor Orders, Razorpay Payments & Ledger** — Order splitting engine, Razorpay checkout, webhook signature verification, partial refunds, and double-entry seller ledger.
- [ ] **Phase 6: Customer Mobile App (Expo)** — Screens for Home, Explore, Product Details, Cart, Checkout, and Order Tracking with Kivora theme.
- [ ] **Phase 7: Seller Web Dashboard (Next.js)** — Catalog management, variant builder, sub-order fulfillment, and payout tracking.
- [ ] **Phase 8: Admin Web Dashboard (Next.js)** — KYC verification, seller governance, marketplace metrics, and ledger settlement.
- [ ] **Phase 9: Real-Time Synchronization & Notifications** — Socket.IO rooms, live order status tracking, and Expo push alerts.
- [ ] **Phase 10: Production Hardening, Testing & Deployment** — Vitest integration suites, concurrency stress tests, Playwright & Maestro E2E tests, and CI/CD pipelines.

---

## 11. Documentation Links

- **Architecture Specification:** [`docs/architecture/PROJECT_ARCHITECTURE.md`](docs/architecture/PROJECT_ARCHITECTURE.md)
