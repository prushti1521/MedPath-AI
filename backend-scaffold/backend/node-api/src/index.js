import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import authRoutes from "./routes/auth.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import symptomsRoutes from "./routes/symptoms.routes.js";
import providersRoutes from "./routes/providers.routes.js";
import medicationsRoutes from "./routes/medications.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import prescriptionsRoutes from "./routes/prescriptions.routes.js";
import historyRoutes from "./routes/history.routes.js";
import remindersRoutes from "./routes/reminders.routes.js";
import conversationsRoutes from "./routes/conversations.routes.js";

dotenv.config();

// Prevent unhandled promise rejections from crashing the server
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

// Apply schema on startup if tables are missing
async function initDb() {
  try {
    const { pool } = await import("./db/pool.js");
    const check = await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='users'"
    );
    if (check.rowCount === 0) {
      console.log("Users table not found — applying schema...");
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const schema = readFileSync(join(__dirname, "db", "schema.sql"), "utf8");
      await pool.query(schema);
      console.log("Schema applied successfully.");
    } else {
      console.log("Database schema already in place.");
    }
  } catch (err) {
    console.error("DB init error (non-fatal):", err.message);
  }
}

initDb();

const app = express();

const allowedOrigins = [
  "https://medpath-ai-frontend-project.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:5177",
  "http://localhost:5179",
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map(o => o.trim()) : [])
];

// CORS must run before helmet to allow cross-origin requests
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("CORS: origin not allowed"));
  },
  credentials: true,
}));

app.use(helmet());
app.use(express.json({ limit: "2mb" }));
app.use(express.static("src/uploads"));

// Global rate limit; tighten further on /auth in production
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.get("/db-health", async (req, res) => {
  try {
    const { pool } = await import("./db/pool.js");
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(503).json({ status: "error", db: "disconnected", error: err.message });
  }
});

app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/symptoms", symptomsRoutes);
app.use("/providers", providersRoutes);
app.use("/medications", medicationsRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/reports", reportsRoutes);
app.use("/prescriptions", prescriptionsRoutes);
app.use("/history", historyRoutes);
app.use("/reminders", remindersRoutes);
app.use("/conversations", conversationsRoutes);

// Central error handler — never leak stack traces to the client
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: "Something went wrong. Please try again." });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API listening on port ${port}`));
