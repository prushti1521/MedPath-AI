import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const profile = await query("SELECT * FROM medical_profiles WHERE user_id = $1", [req.user.id]);
  const allergies = await query(
    `SELECT a.* FROM allergies a JOIN medical_profiles p ON a.profile_id = p.id WHERE p.user_id = $1`,
    [req.user.id]
  );
  const conditions = await query(
    `SELECT c.* FROM chronic_conditions c JOIN medical_profiles p ON c.profile_id = p.id WHERE p.user_id = $1`,
    [req.user.id]
  );

  if (!profile.rowCount) return res.status(404).json({ error: "Profile not found." });

  res.json({ profile: profile.rows[0], allergies: allergies.rows, conditions: conditions.rows });
});

router.patch("/", async (req, res) => {
  const { fullName, dateOfBirth, sex, heightCm, weightKg, bloodType } = req.body;
  const result = await query(
    `UPDATE medical_profiles SET
       full_name = COALESCE($1, full_name),
       date_of_birth = COALESCE($2, date_of_birth),
       sex = COALESCE($3, sex),
       height_cm = COALESCE($4, height_cm),
       weight_kg = COALESCE($5, weight_kg),
       blood_type = COALESCE($6, blood_type),
       updated_at = now()
     WHERE user_id = $7
     RETURNING *`,
    [fullName, dateOfBirth, sex, heightCm, weightKg, bloodType, req.user.id]
  );
  res.json({ profile: result.rows[0] });
});

router.post("/allergies", async (req, res) => {
  const { substance, reaction, severity } = req.body;
  if (!substance) return res.status(400).json({ error: "Substance is required." });

  const profile = await query("SELECT id FROM medical_profiles WHERE user_id = $1", [req.user.id]);
  const inserted = await query(
    "INSERT INTO allergies (profile_id, substance, reaction, severity) VALUES ($1, $2, $3, $4) RETURNING *",
    [profile.rows[0].id, substance, reaction || null, severity || null]
  );
  res.status(201).json({ allergy: inserted.rows[0] });
});

router.delete("/allergies/:id", async (req, res) => {
  await query(
    `DELETE FROM allergies a USING medical_profiles p
     WHERE a.id = $1 AND a.profile_id = p.id AND p.user_id = $2`,
    [req.params.id, req.user.id]
  );
  res.status(204).send();
});

export default router;
