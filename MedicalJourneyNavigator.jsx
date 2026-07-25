import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Home, Stethoscope, UserCircle, Activity, CalendarCheck, MapPin,
  MessageCircleQuestion, AlertTriangle, Phone, ChevronRight, ChevronLeft,
  Check, X, Plus, Trash2, Upload, Search, Star, Clock, ShieldAlert,
  HeartPulse, Sparkles, Send, Menu, Languages, FileText, Pill as PillIcon
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

/* ---------------------------------------------------------------
   DESIGN TOKENS
   Palette: cool clinical paper + deep teal ink, warm clay accent for
   human/guidance moments, semantic urgency ramp for triage.
----------------------------------------------------------------*/
const T = {
  paper: "#F1F4F1",
  paperRaised: "#FFFFFF",
  ink: "#122622",
  inkSoft: "#4B5C58",
  line: "#DCE3DE",
  teal: "#1F6F63",
  tealDeep: "#123832",
  clay: "#C97D45",
  clayDeep: "#8C5225",
  sage: "#4C8A6A",     // self-care
  blue: "#3E7CB1",     // routine
  amber: "#C98A2B",    // urgent
  red: "#B9382A",      // emergency
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap');`;

const URGENCY = {
  emergency: { label: "Emergency", color: T.red, order: 3, action: "Call emergency services or go to the ER now.", icon: ShieldAlert },
  urgent: { label: "Urgent", color: T.amber, order: 2, action: "Seek urgent care today.", icon: AlertTriangle },
  routine: { label: "Routine", color: T.blue, order: 1, action: "Schedule an appointment within a few days.", icon: CalendarCheck },
  selfcare: { label: "Self-care", color: T.sage, order: 0, action: "Home care is likely appropriate — watch for warning signs.", icon: HeartPulse },
};

const RED_FLAG_WORDS = [
  "chest pain", "can't breathe", "cant breathe", "trouble breathing", "difficulty breathing",
  "stroke", "face drooping", "slurred speech", "worst headache of my life",
  "severe bleeding", "won't stop bleeding", "wont stop bleeding", "unconscious",
  "passed out", "suicidal", "want to die", "kill myself", "self harm", "self-harm",
  "crushing pain", "blue lips", "seizure"
];

const CRISIS_WORDS = ["suicidal", "want to die", "kill myself", "self harm", "self-harm"];

/* ---------------------------------------------------------------
   SIMPLE TRIAGE ENGINE (rule-based demo — not real clinical logic)
----------------------------------------------------------------*/
function runTriage(answers) {
  const text = (answers.freeText || "").toLowerCase();
  const isCrisis = CRISIS_WORDS.some((w) => text.includes(w));
  const isRedFlag = RED_FLAG_WORDS.some((w) => text.includes(w));

  if (isCrisis) {
    return { level: "emergency", crisis: true, reasons: ["Message suggests you may be in crisis right now."] };
  }
  if (isRedFlag) {
    return { level: "emergency", crisis: false, reasons: ["Your description includes a symptom that can signal a medical emergency."] };
  }

  const severity = Number(answers.severity || 0);
  const duration = answers.duration;
  const fever = answers.fever;
  const pregnant = answers.pregnant === "yes";
  const reasons = [];
  let score = 0;

  if (severity >= 8) { score += 3; reasons.push("Pain or discomfort rated very high (8+/10)."); }
  else if (severity >= 5) { score += 2; reasons.push("Moderate severity reported (5–7/10)."); }
  else if (severity >= 1) { score += 1; }

  if (fever === "high") { score += 2; reasons.push("High fever reported."); }
  if (duration === "sudden") { score += 2; reasons.push("Symptom started suddenly."); }
  if (pregnant) { score += 1; reasons.push("Pregnancy noted — a lower threshold for caution applies."); }

  let level = "selfcare";
  if (score >= 5) level = "urgent";
  else if (score >= 3) level = "routine";
  else if (score >= 1) level = "routine";
  else level = "selfcare";

  if (score >= 6) level = "urgent";

  return { level, crisis: false, reasons: reasons.length ? reasons : ["Nothing in your answers points to an urgent pattern."] };
}

/* ---------------------------------------------------------------
   SMALL UI PRIMITIVES
----------------------------------------------------------------*/
function Card({ children, style, className }) {
  return (
    <div
      className={className}
      style={{
        background: T.paperRaised,
        border: `1px solid ${T.line}`,
        borderRadius: 16,
        padding: "20px 22px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Pill({ children, color = T.teal, bg }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12.5,
        fontWeight: 600,
        color,
        background: bg || `${color}18`,
        padding: "4px 10px",
        borderRadius: 999,
        letterSpacing: 0.2,
      }}
    >
      {children}
    </span>
  );
}

function PrimaryButton({ children, onClick, disabled, style, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: disabled ? "#B9C4C0" : T.tealDeep,
        color: "#fff",
        border: "none",
        borderRadius: 10,
        padding: "11px 18px",
        fontSize: 14.5,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "Inter, sans-serif",
        transition: "opacity .15s",
        ...style,
      }}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, style, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "transparent",
        color: T.tealDeep,
        border: `1px solid ${T.line}`,
        borderRadius: 10,
        padding: "10px 16px",
        fontSize: 14.5,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "Inter, sans-serif",
        ...style,
      }}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

