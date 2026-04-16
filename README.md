# Stage 1 Backend - Profiles API

This API accepts a name, calls Genderize/Agify/Nationalize, applies classification logic, stores the result in MongoDB, and exposes profile management endpoints.

## Base API URL

- Local: `http://localhost:3000`
<<<<<<< HEAD
- Live: `https://hngstage-0-production.up.railway.app`
=======
- Live: `https://<your-live-domain>`
>>>>>>> eb55a6e ( implemented paralled external api processing and idempotency)

## Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- UUID v7 IDs

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required:

- `MONGODB_URI`

Optional:

- `PORT` (default: `3000`)
- `UPSTREAM_TIMEOUT_MS` (default: `4000`)

## Endpoints

### 1) Create Profile

`POST /api/profiles`

Request body:

```json
{ "name": "ella" }
```

Returns:

- `201` with created profile
- `200` with message `"Profile already exists"` if duplicate name already exists

### 2) Get Single Profile

`GET /api/profiles/{id}`

Returns:

- `200` when found
- `404` when not found

### 3) Get All Profiles

`GET /api/profiles`

Optional filters (case-insensitive):

- `gender`
- `country_id`
- `age_group`

Example:

`GET /api/profiles?gender=male&country_id=NG`

### 4) Delete Profile

`DELETE /api/profiles/{id}`

Returns:

- `204` on successful delete
- `404` if not found

## Classification Rules

- Age group:
  - `0-12` -> `child`
  - `13-19` -> `teenager`
  - `20-59` -> `adult`
  - `60+` -> `senior`
- Nationality:
  - Picks the country with the highest probability from Nationalize

## Error Format

All errors follow:

```json
{
  "status": "error",
  "message": "<error message>"
}
```

Common status codes:

- `400` Missing or empty name
- `422` Invalid type
- `404` Profile not found
- `502` Upstream/external invalid response
- `500` Internal server error

## Edge Cases Implemented

- Genderize: `gender: null` or `count: 0` -> `502`
- Agify: `age: null` -> `502`
- Nationalize: no country data -> `502`

Error message format:

`"${externalApi} returned an invalid response"`

## CORS

CORS is enabled globally with:

- `Access-Control-Allow-Origin: *`

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Configure `.env`:

```bash
cp .env.example .env
```

3. Start server:

```bash
npm start
```
