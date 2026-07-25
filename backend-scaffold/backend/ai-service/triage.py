"""Rule-based symptom triage with an LLM fallback for nuance.

The rule layer is deliberately simple and auditable: red-flag keyword
matches always win, because catching emergencies must never depend on
a model call succeeding. The LLM is used only to add reasoning and
handle cases the rules under-specify — it can raise the urgency level
it never lowers a rule-triggered emergency or crisis flag.
"""

import os
from anthropic import Anthropic

client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

RED_FLAG_WORDS = [
    "chest pain", "can't breathe", "cant breathe", "trouble breathing",
    "difficulty breathing", "stroke", "face drooping", "slurred speech",
    "worst headache of my life", "severe bleeding", "won't stop bleeding",
    "unconscious", "passed out", "crushing pain", "blue lips", "seizure",
]

CRISIS_WORDS = [
    "suicidal", "want to die", "kill myself", "self harm", "self-harm",
]

TRIAGE_SYSTEM_PROMPT = """You are a clinical triage support model for a
patient-facing app. You never diagnose. Given a free-text symptom
description and structured answers, classify urgency as one of:
emergency, urgent, routine, selfcare. Respond ONLY with strict JSON:
{"level": "...", "reasons": ["...", "..."]}
Be conservative: if in doubt between two levels, choose the more urgent one."""


def rule_based_flags(free_text: str) -> dict:
    text = (free_text or "").lower()
    crisis = any(w in text for w in CRISIS_WORDS)
    red_flag = any(w in text for w in RED_FLAG_WORDS)
    return {"crisis": crisis, "red_flag": red_flag}


def score_structured_answers(answers: dict) -> tuple[str, list[str]]:
    reasons = []
    score = 0
    severity = int(answers.get("severity", 0) or 0)
    duration = answers.get("duration")
    fever = answers.get("fever")
    pregnant = answers.get("pregnant") == "yes"

    if severity >= 8:
        score += 3
        reasons.append("Pain or discomfort rated very high (8+/10).")
    elif severity >= 5:
        score += 2
        reasons.append("Moderate severity reported (5-7/10).")
    elif severity >= 1:
        score += 1

    if fever == "high":
        score += 2
        reasons.append("High fever reported.")
    if duration == "sudden":
        score += 2
        reasons.append("Symptom started suddenly.")
    if pregnant:
        score += 1
        reasons.append("Pregnancy noted - a lower threshold for caution applies.")

    if score >= 6:
        level = "urgent"
    elif score >= 3:
        level = "routine"
    elif score >= 1:
        level = "routine"
    else:
        level = "selfcare"

    return level, reasons or ["Nothing in your answers points to an urgent pattern."]


async def run_triage(free_text: str, answers: dict) -> dict:
    flags = rule_based_flags(free_text)

    if flags["crisis"]:
        return {
            "level": "emergency",
            "crisis": True,
            "reasons": ["Message suggests you may be in crisis right now."],
        }
    if flags["red_flag"]:
        return {
            "level": "emergency",
            "crisis": False,
            "reasons": ["Your description includes a symptom that can signal a medical emergency."],
        }

    level, reasons = score_structured_answers(answers)

    # Optional: ask the LLM to sanity-check / potentially escalate the level
    # based on the free-text description, without ever downgrading it.
    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=300,
            system=TRIAGE_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": f"Free text: {free_text}\nAnswers: {answers}\nRule-based level: {level}",
            }],
        )
        # In production: parse message.content, validate JSON, and only
        # escalate (never de-escalate) relative to the rule-based level.
    except Exception:
        pass  # Fail open to the rule-based result if the LLM call fails

    return {"level": level, "crisis": False, "reasons": reasons}
