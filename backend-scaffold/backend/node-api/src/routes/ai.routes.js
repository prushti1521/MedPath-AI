import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

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
        return res.json({ text });
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

      return res.json({ text });
    } catch (err) {
      console.error("AI chat error:", err);
      return res.status(502).json({ error: "Could not reach the AI service. Please try again." });
    }
  }

  return res.status(503).json({ error: "AI service not configured. Add GROQ_API_KEY (free at console.groq.com) or ANTHROPIC_API_KEY to the server environment." });
});

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

  res.status(502).json({ error: "Overpass API unavailable. Showing demo results." });
});

export default router;
