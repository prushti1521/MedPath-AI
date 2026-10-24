# MedPath AI

MedPath AI helps users organize health information, prepare for appointments, manage medications, find nearby providers, and review medical reports. It provides educational support and does not replace a clinician or diagnose medical conditions.

## Features

- **Home dashboard:** health status, upcoming appointments, medication reminders, recent symptoms and reports, risk alerts, and suggestions.
- **Appointment preparation:** save a visit location and date/time, then use a checklist and questions for the visit. Edit or remove the scheduled details without deleting the prep checklist.
- **Reports:** upload PDF, JPEG, PNG, or WebP files up to 10 MB; view extracted findings, download the original file, and delete reports.
- **Report extraction:** Gemini can extract key findings, diagnoses, medications, abnormal values, and questions for a clinician.
- **Symptom check and timeline:** record symptoms and view health-history trends.
- **Medication management:** manage medication information and reminders.
- **Provider search:** search for nearby healthcare providers.
- **Ask AI:** general health education through a configured provider, with limited offline guidance for supported topics.
- **Profile:** manage personal details, allergies, and conditions.

Reports are user-specific. Uploaded files and extracted summaries are stored in PostgreSQL. The original file can be downloaded with its original filename. Redact personal identifiers before sending documents for Gemini extraction. Review extracted content against the original report with a clinician. Lab values shown on the dashboard are context only; they do not change the numerical health score.

## Authentication and Safety

- Protected API routes use JWT bearer tokens.
- Passwords are hashed with bcrypt.
- Uploaded reports and download/delete operations are scoped to the signed-in user.
- Health content is educational, not diagnosis or personal treatment advice.
- Seek urgent care for severe or rapidly worsening symptoms.

## Tech Stack

### Languages

- JavaScript (ES modules and JSX) for the frontend and Node API
- Python for the FastAPI AI service
- SQL for PostgreSQL schema and queries

### Frontend

- React 19 and React DOM, with Vite 8 and the React plugin for development and production builds
- Recharts for visualizations and Lucide React for icons
- CSS and inline component styles; no CSS framework
- `react-router-dom`, Chart.js, and `react-chartjs-2` are declared dependencies but are not currently imported by the frontend

### Backend and API

- Node.js 22 and Express 4 for the REST API
- PostgreSQL access through `pg` and parameterized SQL queries; no ORM
- JWT authentication and bcrypt password hashing
- Multer file uploads and Zod request validation
- CORS, Helmet, Express rate limiting, and dotenv configuration
- Node's built-in `fetch` for external AI and geocoding APIs

### Python AI service

- Python with FastAPI, Uvicorn, and Pydantic for the project's separate AI service
- Anthropic Python SDK for Claude-powered triage, report OCR structuring, RAG answers, and medication-interaction fallback
- Tesseract OCR through `pytesseract` and Pillow image processing; the Tesseract executable must also be installed
- `sentence-transformers` embeddings with `psycopg` and `pgvector` for the RAG vector-search implementation
- `python-dotenv` for environment configuration; this service is not part of the current Render production deployment

### Database and storage

- PostgreSQL stores accounts, login history, profiles, allergies, conditions, symptoms, appointments, reminders, medications, reports, and AI conversations
- `pg` and `psycopg` connect the Node and Python services to PostgreSQL
- `JSONB` stores flexible checklist and extracted-report data; `BYTEA` stores original report files
- `pgcrypto` provides UUID generation. `pgvector` is included for the RAG implementation, but its extension and knowledge-base table are currently commented out in the baseline schema and must be enabled/populated for retrieval to work

### AI services

