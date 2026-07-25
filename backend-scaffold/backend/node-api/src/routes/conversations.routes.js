import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

router.get("/", async (req, res) => {
  const result = await query(
    `SELECT c.id, c.kind, c.title, c.created_at,
        (SELECT content FROM ai_responses WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT COUNT(*) FROM ai_responses WHERE conversation_id = c.id) AS message_count
     FROM conversations c
     WHERE c.user_id = $1
     ORDER BY c.created_at DESC
     LIMIT 50`,
    [req.user.id]
  );
  res.json({ conversations: result.rows });
});

router.get("/search", async (req, res) => {
  const q = `%${req.query.q || ""}%`;
  const result = await query(
    `SELECT c.id, c.kind, c.title, c.created_at,
        (SELECT content FROM ai_responses WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT COUNT(*) FROM ai_responses WHERE conversation_id = c.id) AS message_count
     FROM conversations c
     WHERE c.user_id = $1
       AND (c.title ILIKE $2 OR EXISTS (
         SELECT 1 FROM ai_responses r WHERE r.conversation_id = c.id AND r.content ILIKE $2
       ))
     ORDER BY c.created_at DESC
     LIMIT 50`,
    [req.user.id, q]
  );
  res.json({ conversations: result.rows });
});

router.post("/", async (req, res) => {
  const { title, kind } = req.body;
  const result = await query(
    `INSERT INTO conversations (user_id, title, kind)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [req.user.id, title || "New conversation", kind || "ask_ai"]
  );
  res.status(201).json({ conversation: result.rows[0] });
});

router.patch("/:id", async (req, res) => {
  const { title } = req.body;
  const result = await query(
    `UPDATE conversations SET title = COALESCE($1, title)
     WHERE id = $2 AND user_id = $3 RETURNING *`,
    [title, req.params.id, req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Conversation not found." });
  res.json({ conversation: result.rows[0] });
});

router.delete("/:id", async (req, res) => {
  await query(`DELETE FROM conversations WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
  res.status(204).send();
});

router.get("/:id/messages", async (req, res) => {
  const result = await query(
    `SELECT id, role, content, citations, created_at
     FROM ai_responses
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [req.params.id]
  );
  res.json({ messages: result.rows });
});

router.post("/:id/messages", async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "Message content is required." });

  const conversation = await query(
    `SELECT id FROM conversations WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.id]
  );
  if (!conversation.rowCount) return res.status(404).json({ error: "Conversation not found." });

  await query(
    `INSERT INTO ai_responses (conversation_id, role, content) VALUES ($1, $2, $3)`,
    [req.params.id, "user", content]
  );

  const historyRows = await query(
    `SELECT role, content FROM ai_responses WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [req.params.id]
  );

  const history = historyRows.rows.map((row) => ({ role: row.role, content: row.content }));

  let assistantText = "";
  let citations = [];

  try {
    const aiResponse = await fetch(`${AI_SERVICE_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: content, history }),
    });

    if (!aiResponse.ok) {
      throw new Error("AI service error");
    }

    const data = await aiResponse.json();
    assistantText = data.answer || data.text || "I couldn't generate a response right now.";
    citations = data.sources || [];
  } catch (err) {
    console.error(err);
    assistantText = "Sorry, I couldn't connect to the AI service. Please try again later.";
  }

  const inserted = await query(
    `INSERT INTO ai_responses (conversation_id, role, content, citations)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.params.id, "assistant", assistantText, JSON.stringify(citations)],
  );

  res.status(201).json({ message: inserted.rows[0], assistantText, citations });
});

export default router;
