import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { query } from "../db/pool.js";

const router = Router();
router.use(requireAuth);
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
export const FALLBACK_GEMINI_MODEL = "gemini-3.5-flash-lite";
const GROQ_HISTORY_MESSAGES = 4;
const GROQ_MESSAGE_CHAR_LIMIT = 1000;
const GROQ_MAX_OUTPUT_TOKENS = 500;

const SYSTEM_PROMPT = `You are the "Ask AI" health education assistant inside MedPath AI. Give useful, accurate, plain-language information about health topics.

Cover questions about conditions (including asthma), symptoms and common possible causes, tests, prevention, and general treatment approaches. For symptom-to-condition questions, give a short, non-exhaustive list of plausible causes, distinguish common from serious possibilities, and explain that symptoms alone cannot identify a diagnosis. Do not diagnose the user or estimate their personal likelihood of having a condition.

For medication questions, explain common uses and how the medicine or class works, typical side effects, important serious reactions, and relevant interaction cautions when known. Do not give personal dosing instructions or tell anyone to start, stop, or change a medicine; recommend checking with a pharmacist or clinician for personal advice. Be clear when information may vary by person or country.

If the user describes their own symptoms, answer the general health question instead of refusing or only redirecting. Explain possible causes in general terms, note what details a clinician may consider, and recommend the app's Symptom Check or a healthcare professional for personal assessment. For emergency warning signs or severe/worsening symptoms, advise urgent/emergency care.

Use concise paragraphs or bullets (usually 4-8 sentences). Do not claim a list of causes or side effects is exhaustive. End with a short disclaimer that the answer is educational, not a diagnosis or personal medical advice. Politely redirect unrelated questions to health topics. When search results are available, prefer official health agencies and academic medical sources and cite the returned sources.`;

export function buildOfflineMedicalAnswer(messages) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const prompt = String(lastUserMessage).trim();
  const lower = prompt.toLowerCase();

  const emergencySignals = [
    "chest pain", "trouble breathing", "difficulty breathing", "blue lips",
    "severe bleeding", "won't stop bleeding", "cant breathe", "seizure",
    "passed out", "unconscious", "suicidal", "self harm", "self-harm"
  ];

  if (emergencySignals.some((signal) => lower.includes(signal))) {
    return "This could be an emergency. Seek urgent or emergency care right away if symptoms are severe, worsening, or you are having trouble breathing, chest pain, fainting, severe bleeding, or a mental health crisis. Tell the clinician exactly what you are feeling and when it started, because symptom patterns matter. This is general educational guidance, not a diagnosis or personal medical advice. If you are in immediate danger or your symptoms are rapidly worsening, call emergency services now.";
  }

  if (/\basthma\b/.test(lower)) {
    return "Asthma is a long-term condition in which the airways can become inflamed and narrowed, making breathing harder. Common symptoms include wheezing, coughing, chest tightness, and shortness of breath; they can vary over time and may be triggered by things such as exercise, smoke, allergens, or respiratory infections. Clinicians can assess asthma using your history and breathing tests. Treatment plans vary, so discuss symptoms and medicines with a healthcare professional rather than changing medication on your own. Severe trouble breathing, difficulty speaking, or blue lips needs emergency care. This is educational information, not a diagnosis or personal medical advice.";
  }

  if (/\b(headaches?|migraines?)\b/.test(lower)) {
    return "Headaches can have many causes, including tension, migraine, illness, dehydration, sleep disruption, or medication effects; symptoms alone cannot identify the cause. A clinician may consider when it began, its pattern and severity, associated symptoms, and medicines you take. Seek emergency care for a sudden severe headache, or one with weakness, confusion, fainting, vision loss, fever with a stiff neck, or after a head injury. If headaches are new, frequent, worsening, or not improving, contact a healthcare professional. This is educational information, not a diagnosis or personal medical advice.";
  }

  if (/\b(fever|high temperature|temperature)\b/.test(lower)) {
    return "A fever is a temporary rise in body temperature and is often part of the immune response. Common causes include viral infections such as colds or flu, and sometimes bacterial infections; the temperature alone does not identify the cause. Rest and fluids may help with comfort. Seek medical advice for a very high or persistent fever, or sooner for a young infant, confusion, trouble breathing, severe dehydration, stiff neck, or rapidly worsening symptoms. This is educational information, not a diagnosis or personal medical advice.";
  }

  if (/\b(diabetes|blood sugar|glucose)\b/.test(lower)) {
    return "Diabetes is a group of conditions in which blood glucose stays too high because the body does not make enough insulin or cannot use it effectively. Type 1 and type 2 diabetes have different causes and care plans, and tests are needed to diagnose them. Persistent thirst, frequent urination, fatigue, or blurred vision can have many causes, so discuss them with a clinician. Do not start or change medication based on general information. This is educational information, not a diagnosis or personal medical advice.";
  }

  if (/\b(high blood pressure|hypertension|blood pressure)\b/.test(lower)) {
    return "High blood pressure means the force of blood against artery walls is repeatedly higher than recommended. It often causes no symptoms, so diagnosis usually depends on properly taken readings over time rather than how someone feels. Many factors can contribute, and a clinician can interpret readings in context and discuss lifestyle or treatment options. Seek urgent care for a very high reading with chest pain, severe shortness of breath, weakness, confusion, or vision changes. This is educational information, not a diagnosis or personal medical advice.";
  }

  if (/\b(cough|sore throat|throat pain)\b/.test(lower)) {
    return "Cough or sore throat can come from common viral infections, allergies, irritants, reflux, or other causes; symptoms alone cannot determine which one. Fluids and rest may ease mild symptoms. Contact a healthcare professional for severe or persistent symptoms, difficulty swallowing, dehydration, or a high fever; seek urgent care for trouble breathing, blue lips, or rapidly worsening symptoms. This is educational information, not a diagnosis or personal medical advice.";
  }

  const questionSummary = prompt.replace(/\s+/g, " ").slice(0, 120);
  return `You asked: “${questionSummary}”. I'm in offline mode, so I can't give a reliable topic-specific answer right now. The AI provider is unavailable; please try again later or contact a healthcare professional for personal medical advice. Seek urgent care for severe or rapidly worsening symptoms.`;
}

