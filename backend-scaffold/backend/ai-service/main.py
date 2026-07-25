import os
import shutil
import tempfile

from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

from triage import run_triage
from rag import answer_question
from interactions import check_interactions
from ocr import process_prescription, process_report

load_dotenv()

app = FastAPI(title="MedPath AI — AI service")

DATABASE_URL = os.environ.get("DATABASE_URL")


class TriageRequest(BaseModel):
    free_text: str = ""
    answers: dict = {}


class AskRequest(BaseModel):
    question: str
    history: list[dict] = []


class InteractionRequest(BaseModel):
    medications: list[str]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/triage")
async def triage(req: TriageRequest):
    return await run_triage(req.free_text, req.answers)


@app.post("/ask")
async def ask(req: AskRequest):
    if not DATABASE_URL:
        raise HTTPException(status_code=500, detail="Knowledge base not configured.")
    return await answer_question(req.question, req.history, DATABASE_URL)


@app.post("/interactions")
def interactions(req: InteractionRequest):
    return check_interactions(req.medications)


@app.post("/ocr/prescription")
async def ocr_prescription(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    try:
        return process_prescription(tmp_path)
    finally:
        os.unlink(tmp_path)


@app.post("/ocr/report")
async def ocr_report(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    try:
        return process_report(tmp_path)
    finally:
        os.unlink(tmp_path)
