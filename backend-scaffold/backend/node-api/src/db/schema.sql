-- MedPath AI — core schema
-- Requires: CREATE EXTENSION IF NOT EXISTS vector;  (pgvector, for RAG embeddings)
-- Requires: CREATE EXTENSION IF NOT EXISTS pgcrypto; (for gen_random_uuid())

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'patient', -- patient | caregiver | clinician | admin
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  last_login_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  logout_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE medical_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  date_of_birth DATE,
  age SMALLINT,
  sex TEXT,
  height_cm NUMERIC(5,1),
  weight_kg NUMERIC(5,1),
  blood_type TEXT,
  phone_number TEXT,
  profile_photo_path TEXT,
  insurance_provider TEXT,
  emergency_contact TEXT,
  address TEXT,
  country TEXT,
  preferred_language TEXT,
  family_history TEXT,
  lifestyle_notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES medical_profiles(id) ON DELETE CASCADE,
  substance TEXT NOT NULL,
  reaction TEXT,
  severity TEXT -- mild | moderate | severe
);

CREATE TABLE chronic_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES medical_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  diagnosed_on DATE,
  notes TEXT
);

CREATE TABLE medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES medical_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  started_on DATE,
  source TEXT DEFAULT 'manual', -- manual | ocr
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE symptom_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  free_text TEXT,
  answers JSONB NOT NULL DEFAULT '{}',
  urgency_level TEXT NOT NULL, -- emergency | urgent | routine | selfcare
  reasons JSONB NOT NULL DEFAULT '[]',
  crisis_flag BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE symptom_timeline_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  severity SMALLINT CHECK (severity BETWEEN 0 AND 10),
  symptom_text TEXT,
  body_location TEXT,
  notes TEXT,
  temperature_f NUMERIC(4,1),
  heart_rate SMALLINT,
  blood_pressure_systolic SMALLINT,
  blood_pressure_diastolic SMALLINT,
  blood_sugar NUMERIC(5,1),
  weight_kg NUMERIC(5,1),
  sleep_hours NUMERIC(3,1),
  water_intake_liters NUMERIC(4,1),
  exercise_minutes SMALLINT,
  stress_level SMALLINT,
  mood TEXT,
  source TEXT DEFAULT 'manual' -- manual | apple_health | google_fit | fitbit
);

CREATE TABLE medical_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  report_type TEXT, -- lab | imaging | discharge_summary | other
  extracted_summary JSONB, -- { diagnoses, medications, abnormal_values, follow_up_questions }
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  category TEXT, -- medical_report | prescription | insurance | other
  metadata JSONB DEFAULT '{}',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE medical_history_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  condition TEXT NOT NULL,
  description TEXT,
  started_on DATE,
  ended_on DATE,
  status TEXT, -- active | resolved | monitoring
  notes TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- appointment | medication | follow_up | custom
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  repeat_rule TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  ocr_result JSONB, -- { medication, dosage, frequency, duration, warnings }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE healthcare_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialty TEXT,
  address TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  rating NUMERIC(2,1),
  accepts_insurance TEXT[], -- list of insurance plan names/ids
  phone TEXT
);

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES healthcare_providers(id),
  scheduled_for TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | completed | cancelled
  checklist JSONB NOT NULL DEFAULT '[]',
  questions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'ask_ai', -- symptom_check | ask_ai
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- user | assistant
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- appointment_reminder | follow_up | medication_reminder
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  send_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RAG knowledge base (requires pgvector extension)
-- CREATE EXTENSION IF NOT EXISTS vector;
-- CREATE TABLE knowledge_chunks (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   source TEXT NOT NULL,
--   title TEXT,
--   content TEXT NOT NULL,
--   embedding vector(1536),
--   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
-- );
-- CREATE INDEX ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX idx_users_is_deleted ON users(is_deleted);
CREATE INDEX idx_users_last_login ON users(last_login_at);
CREATE INDEX idx_login_history_user ON login_history(user_id);
CREATE INDEX idx_login_history_timestamp ON login_history(login_at);
CREATE INDEX idx_symptom_sessions_user ON symptom_sessions(user_id);
CREATE INDEX idx_timeline_user_time ON symptom_timeline_entries(user_id, recorded_at);
CREATE INDEX idx_medications_profile ON medications(profile_id);
CREATE INDEX idx_appointments_user ON appointments(user_id);
CREATE INDEX idx_ai_responses_conversation ON ai_responses(conversation_id);
