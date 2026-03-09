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
import boto3
from boto3.dynamodb.conditions import Key
import google.generativeai as genai
from mangum import Mangum

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ValidationError

from schema import PhysicsSchema
from schema_mode2 import Mode2Schema
from bedrock_prompt import SYSTEM_PROMPT

# Load environment variables
load_dotenv()

# ══════════════════════════════════════════════════════════════════
# CONFIGURATION — Change these values to customize behavior
# ══════════════════════════════════════════════════════════════════

# Gemini Model Configuration
GEMINI_MODEL_NAME = "gemini-3-flash-preview"  # Change this to switch models
# Available models:
#   - "gemini-3-flash-preview" (current, fast, free)
#   - "gemini-2.0-flash-exp" (experimental)
#   - "gemini-2.5-pro" (more capable, may have costs)
#   - "gemini-1.5-flash" (older, stable)

# Bedrock Fallback Configuration
USE_BEDROCK_FALLBACK = os.getenv("USE_BEDROCK_FALLBACK", "true").lower() == "true"
BEDROCK_MODEL_ID = "us.amazon.nova-pro-v1:0"  # Nova Pro model
BEDROCK_REGION = os.getenv("AWS_REGION", "us-east-1")

# Debug Mode
DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() == "true"

# ══════════════════════════════════════════════════════════════════

# ── Logging ──────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("newton")

def debug_log(stage: str, label: str, content: str, max_chars: int = 500):
    """Log debug information if DEBUG_MODE is enabled."""
    if DEBUG_MODE:
        truncated = content[:max_chars] + "..." if len(content) > max_chars else content
        logger.info(f"🔍 [{stage}] {label}:\n{truncated}\n{'='*60}")
    else:
        logger.info(f"[{stage}] {label}: {len(content)} chars")

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

# Track failed keys to detect exhaustion
failed_keys = set()


def get_next_api_key() -> str:
    """Get next API key in round-robin fashion."""
    global current_key_index
    if not GEMINI_API_KEYS:
        raise ValueError("No Gemini API keys configured")
    key = GEMINI_API_KEYS[current_key_index]
    current_key_index = (current_key_index + 1) % len(GEMINI_API_KEYS)
    logger.info(f"Using API key #{current_key_index + 1}/{len(GEMINI_API_KEYS)}")
    return key


def mark_key_failed(key_index: int):
    """Mark a key as failed (rate limited or exhausted)."""
    failed_keys.add(key_index)
    logger.warning(f"⚠️  Marked API key #{key_index + 1} as failed")


def all_keys_exhausted() -> bool:
    """Check if all Gemini keys have failed."""
    return len(failed_keys) >= len(GEMINI_API_KEYS)


def reset_failed_keys():
    """Reset failed keys tracker (call after successful request)."""
    failed_keys.clear()


# ── DynamoDB Session Storage ─────────────────────────────────────
DYNAMO_TABLE_NAME = os.getenv("DYNAMO_TABLE_NAME", "newton_ai_sessions")
try:
    dynamodb = boto3.resource("dynamodb", region_name=os.getenv("AWS_REGION", "us-east-1"))
    sessions_table = dynamodb.Table(DYNAMO_TABLE_NAME)
    logger.info(f"✓ Connected to DynamoDB table: {DYNAMO_TABLE_NAME}")
except Exception as e:
    logger.error(f"❌ DynamoDB init failed: {e}")
    sessions_table = None


# ── AWS Bedrock Client (Fallback) ────────────────────────────────
bedrock_client = None
if USE_BEDROCK_FALLBACK:
    try:
        bedrock_client = boto3.client(
            service_name="bedrock-runtime",
            region_name=BEDROCK_REGION
        )
        logger.info(f"✓ Bedrock fallback enabled: {BEDROCK_MODEL_ID}")
    except Exception as e:
        logger.error(f"❌ Bedrock client init failed: {e}")
        bedrock_client = None
else:
    logger.info("ℹ️  Bedrock fallback disabled")


def save_message(session_id: str, role: str, content: str):
    """Save message to DynamoDB."""
    if sessions_table is None:
        logger.warning("DynamoDB table not available, skipping save")
        return
    ts = datetime.now(timezone.utc).isoformat()
    try:
        sessions_table.put_item(
            Item={
                "session_id": session_id,
                "timestamp": ts,
                "role": role,
                "content": content,
            }
        )
    except Exception as e:
        logger.error(f"DynamoDB put_item failed: {e}")