export function getPrimaryAiProvider({ geminiKey, groqKey, anthropicKey }) {
  if (anthropicKey) return "anthropic";
  if (groqKey) return "groq";
  if (geminiKey) return "gemini";
  return "offline";
}

export function compactGroqHistory(messages) {
  return messages
    .filter((message) => message?.role === "user" || message?.role === "assistant")
    .slice(-GROQ_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: String(message.content ?? "").slice(-GROQ_MESSAGE_CHAR_LIMIT),
    }));
}

router.post("/chat", async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const groqModel = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  const primaryProvider = getPrimaryAiProvider({ geminiKey, groqKey, anthropicKey });

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required." });
  }
  if (!geminiKey && !groqKey && !anthropicKey) {
    const text = buildOfflineMedicalAnswer(messages);
    return saveChatResponse(req.user.id, messages, text, res, [], { provider: "offline", mode: "offline_fallback" });
  }

  if (geminiKey && primaryProvider === "gemini") {
    const geminiModels = [...new Set([geminiModel, FALLBACK_GEMINI_MODEL])];
    for (const model of geminiModels) {
      let response;
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
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
      } catch (err) {
        console.error(`Gemini ${model} request failed:`, err.message);
        break;
      }

      if (response.ok) {
        const data = await response.json();
        const { text, sources } = extractGeminiResponse(data);
        if (text) return saveChatResponse(req.user.id, messages, text, res, sources, { provider: "gemini" });
      } else {
        const err = await response.json().catch(() => ({}));
        console.error(`Gemini ${model} API error:`, err?.error?.message || response.status);
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || model === geminiModels[geminiModels.length - 1]) break;
        console.warn(`Retrying Gemini request with ${FALLBACK_GEMINI_MODEL}.`);
      }
    }

    if (!groqKey && !anthropicKey) {
      const fallbackText = buildOfflineMedicalAnswer(messages);
      return saveChatResponse(req.user.id, messages, fallbackText, res, [], { provider: "offline", mode: "offline_fallback" });
    }
  }

  // Try Groq next when its free-tier key is configured.
  if (groqKey && primaryProvider === "groq") {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: groqModel,
          max_tokens: GROQ_MAX_OUTPUT_TOKENS,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...compactGroqHistory(messages),
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error("Groq API error:", err);
        // Fall through to Anthropic if available
        if (!anthropicKey) {
          const fallbackText = buildOfflineMedicalAnswer(messages);
          return saveChatResponse(req.user.id, messages, fallbackText, res, [], { provider: "offline", mode: "offline_fallback" });
        }
      } else {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim() || "I wasn't able to generate a response.";
        return saveChatResponse(req.user.id, messages, text, res, [], { provider: "groq" });
      }
    } catch (err) {
      console.error("Groq error:", err);
      if (!anthropicKey) {
        const fallbackText = buildOfflineMedicalAnswer(messages);
        return saveChatResponse(req.user.id, messages, fallbackText, res, [], { provider: "offline", mode: "offline_fallback" });
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
        const fallbackText = buildOfflineMedicalAnswer(messages);
        return saveChatResponse(req.user.id, messages, fallbackText, res, [], { provider: "offline", mode: "offline_fallback" });
      }

      const data = await response.json();
      const text = (data.content || [])
        .map((block) => (block.type === "text" ? block.text : ""))
        .filter(Boolean)
        .join("\n")
        .trim();

      return saveChatResponse(req.user.id, messages, text, res, [], { provider: "anthropic" });
    } catch (err) {
      console.error("AI chat error:", err);
      const fallbackText = buildOfflineMedicalAnswer(messages);
      return saveChatResponse(req.user.id, messages, fallbackText, res, [], { provider: "offline", mode: "offline_fallback" });
    }
  }

  const fallbackText = buildOfflineMedicalAnswer(messages);
  return saveChatResponse(req.user.id, messages, fallbackText, res, [], { provider: "offline", mode: "offline_fallback" });
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

