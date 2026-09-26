import { connectToDatabase } from "./utils/db.js";

const GRID_COLS = 48;
const GRID_ROWS = 32;
const PALETTE_SIZE = 16;
const COOLDOWN_SECONDS = 6;

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { x, y, colorIndex, clientId } = body;

  if (
    !Number.isInteger(x) || x < 0 || x >= GRID_COLS ||
    !Number.isInteger(y) || y < 0 || y >= GRID_ROWS ||
    !Number.isInteger(colorIndex) || colorIndex < 0 || colorIndex >= PALETTE_SIZE ||
    typeof clientId !== "string" || clientId.length < 8 || clientId.length > 100
  ) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Invalid pixel data" }) };
  }

  try {
    const db = await connectToDatabase();
    const cooldowns = db.collection("cooldowns");
    const canvases = db.collection("canvases");

    // One cooldown document per client, keyed by clientId. If it still
    // exists, the TTL index hasn't reaped it yet, so the client is too fast.
    const active = await cooldowns.findOne({ _id: clientId });
    if (active) {
      const retryAfterMs = Math.max(0, new Date(active.expiresAt).getTime() - Date.now());
      return {
        statusCode: 429,
        headers: HEADERS,
        body: JSON.stringify({ error: "Cooldown active", retryAfterMs }),
      };
    }

    const index = y * GRID_COLS + x;
    await canvases.updateOne(
      { _id: "main" },
      { $set: { [`pixels.${index}`]: colorIndex, updatedAt: new Date() } },
      { upsert: true }
    );

    const expiresAt = new Date(Date.now() + COOLDOWN_SECONDS * 1000);
    await cooldowns.updateOne(
      { _id: clientId },
      { $set: { expiresAt } },
      { upsert: true }
    );

    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true, expiresAt }) };
  } catch (err) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
  }
}
