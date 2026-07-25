import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const result = await query(
    `SELECT id, type, title, message, due_at, repeat_rule, completed
     FROM reminders
     WHERE user_id = $1
     ORDER BY due_at ASC NULLS LAST`,
    [req.user.id]
  );
  res.json({ reminders: result.rows });
});

router.post("/", async (req, res) => {
  const { type, title, message, dueAt, repeatRule } = req.body;
  if (!type || !title || !message) return res.status(400).json({ error: "type, title, and message are required." });

  const inserted = await query(
    `INSERT INTO reminders (user_id, type, title, message, due_at, repeat_rule)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.user.id, type, title, message, dueAt || null, repeatRule || null]
  );
  res.status(201).json({ reminder: inserted.rows[0] });
});

router.patch("/:id", async (req, res) => {
  const { completed } = req.body;
  const result = await query(
    `UPDATE reminders SET completed = COALESCE($1, completed)
     WHERE id = $2 AND user_id = $3 RETURNING *`,
    [completed, req.params.id, req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Reminder not found." });
  res.json({ reminder: result.rows[0] });
});

export default router;
