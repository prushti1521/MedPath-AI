import { Router } from "express";
import { query } from "../db/pool.js";
import { ensureAppointmentLocationColumn } from "../db/appointmentMigration.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

function parseReportSummary(value) {
  if (typeof value !== "string") return value && typeof value === "object" ? value : {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function reportTextItems(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === "string" ? item : item && typeof item === "object"
      ? Object.values(item).filter((part) => typeof part === "string" || typeof part === "number").join(" · ")
      : "")
    .map((item) => item.trim())
    .filter(Boolean);
}

router.get("/", async (req, res, next) => {
  try {
  await ensureAppointmentLocationColumn();
  const [profileRes, appointmentsRes, medsRes, symptomCountsRes, symptomsRes, reportsRes, remindersRes] = await Promise.all([
    query("SELECT full_name FROM medical_profiles WHERE user_id = $1", [req.user.id]),
    query(
      `SELECT id, scheduled_for AS "scheduledFor", location, COUNT(*) OVER() AS "activeCount"
       FROM appointments
       WHERE user_id = $1 AND scheduled_for >= now() AND status = 'scheduled'
       ORDER BY scheduled_for ASC LIMIT 1`,
      [req.user.id]
    ),
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
    query("SELECT report_type, uploaded_at, extracted_summary FROM medical_reports WHERE user_id = $1 ORDER BY uploaded_at DESC LIMIT 3", [req.user.id]),
    query("SELECT id, type, title, due_at, completed FROM reminders WHERE user_id = $1 AND completed = false ORDER BY due_at ASC LIMIT 3", [req.user.id]),
  ]);

  const profile = profileRes.rows[0] || {};
  const nextAppointment = appointmentsRes.rows[0] || null;
  const appointmentCount = Number(nextAppointment?.activeCount || 0);
  const medicationReminders = Number(medsRes.rows[0]?.count || 0);
  const symptomCounts = Object.fromEntries(symptomCountsRes.rows.map((row) => [row.urgency_level, Number(row.count)]));
  const emergencyCount = symptomCounts.emergency || 0;
  const urgentCount = symptomCounts.urgent || 0;
  const routineCount = symptomCounts.routine || 0;
  const recentSymptomCount = emergencyCount + urgentCount + routineCount;
  const recentSymptoms = symptomsRes.rows;
  const recentReports = reportsRes.rows;
  const latestReportSummary = parseReportSummary(recentReports[0]?.extracted_summary);
  const latestReportHighlights = [
    ...reportTextItems(latestReportSummary.key_findings),
    ...reportTextItems(latestReportSummary.abnormal_values),
  ].slice(0, 2);
  const latestReportFollowUpQuestions = reportTextItems(latestReportSummary.follow_up_questions);
  const flaggedReportCount = reportTextItems(latestReportSummary.abnormal_values).length;
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

  const healthStatus = emergencyCount > 0
    ? "High risk"
    : urgentCount > 0
      ? "Moderate risk"
      : flaggedReportCount > 0
        ? "Review report"
        : "Stable";
  const healthSummary = emergencyCount > 0
    ? "A recent emergency-level symptom was logged. Reach out to care if needed."
    : urgentCount > 0
      ? "Some urgent symptoms were recorded. Follow up with your clinician."
      : medicationReminders > 0
        ? "Medication reminders are active. Stay on schedule."
        : "No major issues detected.";
  const reportHealthNote = flaggedReportCount > 0
    ? `Your latest report contains ${flaggedReportCount} extracted abnormal result${flaggedReportCount === 1 ? "" : "s"}. Review the original report with a clinician; automated extraction can be inaccurate.`
    : "";
  const riskAlerts = [];
  if (emergencyCount > 0) riskAlerts.push(`${emergencyCount} emergency symptom${emergencyCount > 1 ? "s" : ""}`);
  if (urgentCount > 0) riskAlerts.push(`${urgentCount} urgent symptom${urgentCount > 1 ? "s" : ""}`);
  if (flaggedReportCount > 0) riskAlerts.push(`Latest report lists ${flaggedReportCount} abnormal result${flaggedReportCount === 1 ? "" : "s"} to review with your clinician`);
  if (medicationReminders > 3) riskAlerts.push("Multiple medication reminders due");

  const dashboard = {
    healthStatus,
    healthSummary: [healthSummary, reportHealthNote].filter(Boolean).join(" "),
    nextAppointment,
    appointmentCount,
    medicationReminders,
    recentSymptoms,
    healthScore: score,
    healthScoreDetails: `Based on ${emergencyCount + urgentCount + routineCount} symptom entries and medication reminders.${flaggedReportCount > 0 ? ` Latest report includes ${flaggedReportCount} extracted abnormal result${flaggedReportCount === 1 ? "" : "s"}; the score does not interpret lab values.` : ""}`,
    riskAlerts,
    latestReportHighlights,
    aiSuggestions: buildAiSuggestions({
      emergencyCount,
      urgentCount,
      recentSymptomCount,
      medicationCount: medicationReminders,
      hasAppointment: Boolean(nextAppointment),
      reportCount: recentReports.length,
      flaggedReportCount,
      reportFollowUpQuestion: latestReportFollowUpQuestions[0],
      reminderCount: reminders.length,
    }),
    recentReports,
    reminders,
  };

  res.json({ dashboard });
  } catch (err) { next(err); }
});

export default router;

export function buildAiSuggestions({
  emergencyCount,
  urgentCount,
  recentSymptomCount,
  medicationCount,
  hasAppointment,
  reportCount,
  flaggedReportCount,
  reportFollowUpQuestion,
  reminderCount,
}) {
  const suggestions = [];

  if (emergencyCount > 0) {
    suggestions.push(`You logged ${emergencyCount} emergency-level symptom ${emergencyCount === 1 ? "entry" : "entries"} in the past 30 days. Review them with a clinician; seek urgent care for severe or worsening symptoms.`);
  } else if (urgentCount > 0) {
    suggestions.push(`You logged ${urgentCount} urgent symptom ${urgentCount === 1 ? "entry" : "entries"} in the past 30 days. Consider discussing them with your clinician, especially if they persist or worsen.`);
  }

  if (reportFollowUpQuestion && suggestions.length < 2) {
    suggestions.push(`From your latest report, consider asking: ${reportFollowUpQuestion}`);
  } else if (flaggedReportCount > 0 && suggestions.length < 2) {
    suggestions.push("Your latest report contains extracted abnormal results. Review them with your clinician; automated extraction can be inaccurate.");
  }

  if (reminderCount > 0) {
    suggestions.push(`You have ${reminderCount} upcoming or incomplete reminder${reminderCount === 1 ? "" : "s"}. Review due times and mark completed items done.`);
  } else if (hasAppointment) {
    suggestions.push("Prepare for your upcoming appointment by noting your questions and any recent symptom changes.");
  }

  if (suggestions.length < 2 && medicationCount > 0) {
    suggestions.push(`Your profile lists ${medicationCount} active medication${medicationCount === 1 ? "" : "s"}. Keep the list current and discuss changes or side effects with your clinician or pharmacist.`);
  }
  if (suggestions.length < 2 && reportCount > 0) {
    suggestions.push("You have recent medical reports saved. Review their results with your clinician.");
  }
  if (suggestions.length < 2 && recentSymptomCount > 0) {
    suggestions.push(`You logged ${recentSymptomCount} symptom ${recentSymptomCount === 1 ? "entry" : "entries"} in the past 30 days. Tracking timing and changes can help you discuss patterns with your clinician.`);
  }
  if (suggestions.length === 0) {
    suggestions.push("There is little recent health activity to personalize suggestions yet. Logging symptoms, appointments, or medications can make these insights more relevant.");
  }

  return suggestions.slice(0, 2);
}
