import { Router } from "express";
import { query } from "../db/pool.js";
import { ensureAppointmentLocationColumn } from "../db/appointmentMigration.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
let nextGeocodeRequestAt = 0;

// Public search — no auth required to browse providers
router.get("/", async (req, res) => {
  const { specialty, q, lat, lng, radiusKm = 25 } = req.query;
  const clauses = [];
  const params = [];

  if (specialty && specialty !== "All") {
    params.push(specialty);
    clauses.push(`specialty = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    clauses.push(`(name ILIKE $${params.length} OR specialty ILIKE $${params.length})`);
  }

  let sql = "SELECT * FROM healthcare_providers";
  if (clauses.length) sql += " WHERE " + clauses.join(" AND ");

  if (lat && lng) {
    // Simple bounding-distance ordering using the haversine formula.
    // For production scale, prefer PostGIS (geography type + ST_DWithin).
    params.push(lat, lng);
    sql += `${clauses.length ? " AND" : " WHERE"} (
      6371 * acos(
        cos(radians($${params.length - 1})) * cos(radians(latitude)) *
        cos(radians(longitude) - radians($${params.length})) +
        sin(radians($${params.length - 1})) * sin(radians(latitude))
      )
    ) <= ${Number(radiusKm)}`;
  }

  sql += " ORDER BY rating DESC NULLS LAST LIMIT 50";
  const result = await query(sql, params);
  res.json({ providers: result.rows });
});

router.get("/geocode", async (req, res) => {
  const searchText = String(req.query.q || "").trim();
  if (searchText.length < 3 || searchText.length > 200) {
    return res.status(400).json({ error: "Enter a location between 3 and 200 characters." });
  }

  const now = Date.now();
  if (now < nextGeocodeRequestAt) {
    return res.status(429).json({ error: "Please wait a moment before searching another location." });
  }
  nextGeocodeRequestAt = now + 1000;

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", searchText);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": "MedPathAI/1.0 (https://medpath-ai-frontend-project.vercel.app)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return res.status(502).json({ error: "Location search is temporarily unavailable. Please try again." });
    }

    const results = await response.json();
    res.set("Cache-Control", "private, max-age=300");
    res.json({
      locations: results.map((result) => ({
        displayName: result.display_name,
        lat: Number(result.lat),
        lon: Number(result.lon),
        type: result.type,
      })),
    });
  } catch {
    res.status(502).json({ error: "Location search is temporarily unavailable. Please try again." });
  }
});

router.use(requireAuth);

router.post("/appointments", async (req, res) => {
  await ensureAppointmentLocationColumn();
  const { providerId, scheduledFor, location, checklist, questions } = req.body;
  const inserted = await query(
    `INSERT INTO appointments (user_id, provider_id, scheduled_for, location, checklist, questions)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user.id, providerId || null, scheduledFor || null, location || null, JSON.stringify(checklist || []), JSON.stringify(questions || [])]
  );
  res.status(201).json({ appointment: inserted.rows[0] });
});

router.get("/appointments", async (req, res) => {
  await ensureAppointmentLocationColumn();
  const result = await query(
    "SELECT * FROM appointments WHERE user_id = $1 ORDER BY scheduled_for ASC NULLS LAST",
    [req.user.id]
  );
  res.json({ appointments: result.rows });
});

router.patch("/appointments/:id", async (req, res) => {
  await ensureAppointmentLocationColumn();
  const { checklist, questions, location, scheduledFor, status, clearSchedule } = req.body;
  const result = await query(
    `UPDATE appointments SET
       checklist = COALESCE($1, checklist),
       questions = COALESCE($2, questions),
       location = CASE WHEN $6::boolean THEN NULL ELSE COALESCE($3, location) END,
       scheduled_for = CASE WHEN $6::boolean THEN NULL ELSE COALESCE($4, scheduled_for) END,
       status = COALESCE($5, status)
     WHERE id = $7 AND user_id = $8 RETURNING *`,
    [checklist ? JSON.stringify(checklist) : null, questions ? JSON.stringify(questions) : null, location, scheduledFor, status, Boolean(clearSchedule), req.params.id, req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Appointment not found." });
  res.json({ appointment: result.rows[0] });
});

export default router;