def get_last_n_messages(session_id: str, n: int = 5) -> list:
    """Query DynamoDB for the last N messages and format for Gemini."""
    if sessions_table is None:
        logger.warning("DynamoDB table not available, returning empty history")
        return []
    try:
        response = sessions_table.query(
            KeyConditionExpression=Key("session_id").eq(session_id),
            ScanIndexForward=False,  # newest first
            Limit=n,
        )
        items = response.get("Items", [])
        # Reverse so they are chronological (oldest → newest)
        items.reverse()
        # Convert to Gemini chat format
        return [
            {"role": "user" if item["role"] == "user" else "model", "parts": [item["content"]]}
            for item in items
        ]
    except Exception as e:
        logger.error(f"DynamoDB query failed: {e}")
        return []


@app.on_event("startup")
def on_startup():
    logger.info("=" * 80)
    logger.info("🚀 NewtonAI Backend Starting")
    logger.info("=" * 80)
    logger.info(f"Environment: {'Production' if not DEBUG_MODE else 'Development (DEBUG)'}")
    logger.info(f"Gemini Model: {GEMINI_MODEL_NAME}")
    logger.info(f"Gemini API Keys: {len(GEMINI_API_KEYS)} loaded")
    logger.info(f"Bedrock Fallback: {'Enabled' if USE_BEDROCK_FALLBACK else 'Disabled'}")
    logger.info(f"Bedrock Available: {'Yes' if bedrock_client else 'No'}")
    logger.info(f"DynamoDB Available: {'Yes' if sessions_table else 'No'}")
    logger.info(f"Debug Mode: {'ON' if DEBUG_MODE else 'OFF'}")
    logger.info("=" * 80)
    logger.info("✓ Backend ready to accept requests")
    logger.info("=" * 80)


# ── Request models ───────────────────────────────────────────────
class GenerateRequest(BaseModel):
    prompt: str
    session_id: Optional[str] = None


# ── Physics Reasoning Prompt ─────────────────────────────────────
PHYSICS_REASONING_PROMPT = """You are a physics professor designing an educational simulation.

CRITICAL: Your response MUST start with a STATUS CODE in the first 5 characters:
- STATUS:1 = Approved, within scope, simple enough
- STATUS:2 = Out of scope (forbidden domain: circuits, fluids, quantum, thermodynamics, optics)
- STATUS:3 = Too complex (>5 objects or >3 links)
- STATUS:4 = Ambiguous or unclear request
- STATUS:0 = Other rejection reason

SCOPE CONSTRAINTS:
- ALLOWED DOMAINS: Simple mechanical physics (balls, pendulums, springs, ramps, collisions) and basic electrostatics (charged particles, electric fields)
- FORBIDDEN DOMAINS: Circuits, fluids, quantum mechanics, thermodynamics, optics, complex mechanics
- MAX COMPLEXITY: 5 objects maximum, 3 links maximum, simple scenarios only

ASSESSMENT CHECKLIST:
1. Is it simple mechanical or electrostatic? (YES/NO)
2. Can it be done with ≤5 objects? (YES/NO)
3. Does it avoid forbidden domains? (YES/NO)

If ANY answer is NO, respond with:
STATUS:[2 or 3 or 4]
REASON: [explain why in 1-2 sentences]

If ALL answers are YES, respond with:
STATUS:1
DOMAIN: [mechanical or electrostatic]

Then reason through the following in plain English. Do NOT output JSON.

CONTROL DESIGN PHILOSOPHY (CRITICAL):
When designing controls, STRONGLY PREFER runtime properties over initial conditions:

PREFERRED (Runtime - work immediately):
✓ Gravity strength (environment.gravity_y)
✓ Material properties (restitution, friction, density)
✓ Object size (radius, width, height, length)
✓ Link properties (spring constant, damping, rope length)
✓ For projectiles: Use ANGLE (degrees) and SPEED (m/s) as separate controls
  - Example: "Launch Angle" (0-90°) and "Launch Speed" (5-20 m/s)
  - The JSON encoder will convert these to velocity components

AVOID (Initial conditions - require reset):
✗ Direct position controls (object.position.x/y/z)
✗ Direct velocity components (initial_velocity.x/y/z)
✗ Rotation angles (rotation_deg.x/y/z)

EXCEPTION: Initial conditions are OK if they are the PRIMARY learning objective
(e.g., "how does drop height affect bounce" → drop height control is appropriate)

Think through:
1. What objects are needed? (type, size, position, material, color)
2. What are the initial conditions? (velocities, angles)
3. What constraints or links connect objects?
4. What 2-4 RUNTIME controls would let a student explore the core concept?
   - Prefer: gravity, material properties, object sizes, link properties
   - For projectiles: suggest angle (degrees) and speed (m/s) controls
5. What 3-step educational sequence would guide learning?
6. Are there any geometry issues? (objects overlapping floor, rope lengths matching distances, anchor vs static distinction)

Be specific with numbers. This reasoning will be passed to a JSON encoder so precision matters."""


