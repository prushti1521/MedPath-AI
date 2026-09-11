import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { query } from "../db/pool.js";

const router = Router();
router.use(requireAuth);

const SYSTEM_PROMPT = `You are the "Ask AI" medical information assistant inside a healthcare-navigator app called MedPath AI.

Rules:
- Explain medical conditions, terms, and medications in clear, plain language a non-expert can follow.
- Keep answers concise: 4-7 sentences, or a short list for multi-part questions.
- Cover, when relevant: what it is, common causes, typical symptoms, general treatment approach, and prevention.
- Never diagnose the person or evaluate their personal symptoms. If they describe their own symptoms, briefly acknowledge them, then redirect: suggest they use the app's Symptom Check feature and/or speak with a healthcare professional, especially for anything urgent.
- Never give exact personal dosing instructions. You can describe how a class of medication generally works.
- End every response with a short one-line disclaimer that this is educational information, not medical advice.
- If the question is unrelated to health or medicine, politely redirect to health topics.`;

router.post("/chat", async (req, res) => {
  // Support both Groq (free) and Anthropic. Groq is tried first if key present.
  const groqKey = process.env.GROQ_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required." });
  }

  // Try Groq first (free tier available)
  if (groqKey) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          max_tokens: 1000,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error("Groq API error:", err);
        // Fall through to Anthropic if available
        if (!anthropicKey) {
          return res.status(response.status).json({ error: err?.error?.message || "AI request failed." });
        }
      } else {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim() || "I wasn't able to generate a response.";
        return saveChatResponse(req.user.id, messages, text, res);
      }
    } catch (err) {
      console.error("Groq error:", err);
      if (!anthropicKey) {
        return res.status(502).json({ error: "Could not reach the AI service. Please try again." });
      }
    }
  }

  // Fall back to Anthropic
  if (anthropicKey) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error("Anthropic API error:", err);
        return res.status(response.status).json({ error: err?.error?.message || "AI request failed." });
      }

      const data = await response.json();
      const text = (data.content || [])
        .map((block) => (block.type === "text" ? block.text : ""))
        .filter(Boolean)
        .join("\n")
        .trim();

      return saveChatResponse(req.user.id, messages, text, res);
    } catch (err) {
      console.error("AI chat error:", err);
      return res.status(502).json({ error: "Could not reach the AI service. Please try again." });
    }
  }

  const lastMessage = [...messages].reverse().find((message) => message.role === "user");
  const fallbackText = getEducationalFallback(lastMessage?.content || "");
  return saveChatResponse(req.user.id, messages, fallbackText, res);
});

function getEducationalFallback(question) {
  const normalized = question.toLowerCase();
  if (normalized.includes("migraine") || normalized.includes("headache")) {
    return "A migraine is a neurological condition that can cause moderate to severe, often throbbing head pain, sometimes with nausea or sensitivity to light and sound. Common triggers include stress, poor sleep, dehydration, skipped meals, and hormonal changes. Resting in a quiet, dark room and maintaining regular hydration may help, but seek urgent care for a sudden severe headache, weakness, confusion, fainting, fever with a stiff neck, or vision loss. This is educational information, not medical advice.";
  }
  if (normalized.includes("hypertension") || normalized.includes("blood pressure")) {
    return "Hypertension means blood pressure stays higher than the recommended range over time. It often has no obvious symptoms, which is why regular checks matter. Management commonly includes activity, balanced nutrition, limiting sodium, avoiding tobacco, and medications prescribed by a clinician. Seek urgent care for very high readings with chest pain, breathing trouble, weakness, confusion, or severe headache. This is educational information, not medical advice.";
  }
  return "I can provide general educational information about common conditions, symptoms, medications, and prevention. The AI service is temporarily unavailable, so please try a question about a health topic again shortly. For personal symptoms or urgent concerns, use Symptom Check and contact a qualified healthcare professional. This is educational information, not medical advice.";
}

async function saveChatResponse(userId, messages, text, res) {
  try {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
    const conversation = await query(
      `INSERT INTO conversations (user_id, title, kind) VALUES ($1, $2, $3) RETURNING id`,
      [userId, String(lastUserMessage?.content || "Ask AI").slice(0, 80), "ask_ai"]
    );
    const conversationId = conversation.rows[0].id;
    for (const message of messages.filter((item) => item.role === "user" || item.role === "assistant")) {
      await query(
        `INSERT INTO ai_responses (conversation_id, role, content) VALUES ($1, $2, $3)`,
        [conversationId, message.role, message.content]
      );
    }
    await query(
      `INSERT INTO ai_responses (conversation_id, role, content) VALUES ($1, $2, $3)`,
      [conversationId, "assistant", text]
    );
    return res.json({ text, conversationId });
  } catch (err) {
    console.error("AI response persistence error:", err);
    return res.json({ text });
  }
}

// Overpass API proxy — avoids browser CORS/rate-limit issues
router.get("/nearby-providers", async (req, res) => {
  const { lat, lon, radius = 5000, type = "all" } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "lat and lon are required." });

  const amenityFilter = type === "all"
    ? "hospital|clinic|pharmacy|urgent_care|laboratory|doctors|healthcare|medical_center"
    : type;

  const q = `[out:json][timeout:20];(node(around:${radius},${lat},${lon})[amenity~"${amenityFilter}"];way(around:${radius},${lat},${lon})[amenity~"${amenityFilter}"];relation(around:${radius},${lat},${lon})[amenity~"${amenityFilter}"];);out center tags;`;

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 18000);
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(q)}`,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) continue;
      const data = await resp.json();
      return res.json(data);
    } catch (err) {
      continue;
    }
  }

  const userLat = Number(lat);
  const userLon = Number(lon);
  const fallbackPlaces = [
    { id: "fallback-hospital", lat: userLat + 0.004, lon: userLon + 0.004, tags: { name: "Community Medical Center", amenity: "hospital", phone: "(555) 555-0100" } },
    { id: "fallback-clinic", lat: userLat + 0.006, lon: userLon - 0.003, tags: { name: "Neighborhood Urgent Care", amenity: "clinic", phone: "(555) 555-0101" } },
    { id: "fallback-pharmacy", lat: userLat - 0.003, lon: userLon + 0.005, tags: { name: "Local Pharmacy Plus", amenity: "pharmacy", phone: "(555) 555-0102" } },
  ];
  res.json({ elements: fallbackPlaces, fallback: true });
});

export default router;
