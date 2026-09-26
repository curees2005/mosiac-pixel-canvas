import { connectToDatabase } from "./utils/db.js";

const GRID_COLS = 48;
const GRID_ROWS = 32;

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: HEADERS, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const db = await connectToDatabase();
    const canvases = db.collection("canvases");
    let doc = await canvases.findOne({ _id: "main" });

    if (!doc) {
      doc = {
        _id: "main",
        pixels: new Array(GRID_COLS * GRID_ROWS).fill(0),
        updatedAt: new Date(),
      };
      await canvases.insertOne(doc);
    }

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ pixels: doc.pixels, updatedAt: doc.updatedAt }),
    };
  } catch (err) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
  }
}
