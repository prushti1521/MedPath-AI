import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const [profileRes, appointmentsRes, medsRes, symptomCountsRes, symptomsRes, reportsRes, remindersRes] = await Promise.all([
    query("SELECT full_name FROM medical_profiles WHERE user_id = $1", [req.user.id]),
    query("SELECT * FROM appointments WHERE user_id = $1 AND scheduled_for >= now() ORDER BY scheduled_for ASC LIMIT 1", [req.user.id]),
    query(
      `SELECT COUNT(*) AS count FROM medications m
       JOIN medical_profiles p ON m.profile_id = p.id
       WHERE p.user_id = $1 AND m.active = true`,
      [req.user.id]
    ),
    query(
      `SELECT urgency_level, COUNT(*) AS count
       FROM symptom_sessions
       WHERE user_id = $1 AND created_at >= now() - interval '30 days'
       GROUP BY urgency_level`,
      [req.user.id]
    ),
    query("SELECT free_text, urgency_level, created_at FROM symptom_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 3", [req.user.id]),
    query("SELECT report_type, uploaded_at FROM medical_reports WHERE user_id = $1 ORDER BY uploaded_at DESC LIMIT 3", [req.user.id]),
    query("SELECT id, type, title, due_at, completed FROM reminders WHERE user_id = $1 AND completed = false ORDER BY due_at ASC LIMIT 3", [req.user.id]),
  ]);

  const profile = profileRes.rows[0] || {};
  const nextAppointment = appointmentsRes.rows[0] || null;
  const medicationReminders = Number(medsRes.rows[0]?.count || 0);
  const symptomCounts = Object.fromEntries(symptomCountsRes.rows.map((row) => [row.urgency_level, Number(row.count)]));
  const emergencyCount = symptomCounts.emergency || 0;
  const urgentCount = symptomCounts.urgent || 0;
  const routineCount = symptomCounts.routine || 0;
  const recentSymptoms = symptomsRes.rows;
  const recentReports = reportsRes.rows;
  const reminders = remindersRes.rows;

  const baseScore = 90;
  const score = Math.max(
    30,
    Math.min(
      100,
      baseScore
        - emergencyCount * 25
        - urgentCount * 12
        - Math.min(10, medicationReminders * 2)
        - (nextAppointment ? 5 : 0)
        + (recentSymptoms.length === 0 ? 8 : 0)
    )
  );

  const healthStatus = emergencyCount > 0 ? "High risk" : urgentCount > 0 ? "Moderate risk" : "Stable";
  const riskAlerts = [];
  if (emergencyCount > 0) riskAlerts.push(`${emergencyCount} emergency symptom${emergencyCount > 1 ? "s" : ""}`);
  if (urgentCount > 0) riskAlerts.push(`${urgentCount} urgent symptom${urgentCount > 1 ? "s" : ""}`);
  if (medicationReminders > 3) riskAlerts.push("Multiple medication reminders due");

  const dashboard = {
    healthStatus,
    healthSummary:
      emergencyCount > 0
        ? "A recent emergency-level symptom was logged. Reach out to care if needed."
        : urgentCount > 0
        ? "Some urgent symptoms were recorded. Follow up with your clinician."
        : medicationReminders > 0
        ? "Medication reminders are active. Stay on schedule."
        : "No major issues detected.",
    nextAppointment,
    medicationReminders,
    recentSymptoms,
    healthScore: score,
    healthScoreDetails: `Based on ${emergencyCount + urgentCount + routineCount} symptom entries and medication reminders.`,
    riskAlerts,
    aiSuggestions: [
      ...(recentReports.length === 0 ? ["Upload a lab report to get more personalized insights"] : []),
      ...(emergencyCount > 0 ? ["Contact care if symptoms worsen"] : ["Ask AI for a monitoring plan"]),
    ],
    recentReports,
    reminders,
  };

  res.json({ dashboard });
});

export default router;
