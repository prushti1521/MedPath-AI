import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
  // Do not exit — let the pool recover and re-establish connections
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  if (process.env.LOG_QUERIES === "true") {
    console.log("query", { text, duration: Date.now() - start, rows: res.rowCount });
  }
  return res;
}
