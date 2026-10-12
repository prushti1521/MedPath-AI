import fs from "fs";
import path from "path";
import multer from "multer";
import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const uploadDir = path.join("src", "uploads", "reports");
fs.mkdirSync(uploadDir, { recursive: true });
const GEMINI_REPORT_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const REPORT_UPLOAD_LIMIT = 10 * 1024 * 1024;
const REPORT_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const REPORT_EXTRACTION_PROMPT = `Read this medical report and return only valid JSON with this shape:
{"key_findings":[],"diagnoses":[],"medications":[],"abnormal_values":[],"follow_up_questions":[]}
Extract only information clearly stated in the document. Do not diagnose, infer a condition, or recommend treatment. Keep key_findings concise and plain-language. Include 2-4 useful questions the patient can ask their clinician. Use empty arrays when a section is not present.`;
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: REPORT_UPLOAD_LIMIT },
  fileFilter(_req, file, callback) {
    if (REPORT_MIME_TYPES.has(file.mimetype)) return callback(null, true);
    callback(new Error("Upload a PDF, JPEG, PNG, or WebP report."));
  },
});

async function extractReportSummary(file) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const bytes = await fs.promises.readFile(file.path);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_REPORT_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { text: REPORT_EXTRACTION_PROMPT },
          { inlineData: { mimeType: file.mimetype, data: bytes.toString("base64") } },
        ],
      }],
      generationConfig: { maxOutputTokens: 1200, responseMimeType: "application/json" },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Gemini returned ${response.status}.`);

  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned no report summary.");
  return JSON.parse(text);
}

router.get("/", async (req, res) => {
  const result = await query(
    `SELECT id, file_url, report_type, extracted_summary, uploaded_at
     FROM medical_reports
     WHERE user_id = $1
     ORDER BY uploaded_at DESC
     LIMIT 20`,
    [req.user.id]
  );
  res.json({ reports: result.rows });
});

router.post("/", async (req, res) => {
  const { fileUrl, reportType, extractedSummary } = req.body;
  if (!fileUrl) return res.status(400).json({ error: "fileUrl is required." });

  const inserted = await query(
    `INSERT INTO medical_reports (user_id, file_url, report_type, extracted_summary)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.user.id, fileUrl, reportType || null, extractedSummary ? JSON.stringify(extractedSummary) : null]
  );
  res.status(201).json({ report: inserted.rows[0] });
});

router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File upload is required." });
  const { reportType, category } = req.body;
  const fileUrl = `/uploads/reports/${req.file.filename}`;

  let extractedSummary = null;
  try {
    extractedSummary = await extractReportSummary(req.file);
  } catch (err) {
    console.error("Gemini report extraction failed:", err.message);
  }

  const inserted = await query(
    `INSERT INTO medical_reports (user_id, file_url, report_type, extracted_summary)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.user.id, fileUrl, reportType || null, extractedSummary ? JSON.stringify(extractedSummary) : null]
  );

  res.status(201).json({ report: inserted.rows[0], uploadedFile: { fileUrl, reportType, extractedSummary } });
});

router.delete("/:id", async (req, res) => {
  const deleted = await query(
    "DELETE FROM medical_reports WHERE id = $1 AND user_id = $2 RETURNING file_url",
    [req.params.id, req.user.id]
  );
  if (!deleted.rowCount) return res.status(404).json({ error: "Report not found." });

  const fileUrl = deleted.rows[0].file_url || "";
  const prefix = "/uploads/reports/";
  if (fileUrl.startsWith(prefix)) {
    const fileName = path.basename(fileUrl.slice(prefix.length));
    if (fileName) {
      await fs.promises.unlink(path.join(uploadDir, fileName)).catch((err) => {
        if (err.code !== "ENOENT") console.error("Unable to remove report file:", err.message);
      });
    }
  }
  res.status(204).end();
});

export default router;