function SectionTitle({ eyebrow, title, sub }) {
  return (
    <div style={{ marginBottom: 22 }}>
      {eyebrow && (
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.clayDeep, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
          {eyebrow}
        </div>
      )}
      <h1 style={{ fontFamily: "Fraunces, serif", fontWeight: 500, fontSize: 30, color: T.ink, margin: 0, lineHeight: 1.15 }}>
        {title}
      </h1>
      {sub && <p style={{ color: T.inkSoft, fontSize: 15, marginTop: 8, maxWidth: 560, lineHeight: 1.55 }}>{sub}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------
   CARE COMPASS — signature gauge component
----------------------------------------------------------------*/
function CareCompass({ level }) {
  const order = ["selfcare", "routine", "urgent", "emergency"];
  const idx = order.indexOf(level);
  const info = URGENCY[level];
  return (
    <div>
      <div style={{ display: "flex", gap: 4, height: 10, borderRadius: 999, overflow: "hidden" }}>
        {order.map((key, i) => (
          <div
            key={key}
            style={{
              flex: 1,
              background: i <= idx ? URGENCY[key].color : T.line,
              transition: "background .3s",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        {order.map((key) => (
          <span key={key} style={{ fontSize: 11, fontWeight: 600, color: key === level ? URGENCY[key].color : T.inkSoft, opacity: key === level ? 1 : 0.55 }}>
            {URGENCY[key].label}
          </span>
        ))}
      </div>
      <div
        style={{
          marginTop: 18,
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          padding: "16px 18px",
          borderRadius: 12,
          background: `${info.color}14`,
          border: `1px solid ${info.color}40`,
        }}
      >
        <info.icon size={22} color={info.color} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 700, color: info.color, fontSize: 15.5 }}>{info.label}</div>
          <div style={{ color: T.ink, fontSize: 14, marginTop: 3 }}>{info.action}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   EMERGENCY BANNER
----------------------------------------------------------------*/
function EmergencyBanner({ crisis, onDismiss }) {
  return (
    <div
      role="alert"
      style={{
        background: T.red,
        color: "#fff",
        borderRadius: 14,
        padding: "18px 20px",
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        marginBottom: 20,
      }}
    >
      <ShieldAlert size={26} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 16.5 }}>
          {crisis ? "You deserve immediate support" : "This may be a medical emergency"}
        </div>
        <p style={{ margin: "6px 0 12px", fontSize: 14, lineHeight: 1.5, opacity: 0.95 }}>
          {crisis
            ? "If you're thinking about suicide or self-harm, please reach out right now. In the US and Canada you can call or text 988 (Suicide & Crisis Lifeline), available 24/7."
            : "Based on what you described, this platform recommends calling emergency services or going to the nearest emergency department right away. Don't wait for an AI assessment."}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href="tel:911" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", color: T.red, fontWeight: 700, fontSize: 14, padding: "9px 14px", borderRadius: 8, textDecoration: "none" }}>
            <Phone size={15} /> Call 911
          </a>
          {crisis && (
            <a href="tel:988" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.15)", color: "#fff", fontWeight: 700, fontSize: 14, padding: "9px 14px", borderRadius: 8, textDecoration: "none", border: "1px solid rgba(255,255,255,.5)" }}>
              <Phone size={15} /> Call or text 988
            </a>
          )}
          <button onClick={onDismiss} style={{ background: "transparent", border: "1px solid rgba(255,255,255,.5)", color: "#fff", borderRadius: 8, padding: "9px 14px", fontSize: 14, cursor: "pointer" }}>
            I understand, continue
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   HOME
----------------------------------------------------------------*/
function HomePage({ go, profile }) {
  const cards = [
    { key: "symptom", title: "Check symptoms", desc: "Answer a few questions and get an urgency read before you decide what to do next.", icon: Stethoscope, accent: T.teal },
    { key: "appointments", title: "Prep for a visit", desc: "Get a personalized checklist of what to bring and ask.", icon: CalendarCheck, accent: T.clay },
    { key: "doctors", title: "Find a provider", desc: "Search nearby clinics and specialists.", icon: MapPin, accent: T.blue },
    { key: "ask", title: "Ask about a condition", desc: "Plain-language explanations, grounded in trusted sources.", icon: MessageCircleQuestion, accent: T.sage },
  ];
  return (
    <div>
      <SectionTitle
        eyebrow="Your health, guided"
        title={`Welcome back${profile.name ? ", " + profile.name.split(" ")[0] : ""}`}
        sub="Not sure what your symptoms mean or where to go? Start here — this navigator helps you decide, prepare, and follow through, without replacing your doctor."
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14, marginBottom: 26 }}>
        {cards.map((c) => (
          <Card key={c.key} style={{ cursor: "pointer" }} className="hoverable">
            <div onClick={() => go(c.key)}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${c.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <c.icon size={20} color={c.accent} />
              </div>
              <div style={{ fontWeight: 600, fontSize: 15.5, color: T.ink, marginBottom: 6 }}>{c.title}</div>
              <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.5 }}>{c.desc}</div>
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 4, color: c.accent, fontSize: 13, fontWeight: 600 }}>
                Open <ChevronRight size={14} />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card style={{ background: T.tealDeep, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>This is a guide, not a diagnosis</div>
          <div style={{ fontSize: 13.5, opacity: 0.85, maxWidth: 480 }}>Every assessment here is educational. For anything severe or fast-changing, contact a medical professional or emergency services directly.</div>
        </div>
        <Sparkles size={28} style={{ opacity: 0.6, flexShrink: 0 }} />
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------
   SYMPTOM CHECK (multi-step AI-style conversation)
----------------------------------------------------------------*/
function SymptomCheck() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [showEmergency, setShowEmergency] = useState(false);

  const steps = [
    { key: "freeText", q: "What symptoms are you experiencing? Describe them in your own words.", type: "text" },
    { key: "onset", q: "When did this start?", type: "choice", options: ["Just now", "Today", "A few days ago", "Over a week ago"] },
    { key: "duration", q: "Did it come on suddenly, or gradually?", type: "choice", options: [["sudden", "Suddenly"], ["gradual", "Gradually"]] },
    { key: "severity", q: "On a scale of 1–10, how severe is it right now?", type: "scale" },
    { key: "fever", q: "Do you have a fever?", type: "choice", options: [["none", "No fever"], ["low", "Low-grade"], ["high", "High (over 103°F / 39.4°C)"]] },
    { key: "pregnant", q: "Are you currently pregnant?", type: "choice", options: [["no", "No"], ["yes", "Yes"], ["na", "Not applicable"]] },
  ];

  const current = steps[step];

  function submitAnswer(value) {
    const next = { ...answers, [current.key]: value };
    setAnswers(next);

    if (current.key === "freeText") {
      const text = String(value).toLowerCase();
      const crisis = CRISIS_WORDS.some((w) => text.includes(w));
      const redflag = RED_FLAG_WORDS.some((w) => text.includes(w));
      if (crisis || redflag) {
        setShowEmergency(true);
        setResult(runTriage(next));
        return;
      }
    }

    if (step + 1 < steps.length) {
      setStep(step + 1);
    } else {
      setResult(runTriage(next));
    }
  }

  function restart() {
    setStep(0);
    setAnswers({});
    setResult(null);
    setShowEmergency(false);
  }

  if (result) {
    const info = URGENCY[result.level];
    return (
      <div>
        <SectionTitle eyebrow="Symptom check" title="Your assessment" />
        {showEmergency && <EmergencyBanner crisis={result.crisis} onDismiss={() => setShowEmergency(false)} />}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 4 }}>Based on your answers</div>
          <CareCompass level={result.level} />
          <div style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: T.ink }}>Why this level</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: T.inkSoft, fontSize: 13.5, lineHeight: 1.7 }}>
              {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </Card>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <GhostButton icon={ChevronLeft} onClick={restart}>Start over</GhostButton>
          <PrimaryButton icon={CalendarCheck}>Prepare for this visit</PrimaryButton>
        </div>
        <p style={{ fontSize: 12, color: T.inkSoft, marginTop: 18, lineHeight: 1.6 }}>
          This tool provides educational guidance only and does not diagnose conditions. If symptoms worsen or you're ever unsure, contact a healthcare professional.
        </p>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle eyebrow="Symptom check" title="Tell me what's going on" sub="I'll ask a few short questions, then suggest the right level of care." />
      <div style={{ display: "flex", gap: 5, marginBottom: 18 }}>
        {steps.map((_, i) => (
          <div key={i} style={{ height: 4, flex: 1, borderRadius: 4, background: i <= step ? T.teal : T.line }} />
        ))}
      </div>
      <Card>
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: T.tealDeep, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Sparkles size={16} color="#fff" />
          </div>
          <div style={{ paddingTop: 6, fontSize: 15.5, color: T.ink, fontWeight: 500, lineHeight: 1.5 }}>{current.q}</div>
        </div>
        <StepInput step={current} onSubmit={submitAnswer} />
      </Card>
    </div>
  );
}

function StepInput({ step, onSubmit }) {
  const [text, setText] = useState("");
  const [scale, setScale] = useState(5);

  if (step.type === "text") {
    return (
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. I have a pounding headache and my vision is a little blurry"
          rows={3}
          style={{ width: "100%", border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px", fontSize: 14.5, fontFamily: "Inter, sans-serif", resize: "vertical", boxSizing: "border-box", color: T.ink }}
        />
        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <PrimaryButton icon={Send} disabled={!text.trim()} onClick={() => onSubmit(text.trim())}>Continue</PrimaryButton>
        </div>
      </div>
    );
  }

  if (step.type === "scale") {
    return (
      <div>
        <input type="range" min={1} max={10} value={scale} onChange={(e) => setScale(Number(e.target.value))} style={{ width: "100%" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: T.inkSoft, marginTop: 4 }}>
          <span>1 – mild</span>
          <span style={{ fontWeight: 700, color: T.tealDeep, fontSize: 16 }}>{scale}</span>
          <span>10 – worst possible</span>
        </div>
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <PrimaryButton onClick={() => onSubmit(scale)}>Continue</PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {step.options.map((opt) => {
        const [val, label] = Array.isArray(opt) ? opt : [opt, opt];
        return (
          <button
            key={val}
            onClick={() => onSubmit(val)}
            style={{ border: `1px solid ${T.line}`, background: "#fff", borderRadius: 10, padding: "10px 16px", fontSize: 14, cursor: "pointer", color: T.ink, fontFamily: "Inter, sans-serif" }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------
   MEDICAL PROFILE
----------------------------------------------------------------*/
function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}
const inputStyle = { width: "100%", border: `1px solid ${T.line}`, borderRadius: 9, padding: "9px 12px", fontSize: 14, fontFamily: "Inter, sans-serif", boxSizing: "border-box", color: T.ink };

function ProfilePage({ profile, setProfile }) {
  const update = (k, v) => setProfile((p) => ({ ...p, [k]: v }));
  const [tagInput, setTagInput] = useState({ allergies: "", conditions: "" });

  function addTag(field) {
    const val = tagInput[field].trim();
    if (!val) return;
    update(field, [...(profile[field] || []), val]);
    setTagInput((t) => ({ ...t, [field]: "" }));
  }
  function removeTag(field, i) {
    update(field, profile[field].filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <SectionTitle eyebrow="Your medical profile" title="Keep this up to date" sub="Stored details help personalize triage, appointment prep, and drug interaction checks." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <Card>
          <div style={{ fontWeight: 600, marginBottom: 14, color: T.ink }}>Basics</div>
          <Field label="Full name"><input style={inputStyle} value={profile.name} onChange={(e) => update("name", e.target.value)} placeholder="Jordan Ellis" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Age"><input style={inputStyle} type="number" value={profile.age} onChange={(e) => update("age", e.target.value)} placeholder="34" /></Field>
            <Field label="Sex"><select style={inputStyle} value={profile.sex} onChange={(e) => update("sex", e.target.value)}><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option></select></Field>
            <Field label="Height (cm)"><input style={inputStyle} type="number" value={profile.height} onChange={(e) => update("height", e.target.value)} placeholder="170" /></Field>
            <Field label="Weight (kg)"><input style={inputStyle} type="number" value={profile.weight} onChange={(e) => update("weight", e.target.value)} placeholder="68" /></Field>
          </div>
          <Field label="Blood type"><select style={inputStyle} value={profile.bloodType} onChange={(e) => update("bloodType", e.target.value)}><option value="">Unknown</option>{["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(b => <option key={b}>{b}</option>)}</select></Field>
        </Card>

        <Card>
          <div style={{ fontWeight: 600, marginBottom: 14, color: T.ink }}>Allergies</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input style={inputStyle} value={tagInput.allergies} onChange={(e) => setTagInput((t) => ({ ...t, allergies: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addTag("allergies")} placeholder="e.g. Penicillin" />
            <GhostButton icon={Plus} onClick={() => addTag("allergies")} style={{ padding: "9px 12px" }}>Add</GhostButton>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(profile.allergies || []).map((a, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: `${T.red}14`, color: T.red, padding: "5px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 600 }}>
                {a} <X size={12} style={{ cursor: "pointer" }} onClick={() => removeTag("allergies", i)} />
              </span>
            ))}
            {!(profile.allergies || []).length && <span style={{ fontSize: 13, color: T.inkSoft }}>No known allergies added.</span>}
          </div>

          <div style={{ fontWeight: 600, margin: "20px 0 14px", color: T.ink }}>Chronic conditions</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input style={inputStyle} value={tagInput.conditions} onChange={(e) => setTagInput((t) => ({ ...t, conditions: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addTag("conditions")} placeholder="e.g. Asthma" />
            <GhostButton icon={Plus} onClick={() => addTag("conditions")} style={{ padding: "9px 12px" }}>Add</GhostButton>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(profile.conditions || []).map((a, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: `${T.blue}14`, color: T.blue, padding: "5px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 600 }}>
                {a} <X size={12} style={{ cursor: "pointer" }} onClick={() => removeTag("conditions", i)} />
              </span>
            ))}
            {!(profile.conditions || []).length && <span style={{ fontSize: 13, color: T.inkSoft }}>None added.</span>}
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: T.ink, display: "flex", alignItems: "center", gap: 8 }}>
          <Upload size={16} color={T.teal} /> Upload a report or discharge summary
        </div>
        <p style={{ fontSize: 13, color: T.inkSoft, margin: "6px 0 14px" }}>The AI will extract diagnoses, medications, abnormal values, and suggested follow-up questions.</p>
        <div style={{ border: `1.5px dashed ${T.line}`, borderRadius: 12, padding: "26px 16px", textAlign: "center", color: T.inkSoft, fontSize: 13.5 }}>
          <FileText size={22} style={{ marginBottom: 8, opacity: 0.6 }} />
          <div>Drag a PDF, lab report, or discharge summary here, or click to browse.</div>
          <div style={{ fontSize: 11.5, marginTop: 6, opacity: 0.7 }}>(Demo — file processing isn't wired up in this prototype.)</div>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------
   TIMELINE
----------------------------------------------------------------*/
const TIMELINE_DATA = [
  { day: "Jul 12", severity: 6, temp: 99.8, hr: 82 },
  { day: "Jul 13", severity: 7, temp: 100.9, hr: 88 },
  { day: "Jul 14", severity: 8, temp: 101.6, hr: 92 },
  { day: "Jul 15", severity: 6, temp: 100.2, hr: 85 },
  { day: "Jul 16", severity: 4, temp: 99.1, hr: 78 },
  { day: "Jul 17", severity: 3, temp: 98.6, hr: 74 },
  { day: "Jul 18", severity: 2, temp: 98.4, hr: 71 },
  { day: "Jul 19", severity: 2, temp: 98.6, hr: 72 },
];

function TimelinePage() {
  return (
    <div>
      <SectionTitle eyebrow="Symptom timeline" title="How you've trended" sub="A visual log of severity, temperature, and heart rate — useful to bring to an appointment." />
      <Card>
        <div style={{ fontWeight: 600, marginBottom: 4, color: T.ink }}>Severity over time</div>
        <div style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 10 }}>Last 8 days · self-reported, 1–10 scale</div>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={TIMELINE_DATA} margin={{ left: -12, right: 10, top: 6 }}>
              <CartesianGrid stroke={T.line} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11.5, fill: T.inkSoft }} axisLine={{ stroke: T.line }} tickLine={false} />
              <YAxis tick={{ fontSize: 11.5, fill: T.inkSoft }} domain={[0, 10]} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 12.5 }} />
              <Line type="monotone" dataKey="severity" stroke={T.clay} strokeWidth={2.5} dot={{ r: 3.5 }} name="Severity" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 16 }}>
        <Card>
          <div style={{ fontWeight: 600, marginBottom: 10, color: T.ink }}>Temperature (°F)</div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={TIMELINE_DATA} margin={{ left: -18, right: 10 }}>
                <CartesianGrid stroke={T.line} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10.5, fill: T.inkSoft }} axisLine={{ stroke: T.line }} tickLine={false} />
                <YAxis tick={{ fontSize: 10.5, fill: T.inkSoft }} domain={[97, 103]} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 12.5 }} />
                <Line type="monotone" dataKey="temp" stroke={T.red} strokeWidth={2} dot={{ r: 3 }} name="Temp" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <div style={{ fontWeight: 600, marginBottom: 10, color: T.ink }}>Heart rate (bpm)</div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={TIMELINE_DATA} margin={{ left: -18, right: 10 }}>
                <CartesianGrid stroke={T.line} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10.5, fill: T.inkSoft }} axisLine={{ stroke: T.line }} tickLine={false} />
                <YAxis tick={{ fontSize: 10.5, fill: T.inkSoft }} domain={[60, 100]} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 12.5 }} />
                <Line type="monotone" dataKey="hr" stroke={T.blue} strokeWidth={2} dot={{ r: 3 }} name="HR" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, background: `${T.sage}10`, border: `1px solid ${T.sage}40` }}>
        <Activity size={18} color={T.sage} />
        <div style={{ fontSize: 13.5, color: T.ink }}>Your trend is improving — severity has dropped from 8 to 2 over the last five days. Wearable sync (Apple Health, Google Fit, Fitbit) can auto-populate this timeline once connected.</div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------
   APPOINTMENT PREP
----------------------------------------------------------------*/
function AppointmentPrep() {
  const [items, setItems] = useState([
    { id: 1, label: "Photo ID and insurance card", done: false },
    { id: 2, label: "List of current medications and dosages", done: false },
    { id: 3, label: "Recent symptom timeline or diary", done: true },
    { id: 4, label: "Blood pressure / temperature readings, if tracked", done: false },
    { id: 5, label: "Any prior test results or imaging", done: false },
    { id: 6, label: "Questions to ask the doctor", done: false },
  ]);
  const [question, setQuestion] = useState("");
  const [questions, setQuestions] = useState([
    "Could this be related to my existing condition?",
    "What symptoms should send me straight to the ER?",
  ]);

  const toggle = (id) => setItems((its) => its.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const addQuestion = () => {
    if (!question.trim()) return;
    setQuestions((q) => [...q, question.trim()]);
    setQuestion("");
  };
  const doneCount = items.filter((i) => i.done).length;

  return (
    <div>
      <SectionTitle eyebrow="Appointment prep" title="Get ready for your visit" sub="A personalized checklist based on your recent symptom check." />
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontWeight: 600, color: T.ink }}>What to bring</div>
          <Pill color={T.teal}>{doneCount}/{items.length} ready</Pill>
        </div>
        {items.map((i) => (
          <div key={i.id} onClick={() => toggle(i.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: `1px solid ${T.line}`, cursor: "pointer" }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${i.done ? T.teal : T.line}`, background: i.done ? T.teal : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {i.done && <Check size={13} color="#fff" />}
            </div>
            <span style={{ fontSize: 14, color: i.done ? T.inkSoft : T.ink, textDecoration: i.done ? "line-through" : "none" }}>{i.label}</span>
          </div>
        ))}
      </Card>

      <Card style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12, color: T.ink }}>Questions to ask</div>
        {questions.map((q, i) => (
          <div key={i} style={{ display: "flex", gap: 10, fontSize: 14, color: T.ink, padding: "8px 0", borderBottom: i < questions.length - 1 ? `1px solid ${T.line}` : "none" }}>
            <span style={{ color: T.clay, fontWeight: 700 }}>Q{i + 1}</span> {q}
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <input style={inputStyle} value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addQuestion()} placeholder="Add your own question" />
          <GhostButton icon={Plus} onClick={addQuestion} style={{ padding: "9px 12px" }}>Add</GhostButton>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------
   DOCTOR FINDER
----------------------------------------------------------------*/
const PROVIDERS = [
  { name: "Dr. Amara Osei", specialty: "Family Medicine", distance: "0.8 mi", rating: 4.8, next: "Today, 3:40 PM", insurance: true },
  { name: "Riverside Urgent Care", specialty: "Urgent Care", distance: "1.2 mi", rating: 4.5, next: "Walk-in", insurance: true },
  { name: "Dr. Liam Carter", specialty: "Internal Medicine", distance: "2.1 mi", rating: 4.9, next: "Tomorrow, 9:00 AM", insurance: false },
  { name: "Dr. Priya Nair", specialty: "Pediatrics", distance: "2.6 mi", rating: 4.7, next: "Thu, 1:15 PM", insurance: true },
  { name: "Downtown ENT Associates", specialty: "ENT", distance: "3.4 mi", rating: 4.4, next: "Fri, 11:30 AM", insurance: true },
];

function DoctorFinder() {
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("All");
  const specialties = ["All", ...Array.from(new Set(PROVIDERS.map((p) => p.specialty)))];
  const filtered = PROVIDERS.filter((p) =>
    (specialty === "All" || p.specialty === specialty) &&
    (p.name.toLowerCase().includes(query.toLowerCase()) || p.specialty.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div>
      <SectionTitle eyebrow="Doctor finder" title="Find the right provider" sub="Search by specialty, distance, and availability." />
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <Search size={16} color={T.inkSoft} style={{ position: "absolute", left: 12, top: 11 }} />
          <input style={{ ...inputStyle, paddingLeft: 34 }} placeholder="Search by name or specialty" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select style={{ ...inputStyle, width: "auto" }} value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
          {specialties.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((p) => (
          <Card key={p.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: `${T.teal}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <UserCircle size={22} color={T.teal} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: T.ink, fontSize: 15 }}>{p.name}</div>
                <div style={{ fontSize: 13, color: T.inkSoft }}>{p.specialty} · {p.distance}</div>
                <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 12.5, color: T.inkSoft }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Star size={12} color={T.clay} fill={T.clay} /> {p.rating}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={12} /> {p.next}</span>
                  {p.insurance && <Pill color={T.sage}>In-network</Pill>}
                </div>
              </div>
            </div>
            <GhostButton icon={MapPin}>Directions</GhostButton>
          </Card>
        ))}
        {!filtered.length && <div style={{ color: T.inkSoft, fontSize: 14, padding: 20, textAlign: "center" }}>No providers match that search.</div>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   MEDICATIONS / INTERACTION CHECKER
----------------------------------------------------------------*/
const KNOWN_INTERACTIONS = [
  { pair: ["warfarin", "ibuprofen"], severity: "High", note: "Increased risk of bleeding when combined." },
  { pair: ["lisinopril", "ibuprofen"], severity: "Moderate", note: "NSAIDs may reduce the blood-pressure-lowering effect." },
  { pair: ["metformin", "alcohol"], severity: "Moderate", note: "Raises risk of lactic acidosis, especially with heavy use." },
  { pair: ["sertraline", "tramadol"], severity: "High", note: "Combined serotonergic effect raises serotonin syndrome risk." },
  { pair: ["simvastatin", "clarithromycin"], severity: "High", note: "Clarithromycin can raise statin levels, increasing muscle-injury risk." },
];

function MedicationsPage() {
  const [meds, setMeds] = useState(["Lisinopril", "Metformin"]);
  const [input, setInput] = useState("");

  const addMed = () => {
    if (!input.trim()) return;
    setMeds((m) => [...m, input.trim()]);
    setInput("");
  };
  const removeMed = (i) => setMeds((m) => m.filter((_, idx) => idx !== i));

  const interactions = useMemo(() => {
    const lower = meds.map((m) => m.toLowerCase());
    return KNOWN_INTERACTIONS.filter(({ pair }) => pair.every((p) => lower.some((m) => m.includes(p))));
  }, [meds]);

  return (
    <div>
      <SectionTitle eyebrow="Medications" title="Manage your medications" sub="Add what you're taking to check for interactions, duplicates, and allergy conflicts." />
      <Card>
        <div style={{ fontWeight: 600, marginBottom: 12, color: T.ink }}>Current medications</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input style={inputStyle} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMed()} placeholder="e.g. Ibuprofen" />
          <GhostButton icon={Plus} onClick={addMed} style={{ padding: "9px 12px" }}>Add</GhostButton>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {meds.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: T.paper, borderRadius: 8 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: T.ink }}><PillIcon size={14} color={T.teal} />{m}</span>
              <Trash2 size={15} color={T.inkSoft} style={{ cursor: "pointer" }} onClick={() => removeMed(i)} />
            </div>
          ))}
          {!meds.length && <div style={{ color: T.inkSoft, fontSize: 13.5 }}>No medications added yet.</div>}
        </div>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12, color: T.ink }}>Interaction check</div>
        {interactions.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {interactions.map((it, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "12px 14px", borderRadius: 10, background: it.severity === "High" ? `${T.red}10` : `${T.amber}10`, border: `1px solid ${it.severity === "High" ? T.red : T.amber}40` }}>
                <AlertTriangle size={18} color={it.severity === "High" ? T.red : T.amber} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: T.ink, textTransform: "capitalize" }}>{it.pair.join(" + ")} — {it.severity} risk</div>
                  <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 2 }}>{it.note}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13.5, color: T.inkSoft, display: "flex", alignItems: "center", gap: 8 }}>
            <Check size={16} color={T.sage} /> No known interactions found among your current list.
          </div>
        )}
        <p style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 14 }}>This demo checks against a small sample list — not a complete drug database. Always confirm with a pharmacist or physician.</p>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------
   ASK AI — MEDICAL CHAT (real Claude API call)
