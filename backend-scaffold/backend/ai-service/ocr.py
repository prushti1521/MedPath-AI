"""OCR + structured extraction for prescriptions and medical reports.

Tesseract (via pytesseract) does the raw text extraction; Claude turns
the raw text into structured fields. Swap pytesseract for a cloud OCR
service (Textract, Google Vision) for better handwriting accuracy.
"""

import os
import json
from anthropic import Anthropic
from PIL import Image
import pytesseract

client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

PRESCRIPTION_PROMPT = """Extract structured data from this OCR text of a
prescription. Respond ONLY with strict JSON:
{"medication": "", "dosage": "", "frequency": "", "duration": "", "warnings": []}
If a field can't be determined, use an empty string or empty array."""

REPORT_PROMPT = """Extract structured data from this OCR text of a medical
report (lab, imaging, or discharge summary). Respond ONLY with strict JSON:
{"diagnoses": [], "medications": [], "abnormal_values": [], "follow_up_questions": []}
follow_up_questions should be 2-4 plain-language questions the patient
could ask their doctor about this report."""


def extract_raw_text(image_path: str) -> str:
    image = Image.open(image_path)
    return pytesseract.image_to_string(image)


def structure_with_llm(raw_text: str, prompt: str) -> dict:
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=600,
        system=prompt,
        messages=[{"role": "user", "content": raw_text}],
    )
    text = "".join(block.text for block in response.content if block.type == "text")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"error": "Could not parse structured data from this document."}


def process_prescription(image_path: str) -> dict:
    raw = extract_raw_text(image_path)
    return structure_with_llm(raw, PRESCRIPTION_PROMPT)


def process_report(image_path: str) -> dict:
    raw = extract_raw_text(image_path)
    return structure_with_llm(raw, REPORT_PROMPT)
