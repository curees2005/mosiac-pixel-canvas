import { MongoClient } from "mongodb";

let cachedDb = null;

export async function connectToDatabase() {
  if (cachedDb) return cachedDb;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it in Netlify → Site settings → Environment variables.");
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "mosaic");

  // TTL index: a cooldown document self-deletes once its expiresAt passes,
  // so we never have to sweep or clean up cooldowns ourselves.
  await db.collection("cooldowns").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  cachedDb = db;
  return cachedDb;
}
