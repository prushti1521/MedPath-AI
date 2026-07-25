# MedPath AI — backend scaffold

This is a real, runnable-shape scaffold for the backend described in the
project spec — not a toy. It hasn't been executed or tested in this
environment (no network/Docker access here), so treat it as a strong
starting point to run locally, not a verified working build.

## Architecture

```
backend/
├── docker-compose.yml       # Postgres (pgvector) + Redis + both services
├── .env.example
├── node-api/                 # Express gateway: auth, profiles, symptoms,
│                              # providers/appointments, medications
│   └── src/
│       ├── index.js
│       ├── db/ (pool.js, schema.sql)
│       ├── middleware/auth.js       # JWT + role-based access control
│       └── routes/*.routes.js
└── ai-service/                # FastAPI: triage, RAG-based Ask AI,
    ├── main.py                 # interaction checking, OCR
    ├── triage.py
    ├── rag.py
    ├── interactions.py
    └── ocr.py
```

**Why two services instead of one:** the Node API owns request handling,
auth, and Postgres CRUD — things Express/JS do well. The Python service
owns anything ML/NLP-heavy (LLM calls, embeddings, OCR) where Python's
ecosystem (sentence-transformers, pytesseract, the Anthropic SDK) is the
natural fit. The Node API calls the AI service over HTTP for triage,
Ask AI, and interaction checks.

## Running it locally

1. `cp .env.example .env` and fill in `ANTHROPIC_API_KEY`, `JWT_SECRET`, `POSTGRES_PASSWORD`.
2. `docker compose up --build`
3. Node API on `http://localhost:4000`, AI service on `http://localhost:8000`, Postgres on `5432`.
4. Point the frontend's `fetch` calls at `http://localhost:4000` instead of directly at the Anthropic API.

## What's real vs. what needs work before production

**Real and reasonably complete:**
- Postgres schema covering every entity in the spec (users, profiles,
  allergies, conditions, medications, symptom sessions/timeline, reports,
  prescriptions, providers, appointments, conversations, notifications).
- JWT auth with bcrypt hashing, role-based middleware, rate limiting, helmet.
- A layered triage flow: hard-coded red-flag/crisis keyword matching that
  always wins (so an LLM outage can't silently miss an emergency), plus
  a rule-based severity score, with an optional LLM pass that can only
  escalate urgency, never downgrade it.
- A genuine RAG shape for Ask AI: embed the question, retrieve from a
  `knowledge_chunks` pgvector table, answer only from retrieved context.

**Needs real work before this touches real patients:**
- `knowledge_chunks` is defined but empty — you'd need to actually ingest
  trusted medical sources (e.g. MedlinePlus, CDC, professional society
  guidelines) with a proper licensing review.
- `KNOWN_INTERACTIONS` in `interactions.py` is a five-pair sample, not a
  licensed drug database (e.g. FDB, Multum, RxNorm/DrugBank) — do not
  ship the sample table as-is.
- OCR uses Tesseract, which struggles with handwritten prescriptions;
  a cloud OCR service will do meaningfully better.
- No tests, no migrations tooling (just a raw `schema.sql`), no CI/CD,
  no audit logging, no encryption-at-rest configuration, no HIPAA/GDPR
  compliance work — all called out in the original spec as things to add.
- The triage LLM escalation logic in `triage.py` has a TODO where the
  actual JSON parsing/validation of the model's response needs to be
  filled in before it does anything beyond the rule-based score.

## Security notes

- Passwords are hashed with bcrypt (cost 12); never log or store raw passwords.
- JWT secret and Anthropic API key must never be committed — they're
  environment variables sourced from `.env`, which is gitignored.
- Rate limiting is global; add a stricter limiter on `/auth/login` before production.
- Input validation uses `zod` in the Node API; extend it to every route
  that accepts user input, not just auth.
