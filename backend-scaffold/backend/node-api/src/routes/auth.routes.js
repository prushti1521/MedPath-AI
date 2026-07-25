import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { query } from "../db/pool.js";
import { signToken } from "../middleware/auth.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10, "Password must be at least 10 characters."),
  fullName: z.string().min(1).optional(),
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  const { email, password, fullName } = parsed.data;

  const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rowCount > 0) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userResult = await query(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role",
    [email, passwordHash]
  );
  const user = userResult.rows[0];

  await query("INSERT INTO medical_profiles (user_id, full_name) VALUES ($1, $2)", [
    user.id,
    fullName || null,
  ]);

  const token = signToken(user);
  res.status(201).json({ token, user });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const { email, password } = parsed.data;

  const result = await query("SELECT id, email, role, password_hash FROM users WHERE email = $1", [email]);
  const user = result.rows[0];

  // Constant-time-ish response regardless of whether the user exists
  const hashToCompare = user ? user.password_hash : "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const valid = await bcrypt.compare(password, hashToCompare);

  if (!user || !valid) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

export default router;