def call_bedrock(user_prompt: str, system_prompt: str, max_tokens: int = 8192) -> str:
    """
    Call AWS Bedrock Nova Pro as fallback when Gemini keys are exhausted.
    
    Args:
        user_prompt: The user's prompt
        system_prompt: System instruction
        max_tokens: Maximum tokens to generate
        
    Returns:
        Raw text response from Nova Pro
    """
    if not bedrock_client:
        raise Exception("Bedrock client not initialized")
    
    logger.info("🔄 Using AWS Bedrock (Nova Pro) fallback")
    
    # Nova Pro API format
    request_body = {
        "messages": [
            {
                "role": "user",
                "content": [{"text": user_prompt}]
            }
        ],
        "system": [{"text": system_prompt}],
        "inferenceConfig": {
            "temperature": 0.1,
            "maxTokens": max_tokens,
        }
    }
    
    try:
        response = bedrock_client.converse(
            modelId=BEDROCK_MODEL_ID,
            messages=request_body["messages"],
            system=request_body["system"],
            inferenceConfig=request_body["inferenceConfig"]
        )
        
        # Extract text from response
        output_message = response["output"]["message"]
        text_content = output_message["content"][0]["text"]
        
        logger.info(f"✓ Bedrock response: {len(text_content)} chars")
        return text_content
        
    except Exception as e:
        logger.error(f"❌ Bedrock call failed: {e}")
        raise


def reason_about_physics(user_prompt: str) -> tuple[str, dict]:
    """
    Stage 1: Generate physics reasoning in plain English.
    
    Returns:
        (reasoning_text, complexity_check_dict)
        complexity_check_dict = {
            "status": "APPROVED" | "OUT_OF_SCOPE" | "TOO_COMPLEX" | "AMBIGUOUS",
            "status_code": int (0-4),
            "domain": "mechanical" | "electrostatic",
            "reason": str | None
        }
    """
    # Try Gemini first
    try:
        api_key = get_next_api_key()
        genai.configure(api_key=api_key)
        
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL_NAME,
            generation_config={
                "temperature": 0.7,
                "max_output_tokens": 2048  # Increased for complete reasoning
            },
            system_instruction=PHYSICS_REASONING_PROMPT
        )
        
        # Debug: Log input
        logger.info("=" * 80)
        logger.info("STAGE 1: PHYSICS REASONING - INPUT")
        logger.info("=" * 80)
        logger.info(f"System Instruction:\n{PHYSICS_REASONING_PROMPT}")
        logger.info("-" * 80)
        logger.info(f"User Prompt:\n{user_prompt}")
        logger.info("=" * 80)
        
        response = model.generate_content(user_prompt)
        reasoning = response.text.strip()
        
        # Success - reset failed keys tracker
        reset_failed_keys()
        
    except Exception as e:
        error_str = str(e).lower()
        
        # Check if it's a rate limit error
        if "429" in error_str or "quota" in error_str or "rate" in error_str:
            logger.warning(f"⚠️  Gemini rate limit hit: {e}")
            mark_key_failed(current_key_index - 1)
            
            # If all keys exhausted, try Bedrock
            if all_keys_exhausted() and USE_BEDROCK_FALLBACK and bedrock_client:
                logger.warning("⚠️  All Gemini keys exhausted, switching to Bedrock")
                try:
                    reasoning = call_bedrock(user_prompt, PHYSICS_REASONING_PROMPT, max_tokens=2048)
                except Exception as bedrock_error:
                    logger.error(f"❌ Bedrock fallback failed: {bedrock_error}")
                    raise Exception(f"Both Gemini and Bedrock failed. Gemini: {e}, Bedrock: {bedrock_error}")
            else:
                raise
        else:
            # Non-rate-limit error, just raise it
            raise
    
    # Parse STATUS code from first 10 characters
    complexity_check = {
        "status": "APPROVED",
        "status_code": 1,
        "domain": "mechanical",
        "reason": None
    }
    
    # Extract STATUS:X from beginning of response
    status_match = re.match(r'^STATUS:(\d)', reasoning)
    if status_match:
        status_code = int(status_match.group(1))
        complexity_check["status_code"] = status_code
        
        if status_code == 1:
            complexity_check["status"] = "APPROVED"
        elif status_code == 2:
            complexity_check["status"] = "OUT_OF_SCOPE"
        elif status_code == 3:
            complexity_check["status"] = "TOO_COMPLEX"
        elif status_code == 4:
            complexity_check["status"] = "AMBIGUOUS"
        else:
            complexity_check["status"] = "REJECTED"
        
        # Extract reason if rejected
        if status_code != 1 and "REASON:" in reasoning:
            reason_start = reasoning.find("REASON:") + 7
            reason_end = reasoning.find("\n\n", reason_start)
            if reason_end == -1:
                reason_end = reasoning.find("\n", reason_start)
            if reason_end == -1:
                reason_end = len(reasoning)
            complexity_check["reason"] = reasoning[reason_start:reason_end].strip()
    
    # Extract domain
    if "DOMAIN: electrostatic" in reasoning:
        complexity_check["domain"] = "electrostatic"
    elif "DOMAIN: mechanical" in reasoning:
        complexity_check["domain"] = "mechanical"
    
    # Debug: Log output
    logger.info("=" * 80)
    logger.info("STAGE 1: PHYSICS REASONING - OUTPUT")
    logger.info("=" * 80)
    logger.info(f"Complexity Check: {complexity_check}")
    logger.info("-" * 80)
    logger.info(f"Reasoning ({len(reasoning)} chars):\n{reasoning}")
    logger.info("=" * 80)
    
    return reasoning, complexity_check


