# Kivora Authentication API Specification

Comprehensive documentation for the Kivora Authentication & Security Engine (`/api/v1/auth`).

---

## Overview

Kivora uses a hardened dual-token authentication engine with strict security controls:

1. **Access Token (JWT):** Short-lived (15 minutes), signed with `JWT_ACCESS_SECRET`. Contains explicit `token_type: 'access'`, unique `jti`, and `familyId`. Transmitted via `Authorization: Bearer <token>` or `kivora_access_token` cookie. Revocation is immediately tracked via Redis blacklist (`revoked:jti` and `revoked:user`).
2. **Refresh Token (Opaque):** Long-lived (7 days), generated as a cryptographically random 256-bit hex string (`crypto.randomBytes(32).toString('hex')`). Stored exclusively as a SHA-256 hash in PostgreSQL with atomic token-family rotation. Transmitted via request body or `kivora_refresh_token` HttpOnly cookie.
3. **CSRF Defense:** Cookie-authenticated state-changing requests enforce strict Origin matching against `CORS_ORIGIN` and require custom anti-CSRF headers (`X-Requested-With` or `X-CSRF-Token`). Mobile and API clients using `Authorization: Bearer` or explicit JSON body tokens are exempt from ambient cookie CSRF restrictions.
4. **Trusted Proxy & Rate Limiting:** Configured with Express `trust proxy 1`. Rate limiters evaluate client `req.ip` without blindly trusting spoofable client headers.

---

## Endpoints

### 1. Register Customer

`POST /api/v1/auth/register/customer`

Registers a new customer and transactionally creates `User` and `CustomerProfile`.

**Request Body:**

```json
{
  "email": "customer@example.com",
  "password": "Password123!Secure",
  "firstName": "Alice",
  "lastName": "Sharma",
  "phone": "9876543210"
}
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Customer account created successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "customer@example.com",
      "role": "CUSTOMER",
      "phone": "9876543210",
      "isActive": true,
      "customerProfile": {
        "id": "uuid",
        "firstName": "Alice",
        "lastName": "Sharma",
        "avatarUrl": null
      },
      "sellerProfile": null,
      "createdAt": "2026-11-14T12:00:00.000Z",
      "updatedAt": "2026-11-14T12:00:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi...",
      "expiresIn": 900,
      "tokenType": "Bearer"
    }
  }
}
```

---

### 2. Register Seller

`POST /api/v1/auth/register/seller`

Registers a seller, creating `User`, `SellerProfile` (with `kycVerified: false`), and `Store` (with `status: PENDING`).

**Request Body:**

```json
{
  "email": "seller@example.com",
  "password": "SellerPass123!Secure",
  "firstName": "Bob",
  "lastName": "Merchant",
  "phone": "9876543211",
  "storeName": "Bob Retail Mart",
  "panNumber": "ABCDE1234F",
  "gstin": "29ABCDE1234F1Z5"
}
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Seller account registered successfully. Store is pending KYC approval.",
  "data": {
    "user": {
      "id": "uuid",
      "email": "seller@example.com",
      "role": "SELLER",
      "sellerProfile": {
        "id": "uuid",
        "panNumber": "ABCDE1234F",
        "gstin": "29ABCDE1234F1Z5",
        "kycVerified": false,
        "store": {
          "id": "uuid",
          "name": "Bob Retail Mart",
          "slug": "bob-retail-mart",
          "status": "PENDING"
        }
      }
    },
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi...",
      "expiresIn": 900,
      "tokenType": "Bearer"
    }
  }
}
```

---

### 3. Login

`POST /api/v1/auth/login`

Authenticates credentials using constant-time Argon2id verification.

**Request Body:**

```json
{
  "email": "customer@example.com",
  "password": "Password123!Secure"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Authentication successful",
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi...",
      "expiresIn": 900,
      "tokenType": "Bearer"
    }
  }
}
```

---

### 4. Refresh Token Rotation

