"""Retrieval-augmented generation for the Ask AI feature.

Embeds the user's question, retrieves the closest chunks from the
knowledge_chunks table (medical guidelines, trusted articles, FAQs),
and asks Claude to answer using only that retrieved context.
"""

import os
from anthropic import Anthropic

# Heavy optional dependencies (sentence-transformers, psycopg) are imported
# lazily so the service can start in development even if the full ML stack
# isn't installed. If they are missing, /ask will return a clear 503 error.
client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
_embedder = None
_psycopg = None

def _ensure_optional_deps():
    global _embedder, _psycopg
    if _embedder is None:
        try:
            from sentence_transformers import SentenceTransformer
            _embedder = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception:
            _embedder = None
    if _psycopg is None:
        try:
            import psycopg
            _psycopg = psycopg
        except Exception:
            _psycopg = None

RAG_SYSTEM_PROMPT = """You are a medical information assistant. Answer the
user's question using ONLY the provided context passages. If the context
doesn't cover the question, say so plainly rather than guessing. Explain
in plain language, 4-7 sentences. Never diagnose the user's personal
symptoms. Always end with a one-line educational disclaimer."""


def embed(text: str) -> list[float]:
    _ensure_optional_deps()
    if not _embedder:
        raise RuntimeError("Optional dependency 'sentence-transformers' is not installed. Install the full requirements to enable RAG functionality.")
    return _embedder.encode(text).tolist()


async def retrieve_chunks(question: str, db_url: str, k: int = 5) -> list[dict]:
    _ensure_optional_deps()
    if not _embedder or not _psycopg:
        raise RuntimeError("RAG retrieval requires optional dependencies (sentence-transformers, psycopg). Install full requirements to enable this feature.")
    vector = embed(question)
    async with await _psycopg.AsyncConnection.connect(db_url) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT title, content, source, embedding <=> %s AS distance
                FROM knowledge_chunks
                ORDER BY distance ASC
                LIMIT %s
                """,
                (vector, k),
            )
            rows = await cur.fetchall()
    return [{"title": r[0], "content": r[1], "source": r[2]} for r in rows]


async def answer_question(question: str, history: list[dict], db_url: str) -> dict:
    chunks = await retrieve_chunks(question, db_url)
    context = "\n\n".join(f"[{c['source']}] {c['title']}: {c['content']}" for c in chunks)

    messages = history + [{
        "role": "user",
        "content": f"Context:\n{context}\n\nQuestion: {question}",
    }]

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=800,
        system=RAG_SYSTEM_PROMPT,
        messages=messages,
    )

    text = "".join(block.text for block in response.content if block.type == "text")
    return {"answer": text, "sources": [c["source"] for c in chunks]}