----------------------------------------------------------------*/
const ASK_AI_SYSTEM_PROMPT = `You are the "Ask AI" medical information assistant inside a healthcare-navigator app called MedPath AI.

Rules:
- Explain medical conditions, terms, and medications in clear, plain language a non-expert can follow.
- Keep answers concise: 4-7 sentences, or a short list for multi-part questions.
- Cover, when relevant: what it is, common causes, typical symptoms, general treatment approach, and prevention.
- Never diagnose the person or evaluate their personal symptoms. If they describe their own symptoms, briefly acknowledge them, then redirect: suggest they use the app's Symptom Check feature and/or speak with a healthcare professional, especially for anything urgent.
- Never give exact personal dosing instructions. You can describe how a class of medication generally works.
- End every response with a short one-line disclaimer that this is educational information, not medical advice.
- If the question is unrelated to health or medicine, politely redirect to health topics.`;

function AskAI() {
  const [messages, setMessages] = useState([
    { role: "ai", text: "Ask me about a condition, medication, or medical term — I'll explain it in plain language." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function send() {
    const question = input.trim();
    if (!question || loading) return;
    const userMsg = { role: "user", text: question };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const apiHistory = history
        .filter((m) => m.role === "user" || m.role === "ai")
        .map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: ASK_AI_SYSTEM_PROMPT,
          messages: apiHistory,
        }),
      });

      if (!response.ok) throw new Error("Request failed with status " + response.status);
      const data = await response.json();
      const text = (data.content || [])
        .map((block) => (block.type === "text" ? block.text : ""))
        .filter(Boolean)
        .join("\n")
        .trim();

      setMessages((m) => [...m, { role: "ai", text: text || "I wasn't able to generate a response. Please try rephrasing your question." }]);
    } catch (e) {
      setError("Something went wrong reaching the AI. Please try again.");
      setMessages((m) => [...m, { role: "ai", text: "Sorry, I couldn't process that just now. Please try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <SectionTitle eyebrow="Ask AI" title="Understand a condition" sub="Powered by a live Claude API call — educational explanations only, always confirm anything medical with a professional." />
      <Card style={{ display: "flex", flexDirection: "column", height: 440, padding: 0, overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "80%", fontSize: 13.5, lineHeight: 1.6, padding: "10px 14px", borderRadius: 12, whiteSpace: "pre-wrap",
                background: m.role === "user" ? T.tealDeep : T.paper,
                color: m.role === "user" ? "#fff" : T.ink,
                borderBottomRightRadius: m.role === "user" ? 3 : 12,
                borderBottomLeftRadius: m.role === "user" ? 12 : 3,
              }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{ fontSize: 13, color: T.inkSoft, padding: "10px 14px", background: T.paper, borderRadius: 12, borderBottomLeftRadius: 3 }}>
                Thinking…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div style={{ borderTop: `1px solid ${T.line}`, padding: 14, display: "flex", gap: 8 }}>
          <input style={inputStyle} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Explain hypertension..." disabled={loading} />
          <PrimaryButton icon={Send} onClick={send} disabled={!input.trim() || loading} style={{ padding: "9px 14px" }} />
        </div>
      </Card>
      {error && <p style={{ fontSize: 12, color: T.red, marginTop: 10 }}>{error}</p>}
      <p style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 12 }}>Responses are generated live and are educational — not a substitute for professional medical advice.</p>
    </div>
  );
}