`POST /api/v1/auth/refresh`

Rotates the refresh token atomically and issues a new access token. If an already rotated token is re-submitted or a concurrent collision occurs, the entire token family is revoked immediately in PostgreSQL and Redis.

**Security Requirements:**

- **Mobile/API Clients:** Pass `refreshToken` in the JSON request body. No anti-CSRF headers required.
- **Web Browser Clients:** If relying on the HttpOnly `kivora_refresh_token` cookie, requests MUST provide:
  - An `Origin` or `Referer` matching `CORS_ORIGIN`.
  - A custom header: `X-Requested-With: XMLHttpRequest` or `X-CSRF-Token`.

**Request Body (or HttpOnly Cookie):**

```json
{
  "refreshToken": "8f3b2a9e...64_hex_chars..."
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Token rotated successfully",
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "7c1d4e2a...64_hex_chars...",
      "expiresIn": 900,
      "tokenType": "Bearer"
    }
  }
}
```

---

### 5. Logout

`POST /api/v1/auth/logout`

Revokes the active refresh token and blacklists the current access token (`revoked:jti`) and session family (`revoked:family`) in Redis with TTL matching token expiry. Clears the HttpOnly cookie.

**Security Requirements:**

- If called via ambient cookies, requires `Origin` and `X-Requested-With` / `X-CSRF-Token`.
- Mobile/API clients can provide `refreshToken` in request body or `Authorization: Bearer <token>`.

**Request Body (or HttpOnly Cookie / Authorization Header):**

```json
{
  "refreshToken": "8f3b2a9e...64_hex_chars..."
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Session logged out successfully",
  "data": {
    "loggedOut": true
  }
}
```

---

### 6. Logout All Sessions

`POST /api/v1/auth/logout-all`

**Headers:**
`Authorization: Bearer <accessToken>`

Revokes all active refresh tokens for the user in PostgreSQL and blacklists all active access tokens in Redis (`revoked:user:<userId>`). Any existing access tokens issued prior to logout-all are rejected immediately.

**Success Response (200 OK):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "All active sessions terminated across all devices",
  "data": {
    "loggedOutAll": true
  }
}
```

---

### 7. Current User Profile

`GET /api/v1/auth/me`

**Headers:**
`Authorization: Bearer <accessToken>`

**Success Response (200 OK):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Current authenticated user profile",
  "data": {
    "user": {
      "id": "uuid",
      "email": "customer@example.com",
      "role": "CUSTOMER",
      "customerProfile": { ... }
    }
  }
}
```

---

## Error Responses

All error responses use a standard error envelope:

```json
{
  "success": false,
  "statusCode": 401,
  "message": "Invalid email or password",
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

### Standard Error Codes

| Code                        | HTTP Status | Description                                    |
| :-------------------------- | :---------- | :--------------------------------------------- |
| `VALIDATION_ERROR`          | 400         | Payload failed Zod schema checks.              |
| `AUTHENTICATION_REQUIRED`   | 401         | Missing or invalid Bearer token.               |
| `INVALID_CREDENTIALS`       | 401         | Incorrect email or password.                   |
| `TOKEN_EXPIRED`             | 401         | Access token or refresh token has expired.     |
| `TOKEN_INVALID`             | 401         | Cryptographic signature mismatch.              |
| `TOKEN_REUSE_DETECTED`      | 401         | Rotated token was reused. Family revoked.      |
| `FORBIDDEN_ACCESS`          | 403         | User does not have the required role.          |
| `SELLER_NOT_APPROVED`       | 403         | Seller KYC is pending or store is inactive.    |
| `UNAUTHORIZED_STORE_ACCESS` | 403         | Seller does not own the requested store.       |
| `CONFLICT_ERROR`            | 409         | Duplicate email, phone, or PAN.                |
| `RATE_LIMIT_EXCEEDED`       | 429         | Rate limit hit (`Retry-After` header present). |