async function saveChatResponse(userId, messages, text, res, sources = [], extra = {}) {
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
    return res.json({ text, conversationId, sources, ...extra });
  } catch (err) {
    console.error("AI response persistence error:", err);
    return res.json({ text, sources, ...extra });
  }
}

const PROVIDER_SEARCH_TAGS = {
  all: [
    ["amenity", "hospital|clinic|pharmacy|doctors|doctor|dentist|urgent_care|laboratory|medical_center|medical_centre"],
    ["healthcare", "hospital|clinic|pharmacy|doctor|dentist|urgent_care|laboratory|medical_centre|health_centre"],
    ["shop", "chemist|medical_supply"],
  ],
  hospital: [["amenity", "hospital"], ["healthcare", "hospital"]],
  clinic: [["amenity", "clinic"], ["healthcare", "clinic|health_centre"]],
  pharmacy: [["amenity", "pharmacy"], ["healthcare", "pharmacy"], ["shop", "chemist"]],
  urgent_care: [["amenity", "urgent_care"], ["healthcare", "urgent_care"]],
  laboratory: [["amenity", "laboratory"], ["healthcare", "laboratory"]],
  doctor: [["amenity", "doctors|doctor|dentist"], ["healthcare", "doctor|dentist"]],
};

export function buildNearbyProvidersQuery({ lat, lon, radius = 5000, type = "all" }) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  const searchRadius = Number(radius);
  const tags = PROVIDER_SEARCH_TAGS[String(type).toLowerCase()];

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new RangeError("Latitude must be between -90 and 90.");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new RangeError("Longitude must be between -180 and 180.");
  }
  if (!Number.isFinite(searchRadius) || searchRadius < 250 || searchRadius > 50000) {
    throw new RangeError("Radius must be between 250 and 50000 meters.");
  }
  if (!tags) throw new RangeError("Unsupported provider type.");

  const selectors = tags.map(([tag, pattern]) =>
    `nwr(around:${searchRadius},${latitude},${longitude})[${tag}~"^(${pattern})$",i];`
  );
  return `[out:json][timeout:25];(${selectors.join("")});out center tags 500;`;
}

// Overpass API proxy — avoids browser CORS/rate-limit issues
router.get("/nearby-providers", async (req, res) => {
  let overpassQuery;
  try {
    overpassQuery = buildNearbyProvidersQuery(req.query);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 28000);
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "MedPathAI/1.0 (https://medpath-ai-frontend-project.vercel.app)",
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        const detail = (await resp.text().catch(() => "")).slice(0, 160).replace(/\s+/g, " ");
        console.warn(`Overpass ${endpoint} returned ${resp.status}: ${detail}`);
        continue;
      }
      const data = await resp.json();
      return res.json(data);
    } catch (err) {
      console.warn(`Overpass request to ${endpoint} failed: ${err.message} (${err.cause?.code || "no-cause-code"}) ${err.cause?.message || ""}`);
      continue;
    }
  }

  res.status(503).json({ error: "Live provider search is temporarily unavailable. Please try again." });
});

export default router;
