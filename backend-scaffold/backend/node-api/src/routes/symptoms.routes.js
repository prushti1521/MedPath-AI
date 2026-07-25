import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// Create a new symptom-check session. Delegates triage scoring to the
// Python AI service (FastAPI), which applies rules + LLM reasoning
// and returns an urgency level, reasons, and a crisis flag.
router.post("/sessions", async (req, res) => {
  const { freeText, answers } = req.body;

  let triage;
  try {
    const aiResponse = await fetch(`${AI_SERVICE_URL}/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ free_text: freeText, answers }),
    });
    if (!aiResponse.ok) throw new Error("AI service error");
    triage = await aiResponse.json();
  } catch (err) {
    // Fail safe: if the AI service is unreachable, don't silently
    // under-triage — surface an error rather than guessing.
    return res.status(502).json({ error: "Couldn't reach the triage service. Please try again." });
  }

  const inserted = await query(
    `INSERT INTO symptom_sessions (user_id, free_text, answers, urgency_level, reasons, crisis_flag)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.user.id, freeText, JSON.stringify(answers || {}), triage.level, JSON.stringify(triage.reasons || []), !!triage.crisis]
  );

  res.status(201).json({ session: inserted.rows[0] });
});

router.get("/sessions", async (req, res) => {
  const result = await query(
    "SELECT * FROM symptom_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
    [req.user.id]
  );
  res.json({ sessions: result.rows });
});

// Symptom timeline entries (severity, vitals, mood, sleep)
router.post("/timeline", async (req, res) => {
  const {
    severity,
    symptomText,
    bodyLocation,
    notes,
    temperatureF,
    heartRate,
    bpSystolic,
    bpDiastolic,
    bloodSugar,
    weightKg,
    sleepHours,
    waterIntakeLiters,
    exerciseMinutes,
    stressLevel,
    mood,
    source,
    recordedAt,
  } = req.body;

  const inserted = await query(
    `INSERT INTO symptom_timeline_entries
       (user_id, severity, symptom_text, body_location, notes, temperature_f, heart_rate,
        blood_pressure_systolic, blood_pressure_diastolic, blood_sugar, weight_kg,
        sleep_hours, water_intake_liters, exercise_minutes, stress_level, mood, source, recorded_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
    [
      req.user.id,
      severity || null,
      symptomText || null,
      bodyLocation || null,
      notes || null,
      temperatureF || null,
      heartRate || null,
      bpSystolic || null,
      bpDiastolic || null,
      bloodSugar || null,
      weightKg || null,
      sleepHours || null,
      waterIntakeLiters || null,
      exerciseMinutes || null,
      stressLevel || null,
      mood || null,
      source || "manual",
      recordedAt || null,
    ]
  );
  res.status(201).json({ entry: inserted.rows[0] });
});

router.get("/timeline", async (req, res) => {
  const days = Number(req.query.days || 30);
  const result = await query(
    `SELECT * FROM symptom_timeline_entries
     WHERE user_id = $1 AND recorded_at >= now() - ($2 || ' days')::interval
     ORDER BY recorded_at ASC`,
    [req.user.id, days]
  );
  res.json({ entries: result.rows });
});

export default router;
