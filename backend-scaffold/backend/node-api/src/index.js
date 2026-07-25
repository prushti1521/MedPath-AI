import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

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

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || "*" }));
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