- **Currently configured in production:** Google Gemini API, called through its Generative Language REST API using Node's built-in `fetch` and `GEMINI_API_KEY`, powers Ask AI and report extraction. Ask AI defaults to `gemini-3.8-flash`; report extraction can retry with `gemini-3.5-flash-lite` when the primary model is temporarily busy or rate-limited. Free-tier quotas and availability limits apply.
- **Optional Node API integrations:** Groq and Anthropic adapters are present in the code, but their keys are not configured in the current Render production environment.
- **Python AI service:** selected routes can connect to it through `AI_SERVICE_URL`; its Claude-powered features require an Anthropic key. It is not currently deployed to Render.
- Ask AI uses limited offline guidance for supported topics when no online provider can answer.

### External data and geocoding

- OpenStreetMap Nominatim provides location search/geocoding for provider discovery

### Deployment and validation

- Vercel hosts the React frontend; Render hosts the Node API and PostgreSQL database
- Docker builds the Render API from `node:22-alpine`; a Docker Compose file describes local PostgreSQL/pgvector, Redis, Node API, and Python service containers
- Redis is declared in the local Compose configuration but is not currently used by the API. The Python service directory does not currently include a Dockerfile, so its Compose container needs one before it can be built
- `npm test` runs API tests; `npm run build` creates the frontend production build

## Prerequisites

- Node.js 22 or newer
- PostgreSQL
- npm
- Python 3.8 or newer to run the FastAPI AI service

## Local Development

1. Clone the repository and create a local PostgreSQL database:

```bash
git clone https://github.com/prushti1521/MedPath-AI.git
cd MedPath-AI
createdb medpath_ai
```

2. Configure `backend-scaffold/backend/node-api/.env` with local values:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/medpath_ai
JWT_SECRET=replace-with-a-long-random-secret
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
GEMINI_API_KEY=your-Google-AI-Studio-key
```

Optional provider settings include `GEMINI_MODEL`, `GEMINI_OCR_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL`, `ANTHROPIC_API_KEY`, and `AI_SERVICE_URL`. Never commit `.env` files, database URLs, passwords, or API keys.

3. Start the Node API:

```bash
cd backend-scaffold/backend/node-api
npm install
npm run dev
```

The API listens on port `4000`. At startup it applies the baseline schema to an empty database and ensures the `login_history` audit table exists. Appointment and report routes use idempotent migrations for added columns.

4. In another terminal, start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL printed in the terminal, normally `http://localhost:5173`. In development the frontend defaults to `http://localhost:4000`; set `VITE_API_BASE` to override it.

### Python AI Service

The Node API handles Gemini-based Ask AI and report extraction directly. Symptom, medication-interaction, and RAG conversation routes can call the FastAPI service via `AI_SERVICE_URL` (defaults to `http://localhost:8000`). The Python service's current OCR/RAG implementation uses Anthropic and requires a valid Anthropic API key. The service is part of the project but is not currently deployed to Render. See `backend-scaffold/backend/docker-compose.yml` and `backend-scaffold/backend/ai-service/requirements.txt` for the local setup.

## Project Structure

```text
.
├── frontend/
│   ├── src/App.jsx                  React pages and workflows
│   ├── src/global.css              Global styling
│   └── package.json                Vite scripts and frontend dependencies
├── backend-scaffold/backend/
│   ├── node-api/
│   │   ├── src/index.js            Express server and route mounting
│   │   ├── src/db/schema.sql       PostgreSQL schema
│   │   └── src/routes/             Authenticated API route handlers
│   └── ai-service/                 Python FastAPI AI service
│       ├── main.py
│       └── triage.py, interactions.py, rag.py, ocr.py
├── Dockerfile                      Render Node API image
└── render.yaml                     Render API and database configuration
```

## API Routes

The Node API listens on port `4000`. Protected routes require `Authorization: Bearer <token>`.

- `GET /health`, `GET /db-health` - service and database checks
- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `DELETE /auth/account`
- `GET /profile`, `PATCH /profile`
- `GET /dashboard`
- `GET /history/medical`, `POST /history/medical`
- `GET /history/uploaded-files`, `POST /history/uploaded-files`
- `POST /symptoms/check`, `GET /symptoms/timeline`
- `GET /providers/appointments`, `POST /providers/appointments`, `PATCH /providers/appointments/:id`
- `GET /reports` - list the signed-in user's reports
- `POST /reports/upload` - save and extract a report
- `GET /reports/:id/file` - download the original file; ownership is checked
- `DELETE /reports/:id` - delete the report and extracted summary
- `POST /ai/chat` - Ask AI conversation
- `GET /medications`, `POST /medications`, `DELETE /medications/:id`

