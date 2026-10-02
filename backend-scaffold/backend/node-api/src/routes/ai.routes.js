import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { query } from "../db/pool.js";

const router = Router();
router.use(requireAuth);

const SYSTEM_PROMPT = `You are the "Ask AI" health education assistant inside MedPath AI. Give useful, accurate, plain-language information about health topics.

Cover questions about conditions (including asthma), symptoms and common possible causes, tests, prevention, and general treatment approaches. For symptom-to-condition questions, give a short, non-exhaustive list of plausible causes, distinguish common from serious possibilities, and explain that symptoms alone cannot identify a diagnosis. Do not diagnose the user or estimate their personal likelihood of having a condition.

For medication questions, explain common uses and how the medicine or class works, typical side effects, important serious reactions, and relevant interaction cautions when known. Do not give personal dosing instructions or tell anyone to start, stop, or change a medicine; recommend checking with a pharmacist or clinician for personal advice. Be clear when information may vary by person or country.

If the user describes their own symptoms, answer the general health question instead of refusing or only redirecting. Explain possible causes in general terms, note what details a clinician may consider, and recommend the app's Symptom Check or a healthcare professional for personal assessment. For emergency warning signs or severe/worsening symptoms, advise urgent/emergency care.

Use concise paragraphs or bullets (usually 4-8 sentences). Do not claim a list of causes or side effects is exhaustive. End with a short disclaimer that the answer is educational, not a diagnosis or personal medical advice. Politely redirect unrelated questions to health topics. When search results are available, prefer official health agencies and academic medical sources and cite the returned sources.`;

router.post("/chat", async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required." });
  }
  if (!geminiKey && !groqKey && !anthropicKey) {
    return res.status(503).json({
      code: "AI_PROVIDER_NOT_CONFIGURED",
      error: "Ask AI needs a Gemini, Groq, or Anthropic API key configured on the server.",
    });
  }

  if (geminiKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: messages.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: String(message.content ?? "") }],
          })),
          tools: [{ google_search: {} }],
          generationConfig: { maxOutputTokens: 1000 },
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error("Gemini API error:", err?.error?.message || response.status);
        if (!groqKey && !anthropicKey) {
          return res.status(response.status).json({ error: err?.error?.message || "Gemini request failed." });
        }
      } else {
        const data = await response.json();
        const { text, sources } = extractGeminiResponse(data);
        if (text) return saveChatResponse(req.user.id, messages, text, res, sources);
        if (!groqKey && !anthropicKey) {
          return res.status(502).json({ error: "Gemini returned no answer. Please try again." });
        }
      }
    } catch (err) {
      console.error("Gemini error:", err.message);
      if (!groqKey && !anthropicKey) {
        return res.status(502).json({ error: "Could not reach the Gemini service. Please try again." });
      }
    }
  }

  // Try Groq next when its free-tier key is configured.
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

  return res.status(503).json({ error: "No configured AI provider could answer this request." });
});

export function extractGeminiResponse(data) {
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts || [])
    .map((part) => part.text || "")
    .join("")
    .trim();
  const sources = [];
  const seenUrls = new Set();

  for (const chunk of candidate?.groundingMetadata?.groundingChunks || []) {
    const source = chunk.web;
    if (source?.uri && !seenUrls.has(source.uri)) {
      seenUrls.add(source.uri);
      sources.push({ title: source.title || source.uri, url: source.uri });
    }
  }

  return { text, sources: sources.slice(0, 5) };
}

async function saveChatResponse(userId, messages, text, res, sources = []) {
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
    return res.json({ text, conversationId, sources });
  } catch (err) {
    console.error("AI response persistence error:", err);
    return res.json({ text, sources });
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
