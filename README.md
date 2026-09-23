# DarkScan

Foundation for an automated website dark-pattern auditor. A scan crawls up to 10 same-origin pages (depth 3), stores what it finds, and saves a screenshot of each page. Rule definitions for India's 13 dark-pattern categories are included. Detection is not implemented yet.

## Layout

- `apps/web` — React + TypeScript
- `apps/server` — Express + TypeScript, Prisma, Playwright
- `packages/rules` — dark-pattern category definitions

## Prerequisites

- Node.js 20+
- PostgreSQL 16
- Chromium for Playwright

## Setup

```bash
npm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
docker compose up -d
npm run db:migrate
npx playwright install chromium
npm run build
```

Docker Compose creates the `darkscan` database. If PostgreSQL is already running on port 5432, create that database yourself, then run `npm run db:migrate`.

## Run

```bash
npm run dev:server
npm run dev:web
```

The web app is at http://localhost:5173 and the API at http://localhost:3001.

## API

- `GET /health` — `{ "status": "ok" }`
- `POST /api/scans` — body `{ "url": "https://example.com" }`
- `GET /api/scans/:id` — scan status, crawled pages, screenshot paths, and errors

`POST /api/scans` validates the URL, creates a scan, and crawls the site. Each saved page includes its URL, title, visible text, forms and controls, and a screenshot under `apps/server/storage/screenshots/`. The crawler stays on the starting origin, skips duplicate URLs, and does not submit payments, personal information, orders, or other destructive actions.

Set `DATABASE_URL` in `apps/server/.env`. The checked-in example uses a local Postgres URL.

## Not in this phase

Authentication, Redis, BullMQ, LLM or vision detection, and a reporting dashboard.