def correct_json_errors(raw_json: str, errors: list) -> str:
    """Stage 3: Attempt to fix validation errors."""
    
    error_str = "\n".join(errors)
    fix_prompt = f"""The following JSON has validation errors. Fix ONLY the errors listed. Do not change anything else. Output raw JSON only.

ERRORS:
{error_str}

JSON TO FIX:
{raw_json}"""
    
    # Try Gemini first
    try:
        api_key = get_next_api_key()
        genai.configure(api_key=api_key)
        
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL_NAME,
            generation_config={
                "temperature": 0.0,
                "max_output_tokens": 8192,  # Increased to ensure complete JSON
                "response_mime_type": "application/json",  # Force JSON output
            },
            system_instruction=SYSTEM_PROMPT
        )
        
        # Debug: Log input
        logger.info("=" * 80)
        logger.info("STAGE 3: ERROR CORRECTION - INPUT")
        logger.info("=" * 80)
        logger.info(f"System Instruction: [SYSTEM_PROMPT - {len(SYSTEM_PROMPT)} chars]")
        logger.info("-" * 80)
        logger.info(f"Errors to fix ({len(errors)}):")
        for i, err in enumerate(errors[:5], 1):
            logger.info(f"  {i}. {err}")
        logger.info("-" * 80)
        logger.info(f"Raw JSON to fix ({len(raw_json)} chars):\n{raw_json[:500]}...")
        logger.info("=" * 80)
        
        response = model.generate_content(fix_prompt)
        corrected = response.text.strip()
        
        # Success - reset failed keys tracker
        reset_failed_keys()
        
    except Exception as e:
        error_str_lower = str(e).lower()
        
        # Check if it's a rate limit error
        if "429" in error_str_lower or "quota" in error_str_lower or "rate" in error_str_lower:
            logger.warning(f"⚠️  Gemini rate limit hit: {e}")
            mark_key_failed(current_key_index - 1)
            
            # If all keys exhausted, try Bedrock
            if all_keys_exhausted() and USE_BEDROCK_FALLBACK and bedrock_client:
                logger.warning("⚠️  All Gemini keys exhausted, switching to Bedrock")
                try:
                    corrected = call_bedrock(fix_prompt, SYSTEM_PROMPT, max_tokens=8192)
                except Exception as bedrock_error:
                    logger.error(f"❌ Bedrock fallback failed: {bedrock_error}")
                    raise Exception(f"Both Gemini and Bedrock failed. Gemini: {e}, Bedrock: {bedrock_error}")
            else:
                raise
        else:
            # Non-rate-limit error, just raise it
            raise
    
    # Debug: Log output
    logger.info("=" * 80)
    logger.info("STAGE 3: ERROR CORRECTION - OUTPUT")
    logger.info("=" * 80)
    logger.info(f"Corrected JSON ({len(corrected)} chars):\n{corrected[:500]}...")
    logger.info("=" * 80)
    
    return corrected


def try_validate(payload: dict) -> tuple:
    """
    Validate payload and return (validated_dict, list_of_error_strings).
    Empty error list means success.
    """
    mode = payload.get("mode", 1)
    schema = Mode2Schema if mode == 2 else PhysicsSchema
    
    try:
        validated = schema(**payload)
        return validated.model_dump(), []
    except ValidationError as e:
        errors = [
            f"{'.'.join(str(l) for l in err['loc'])}: {err['msg']}"
            for err in e.errors()
        ]
        return payload, errors


