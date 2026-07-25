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

  const result = await query(
    "SELECT id, email, role, password_hash, is_deleted FROM users WHERE email = $1 AND is_deleted = false",
    [email]
  );
  const user = result.rows[0];

  // Constant-time-ish response regardless of whether the user exists
  const hashToCompare = user ? user.password_hash : "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const valid = await bcrypt.compare(password, hashToCompare);

  if (!user || !valid) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  // Update last login and track login history
  await query(
    "UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1",
    [user.id]
  );

  await query(
    "INSERT INTO login_history (user_id, ip_address, user_agent, success) VALUES ($1, $2, $3, true)",
    [user.id, req.ip, req.get("user-agent")]
  );

  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

router.post("/logout", async (req, res) => {
  // Logout is optional in JWT flow, but we can log it for security audit
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(400).json({ error: "No auth token provided." });
  }

  const token = authHeader.replace("Bearer ", "");
  let userId;

  try {
    const decoded = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    userId = decoded.id;
  } catch (err) {
    return res.status(401).json({ error: "Invalid token." });
  }

  // Update the most recent login session's logout time
  await query(
    "UPDATE login_history SET logout_at = now() WHERE id = (SELECT id FROM login_history WHERE user_id = $1 AND logout_at IS NULL ORDER BY login_at DESC LIMIT 1)",
    [userId]
  );

  res.json({ message: "Logged out successfully." });
});

router.delete("/account", async (req, res) => {
  // Requires auth — will add middleware check
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: "Password is required to delete account." });
  }

  // Verify password before deletion
  const userResult = await query(
    "SELECT password_hash FROM users WHERE id = $1 AND is_deleted = false",
    [req.user.id]
  );

  if (!userResult.rowCount) {
    return res.status(404).json({ error: "User not found." });
  }

  const valid = await bcrypt.compare(password, userResult.rows[0].password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  // Soft delete account
  await query(
    "UPDATE users SET is_deleted = true, deleted_at = now(), updated_at = now() WHERE id = $1",
    [req.user.id]
  );

  res.json({ message: "Account deleted successfully. Your data has been archived." });
});

export default router;