/* ---------------------------------------------------------------
   APP SHELL
----------------------------------------------------------------*/
const NAV = [
  { key: "home", label: "Home", icon: Home },
  { key: "symptom", label: "Symptom check", icon: Stethoscope },
  { key: "timeline", label: "Timeline", icon: Activity },
  { key: "appointments", label: "Appointment prep", icon: CalendarCheck },
  { key: "doctors", label: "Find a doctor", icon: MapPin },
  { key: "meds", label: "Medications", icon: PillIcon },
  { key: "ask", label: "Ask AI", icon: MessageCircleQuestion },
  { key: "profile", label: "Profile", icon: UserCircle },
];
const MOBILE_NAV_KEYS = ["home", "symptom", "timeline", "appointments", "profile"];
const LANGS = ["English", "Español", "Français", "हिन्दी", "ગુજરાતી", "中文"];

export default function App() {
  const [page, setPage] = useState("home");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lang, setLang] = useState("English");
  const [profile, setProfile] = useState({ name: "Jordan Ellis", age: "34", sex: "Female", allergies: ["Penicillin"], conditions: ["Asthma"] });
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 860 : false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 860);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const go = (key) => { setPage(key); setMobileOpen(false); };

  const pageMap = {
    home: <HomePage go={go} profile={profile} />,
    symptom: <SymptomCheck />,
    profile: <ProfilePage profile={profile} setProfile={setProfile} />,
    timeline: <TimelinePage />,
    appointments: <AppointmentPrep />,
    doctors: <DoctorFinder />,
    meds: <MedicationsPage />,
    ask: <AskAI />,
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: T.paper, minHeight: "100vh", color: T.ink }}>
      <style>{`
        ${FONT_IMPORT}
        * { box-sizing: border-box; }
        .hoverable { transition: transform .15s ease, box-shadow .15s ease; }
        .hoverable:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(18,38,34,0.06); }
        input:focus, select:focus, textarea:focus { outline: 2px solid ${T.teal}55; border-color: ${T.teal}; }
        ::selection { background: ${T.teal}33; }
        @media (max-width: 859px) {
          .desktop-sidebar { display: none !important; }
          .main-content { margin-left: 0 !important; padding-bottom: 84px !important; }
        }
        @media (min-width: 860px) {
          .mobile-tabbar { display: none !important; }
          .mobile-topbar { display: none !important; }
        }
      `}</style>

      {/* Desktop sidebar */}
      <aside className="desktop-sidebar" style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 236, background: T.tealDeep, padding: "26px 16px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 8px", marginBottom: 30 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: T.clay, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <HeartPulse size={16} color="#fff" />
          </div>
          <span style={{ fontFamily: "Fraunces, serif", fontSize: 16.5, color: "#fff", fontWeight: 500 }}>MedPath AI</span>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => go(n.key)}
              style={{
                display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 9,
                background: page === n.key ? "rgba(255,255,255,0.12)" : "transparent",
                border: "none", color: page === n.key ? "#fff" : "rgba(255,255,255,0.7)",
                fontSize: 14, fontWeight: 500, cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif",
              }}
            >
              <n.icon size={17} />{n.label}
            </button>
          ))}
        </nav>
        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.65)", fontSize: 12.5, padding: "0 8px" }}>
            <Languages size={14} />
            <select value={lang} onChange={(e) => setLang(e.target.value)} style={{ background: "transparent", color: "rgba(255,255,255,0.85)", border: "none", fontSize: 12.5, fontFamily: "Inter, sans-serif" }}>
              {LANGS.map((l) => <option key={l} style={{ color: "#000" }}>{l}</option>)}
            </select>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="mobile-topbar" style={{ position: "sticky", top: 0, zIndex: 20, background: T.tealDeep, color: "#fff", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: T.clay, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <HeartPulse size={14} color="#fff" />
          </div>
          <span style={{ fontFamily: "Fraunces, serif", fontSize: 15.5 }}>MedPath AI</span>
        </div>
        <Menu size={22} onClick={() => setMobileOpen((o) => !o)} style={{ cursor: "pointer" }} />
      </div>
      {mobileOpen && (
        <div className="mobile-topbar" style={{ background: T.tealDeep, padding: "6px 12px 14px" }}>
          {NAV.map((n) => (
            <button key={n.key} onClick={() => go(n.key)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 10px", background: page === n.key ? "rgba(255,255,255,0.12)" : "transparent", border: "none", borderRadius: 8, color: "#fff", fontSize: 14.5, cursor: "pointer", textAlign: "left" }}>
              <n.icon size={16} />{n.label}
            </button>
          ))}
        </div>
      )}

      {/* Main content */}
      <main className="main-content" style={{ marginLeft: 236, padding: "36px 40px", maxWidth: 900 }}>
        {pageMap[page]}
      </main>

      {/* Mobile bottom tab bar */}
      <div className="mobile-tabbar" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: `1px solid ${T.line}`, display: "flex", justifyContent: "space-around", padding: "8px 4px", zIndex: 20 }}>
        {NAV.filter((n) => MOBILE_NAV_KEYS.includes(n.key)).map((n) => (
          <button key={n.key} onClick={() => go(n.key)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "transparent", border: "none", color: page === n.key ? T.teal : T.inkSoft, fontSize: 10.5, cursor: "pointer", padding: "4px 8px" }}>
            <n.icon size={19} />{n.label.split(" ")[0]}
          </button>
        ))}
      </div>
    </div>
  );
}




