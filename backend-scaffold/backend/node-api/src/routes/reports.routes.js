import fs from "fs";
import path from "path";
import multer from "multer";
import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const uploadDir = path.join("src", "uploads", "reports");
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

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
    const formData = new FormData();
    formData.append("file", fs.createReadStream(req.file.path), req.file.originalname);
    const endpoint = reportType === "prescription" ? "/ocr/prescription" : "/ocr/report";
    const response = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
      method: "POST",
      body: formData,
    });
    if (response.ok) {
      extractedSummary = await response.json();
    }
  } catch (err) {
    console.error("OCR service error", err);
  }

  const inserted = await query(
    `INSERT INTO medical_reports (user_id, file_url, report_type, extracted_summary)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.user.id, fileUrl, reportType || null, extractedSummary ? JSON.stringify(extractedSummary) : null]
  );

  res.status(201).json({ report: inserted.rows[0], uploadedFile: { fileUrl, reportType, extractedSummary } });
});

export default router;
