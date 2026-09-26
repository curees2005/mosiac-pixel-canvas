Mosaic 

A shared, public pixel canvas built as a serverless MERN app for Netlify. Anyone who opens the site paints on the same grid, with a server-enforced cooldown between placements.

1. Overview
	
Frontend	React 18 (Vite)
Backend	Netlify Functions (Node, AWS Lambda under the hood)
Database	MongoDB (Atlas)
Hosting	Netlify (static site + functions, one deploy)
Real-time strategy	Client polling every 3s — no websockets

The app has exactly one shared document representing the canvas and one collection of short-lived "cooldown" documents used to rate-limit placements. There is no user authentication; visitors are identified by a random id stored in localStorage, used only for rate limiting.

2. Architecture
┌─────────────┐   GET /api/canvas-state    ┌───────────────────────┐
│             │ ─────────────────────────▶ │ canvas-state.js       │
│   React     │                            │ (Netlify Function)    │
│   frontend  │ ◀───────────────────────── │                       │
│  (Canvas.jsx)│      { pixels, updatedAt }│                       │
│             │                            └───────────┬───────────┘
│             │   POST /api/place-pixel                │
│             │ ─────────────────────────▶ ┌───────────▼───────────┐
│             │                            │ place-pixel.js        │──▶ MongoDB Atlas
│             │ ◀───────────────────────── │ (Netlify Function)    │    - canvases
└─────────────┘   { success } | 429        └────────────────────────┘    - cooldowns
The browser polls canvas-state every 3 seconds to pick up other users' pixels.
Clicking a cell optimistically paints it locally, then confirms with place-pixel. If the server rejects it (cooldown active, or a network error), the local paint is rolled back.
Rate limiting is enforced server-side via a MongoDB TTL index, not just client-side, so it can't be bypassed by editing local storage.
3. Project structure
src/
  constants.js          Grid size (48×32), 16-color palette, cooldown length — single source of truth for the frontend
  clientId.js           Generates/reads a random UUID from localStorage, used only for cooldown tracking
  App.jsx / App.css     Page shell and design tokens
  components/
    Canvas.jsx           Renders the grid to a <canvas>, handles polling, clicks, optimistic updates, cooldown countdown
netlify/functions/
  canvas-state.js         GET  — returns the full pixel grid, creating it on first request if it doesn't exist
  place-pixel.js          POST — validates input, checks/sets cooldown, writes one pixel atomically
  utils/db.js             Cached MongoDB connection; ensures the cooldowns TTL index exists
netlify.toml              Build settings + routes /api/canvas-state and /api/place-pixel to their functions
4. Data models
canvases collection — one document
js
{
  _id: "main",
  pixels: [0, 0, 15, 3, ...],   // length = GRID_COLS * GRID_ROWS (1536), each value is a palette index 0–15
  updatedAt: ISODate("...")
}

Pixel (x, y) lives at array index y * GRID_COLS + x. Palette indices map to hex colors defined in src/constants.js (index 0 = background/blank).

cooldowns collection — one document per active visitor
js
{
  _id: "<clientId>",           // the visitor's localStorage UUID
  expiresAt: ISODate("...")    // TTL index deletes this doc automatically once this time passes
}

No cleanup code is needed: MongoDB's TTL index ({ expiresAt: 1 }, { expireAfterSeconds: 0 }, created in utils/db.js) removes expired cooldown documents in the background. A visitor can place a new pixel exactly when their document disappears.

5. API reference
GET /api/canvas-state

Returns the current canvas. No auth, no params.

200 response

json
{ "pixels": [0, 0, 15, ...], "updatedAt": "2026-09-26T12:00:00.000Z" }
POST /api/place-pixel

Places one pixel, subject to the caller's cooldown.

Request body

json
{ "x": 12, "y": 5, "colorIndex": 15, "clientId": "e3f1..." }
Field	Type	Constraint
x	integer	0 ≤ x < 48
y	integer	0 ≤ y < 32
colorIndex	integer	0 ≤ colorIndex < 16
clientId	string	8–100 chars

200 — placed successfully:

json
{ "success": true, "expiresAt": "2026-09-26T12:00:06.000Z" }

429 — cooldown still active:

json
{ "error": "Cooldown active", "retryAfterMs": 4200 }

400 — invalid body (out-of-range coordinates/color, malformed JSON, missing clientId). 500 — database/connection error (commonly a missing or wrong MONGODB_URI).

6. Environment variables

Set these in Netlify under Site configuration → Environment variables (and locally in .env, copied from .env.example):

Variable	Required	Description
MONGODB_URI	Yes	Full MongoDB Atlas connection string, including credentials
MONGODB_DB	No (defaults to mosaic)	Database name to use within the cluster
7. Local development
bash
npm install
cp .env.example .env       # then fill in MONGODB_URI
npm install -g netlify-cli # one-time, gives you the `netlify` command
netlify dev

netlify dev runs the Vite dev server and the Netlify Functions together on http://localhost:8888, matching production routing (/api/* reaches the functions). Running npm run dev alone only starts the frontend — API calls will fail with no function server behind them.

8. Deployment (Netlify)
Push the project to a GitHub/GitLab/Bitbucket repo.
In Netlify: Add new site → Import an existing project, select the repo. Build command, publish directory, and functions directory are already configured via netlify.toml.
Add MONGODB_URI (and optionally MONGODB_DB) as environment variables.
Deploy. If you added env vars after the first deploy, trigger a new one (Deploys → Trigger deploy) so the functions pick them up.
Verify by opening https://<your-site>.netlify.app/api/canvas-state directly — it should return JSON, not an error.
9. Design decisions & trade-offs
Polling over websockets: Netlify Functions are request/response only — they can't hold an open socket — so polling is the correct fit for this platform, not a compromise.
Whole-grid GET vs. diffs: at 1,536 cells the full grid is a few KB, cheap enough to refetch every 3s. This won't scale to a much larger canvas — see below.
Server-side cooldown via TTL index: avoids writing and maintaining a cleanup job; MongoDB handles expiry natively.
Optimistic UI: a click paints immediately and rolls back only if the server rejects it, so the app feels responsive despite the 3-second poll interval.
10. Known limitations & extension ideas
Limitation	Possible fix
No user accounts — anyone can paint	Add auth (e.g. Netlify Identity) and store userId instead of an anonymous client id
Cooldown can be reset by clearing localStorage + new IP	Track cooldowns by IP as a secondary check, or require a lightweight auth step
Full-grid GET won't scale much past a few thousand cells	Track a version counter on the canvas doc; clients poll the version cheaply and only fetch full pixels when it changes, or fetch a diff of pixels changed since their last known version
No history/replay	Log each placement to a separate placements collection (in addition to updating the grid) to enable a timelapse view
Single canvas only	Key documents by a boardId to support multiple boards/rooms
