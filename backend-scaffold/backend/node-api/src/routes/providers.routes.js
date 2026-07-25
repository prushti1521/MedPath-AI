import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

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

router.use(requireAuth);

router.post("/appointments", async (req, res) => {
  const { providerId, scheduledFor, checklist, questions } = req.body;
  const inserted = await query(
    `INSERT INTO appointments (user_id, provider_id, scheduled_for, checklist, questions)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.id, providerId || null, scheduledFor || null, JSON.stringify(checklist || []), JSON.stringify(questions || [])]
  );
  res.status(201).json({ appointment: inserted.rows[0] });
});

router.get("/appointments", async (req, res) => {
  const result = await query(
    "SELECT * FROM appointments WHERE user_id = $1 ORDER BY scheduled_for ASC NULLS LAST",
    [req.user.id]
  );
  res.json({ appointments: result.rows });
});

router.patch("/appointments/:id", async (req, res) => {
  const { checklist, questions, status } = req.body;
  const result = await query(
    `UPDATE appointments SET
       checklist = COALESCE($1, checklist),
       questions = COALESCE($2, questions),
       status = COALESCE($3, status)
     WHERE id = $4 AND user_id = $5 RETURNING *`,
    [checklist ? JSON.stringify(checklist) : null, questions ? JSON.stringify(questions) : null, status, req.params.id, req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Appointment not found." });
  res.json({ appointment: result.rows[0] });
});

export default router;
