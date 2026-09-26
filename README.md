# Mosaic — a shared pixel canvas (serverless MERN)

A single canvas that everyone who visits the site is drawing on together — like r/place, but small enough to run entirely on Netlify's free tier with no server to manage and no websockets.

## Why this shape is unique

Most "real-time" demos reach for websockets, which don't fit serverless functions well (a Lambda-style function ends when it responds — it can't hold an open socket). Mosaic sidesteps that:

- **Polling instead of push.** The frontend re-fetches the whole canvas every 3 seconds. For a small grid that's cheap and simple, and it's the honest way to do "live" data on serverless.
- **One atomic write per pixel.** Placing a pixel updates a single array index — `pixels.<index>` — directly in MongoDB with `$set`, so two people placing different pixels at the same instant never clobber each other.
- **Self-cleaning rate limiting.** Each visitor gets a cooldown enforced by the *server*, not client-side trust: a `cooldowns` collection holds one document per visitor with an `expiresAt` field, and a MongoDB **TTL index** deletes it automatically once it passes. There's no cron job, no cleanup script — the database does it for you.

## What's inside

```
src/
  constants.js          Grid size, palette, cooldown length (single source of truth)
  clientId.js           Anonymous per-browser id (localStorage) used only for rate limiting
  components/
    Canvas.jsx           <canvas> rendering, polling, click-to-place, cooldown UI
netlify/functions/
  canvas-state.js        GET — returns the current grid
  place-pixel.js         POST — validates, checks cooldown, writes the pixel
  utils/db.js            Cached Mongo connection + ensures the TTL index exists
```

## 1. Local setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:
```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-url>/?retryWrites=true&w=majority
MONGODB_DB=mosaic
```


Run the frontend and functions together:
```bash
npm install -g netlify-cli   # one-time
netlify dev
```
Open the printed URL (usually `http://localhost:8888`) — open it in two tabs to watch pixels sync between them.

## 2. Deploy to Netlify

1. Push this project to a Git repo, then in Netlify: **Add new site → Import an existing project**.
2. Build settings come from `netlify.toml` already (`npm run build`, publish `dist`, functions in `netlify/functions`).
3. Add environment variables in **Site configuration → Environment variables**: `MONGODB_URI` (required) and `MONGODB_DB` (optional).
4. Deploy. Share the URL — everyone who opens it is painting the same canvas.

## Extending it

- **Bigger canvas:** raise `GRID_COLS`/`GRID_ROWS` in `src/constants.js` and mirror the change in the two function files. Beyond a few thousand cells, switch from polling the whole grid to polling only a `version` counter and fetching a diff.
- **Live user count:** add a short-TTL "presence" document per client (same TTL-index trick as cooldowns) and count active documents.
- **History/replay:** log each placement to a `placements` collection instead of only updating the grid in place, and you get a full timelapse for free.
