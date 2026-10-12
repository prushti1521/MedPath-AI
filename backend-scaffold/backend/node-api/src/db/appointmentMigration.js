import { query } from "./pool.js";

let migrationPromise;

export function ensureAppointmentLocationColumn() {
  if (!migrationPromise) {
    migrationPromise = query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS location TEXT").catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }
  return migrationPromise;
}