# ── Post-Generation Validation ──────────────────────────────────
def is_simulation_simple(payload: dict) -> bool:
    """Check if generated simulation meets simplicity constraints."""
    
    # Max object count
    if len(payload.get("objects", [])) > 5:
        logger.warning(f"Too many objects: {len(payload['objects'])}")
        return False
    
    # Max link count
    if len(payload.get("links", [])) > 3:
        logger.warning(f"Too many links: {len(payload['links'])}")
        return False
    
    # Check for forbidden object types
    FORBIDDEN_TYPES = ["fluid_emitter"]
    for obj in payload.get("objects", []):
        if obj.get("type") in FORBIDDEN_TYPES:
            logger.warning(f"Forbidden object type: {obj['type']}")
            return False
    
    # Mode check (only mode 1 for mechanical, mode 2 for electrostatic)
    mode = payload.get("mode", 1)
    if mode not in [1, 2]:
        logger.warning(f"Invalid mode: {mode}")
        return False
    
    return True


# ── Helper: call Gemini ──────────────────────────────────────────
def call_gemini(user_prompt: str, history: list = [], max_tokens: int = 8192) -> str:
    """Call Google Gemini 3 Flash Preview and return raw text response."""
    
    # Try Gemini first
    try:
        api_key = get_next_api_key()
        genai.configure(api_key=api_key)
        
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL_NAME,
            generation_config={
                "temperature": 0.1,
                "max_output_tokens": max_tokens,
                "response_mime_type": "application/json",  # Force JSON output
            },
            system_instruction=SYSTEM_PROMPT
        )
        
        # Debug: Log input
        logger.info("=" * 80)
        logger.info("STAGE 2: JSON ENCODING - INPUT")
        logger.info("=" * 80)
        logger.info(f"System Instruction: [SYSTEM_PROMPT - {len(SYSTEM_PROMPT)} chars]")
        logger.info("-" * 80)
        logger.info(f"History messages: {len(history)}")
        for i, msg in enumerate(history, 1):
            role = msg.get('role', 'unknown')
            content = str(msg.get('parts', [''])[0])[:100]
            logger.info(f"  {i}. [{role}] {content}...")
        logger.info("-" * 80)
        logger.info(f"User Prompt:\n{user_prompt}")
        logger.info("=" * 80)
        
        # Start chat with history
        chat = model.start_chat(history=history)
        
        # Send message
        response = chat.send_message(user_prompt)
        raw_text = response.text.strip()
        
        # Success - reset failed keys tracker
        reset_failed_keys()
        
    except Exception as e:
        error_str = str(e).lower()
        
        # Check if it's a rate limit error
        if "429" in error_str or "quota" in error_str or "rate" in error_str:
            logger.warning(f"⚠️  Gemini rate limit hit: {e}")
            mark_key_failed(current_key_index - 1)
            
            # If all keys exhausted, try Bedrock
            if all_keys_exhausted() and USE_BEDROCK_FALLBACK and bedrock_client:
                logger.warning("⚠️  All Gemini keys exhausted, switching to Bedrock")
                try:
                    raw_text = call_bedrock(user_prompt, SYSTEM_PROMPT, max_tokens=max_tokens)
                except Exception as bedrock_error:
                    logger.error(f"❌ Bedrock fallback failed: {bedrock_error}")
                    raise Exception(f"Both Gemini and Bedrock failed. Gemini: {e}, Bedrock: {bedrock_error}")
            else:
                raise
        else:
            # Non-rate-limit error, just raise it
            raise
    
    # Check if response was truncated
    if hasattr(response, 'candidates') and len(response.candidates) > 0:
        candidate = response.candidates[0]
        if hasattr(candidate, 'finish_reason'):
            finish_reason = str(candidate.finish_reason)
            logger.info(f"🔍 Finish reason: {finish_reason}")
            
            # Check for truncation indicators
            if 'MAX_TOKENS' in finish_reason or 'LENGTH' in finish_reason:
                logger.warning(f"⚠️ Response may be truncated due to: {finish_reason}")
            elif 'SAFETY' in finish_reason:
                logger.error(f"❌ Response blocked by safety filters: {finish_reason}")
                raise Exception(f"Content blocked by safety filters: {finish_reason}")
    
    # Debug: Log output
    logger.info("=" * 80)
    logger.info("STAGE 2: JSON ENCODING - OUTPUT")
    logger.info("=" * 80)
    logger.info(f"Raw response ({len(raw_text)} chars):")
    if len(raw_text) > 2000:
        logger.info(f"{raw_text[:1000]}")
        logger.info(f"... [middle {len(raw_text) - 2000} chars omitted] ...")
        logger.info(f"{raw_text[-1000:]}")
    else:
        logger.info(raw_text)
    logger.info("=" * 80)
    
    return raw_text


