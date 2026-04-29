# Queryable Intelligence Engine API

Production-ready profile API for Insighta Labs with:

- profile creation from external APIs
- strict database structure
- advanced filtering with combined conditions
- sorting and pagination
- rule-based natural language search
- idempotent seed process for 2026 records

## Base URL

- Local: `http://localhost:3000`
- Live (Railway): `https://hngstage-0-production.up.railway.app`

## Repositories & live deployment (submission)

| Artifact | Repository | Live URL |
|----------|------------|----------|
| **Backend** (this repo) | https://github.com/Nuel-09/HNG_STAGE-1 | https://hngstage-0-production.up.railway.app |
| **CLI** | https://github.com/Nuel-09/Insighta-Cli | runs locally (`insighta` command) |
| **Web portal** | https://github.com/Nuel-09/Insighta-WebPortal | https://insighta-webportal-production.up.railway.app |

**Submission bundle:** paste the three repository URLs plus the **live backend URL** and **live web portal URL** from the table above into your Stage 3 submission form.

## Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- UUID v7 (`id`)

## Project layout (separation of concerns)

- `server.js` — process entry: connect to MongoDB, run index migration, start HTTP
- `src/app.js` — Express app: CORS (credentials), cookies, JSON body, request logging, rate limits; mounts `/auth` and protected `/api`
- `src/routes/auth.js` — GitHub OAuth (PKCE): start, callback, CLI token exchange, refresh, logout
- `src/routes/profiles.js` — URL mapping (export + list + search before `/:id`)
- `src/middleware/*` — API version header, JWT/cookie auth, RBAC, rate limits, request logging
- `src/controllers/profilesController.js` — request/response and status codes
- `src/services/*` — business logic: query parsing, natural language, external APIs, DB list helpers
- `src/models/profile.js` — Mongoose schema, indexes, legacy index cleanup
- `src/config/*` — environment and upstream API base URLs
- `src/utils/http.js` — shared response JSON shapes
- `seed.js` — one-off data load; reuses the same Profile model and config

## Database Schema

Each profile follows this structure:

- `id` (UUID v7, primary key)
- `name` (string, unique)
- `gender` (`male` | `female`)
- `gender_probability` (float)
- `age` (int)
- `age_group` (`child` | `teenager` | `adult` | `senior`)
- `country_id` (2-letter ISO code)
- `country_name` (full country name)
- `country_probability` (float)
- `created_at` (timestamp)

All timestamps are returned in UTC ISO 8601.

## Environment Variables

Required:

- `MONGODB_URI`

Optional:

- `PORT` (default: `3000`)
- `UPSTREAM_TIMEOUT_MS` (default: `4000`)
- `SEED_FILE` (default: `./seed_profiles.json`)

Stage 3 (auth, RBAC, export):

- `JWT_SECRET` — required for access/refresh token signing
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — GitHub OAuth app
- `GITHUB_WEB_REDIRECT_URI` — must match GitHub OAuth app callback exactly (local: `http://localhost:3000/auth/github/callback`; production: `https://hngstage-0-production.up.railway.app/auth/github/callback`)
- `WEB_ORIGIN` — allowed browser origin(s) for CORS with credentials (comma-separated), or `*` for permissive dev
- `OAUTH_SUCCESS_REDIRECT` — **full URL** where the browser lands after OAuth (e.g. `https://your-portal.up.railway.app/`). Do not omit `https://` in Railway (host-only values are normalized in code, but GitHub OAuth callback URL below must be exact).
- `ADMIN_GITHUB_IDS` — comma-separated GitHub numeric user IDs granted `admin` on first login
- `NODE_ENV` — set to `production` for secure cookies

## Setup and Run (local)

From the repository root:

```bash
npm install
cp .env.example .env
# Windows CMD: copy .env.example .env
# Edit .env: set MONGODB_URI, JWT_SECRET, GitHub OAuth vars, WEB_ORIGIN, etc.
npm run seed
npm start
```

Server listens on `PORT` (default `3000`). Health check: open `http://localhost:3000` or call any documented route with correct headers.

### Test (CI / local)

```bash
npm test
```

Runs `node --check` on `server.js`, `seed.js`, and tracked `src/**/*.js` modules (syntax validation). GitHub Actions runs the same on pull requests and pushes to `main` (`.github/workflows/ci.yml`).

## Seeding (2026 profiles)

Seed source file: `seed_profiles.json`

Script:

```bash
npm run seed
```

Behavior:

- validates expected profile count (`2026`)
- validates required fields per record
- upserts by unique `name` so reruns do not create duplicates
- creates UUID v7 only for new records

## Stage 3: API access (versioning and auth)

