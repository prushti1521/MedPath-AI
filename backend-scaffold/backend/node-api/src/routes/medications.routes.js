import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

router.get("/", async (req, res) => {
  const result = await query(
    `SELECT m.* FROM medications m JOIN medical_profiles p ON m.profile_id = p.id
     WHERE p.user_id = $1 AND m.active = true ORDER BY m.created_at DESC`,
    [req.user.id]
  );
  res.json({ medications: result.rows });
});

router.post("/", async (req, res) => {
  const { name, dosage, frequency, startedOn, source } = req.body;
  if (!name) return res.status(400).json({ error: "Medication name is required." });

  const profile = await query("SELECT id FROM medical_profiles WHERE user_id = $1", [req.user.id]);
  const inserted = await query(
    `INSERT INTO medications (profile_id, name, dosage, frequency, started_on, source)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [profile.rows[0].id, name, dosage || null, frequency || null, startedOn || null, source || "manual"]
  );
  res.status(201).json({ medication: inserted.rows[0] });
});

router.delete("/:id", async (req, res) => {
  await query(
    `UPDATE medications m SET active = false FROM medical_profiles p
     WHERE m.id = $1 AND m.profile_id = p.id AND p.user_id = $2`,
    [req.params.id, req.user.id]
  );
  res.status(204).send();
});

// Delegates to the AI service, which checks a maintained interaction
// dataset (and can call an LLM for anything not in the structured table).
router.post("/check-interactions", async (req, res) => {
  const meds = await query(
    `SELECT m.name FROM medications m JOIN medical_profiles p ON m.profile_id = p.id
     WHERE p.user_id = $1 AND m.active = true`,
    [req.user.id]
  );
  const names = meds.rows.map((r) => r.name);

  try {
    const aiResponse = await fetch(`${AI_SERVICE_URL}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medications: names }),
    });
    if (!aiResponse.ok) throw new Error("AI service error");
    const data = await aiResponse.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "Couldn't reach the interaction-check service." });
  }
});

export default router;