def extract_json(text: str) -> tuple[dict | None, str | None]:
    """
    Extract JSON from model response, stripping markdown fences if present.
    
    Returns:
        (payload_dict, error_message) - payload is None if extraction completely failed
    """
    logger.info(f"🔍 Extracting JSON from response ({len(text)} chars)")
    
    # Strip markdown code fences
    cleaned = re.sub(r'^```[a-z]*\n?', '', text)
    cleaned = re.sub(r'\n?```$', '', cleaned)
    cleaned = cleaned.strip()
    
    logger.info(f"🔍 After cleaning: {len(cleaned)} chars")

    # Try direct parse
    try:
        result = json.loads(cleaned)
        logger.info(f"✓ Direct JSON parse successful")
        return result, None
    except json.JSONDecodeError as e:
        logger.warning(f"⚠ Direct parse failed: {e}")

    # Find the first { ... last }
    start = cleaned.find('{')
    end = cleaned.rfind('}')
    logger.info(f"🔍 JSON boundaries: start={start}, end={end}")
    
    if start != -1 and end != -1 and end > start:
        try:
            extracted = cleaned[start:end + 1]
            logger.info(f"🔍 Extracted JSON substring: {len(extracted)} chars")
            result = json.loads(extracted)
            logger.info(f"✓ Extracted JSON parse successful")
            return result, None
        except json.JSONDecodeError as e:
            logger.error(f"❌ Extracted parse failed: {e}")
            logger.error(f"❌ Last 200 chars of extracted: {extracted[-200:]}")
            # Return the extracted text as error for Stage 3 to fix
            return None, f"JSON parse error at position {e.pos}: {e.msg}"

    logger.error(f"❌ Could not find valid JSON boundaries")
    return None, "No JSON object found in response"


