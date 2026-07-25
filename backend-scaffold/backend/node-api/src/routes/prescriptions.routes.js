import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const result = await query(
    `SELECT id, image_url, ocr_result, created_at
     FROM prescriptions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [req.user.id]
  );
  res.json({ prescriptions: result.rows });
});

router.post("/", async (req, res) => {
  const { imageUrl, ocrResult } = req.body;
  if (!imageUrl) return res.status(400).json({ error: "imageUrl is required." });

  const inserted = await query(
    `INSERT INTO prescriptions (user_id, image_url, ocr_result)
     VALUES ($1, $2, $3) RETURNING *`,
    [req.user.id, imageUrl, ocrResult ? JSON.stringify(ocrResult) : null]
  );
  res.status(201).json({ prescription: inserted.rows[0] });
});

export default router;