All routes under `/api/*` require:

- Header `X-API-Version: 1` (otherwise `400` with `API version header required`)
- Authentication: `Authorization: Bearer <access_token>` (or `access_token` cookie from the web OAuth callback)

Access tokens expire in **3 minutes**; refresh tokens in **5 minutes** with **rotation** (a used refresh token is invalidated). Inactive users receive **403** on API calls.

**RBAC:** `admin` may create and delete profiles and export CSV. `analyst` may list, search, and read by id only.

**Rate limits:** `/auth/*` — 10 requests/minute per IP; `/api/*` — 60/minute per authenticated user. Exceeded → **429**.

**CSRF (web portal):** For browser sessions using HTTP-only cookies (no `Authorization` header), unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`) require header `X-CSRF-Token` matching the readable `csrf_token` cookie issued by `GET /auth/csrf-token`. The CLI uses Bearer tokens only → CSRF is skipped.

### GitHub OAuth app (production)

In GitHub → Developer settings → OAuth app, **Authorization callback URL** must be exactly:

`https://<your-api-host>/auth/github/callback`

Example: `https://hngstage-0-production.up.railway.app/auth/github/callback`

Do **not** use your web portal hostname or extra path segments here (wrong callback URLs produce `Cannot GET /auth/github/...` after login).

## Auth endpoints

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/auth/github` | Start OAuth. **Web:** stores PKCE verifier server-side, redirects to GitHub. **CLI:** pass `state`, `code_challenge`, `redirect_uri` (your local callback) so GitHub redirects back to the CLI listener. |
| GET | `/auth/github/callback` | Web callback: exchanges code, sets HTTP-only cookies, redirects to `OAUTH_SUCCESS_REDIRECT`. |
| GET | `/auth/csrf-token` | Returns `{ "status":"success","csrf_token":"..." }` and sets the `csrf_token` cookie for double-submit CSRF protection. |
| POST | `/auth/github/token` | CLI completion: JSON body `{ "code", "code_verifier", "redirect_uri" }` → JSON tokens + user. |
| POST | `/auth/refresh` | Body or cookie `refresh_token` → new access + refresh pair; updates cookies if present. |
| POST | `/auth/logout` | Revokes refresh (if provided) and clears cookies. |

## Endpoints

### GET `/api/me`

Returns the authenticated user (`id`, `username`, `email`, `avatar_url`, `role`, `is_active`). Same auth + `X-API-Version` rules as other `/api/*` routes.

### POST `/api/profiles`

**Admin only.** Same validation and upstream behavior as Stage 2.

Creates a profile by calling:

- Genderize
- Agify
- Nationalize

Request body:

```json
{ "name": "ella" }
```

Responses:

- `201` profile created
- `200` profile already exists
- `400` missing/empty `name`
- `422` invalid type
- `502` upstream response invalid

### GET `/api/profiles/:id`

Fetches a single profile by UUID.

Responses:

- `200` found
- `404` not found

### DELETE `/api/profiles/:id`

**Admin only.** Deletes profile by UUID.

Responses:

- `204` deleted
- `404` not found

### GET `/api/profiles`

Advanced query endpoint with combined filters, sorting, and pagination.

Supported filters (combinable with AND):

- `gender`
- `age_group`
- `country_id`
- `min_age`
- `max_age`
- `min_gender_probability`
- `min_country_probability`

Sorting:

- `sort_by`: `age` | `created_at` | `gender_probability`
- `order`: `asc` | `desc`

Pagination:

- `page` default: `1`
- `limit` default: `10`, max: `50` (if a client sends a higher `limit`, it is **capped to 50**; the JSON `limit` field reflects the value used)

Example:

`GET /api/profiles?gender=male&country_id=NG&min_age=25&sort_by=age&order=desc&page=1&limit=10`

Response format (Stage 3 adds `total_pages` and HATEOAS-style `links`):

```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 2026,
  "total_pages": 203,
  "links": {
    "self": "/api/profiles?page=1&limit=10",
    "next": "/api/profiles?page=2&limit=10",
    "prev": null
  },
  "data": []
}
```

### GET `/api/profiles/export`

**Admin only.** Download CSV with the same filter and sort query parameters as `GET /api/profiles`, plus required `format=csv`.

Example:

`GET /api/profiles/export?format=csv&gender=male&sort_by=created_at&order=desc`

Response: `text/csv` with `Content-Disposition: attachment` and columns: `id`, `name`, `gender`, `gender_probability`, `age`, `age_group`, `country_id`, `country_name`, `country_probability`, `created_at`.

### GET `/api/profiles/search`

Rule-based natural language query endpoint.

Query params:

- `q` (required)
- `page` (optional, default `1`)
- `limit` (optional, default `10`, max `50`)

Example:

`GET /api/profiles/search?q=young males from nigeria&page=1&limit=10`

Supported mapping examples:

- `"young males"` -> `gender=male`, `min_age=16`, `max_age=24`
- `"females above 30"` -> `gender=female`, `min_age=30`
- `"people from angola"` -> country filter by country name/code match
- `"adult males from kenya"` -> `age_group=adult`, `gender=male`, country filter
- `"male and female teenagers above 17"` -> `age_group=teenager`, `min_age=17`

Rules:

- parser is deterministic and rule-based (no AI/LLMs)
- `"young"` maps to age `16-24` for parsing only
- if query cannot be interpreted:

```json
{
  "status": "error",
  "message": "Unable to interpret query"
}
```

## Validation Rules

Invalid query parameters return:

```json
{
  "status": "error",
  "message": "Invalid query parameters"
}
```

Status code behavior:

- `400` missing/empty required parameter
- `422` invalid type/value/query parameter
- `404` profile not found
- `500` internal server error
- `502` upstream provider failure

## Global Error Format

All errors use:

```json
{
  "status": "error",
  "message": "<error message>"
}
```

## CORS

Set `WEB_ORIGIN` to the **exact** browser origin(s) of your web portal (scheme + host + port, no path; trailing slashes are ignored). Comma-separate for dev + production, e.g. `https://insighta-webportal-production.up.railway.app,http://localhost:5173`. With `credentials: true`, the allowed origin must match the `Origin` header or the browser will block `/api/*` (preflight can still return 204). If `WEB_ORIGIN` is `*`, the server reflects the request origin (dev only).

## Test Commands

```bash
npm test
```

This runs `node --check` across the entrypoint, seed script, and `src/**/*.js` modules used by the app.

## System architecture (TRD)

```text
Clients (CLI Bearer / Web cookies)
        │
        ▼