# ── Main endpoint ────────────────────────────────────────────────
@app.post("/generate")
async def generate_simulation(request: GenerateRequest):
    """
    Generate a physics simulation using a two-stage pipeline:
    
    Stage 1: Physics Reasoning (plain English)
    Stage 2: JSON Encoding (structured output)
    Stage 3: Validation + Error Correction (if needed)
    """
    request_id = str(uuid.uuid4())[:8]
    start_time = datetime.now(timezone.utc)
    
    logger.info("\n" + "█" * 80)
    logger.info(f"NEW SIMULATION REQUEST [{request_id}]")
    logger.info("█" * 80)
    logger.info(f"Timestamp: {start_time.isoformat()}")
    logger.info(f"User Prompt: '{request.prompt.strip()}'")
    logger.info(f"Session ID: {request.session_id or 'NEW'}")
    logger.info(f"Prompt Length: {len(request.prompt)} chars")
    logger.info("█" * 80 + "\n")
    
    prompt = request.prompt.strip()
    if not prompt:
        logger.error(f"[{request_id}] ❌ Empty prompt rejected")
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    session_id = request.session_id or str(uuid.uuid4())
    # Note: History not needed for simulation generation - each sim is independent

    # ── Stage 1: Physics Reasoning (with Gemini complexity check) ─
    stage1_start = datetime.now(timezone.utc)
    try:
        logger.info(f"[{request_id}] → Starting Stage 1: Physics Reasoning")
        physics_reasoning, gemini_complexity_check = reason_about_physics(prompt)
        stage1_duration = (datetime.now(timezone.utc) - stage1_start).total_seconds()
        
        logger.info(f"[{request_id}] ✓ Stage 1 complete in {stage1_duration:.2f}s")
        logger.info(f"[{request_id}]   - Reasoning: {len(physics_reasoning)} chars")
        logger.info(f"[{request_id}]   - Status: {gemini_complexity_check['status']}")
        logger.info(f"[{request_id}]   - Domain: {gemini_complexity_check['domain']}")
        
        # Check if Gemini rejected the prompt
        if gemini_complexity_check["status"] != "APPROVED":
            status_code = gemini_complexity_check["status_code"]
            reason = gemini_complexity_check["reason"] or "This simulation cannot be created."
            
            # Map status codes to error types
            error_type_map = {
                2: "out_of_scope",
                3: "too_complex",
                4: "ambiguous",
                0: "rejected"
            }
            
            error_type = error_type_map.get(status_code, "rejected")
            
            logger.warning(f"[{request_id}] ⚠ Prompt rejected: STATUS:{status_code} - {reason}")
            raise HTTPException(
                status_code=400,
                detail={
                    "error": error_type,
                    "message": reason,
                    "suggestion": "Try: 'bouncing ball', 'simple pendulum', 'ball rolling down ramp', or 'two charged particles'"
                }
            )
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        stage1_duration = (datetime.now(timezone.utc) - stage1_start).total_seconds()
        logger.error(f"[{request_id}] ❌ Stage 1 failed after {stage1_duration:.2f}s: {e}")
        raise HTTPException(
            status_code=502,
            detail={
                "error": "reasoning_failure",
                "message": "Failed to generate physics reasoning. Please try again.",
                "technical_detail": str(e)
            }
        )

    # ── Stage 2: JSON Encoding ───────────────────────────────────
    stage2_start = datetime.now(timezone.utc)
    encoding_prompt = f"""Student request: {prompt}

Physics reasoning:
{physics_reasoning}

Now encode this as a valid simulation JSON."""

    logger.info(f"[{request_id}] → Starting Stage 2: JSON Encoding")
    logger.info(f"[{request_id}]   - Encoding prompt: {len(encoding_prompt)} chars")

    try:
        # Don't pass history - each simulation should be independent
        raw_text = call_gemini(encoding_prompt, history=[])
        stage2_duration = (datetime.now(timezone.utc) - stage2_start).total_seconds()
        
        logger.info(f"[{request_id}] ✓ Stage 2 complete in {stage2_duration:.2f}s")
        logger.info(f"[{request_id}]   - Response: {len(raw_text)} chars")
    except Exception as e:
        stage2_duration = (datetime.now(timezone.utc) - stage2_start).total_seconds()
        logger.error(f"[{request_id}] ❌ Stage 2 failed after {stage2_duration:.2f}s: {e}")
        raise HTTPException(
            status_code=502,
            detail={
                "error": "encoding_failure",
                "message": "Failed to encode simulation. Please try again.",
                "technical_detail": str(e)
            }
        )

    # ── Extract JSON ─────────────────────────────────────────────
    logger.info(f"[{request_id}] → Extracting JSON from response")
    payload, extraction_error = extract_json(raw_text)
    
    if payload:
        logger.info(f"[{request_id}] ✓ JSON extracted successfully")
        logger.info(f"[{request_id}]   - Title: {payload.get('title', 'N/A')}")
        logger.info(f"[{request_id}]   - Mode: {payload.get('mode', 'N/A')}")
        logger.info(f"[{request_id}]   - Objects: {len(payload.get('objects', []))}")
        logger.info(f"[{request_id}]   - Links: {len(payload.get('links', []))}")
        logger.info(f"[{request_id}]   - Controls: {len(payload.get('controls', []))}")
    else:
        logger.error(f"[{request_id}] ❌ JSON extraction failed: {extraction_error}")
        logger.info(f"[{request_id}] → Attempting Stage 3 correction on malformed JSON")
        
        # Try to fix the malformed JSON using Stage 3
        stage3_start = datetime.now(timezone.utc)
        try:
            corrected_text = correct_json_errors(raw_text, [extraction_error])
            payload, extraction_error2 = extract_json(corrected_text)
            stage3_duration = (datetime.now(timezone.utc) - stage3_start).total_seconds()
            
            if not payload:
                logger.error(f"[{request_id}] ❌ Stage 3 correction failed after {stage3_duration:.2f}s: {extraction_error2}")
                raise HTTPException(
                    status_code=502,
                    detail={
                        "error": "invalid_response",
                        "message": "AI returned invalid format that could not be corrected.",
                        "suggestion": "Use simple language: 'show me a bouncing ball' or 'create a pendulum'",
                        "technical_detail": extraction_error2
                    }
                )
            else:
                logger.info(f"[{request_id}] ✓ Stage 3 fixed malformed JSON in {stage3_duration:.2f}s")
        except Exception as e:
            stage3_duration = (datetime.now(timezone.utc) - stage3_start).total_seconds()
            logger.error(f"[{request_id}] ❌ Stage 3 correction crashed after {stage3_duration:.2f}s: {e}")
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "invalid_response",
                    "message": "AI returned invalid format. Please try rephrasing your prompt.",
                    "suggestion": "Use simple language: 'show me a bouncing ball' or 'create a pendulum'"
                }
            )

    # ── Stage 3: Validate + Correction ───────────────────────────
    logger.info(f"[{request_id}] → Validating JSON against schema")
    validated, errors = try_validate(payload)
    
    if errors:
        logger.warning(f"[{request_id}] ⚠ Validation errors found: {len(errors)}")
        for i, err in enumerate(errors[:5], 1):
            logger.warning(f"[{request_id}]   {i}. {err}")
        
        logger.info(f"[{request_id}] → Attempting automatic error correction")
        
        stage3_start = datetime.now(timezone.utc)
        try:
            corrected_text = correct_json_errors(raw_text, errors[:5])  # Only send first 5 errors
            corrected_payload, extraction_error3 = extract_json(corrected_text)
            stage3_duration = (datetime.now(timezone.utc) - stage3_start).total_seconds()
            
            if not corrected_payload:
                logger.warning(f"[{request_id}] ⚠ Correction produced invalid JSON: {extraction_error3}")
                logger.warning(f"[{request_id}] → Using original payload")
            else:
                validated, remaining_errors = try_validate(corrected_payload)
                
                if remaining_errors:
                    logger.warning(f"[{request_id}] ⚠ Correction incomplete after {stage3_duration:.2f}s: {len(remaining_errors)} errors remain")
                    for i, err in enumerate(remaining_errors[:3], 1):
                        logger.warning(f"[{request_id}]   {i}. {err}")
                else:
                    logger.info(f"[{request_id}] ✓ Stage 3 complete in {stage3_duration:.2f}s: All errors corrected")
        except Exception as e:
            stage3_duration = (datetime.now(timezone.utc) - stage3_start).total_seconds()
            logger.warning(f"[{request_id}] ⚠ Correction failed after {stage3_duration:.2f}s: {e}")
            logger.warning(f"[{request_id}] → Using best-effort payload")
            validated = payload
    else:
        logger.info(f"[{request_id}] ✓ Validation passed on first try")

    # ── Post-validation complexity check ─────────────────────────
    logger.info(f"[{request_id}] → Checking simulation complexity")
    if not is_simulation_simple(validated):
        logger.warning(f"[{request_id}] ❌ Simulation too complex")
        raise HTTPException(
            status_code=400,
            detail={
                "error": "too_complex",
                "message": "The generated simulation is too complex. Please simplify your prompt.",
                "suggestion": "Try: 'one ball bouncing' instead of 'five balls colliding'"
            }
        )
    
    logger.info(f"[{request_id}] ✓ Complexity check passed")

    total_duration = (datetime.now(timezone.utc) - start_time).total_seconds()
    
    logger.info("\n" + "█" * 80)
    logger.info(f"✓ SIMULATION GENERATED SUCCESSFULLY [{request_id}]")
    logger.info("█" * 80)
    logger.info(f"Title: {validated.get('title', '?')}")
    logger.info(f"Mode: {validated.get('mode', '?')}")
    logger.info(f"Session: {session_id}")
    logger.info(f"Total Duration: {total_duration:.2f}s")
    logger.info(f"Stage 1: {stage1_duration:.2f}s | Stage 2: {stage2_duration:.2f}s")
    logger.info("█" * 80 + "\n")
    
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
    request_id = str(uuid.uuid4())[:8]
    logger.info(f"[{request_id}] 💬 Chat request: session={request.session_id}, question='{request.question[:50]}...'")
    
    history = get_last_n_messages(request.session_id)
    logger.info(f"[{request_id}] Retrieved {len(history)} history messages")
    
    try:
        api_key = get_next_api_key()
        genai.configure(api_key=api_key)
        
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL_NAME,
            generation_config={
                "temperature": 0.7,
                "max_output_tokens": 300,
            },
            system_instruction=CHAT_SYSTEM_PROMPT
        )
        
        chat_session = model.start_chat(history=history)
        response = chat_session.send_message(request.question)
        answer = response.text.strip()
        
        logger.info(f"[{request_id}] ✓ Chat response generated: {len(answer)} chars")
    except Exception as e:
        logger.error(f"[{request_id}] ❌ Chat failed: {e}")
        raise HTTPException(status_code=502, detail=str(e))
    
    save_message(request.session_id, "user", request.question)
    save_message(request.session_id, "assistant", answer)
    
    return ChatResponse(session_id=request.session_id, answer=answer)


# ── Health check ─────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": GEMINI_MODEL_NAME,
        "api_keys_loaded": len(GEMINI_API_KEYS),
        "failed_keys": len(failed_keys),
        "bedrock_fallback_enabled": USE_BEDROCK_FALLBACK,
        "bedrock_available": bedrock_client is not None,
        "debug_mode": DEBUG_MODE
    }

# ── Mangum handler for AWS Lambda ────────────────────────────────
handler = Mangum(app)
