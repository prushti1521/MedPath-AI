import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/medical", async (req, res) => {
  const result = await query(
    `SELECT id, condition, description, started_on, ended_on, status, notes
     FROM medical_history_entries
     WHERE user_id = $1
     ORDER BY started_on DESC NULLS LAST
     LIMIT 50`,
    [req.user.id]
  );
  res.json({ medicalHistory: result.rows });
});

router.post("/medical", async (req, res) => {
  const { condition, description, startedOn, endedOn, status, notes } = req.body;
  if (!condition) return res.status(400).json({ error: "condition is required." });

  const inserted = await query(
    `INSERT INTO medical_history_entries (user_id, condition, description, started_on, ended_on, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [req.user.id, condition, description || null, startedOn || null, endedOn || null, status || null, notes || null]
  );
  res.status(201).json({ history: inserted.rows[0] });
});

router.get("/uploaded-files", async (req, res) => {
  const result = await query(
    `SELECT id, file_name, file_url, file_type, category, metadata, uploaded_at
     FROM uploaded_files
     WHERE user_id = $1
     ORDER BY uploaded_at DESC
     LIMIT 50`,
    [req.user.id]
  );
  res.json({ uploadedFiles: result.rows });
});

router.post("/uploaded-files", async (req, res) => {
  const { fileName, fileUrl, fileType, category, metadata } = req.body;
  if (!fileName || !fileUrl) return res.status(400).json({ error: "fileName and fileUrl are required." });

  const inserted = await query(
    `INSERT INTO uploaded_files (user_id, file_name, file_url, file_type, category, metadata)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.user.id, fileName, fileUrl, fileType || null, category || null, metadata ? JSON.stringify(metadata) : null]
  );
  res.status(201).json({ uploadedFile: inserted.rows[0] });
});

export default router;
