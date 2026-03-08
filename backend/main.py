"""
NewtonAI — FastAPI Backend
===========================
Single endpoint: POST /generate
  - Receives { prompt } from frontend
  - Calls Google Gemini 2.0 Flash (FREE TIER) via AI Studio
  - Validates response against PhysicsSchema (Mode 1) or Mode2Schema (Mode 2)
  - Returns validated JSON to the frontend renderer

Run:
  cd backend
  .\\venv\\Scripts\\activate
  uvicorn main:app --reload --port 8000
"""

import json
import re
import logging
import uuid
import os
from datetime import datetime, timezone
from typing import Optional
from dotenv import load_dotenv
import google.generativeai as genai

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ValidationError

from schema import PhysicsSchema
from schema_mode2 import Mode2Schema
from bedrock_prompt import SYSTEM_PROMPT

# Load environment variables
load_dotenv()

# ── Logging ──────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("newton")

# ── App ──────────────────────────────────────────────────────────
app = FastAPI(
    title="NewtonAI",
    description="Generative Physics Engine — Gemini 2.0 Flash (FREE) → JSON → Three.js",
    version="1.0.0",
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Gemini API Keys (Load Balancing) ────────────────────────────
GEMINI_API_KEYS = [
    os.getenv(f"GEMINI_API_KEY_{i}")
    for i in range(1, 6)
    if os.getenv(f"GEMINI_API_KEY_{i}")
]

if not GEMINI_API_KEYS:
    logger.warning("⚠️  No Gemini API keys found in .env file!")
else:
    logger.info(f"✓ Loaded {len(GEMINI_API_KEYS)} Gemini API key(s)")

# Current key index for round-robin
current_key_index = 0


def get_next_api_key() -> str:
    """Get next API key in round-robin fashion."""
    global current_key_index
    if not GEMINI_API_KEYS:
        raise ValueError("No Gemini API keys configured")
    key = GEMINI_API_KEYS[current_key_index]
    current_key_index = (current_key_index + 1) % len(GEMINI_API_KEYS)
    logger.info(f"Using API key #{current_key_index + 1}/{len(GEMINI_API_KEYS)}")
    return key


# ── In-Memory Session Storage ───────────────────────────────────
# Stores conversation history: { session_id: [messages] }
session_storage: dict[str, list[dict]] = {}


def save_message(session_id: str, role: str, content: str):
    """Save message to in-memory session storage."""
    if session_id not in session_storage:
        session_storage[session_id] = []
    session_storage[session_id].append({
        "role": role,
        "content": content,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    # Keep only last 10 messages per session
    session_storage[session_id] = session_storage[session_id][-10:]


def get_last_n_messages(session_id: str, n: int = 5) -> list:
    """Get last N messages from session storage."""
    if session_id not in session_storage:
        return []
    messages = session_storage[session_id][-n:]
    # Convert to Gemini format
    return [
        {"role": "user" if msg["role"] == "user" else "model", "parts": [msg["content"]]}
        for msg in messages
    ]


@app.on_event("startup")
def on_startup():
    logger.info("🚀 NewtonAI backend started")
    logger.info(f"📊 Using {len(GEMINI_API_KEYS)} Gemini API key(s) for load balancing")


# ── Request models ───────────────────────────────────────────────
class GenerateRequest(BaseModel):
    prompt: str
    session_id: Optional[str] = None


# ── Helper: call Gemini ──────────────────────────────────────────
def call_gemini(user_prompt: str, history: list = [], max_tokens: int = 8192) -> str:
    """Call Google Gemini 2.5 Pro and return raw text response."""
    api_key = get_next_api_key()
    genai.configure(api_key=api_key)
    
    model = genai.GenerativeModel(
        model_name="gemini-3.1-flash-lite-preview",
        generation_config={
            "temperature": 0.1,
            "max_output_tokens": max_tokens,
        },
        system_instruction=SYSTEM_PROMPT
    )
    
    # Start chat with history
    chat = model.start_chat(history=history)
    
    # Send message
    response = chat.send_message(user_prompt)
    
    return response.text.strip()


def extract_json(text: str) -> dict:
    """Extract JSON from model response, stripping markdown fences if present."""
    # Strip markdown code fences
    cleaned = re.sub(r'^```[a-z]*\n?', '', text)
    cleaned = re.sub(r'\n?```$', '', cleaned)
    cleaned = cleaned.strip()

    # Try direct parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Find the first { ... last }
    start = cleaned.find('{')
    end = cleaned.rfind('}')
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(cleaned[start:end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not extract valid JSON from model response. First 500 chars: {text[:500]}")


def validate_payload(payload: dict) -> dict:
    """
    Validate and return the payload.
    Tries Mode 1 schema first (since the system prompt generates Mode 1),
    then falls back to Mode 2 if mode=2 is detected.
    """
    mode = payload.get("mode", 1)

    if mode == 2:
        try:
            validated = Mode2Schema(**payload)
            return validated.model_dump()
        except ValidationError as e:
            logger.warning(f"Mode 2 validation failed: {e.error_count()} errors")
            return payload
    else:
        try:
            validated = PhysicsSchema(**payload)
            return validated.model_dump()
        except ValidationError as e:
            logger.warning(f"Mode 1 validation failed: {e.error_count()} errors")
            for err in e.errors()[:5]:
                loc = ".".join(str(l) for l in err["loc"])
                logger.warning(f"  {loc}: {err['msg']}")
            return payload


# ── Main endpoint ────────────────────────────────────────────────
@app.post("/generate")
async def generate_simulation(request: GenerateRequest):
    """
    Generate a physics simulation from a natural language prompt.

    Flow:
      1. User types "show me a pendulum"
      2. Gemini generates valid simulation JSON
      3. Backend validates against Pydantic schema
      4. Frontend receives JSON → renders in Three.js
    """
    prompt = request.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    logger.info(f"📝 Generating simulation for: '{prompt[:80]}...'")

    session_id = request.session_id or str(uuid.uuid4())
    history = get_last_n_messages(session_id)

    # ── Call Gemini ──────────────────────────────────────────────
    try:
        raw_text = call_gemini(prompt, history=history)
    except Exception as e:
        logger.error(f"Gemini call failed: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Failed to reach Gemini API: {str(e)}"
        )

    # ── Extract JSON ─────────────────────────────────────────────
    try:
        payload = extract_json(raw_text)
    except ValueError as e:
        logger.error(f"JSON extraction failed: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Gemini returned invalid JSON: {str(e)}"
        )

    # ── Validate ─────────────────────────────────────────────────
    try:
        validated = validate_payload(payload)
    except Exception as e:
        logger.error(f"Validation crashed: {e}")
        validated = payload

    logger.info(f"✓ Generated: '{validated.get('title', '?')}' (mode={validated.get('mode', '?')})")
    
    save_message(session_id, "user", prompt)
    save_message(session_id, "assistant", json.dumps(validated))
    
    return {"session_id": session_id, "simulation": validated}


# ── Chat endpoint ────────────────────────────────────────────────
class ChatRequest(BaseModel):
    session_id: str
    question: str
    simulation_id: str


class ChatResponse(BaseModel):
    session_id: str
    answer: str


CHAT_SYSTEM_PROMPT = (
    "You are a physics tutor for NewtonAI, an educational 3D physics simulator. "
    "A student is viewing a physics simulation and has a question about it. "
    "Use the conversation history to understand what simulation they are viewing. "
    "Explain clearly and simply. Keep answers under 100 words. "
    "Plain English only, no equations unless the student asks. Never output JSON."
)


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    history = get_last_n_messages(request.session_id)
    
    try:
        api_key = get_next_api_key()
        genai.configure(api_key=api_key)
        
        model = genai.GenerativeModel(
            model_name="gemini-3.1-flash-lite-preview",
            generation_config={
                "temperature": 0.7,
                "max_output_tokens": 300,
            },
            system_instruction=CHAT_SYSTEM_PROMPT
        )
        
        chat_session = model.start_chat(history=history)
        response = chat_session.send_message(request.question)
        answer = response.text.strip()
    except Exception as e:
        logger.error(f"Chat failed: {e}")
        raise HTTPException(status_code=502, detail=str(e))
    
    save_message(request.session_id, "user", request.question)
    save_message(request.session_id, "assistant", answer)
    
    return ChatResponse(session_id=request.session_id, answer=answer)


# ── Health check ─────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": "gemini-3.1-flash-lite-preview",
        "api_keys_loaded": len(GEMINI_API_KEYS)
    }
