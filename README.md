# Stage 0 Backend - API Integration and Data Processing

This project exposes a `GET /api/classify` endpoint that accepts a `name` query parameter, calls the Genderize API, processes the response, and returns a normalized output format.

## Base API URL

- Local: `http://localhost:3000`
- Live: `hngstage-0-production.up.railway.app`

## Endpoint

`GET /api/classify?name=<name>`

## Success Response

```json
{
  "status": "success",
  "data": {
    "name": "john",
    "gender": "male",
    "probability": 0.99,
    "sample_size": 1234,
    "is_confident": true,
    "processed_at": "2026-04-01T12:00:00.000Z"
  }
}
```

## Processing Rules Implemented

- Extracts `gender`, `probability`, and `count` from Genderize API
- Renames `count` to `sample_size`
- Computes `is_confident` as:
  - `true` only if `probability >= 0.7` and `sample_size >= 100`
  - otherwise `false`
- Generates `processed_at` dynamically per request using UTC ISO 8601

## Error Response Format

All errors follow:

```json
{
  "status": "error",
  "message": "<error message>"
}
```

## Status Codes

- `400` - Missing or empty `name`
- `422` - Non-string `name`
- `422` - No prediction available (`gender: null` or `count: 0`)
- `502` - Genderize upstream error/unavailable
- `500` - Internal server error

## CORS

The server is configured with:

- `Access-Control-Allow-Origin: *`

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Start server:

```bash
npm start
```

3. Test:

```bash
curl "http://localhost:3000/api/classify?name=john"
```
