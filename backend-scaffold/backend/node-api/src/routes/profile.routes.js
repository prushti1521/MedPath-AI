import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "../uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeName = `${req.user.id}-${Date.now()}${ext}`;
      cb(null, safeName);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const profile = await query(
      `SELECT p.*, u.email FROM medical_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1`,
      [req.user.id]
    );
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
  } catch (err) { next(err); }
});

router.patch("/", async (req, res, next) => {
  try {
  const {
    fullName,
    email,
    phoneNumber,
    profilePhotoPath,
    dateOfBirth,
    age,
    sex,
    gender,
    bloodType,
    heightCm,
    weightKg,
    insuranceProvider,
    emergencyContact,
    address,
    country,
    preferredLanguage,
  } = req.body;

  const profileSex = sex || gender || null;

  if (email) {
    await query("UPDATE users SET email = $1, updated_at = now() WHERE id = $2", [email, req.user.id]);
  }

  const result = await query(
    `UPDATE medical_profiles SET
       full_name = COALESCE($1, full_name),
       date_of_birth = COALESCE($2, date_of_birth),
       age = COALESCE($3, age),
       sex = COALESCE($4, sex),
       blood_type = COALESCE($5, blood_type),
       height_cm = COALESCE($6, height_cm),
       weight_kg = COALESCE($7, weight_kg),
       phone_number = COALESCE($8, phone_number),
       profile_photo_path = CASE
         WHEN $9::text IS NOT NULL THEN NULLIF($9::text, '')
         ELSE profile_photo_path
       END,
       insurance_provider = COALESCE($10, insurance_provider),
       emergency_contact = COALESCE($11, emergency_contact),
       address = COALESCE($12, address),
       country = COALESCE($13, country),
       preferred_language = COALESCE($14, preferred_language),
       updated_at = now()
     WHERE user_id = $15
     RETURNING *`,
    [
      fullName,
      dateOfBirth,
      age,
      profileSex,
      bloodType,
      heightCm,
      weightKg,
      phoneNumber,
      profilePhotoPath,
      insuranceProvider,
      emergencyContact,
      address,
      country,
      preferredLanguage,
      req.user.id,
    ]
  );

  if (!result.rowCount) return res.status(404).json({ error: "Profile not found." });

  res.json({ profile: result.rows[0] });
  } catch (err) { next(err); }
});

router.post("/photo", upload.single("photo"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Photo file is required." });

    const profile = await query("SELECT id FROM medical_profiles WHERE user_id = $1", [req.user.id]);
    if (!profile.rowCount) return res.status(404).json({ error: "Profile not found." });

    const profilePhotoPath = `/uploads/${req.file.filename}`;
    const result = await query(
      "UPDATE medical_profiles SET profile_photo_path = $1, updated_at = now() WHERE user_id = $2 RETURNING profile_photo_path",
      [profilePhotoPath, req.user.id]
    );

    res.json({ profilePhotoPath: result.rows[0].profile_photo_path });
  } catch (err) { next(err); }
});

router.post("/allergies", async (req, res, next) => {
  try {
    const { substance, reaction, severity } = req.body;
    if (!substance) return res.status(400).json({ error: "Substance is required." });

    const profile = await query("SELECT id FROM medical_profiles WHERE user_id = $1", [req.user.id]);
    const inserted = await query(
      "INSERT INTO allergies (profile_id, substance, reaction, severity) VALUES ($1, $2, $3, $4) RETURNING *",
      [profile.rows[0].id, substance, reaction || null, severity || null]
    );
    res.status(201).json({ allergy: inserted.rows[0] });
  } catch (err) { next(err); }
});

router.delete("/allergies/:id", async (req, res, next) => {
  try {
    await query(
      `DELETE FROM allergies a USING medical_profiles p
       WHERE a.id = $1 AND a.profile_id = p.id AND p.user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
