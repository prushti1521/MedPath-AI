"""Drug interaction checking.

Checks a structured interaction table first (fast, deterministic).
Falls back to an LLM pass for pairs not in the table, clearly labeled
as a lower-confidence result that should be confirmed with a pharmacist.
"""

import os
from anthropic import Anthropic

client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

# Replace with a real licensed interaction dataset (e.g. First Databank,
# Multum, or RxNorm + DrugBank) before shipping to real users.
KNOWN_INTERACTIONS = [
    {"pair": ["warfarin", "ibuprofen"], "severity": "High", "note": "Increased risk of bleeding when combined."},
    {"pair": ["lisinopril", "ibuprofen"], "severity": "Moderate", "note": "NSAIDs may reduce the blood-pressure-lowering effect."},
    {"pair": ["metformin", "alcohol"], "severity": "Moderate", "note": "Raises risk of lactic acidosis, especially with heavy use."},
    {"pair": ["sertraline", "tramadol"], "severity": "High", "note": "Combined serotonergic effect raises serotonin syndrome risk."},
    {"pair": ["simvastatin", "clarithromycin"], "severity": "High", "note": "Clarithromycin can raise statin levels, increasing muscle-injury risk."},
]

INTERACTION_PROMPT = """Given a list of medications, note any clinically
significant interactions not already covered. Respond ONLY with strict
JSON: {"interactions": [{"pair": ["", ""], "severity": "Low|Moderate|High", "note": ""}]}
If none, return {"interactions": []}. Be conservative and flag low-confidence
items as "Low" severity with a note to confirm with a pharmacist."""


def check_known_table(meds: list[str]) -> list[dict]:
    lower = [m.lower() for m in meds]
    return [
        entry for entry in KNOWN_INTERACTIONS
        if all(any(p in m for m in lower) for p in entry["pair"])
    ]


def check_with_llm(meds: list[str]) -> list[dict]:
    if len(meds) < 2:
        return []
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=500,
        system=INTERACTION_PROMPT,
        messages=[{"role": "user", "content": ", ".join(meds)}],
    )
    import json
    text = "".join(block.text for block in response.content if block.type == "text")
    try:
        return json.loads(text).get("interactions", [])
    except json.JSONDecodeError:
        return []


def check_interactions(meds: list[str]) -> dict:
    known = check_known_table(meds)
    known_pairs = {tuple(sorted(e["pair"])) for e in known}

    llm_found = check_with_llm(meds)
    extra = [e for e in llm_found if tuple(sorted(e["pair"])) not in known_pairs]

    return {"interactions": known + extra}
