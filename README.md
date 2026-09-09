# OUR Bank — Digital Banking Backend

A production-shaped backend for a start-up bank, built on the **NibssByPhoenix**
banking rails. It handles customer onboarding with BVN/NIN verification, account
creation, intra/inter-bank transfers, and per-customer transaction history with
strict data isolation.

**Bank name:** OUR Bank &nbsp;·&nbsp; **Bank code:** `210`

---

## Table of contents

- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [End-to-end walkthrough](#end-to-end-walkthrough)
- [How each requirement is met](#how-each-requirement-is-met)
- [Security decisions](#security-decisions)
- [Notes on the NibssByPhoenix API](#notes-on-the-nibssbyphoenix-api)
- [Known limitations](#known-limitations)

---

## Architecture

The single most important idea in this codebase: **NibssByPhoenix is not our
database — it is the rails.** It holds the real account numbers, the real
balances, and moves the real money. This service is *the bank that sits on top*.

That produces **two entirely separate authentication layers**:

```
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 2   Customer  ──►  OUR Bank                               │
│            email + password  ──►  our own JWT (JWT_SECRET)       │
│            One token per customer. Identifies WHO is asking.     │
└──────────────────────────────────────────────────────────────────┘
                                │
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 1   OUR Bank  ──►  NibssByPhoenix                         │
│            apiKey + apiSecret  ──►  NIBSS JWT (1 hour TTL)       │
│            ONE token for the whole bank. Cached, auto-renewed.   │
└──────────────────────────────────────────────────────────────────┘
```

NIBSS cannot tell our customers apart — every transfer flows through the same
bank-level token. **Only this service can.** That is why data isolation
(Requirement 4) is enforced entirely here, and why it is designed in rather than
bolted on.

### Project structure

```
src/
├─ config/env.ts         Zod-validated environment; refuses to boot on bad config
├─ db/mongoose.ts        MongoDB connection (+ DNS override for SRV lookups)
├─ models/               Mongoose schemas — where the invariants actually live
│  ├─ Customer.ts          toJSON strips passwordHash automatically
│  ├─ KycRecord.ts         unique customerId + unique kycId
│  ├─ Account.ts           unique customerId  ← one-account-per-customer rule
│  └─ Transaction.ts       double-entry ledger, indexed by customerId
├─ nibss/                ANTI-CORRUPTION LAYER — the only code that calls NIBSS
│  ├─ client.ts            all 12 upstream endpoints, normalised
│  ├─ token.ts             token cache, expiry-aware refresh, herd guard
│  ├─ errors.ts            NibssError carries upstream status + body
│  └─ types.ts             our shapes, not theirs
├─ middleware/
│  ├─ requireAuth.ts       verifies our JWT, attaches req.customerId
│  └─ errorHandler.ts      the single place errors become HTTP responses
├─ modules/              Feature slices: schemas · service · routes
│  ├─ auth/                register, login, me
│  ├─ kyc/                 BVN/NIN submission + the verification gate
│  ├─ account/             account creation, balance
│  ├─ transfer/            name enquiry, transfers, transaction status
│  └─ history/             per-customer transaction history
├─ utils/                AppError, JWT helpers, money (kobo integers)
└─ index.ts              Boot: DB first, then HTTP, with graceful shutdown
```

Each feature module follows the same three-file shape:

| File | Responsibility |
|---|---|
| `*.schemas.ts` | Zod validation — turns untrusted input into trusted, typed data |
| `*.service.ts` | Business rules. No HTTP concepts here at all |
| `*.routes.ts`  | HTTP wiring only — parse, delegate, respond |

---

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| Runtime | Node.js 24 | Native `fetch`, native ESM |
| Language | TypeScript 7 (strict) | `noUncheckedIndexedAccess` on; caught real bugs during the build |
| Framework | Express 5 | Auto-forwards async errors — no `asyncHandler` wrapper needed |
| Database | MongoDB Atlas + Mongoose 9 | Unique indexes enforce banking invariants atomically |
| Validation | Zod 4 | One schema yields both runtime validation and the static type |
| Auth | jsonwebtoken + bcryptjs | Stateless JWTs; bcrypt cost factor 12 |

---

## Getting started

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env      # then fill in the values (see below)

# 3. Run
npm run dev               # watch mode, restarts on save
```

Verify it is up:

```bash
curl http://localhost:4000/health
```

```json
{ "success": true, "bank": "OUR Bank", "bankCode": "210", "environment": "development" }
```

Other scripts:

```bash
npm run typecheck    # tsc --noEmit
npm run build        # compile to dist/
npm start            # run the compiled build
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | no | HTTP port. Default `4000` |
| `NODE_ENV` | no | `development` / `production` / `test` |
| `MONGODB_URI` | **yes** | MongoDB Atlas connection string |
| `JWT_SECRET` | **yes** | Min 16 chars. Signs customer tokens |
| `JWT_EXPIRES_IN` | no | Default `1d` |
| `NIBSS_BASE_URL` | no | Default `https://nibssbyphoenix.onrender.com` |
| `NIBSS_API_KEY` | **yes** | From `POST /api/fintech/onboard` |
| `NIBSS_API_SECRET` | **yes** | From the same call |
| `NIBSS_BANK_CODE` | no | Default `210`. Classifies INTRA vs INTER |
| `BANK_NAME` | no | Default `OUR Bank` |
| `DNS_SERVERS` | no | e.g. `8.8.8.8,1.1.1.1`. Needed when an ISP resolver cannot answer the `mongodb+srv` SRV lookup |

Config is validated by Zod at boot. **Bad configuration crashes the process on
startup rather than failing mysteriously on one code path later.**

---

## API reference

Base URL: `http://localhost:4000`

All authenticated routes require `Authorization: Bearer <token>`.

### Auth

| Method | Path | Auth | Description |
|---|---|:--:|---|
| `POST` | `/api/auth/register` | – | Create a customer |
| `POST` | `/api/auth/login` | – | Obtain a JWT |
| `GET`  | `/api/auth/me` | yes | Current customer profile |

### KYC — Requirement 1

| Method | Path | Auth | Description |
|---|---|:--:|---|
| `POST` | `/api/kyc/bvn` | yes | Submit and verify a BVN |
| `POST` | `/api/kyc/nin` | yes | Submit and verify a NIN |
| `GET`  | `/api/kyc/status` | yes | Current verification status |

### Accounts — Requirement 2

| Method | Path | Auth | Description |
|---|---|:--:|---|
| `POST` | `/api/account` | yes | Open the customer's single account |
| `GET`  | `/api/account` | yes | Own account details + **live balance** |

### Banking operations — Requirement 3

| Method | Path | Auth | Description |
|---|---|:--:|---|
| `GET`  | `/api/transfer/name-enquiry/:accountNumber` | yes | Resolve a recipient's name before paying |
| `POST` | `/api/transfer` | yes | Transfer funds (intra or inter bank) |
| `GET`  | `/api/transfer/status/:reference` | yes | Transaction status (own transactions only) |

### Transaction history — Requirement 4

| Method | Path | Auth | Description |
|---|---|:--:|---|
| `GET` | `/api/transactions` | yes | Own history. Supports `page`, `limit`, `direction`, `status`, `scope` |
| `GET` | `/api/transactions/summary` | yes | Totals sent and received |

### Error format

Every error in the system returns the same shape:

```json
{ "success": false, "code": "FORBIDDEN", "message": "..." }
```

| Status | Code | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | A business rule was broken |
| 401 | `UNAUTHORIZED` | Missing, invalid or expired token |
| 403 | `FORBIDDEN` | Authenticated, but not permitted |
| 404 | `NOT_FOUND` | Not found — **or not yours** (see Security) |
| 409 | `CONFLICT` | Duplicate: second account, second KYC |
| 422 | `VALIDATION_ERROR` | Includes a per-field `details` array |
| 502 | `UPSTREAM_ERROR` | NibssByPhoenix failed. Not the caller's fault |

## Postman collection

A ready-to-run Postman collection covering every endpoint lives in
[`postman/OUR-Bank.postman_collection.json`](postman/OUR-Bank.postman_collection.json).

**To use it:** Postman → Import → drop the file in → run the requests top to
bottom. The JWT is captured automatically after Register or Login, so no token
is ever pasted by hand.

Each request carries a description explaining what it does and which rules to
try breaking, and every request asserts its own expected behaviour.

---

## End-to-end walkthrough

```bash
BASE=http://localhost:4000

# 1. Register, and keep the token
curl -X POST $BASE/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"grace@ourbank.ng","password":"GracePass123","firstName":"Grace","lastName":"Adeyemi","phone":"08055512345"}'

TOKEN=<paste the token from the response>

# 2. Verify KYC  (synthetic test BVN — no real BVN is used in this project)
curl -X POST $BASE/api/kyc/bvn -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"bvn":"22244455501","dob":"1994-02-11"}'

# 3. Open the account — arrives pre-funded with N15,000
curl -X POST $BASE/api/account -H "Authorization: Bearer $TOKEN"

# 4. Confirm who you are about to pay
curl $BASE/api/transfer/name-enquiry/2104573880 -H "Authorization: Bearer $TOKEN"

# 5. Send money
curl -X POST $BASE/api/transfer -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"to":"2104573880","amount":2500,"narration":"Lunch money"}'

# 6. Balance, history, summary
curl $BASE/api/account              -H "Authorization: Bearer $TOKEN"
curl $BASE/api/transactions         -H "Authorization: Bearer $TOKEN"
curl $BASE/api/transactions/summary -H "Authorization: Bearer $TOKEN"
```

---

## How each requirement is met

### 1. Customer onboarding

- `POST /api/kyc/bvn` and `/nin` insert the record upstream, then **validate** it.
- Verification is recorded only after NIBSS confirms the identity.
- **Identity binding:** the name NIBSS returns must match the name the customer
  registered with. A customer submitting *someone else's* BVN is rejected with
  `403`, which prevents opening an account in a stranger's name.
- One KYC record per customer, enforced by a unique index on `customerId`.

### 2. Account creation

- `assertVerifiedKyc()` is the gate: no verified KYC, no account (`403`).
- **Maximum one account**, enforced by a `unique` index on `Account.customerId`
  rather than by an `if` statement. An application-level check can be raced by
  two simultaneous requests; a unique index cannot.
- Accounts arrive **pre-funded with ₦15,000** by NIBSS on creation.

### 3. Core banking operations

- **Name enquiry** before transfers, returning the recipient's real name.
- **Transfers**, classified `INTRA` or `INTER` by comparing the recipient's
  `bankCode` with our own (`210`).
- **Balance** always read live from NIBSS, never cached locally — two copies of
  a balance are two numbers that can disagree.
- **Transaction status** by reference, guarded by ownership.

### 4. Transaction history and data privacy

- Every query is filtered by `customerId` taken from the **verified JWT**.
- Optional filters can only narrow a result set, never widen it.
- **Double-entry ledger:** one transfer writes a `DEBIT` row for the sender and
  a matching `CREDIT` row for the recipient, sharing one reference — so each
  customer sees the event from their own side.
- No endpoint anywhere accepts a customer or account identifier as input.
  Other people's data is not merely forbidden, it is **unrepresentable**.

### 5. NibssByPhoenix integration

All 12 upstream endpoints are wrapped in `src/nibss/client.ts`, with automatic
token caching, expiry-aware refresh, and a single retry on `401`.

---

## Security decisions

| Decision | Reasoning |
|---|---|
| **bcrypt cost 12** | Deliberately slow (~250ms). A fast hash lets a database thief try billions of guesses per second |
| **Identical login errors** | "Invalid email or password" in both cases. Distinct messages let an attacker enumerate which emails bank here |
| **404, not 403, for others' data** | `403` confirms a record exists. References are timestamp-based and guessable, so confirming existence is itself a leak |
| **No `from` field on transfers** | The sender is derived from the token. There is no input with which to name someone else's account |
| **No `:accountNumber` on balance** | Prevents IDOR. Account numbers are near-sequential and trivially enumerable |
| **`router.use(requireAuth)`** | Applied per-router, so a route added later cannot accidentally be left public |
| **Unique indexes over `if` checks** | Invariants are pushed down to the only layer that cannot be raced |
| **`toJSON` strips `passwordHash`** | A safety net that holds even if a route forgets to select fields |
| **Stack traces hidden in production** | A stack trace is a map of your codebase |
| **Money stored in kobo** | Integers cannot drift. `0.1 + 0.2 !== 0.3` in floating point |

---

## Notes on the NibssByPhoenix API

Findings from testing against the live API, all absorbed inside
`src/nibss/client.ts` so they never leak into the rest of the codebase:

1. **`kycType` must be lowercase.** The Swagger docs show `"BVN"`, but uppercase
   returns `HTTP 500 Account creation failed`. Only `"bvn"` / `"nin"` work.
2. **Response wrappers are inconsistent.** BVN endpoints wrap the payload in
   `data`, NIN endpoints in `response`, and account creation in `account`.
3. **`dob` round-trips differently.** Sent as `1995-06-15`, returned as
   `1995-06-15T00:00:00.000Z`.
4. **Tokens live one hour** (`exp - iat = 3600`), so they must be refreshed.
5. **`/api/fintech/onboard` returns `HTTP 400` for an already-onboarded fintech
   but still includes the credentials** in the response body.
6. **`GET /api/accounts` returns every account belonging to the fintech.** It is
   deliberately never exposed through any customer-facing route.

---

## Known limitations

- **Inter-bank transfers are implemented but not demonstrated with live data.**
  Every account NIBSS creates for us carries our own `bankCode` (`210`), so all
  reachable accounts are intra-bank. The `INTER` path is selected by comparing
  `bankCode` values and would need a second fintech's account number to exercise
  for real.
- **No automated test suite.** Verification was done through scripted `curl`
  flows against the live API, including deliberate attack cases: identity theft
  via someone else's BVN, cross-customer transaction reads, overdrafts, forged
  JWTs, and duplicate account creation.
- **The balance check before a transfer is advisory.** NIBSS remains the
  authority on funds and will reject an overdraw regardless; our check exists to
  return a clearer error message.
- **No rate limiting.** This would be the first addition before any real
  deployment.

---

## Testing note

No real BVN or NIN is used anywhere in this project, as required by the brief.
All identity numbers are clearly synthetic test values.