┌───────────────────────────────────────┐
│ Express: CORS + cookies + JSON        │
│ requestLogger (method, endpoint,      │
│   status, response_time_ms)            │
├───────────────────────────────────────┤
│ /auth  → rate limit 10/min, GitHub    │
│   OAuth (PKCE), CSRF on POST          │
│ /api   → auth → rate 60/min/user      │
│   → CSRF → X-API-Version:1            │
│   → RBAC (admin | analyst)            │
├───────────────────────────────────────┤
│ Controllers / services                 │
│ MongoDB: users, refresh tokens,        │
│   profiles, OAuth state (web PKCE)     │
└───────────────────────────────────────┘
```

- **Authentication flow:** Web uses server-stored `code_verifier` + callback cookies. CLI uses query `code_challenge` + local `http://127.0.0.1:<port>/callback` and `POST /auth/github/token`.
- **Token handling:** Short-lived JWT access; opaque refresh stored hashed; rotation on refresh; `is_active: false` → 403.
- **Role enforcement:** Central `requireRoles("admin")` on mutating profile routes and export; `authenticate` + `User` on every `/api` request.
- **Natural language search:** Unchanged from Stage 2 — deterministic rule-based parser in `src/services/nlSearchService.js` (no LLM); maps phrases to filter objects and optional country name resolution.

## GitHub Actions

On push/PR to `main`, CI runs `npm test` (see `.github/workflows/ci.yml`). Merge only when CI is green.

---

## Stage 3 submission checklist (copy into PR or submission form)

Use this list before you submit; tick each item.

- [ ] **Repositories:** Backend https://github.com/Nuel-09/HNG_STAGE-1 · CLI https://github.com/Nuel-09/Insighta-Cli · Web https://github.com/Nuel-09/Insighta-WebPortal  
- [ ] **Live backend URL:** https://hngstage-0-production.up.railway.app  
- [ ] **Live web portal URL:** https://insighta-webportal-production.up.railway.app  
- [ ] **GitHub OAuth app:** Authorization callback = `https://hngstage-0-production.up.railway.app/auth/github/callback` (and localhost callback for dev if needed)  
- [ ] **Railway backend env:** `WEB_ORIGIN` includes portal origin; `OAUTH_SUCCESS_REDIRECT` is full portal URL; `GITHUB_WEB_REDIRECT_URI` matches GitHub app  
- [ ] **Smoke test:** Login via web → dashboard; `GET /api/me` with cookies + `X-API-Version: 1`; CLI `insighta login` against live API URL  
- [ ] **CI:** Latest `main` green on all three repos  
- [ ] **READMEs:** Architecture, auth, CLI usage, tokens, RBAC, NL parsing documented (this file + sibling repos)
