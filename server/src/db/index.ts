import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env";
import * as schema from "./schema";

/**
 * A single pooled Postgres connection for the process. Using the standard `pg`
 * driver over TCP is the recommended path for a long-running server (including
 * against Neon's pooled `-pooler` connection string in production).
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

// Keep the process alive if an idle connection is dropped (e.g. Neon scale-to-zero
// severs idle connections; the pool reconnects on the next query).
pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error:", err);
});

export const db = drizzle(pool, { schema });