## Database

PostgreSQL stores user profiles, login audit history, medical history, symptoms, appointments, medications, reminders, reports, uploaded-file metadata, and AI conversations. Appointment checklists and report extractions use JSONB. Original report bytes, MIME type, and filename are stored in `medical_reports`, so downloads survive API redeploys.

The dashboard includes extracted report findings as context. It does not calculate the numeric health score from lab values.

## Security and Privacy

- Passwords are hashed with bcrypt; protected APIs use JWT bearer authentication.
- Login/logout events are recorded with timestamps, request IP, and user-agent for account audit history.
- SQL queries use parameters, and report list/download/delete queries are scoped to the signed-in user.
- Report uploads accept PDF, JPEG, PNG, or WebP, up to 10 MB.
- Uploaded report files are sent to Gemini for extraction. Redact identifiers before upload and review extracted text against the source document.
- Never commit secrets. Set production keys in Render's environment settings.

## Tests and Builds

Run the Node API test suite:

```bash
cd backend-scaffold/backend/node-api
npm test
```

Build the frontend:

```bash
cd frontend
npm run build
```

## CI/CD

GitHub Actions runs the pipeline on every push to `main`.

- **CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on pushes to `main` and on pull requests: backend `npm ci` and `npm test`, frontend `npm install` and `npm run build`, then a Docker build of the API image.
- **CD** ([`.github/workflows/cd.yml`](.github/workflows/cd.yml)) runs only after CI succeeds on `main`: it triggers a Render deploy for the API through a deploy hook and deploys the frontend to Vercel with the Vercel CLI.
- Render's **Auto-Deploy** is set to Off and Vercel's git auto-deploy is disabled in `frontend/vercel.json`, so each push deploys once, through the pipeline.

Required repository secrets (Settings -> Secrets and variables -> Actions):

| Secret | Purpose |
| --- | --- |
| `RENDER_DEPLOY_HOOK_URL` | Render deploy hook URL for the API service |
| `VERCEL_TOKEN` | Vercel access token scoped to the frontend project |

Never commit these values. If one is exposed, regenerate it and update the secret.

## Deployment

- **Frontend:** Vercel deploys the `frontend` directory at `https://medpath-ai-frontend-project.vercel.app`, triggered by the CD workflow.
- **API and database:** Render runs the Node API and PostgreSQL. The current API base URL is `https://medpath-api-yxav.onrender.com`. The CD workflow triggers the deploy.
- Push changes to `main`; CI runs first and CD deploys when it passes. To deploy manually, use **Manual Deploy -> Deploy latest commit** in the Render dashboard.
- Render's free service may spin down while idle, so its first response after inactivity can be delayed.
- Set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, and AI provider keys in the hosting provider's environment settings, not in this README.

## Troubleshooting

- **API cannot connect to PostgreSQL:** verify `DATABASE_URL` and database availability in Render/local PostgreSQL.
- **Browser CORS errors:** set `CORS_ORIGIN` to include the frontend origin, then redeploy the API.
- **Ask AI is offline:** check the configured provider key and free-tier quota. Offline responses cover only supported common topics.
- **Report has no extracted summary:** the upload may still be saved; Gemini may be unavailable or rate-limited. Check API logs and retry later.
- **Report file cannot download:** downloads require the signed-in account that owns the report. Older files stored before database-backed file storage may no longer be available after an ephemeral service restart.

## Medical Disclaimer

MedPath AI provides general educational information only. It is not a diagnosis, treatment recommendation, or substitute for care from a qualified clinician. Always review AI-generated report information with a healthcare professional.
