# DarkScan

DarkScan audits a website for potential dark patterns. It crawls a same-origin slice of the site, follows safe shopping and account flows, runs deterministic rules, and asks a model only when a page is still ambiguous. Findings keep the page, the element, and a screenshot. The dashboard and JSON report describe potential patterns. They are not a determination that a page is unlawful or non-compliant.

## Architecture

```text
URL
  → crawler (Playwright, same origin, page and depth limits)
  → journey walker (checkout, signup, subscription, cancellation)
  → rule engine
  → AI review (ambiguous pages only)
  → evidence + report
  → React dashboard
```

A scan stores pages, journeys, findings, and evidence in PostgreSQL. Screenshots stay on the server under `apps/server/storage/screenshots/`.

## Tech stack

- React 19, TypeScript, and Vite (`apps/web`)
- Express, TypeScript, Prisma, and Playwright (`apps/server`)
- PostgreSQL
- Shared rule catalog (`packages/rules`)
- Optional OpenAI review through the official Node SDK. The key stays in the server environment.

## Local setup

Requirements: Node.js 20+, PostgreSQL, and Chromium for Playwright.

```bash
npm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
docker compose up -d
npm run db:migrate
npx playwright install chromium
npm run build
```

If PostgreSQL is already running, create the database yourself and set `DATABASE_URL` in `apps/server/.env`, then run `npm run db:migrate`.

## Environment variables

Server (`apps/server/.env`):

| Variable | Purpose |
| --- | --- |
| `PORT` | API port. Default `3001`. |
| `DATABASE_URL` | PostgreSQL connection string. |
| `CORS_ORIGIN` | Browser origin allowed to call the API. Default `http://localhost:5173`. |
| `CRAWL_TIMEOUT_MS` | Navigation timeout per page. Default `30000`. |
| `CRAWL_ALLOW_PRIVATE` | `true` allows localhost and private-network targets. Leave `false` unless you are scanning the local demo site. |
| `OPENAI_API_KEY` | Optional. When missing, rule detection still runs and AI is marked unavailable. |
| `OPENAI_MODEL` | Optional. Default `gpt-4o-mini`. |

Web (`apps/web/.env`):

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API origin. Default `http://localhost:3001`. |

Do not put `OPENAI_API_KEY` in the web app or in git.

## Run

```bash
npm run dev:server
npm run dev:web
```

The dashboard is at http://localhost:5173 and the API at http://localhost:3001.

## Demo site

The demo shop is a small local site with intentional examples. It is marked as a test site and is not a real store.

```bash
npm run demo
```

The site listens on http://127.0.0.1:4174.

Private and loopback targets are blocked unless the API is started with the local switch:

```bash
CRAWL_ALLOW_PRIVATE=true npm run dev:server
```

Then start the dashboard (`npm run dev:web`) and scan `http://127.0.0.1:4174`.

Example flow:

1. Enter the demo URL and choose Start Scan.
2. The progress view stays on Scanning until the crawl finishes, then lists the pages it opened.
3. The results view shows finding counts, severity, pages, journeys, and whether AI review completed, was skipped, or was unavailable.
4. Open a finding to see the screenshot, highlighted element when a box was captured, rule or AI source, confidence, reasoning for AI findings, and a remediation suggestion.
5. The journey view shows the checkout flow and any findings on each step.

The demo pages are built to trigger false urgency, confirm shaming, basket sneaking, preselection, and forced action. The pricing page includes a “call to cancel” line for the AI layer. If the model is unavailable, that page stays in the crawl and the rule findings are still reported.

## API

- `GET /health`
- `POST /api/scans` with `{ "url": "https://example.com" }`
- `GET /api/scans/:id`
- `GET /api/scans/:id/report`

`POST /api/scans` returns when the crawl and detection finish. A second request for the same URL, while that scan is still running, reuses the in-progress scan instead of starting another browser. A page that times out, resets, or redirects off-site is recorded as an error. Pages that did load are kept.

Submitted URLs must be absolute `http` or `https` URLs without credentials. Localhost, private, and link-local addresses are rejected unless `CRAWL_ALLOW_PRIVATE=true`. The crawler stays on the starting origin and does not submit payment, passwords, or orders.

## Current limitations

- At most 10 pages and depth 3.
- Five detectors are active: false urgency, confirm shaming, basket sneaking, forced action, and preselection. The other catalog entries are defined for the report and are not separate detectors.
- AI runs only for a few ambiguous pages. It does not replace a high-confidence rule finding. A missing or failing API key does not fail the scan.
- `POST /api/scans` holds the connection until the scan completes, so the dashboard cannot list pages until that response returns.
- Screenshots are full-page captures. The highlight uses the stored element box and can be offset if the page layout shifts.
- There is no authentication, queue, or PDF export.
- Results are potential dark-pattern findings, not legal conclusions.
