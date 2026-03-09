# NewtonAI - Design Document

## System Architecture

### High-Level Overview

```
┌─────────────────┐
│   User Browser  │
│   (React + TS)  │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│  FastAPI Backend│
│   (Python 3.11) │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────┐
│ Gemini │ │ Bedrock  │
│  API   │ │ Nova Pro │
└────────┘ └──────────┘
    │         │
    └────┬────┘
         ▼
┌─────────────────┐
│    DynamoDB     │
│  (Sessions)     │
└─────────────────┘
```

## Backend Design

### 1. Three-Stage Generation Pipeline

#### Stage 1: Physics Reasoning
**Purpose**: Generate plain English physics reasoning with complexity validation

**Input**:
- User prompt (natural language)
- System instruction (PHYSICS_REASONING_PROMPT)

**Process**:
1. Call Gemini with reasoning prompt
2. Parse STATUS code from response (STATUS:0-4)
3. Extract domain (mechanical/electrostatic)
4. Extract rejection reason if applicable
5. Return reasoning text + complexity check dict

**Output**:
```python
(reasoning_text: str, complexity_check: dict)

complexity_check = {
    "status": "APPROVED" | "OUT_OF_SCOPE" | "TOO_COMPLEX" | "AMBIGUOUS",
    "status_code": int (0-4),
    "domain": "mechanical" | "electrostatic",
    "reason": str | None
}
```

**Status Codes**:
- STATUS:1 = Approved, within scope
- STATUS:2 = Out of scope (forbidden domain)
- STATUS:3 = Too complex (>5 objects or >3 links)
- STATUS:4 = Ambiguous or unclear request
- STATUS:0 = Other rejection reason

**Error Handling**:
- Catch rate limit errors (429, quota, rate)
- Mark failed keys
- Fallback to Bedrock if all keys exhausted
- Reset failed keys on success

#### Stage 2: JSON Encoding
**Purpose**: Convert physics reasoning into structured JSON simulation

**Input**:
- User prompt
- Physics reasoning from Stage 1
- System instruction (SYSTEM_PROMPT from bedrock_prompt.py)

**Process**:
1. Create encoding prompt combining user request + reasoning
2. Call Gemini with JSON MIME type enforcement
3. Extract JSON from response
4. Check finish_reason for truncation
5. Return raw JSON text

**Output**:
- Raw JSON string (8192 token limit)

**Configuration**:
- Temperature: 0.1 (deterministic)
- Max tokens: 8192
- Response MIME type: application/json
- No conversation history

**Error Handling**:
- Detect rate limits, fallback to Bedrock
- Log finish_reason for truncation detection
- Catch safety filter blocks

#### Stage 3: Validation + Error Correction
**Purpose**: Validate JSON against schema and auto-correct errors

**Input**:
- Raw JSON from Stage 2
- Validation errors (if any)

**Process**:
1. Parse JSON (strip markdown fences)
2. Validate against PhysicsSchema or Mode2Schema
3. If errors found, call Gemini to fix
4. Re-validate corrected JSON
5. Return validated dict

**Output**:
- Validated simulation dict
- List of remaining errors (empty if success)

**Configuration**:
- Temperature: 0.0 (precise fixes)
- Max tokens: 8192
- Response MIME type: application/json

**Error Handling**:
- Fallback to Bedrock if Gemini exhausted
- Best-effort payload if correction fails
- Log all validation errors

### 2. AI Model Integration

#### Gemini Configuration
```python
GEMINI_MODEL_NAME = "gemini-3-flash-preview"
GEMINI_API_KEYS = [key1, key2, key3, key4, key5]  # 1-5 keys
current_key_index = 0  # Round-robin
failed_keys = set()  # Track exhausted keys
```

**Load Balancing**:
- Round-robin across 1-5 API keys
- Automatic key rotation
- Failed key tracking
- Reset on successful request

**Rate Limit Detection**:
```python
if "429" in error or "quota" in error or "rate" in error:
    mark_key_failed(current_key_index)
    if all_keys_exhausted():
        switch_to_bedrock()
```

#### Bedrock Fallback
```python
USE_BEDROCK_FALLBACK = True  # Environment variable
BEDROCK_MODEL_ID = "us.amazon.nova-pro-v1:0"
BEDROCK_REGION = "us-east-1"
```

**Fallback Logic**:
1. Try Gemini with current key
2. On 429/quota/rate error, mark key as failed
3. If all keys failed, switch to Bedrock
4. Call Bedrock with same prompt
5. Return Bedrock response
6. Reset failed keys on next success

**Bedrock API Format**:
```python
{
    "messages": [{"role": "user", "content": [{"text": prompt}]}],
    "system": [{"text": system_prompt}],
    "inferenceConfig": {
        "temperature": 0.1,
        "maxTokens": 8192
    }
}
```

### 3. Logging Architecture

#### Request Tracking
```python
request_id = str(uuid.uuid4())[:8]  # 8-char unique ID
start_time = datetime.now(timezone.utc)
```

**Log Format**:
```
[request_id] LEVEL Message
[a1b2c3d4] INFO → Starting Stage 1: Physics Reasoning
[a1b2c3d4] ✓ Stage 1 complete in 12.34s
```

#### Startup Banner
```
================================================================================
🚀 NewtonAI Backend Starting
================================================================================
Environment: Production
Gemini Model: gemini-3-flash-preview
Gemini API Keys: 3 loaded
Bedrock Fallback: Enabled
Bedrock Available: Yes
DynamoDB Available: Yes
Debug Mode: OFF
================================================================================
✓ Backend ready to accept requests
================================================================================
```

#### Request Logging
```
████████████████████████████████████████████████████████████████████████████████
NEW SIMULATION REQUEST [a1b2c3d4]
████████████████████████████████████████████████████████████████████████████████
Timestamp: 2024-01-15T10:30:45.123Z
User Prompt: 'bouncing ball'
Session ID: 550e8400-e29b-41d4-a716-446655440000
Prompt Length: 13 chars
████████████████████████████████████████████████████████████████████████████████
```

#### Stage Logging
```
[a1b2c3d4] → Starting Stage 1: Physics Reasoning
[a1b2c3d4] ✓ Stage 1 complete in 12.34s
[a1b2c3d4]   - Reasoning: 1234 chars
[a1b2c3d4]   - Status: APPROVED
[a1b2c3d4]   - Domain: mechanical
```

#### Success Logging
```
████████████████████████████████████████████████████████████████████████████████
✓ SIMULATION GENERATED SUCCESSFULLY [a1b2c3d4]
████████████████████████████████████████████████████████████████████████████████
Title: Bouncing Ball
Mode: 1
Session: 550e8400-e29b-41d4-a716-446655440000
Total Duration: 45.67s
Stage 1: 12.34s | Stage 2: 28.90s
████████████████████████████████████████████████████████████████████████████████
```

#### Error Logging
```
[a1b2c3d4] ❌ Stage 2 failed after 5.23s: 429 Resource exhausted
[a1b2c3d4] ⚠️  Gemini rate limit hit
[a1b2c3d4] ⚠️  Marked API key #2 as failed
[a1b2c3d4] ⚠️  All Gemini keys exhausted, switching to Bedrock
[a1b2c3d4] 🔄 Using AWS Bedrock (Nova Pro) fallback
```

### 4. Data Models

#### Request Models
```python
class GenerateRequest(BaseModel):
    prompt: str  # User's natural language prompt
    session_id: Optional[str] = None  # Session ID (generated if None)

class ChatRequest(BaseModel):
    session_id: str  # Required for chat context
    question: str  # User's question
    simulation_id: str  # Current simulation ID
```

#### Response Models
```python
class ChatResponse(BaseModel):
    session_id: str
    answer: str

# Generate endpoint returns:
{
    "session_id": str,
    "simulation": dict  # Validated PhysicsSchema or Mode2Schema
}
```

#### Simulation Schema (Mode 1)
```python
{
    "simulation_id": str,
    "title": str,
    "description": str,
    "physics_concept": str,
    "mode": 1,
    "difficulty": "beginner" | "intermediate" | "advanced",
    "tags": [str],
    "is_qualitative": bool,
    "environment": {
        "gravity_y": float,
        "background": str,
        "ambient_light": float,
        "show_axes": bool,
        "show_grid": bool,
        "camera_position": {"x": float, "y": float, "z": float},
        "fog_enabled": bool
    },
    "objects": [
        {
            "type": str,  # sphere, box, cylinder, plane, ramp, etc.
            "id": str,
            "label": str,
            "education_note": str,
            "is_static": bool,
            "is_anchor": bool,
            "color": str,  # hex
            "position": {"x": float, "y": float, "z": float},
            "material": {
                "preset": str,
                "restitution": float,
                "friction": float,
                "density": float
            },
            # Type-specific fields...
        }
    ],
    "links": [
        {
            "id": str,
            "type": str,  # rope, spring_link, rigid_rod, hinge, etc.
            "label": str,
            "education_note": str,
            "object_a": {
                "id": str,
                "attachment_point": str,
                "offset": {"x": float, "y": float, "z": float}
            },
            "object_b": {
                "id": str,
                "attachment_point": str,
                "offset": {"x": float, "y": float, "z": float}
            },
            "properties": dict  # Type-specific
        }
    ],
    "controls": [
        {
            "group": str,
            "label": str,
            "param": str,  # dot notation: "object_id.field"
            "min": float,
            "max": float,
            "default": float,
            "step": float,
            "unit": str,
            "education_note": str
        }
    ],
    "educational_sequence": [
        {
            "step": int,
            "title": str,
            "instruction": str,
            "focus_objects": [str],
            "focus_controls": [str]
        }
    ]
}
```

### 5. Control Design Philosophy

#### Runtime Controls (Preferred)
These apply immediately without reset:
- `environment.gravity_y` - Gravity strength
- `object.material.restitution` - Bounciness
- `object.material.friction` - Surface friction
- `object.material.density` - Mass (via density)
- `object.radius` - Object size
- `link.spring_constant` - Spring stiffness
- `link.damping` - Damping coefficient

#### Initial Condition Controls (Auto-Reset)
These trigger automatic simulation reset:
- `object.position.x/y/z` - Starting position
- `object.initial_velocity.x/y/z` - Launch velocity
- `object.rotation_deg.x/y/z` - Starting rotation

**Implementation**:
```typescript
// Frontend: PhysicsWorld.tsx
const remountKey = useMemo(() => {
    return JSON.stringify({
        material: object.material,
        geometry: object.geometry,
        initial_velocity: object.initial_velocity,
        rotation_deg: object.rotation_deg
    });
}, [object]);

// Triggers remount when these change
<Physics key={remountKey}>
```

### 6. Frontend Architecture

#### Component Structure
```
App.tsx
├── ControlPanel.tsx (integrated chat)
├── PhysicsWorld.tsx (simulation engine)
│   ├── SceneSetup.tsx
│   ├── ObjectMesh.tsx
│   ├── Joints.tsx
│   └── BodyTrail.tsx
└── Sidebar (simulation history)
```

#### State Management
```typescript
// App.tsx
const [simulation, setSimulation] = useState(null);
const [isGenerating, setIsGenerating] = useState(false);
const [error, setError] = useState(null);
const [showChat, setShowChat] = useState(false);
const [elapsedTime, setElapsedTime] = useState(0);
const [history, setHistory] = useState([]);
```

#### Simulation History
```typescript
// localStorage key: 'newton_simulation_history'
interface HistoryItem {
    simulation_id: string;
    title: string;
    timestamp: number;
    isUserGenerated: boolean;
}

// Max 10 items, newest first
// Deduplication by simulation_id
```

#### Auto-Reset Logic
```typescript
useEffect(() => {
    if (hasInitialConditionChanged(controls)) {
        resetSimulation();
    }
}, [controls]);

function hasInitialConditionChanged(controls) {
    return controls.some(c => 
        c.param.includes('position') ||
        c.param.includes('initial_velocity') ||
        c.param.includes('rotation_deg')
    );
}
```

### 7. Error Handling Design

#### Error Types
```python
ERROR_TYPES = {
    "out_of_scope": {
        "status_code": 400,
        "message": "This domain is not supported",
        "suggestion": "Try simple mechanical or electrostatic scenarios"
    },
    "too_complex": {
        "status_code": 400,
        "message": "Simulation too complex",
        "suggestion": "Simplify to ≤5 objects and ≤3 links"
    },
    "ambiguous": {
        "status_code": 400,
        "message": "Request unclear",
        "suggestion": "Be more specific about the physics scenario"
    },
    "reasoning_failure": {
        "status_code": 502,
        "message": "Failed to generate physics reasoning",
        "suggestion": "Please try again"
    },
    "encoding_failure": {
        "status_code": 502,
        "message": "Failed to encode simulation",
        "suggestion": "Please try again"
    },
    "invalid_response": {
        "status_code": 502,
        "message": "AI returned invalid format",
        "suggestion": "Use simple language: 'bouncing ball' or 'pendulum'"
    }
}
```

#### Error Response Format
```json
{
    "error": "out_of_scope",
    "message": "This domain is not supported",
    "suggestion": "Try simple mechanical or electrostatic scenarios",
    "technical_detail": "STATUS:2 - Circuits are forbidden"
}
```

#### Frontend Error Display
```typescript
{error && (
    <div className="error-banner">
        <h3>{error.message}</h3>
        <p>{error.suggestion}</p>
        {DEBUG_MODE && <pre>{error.technical_detail}</pre>}
    </div>
)}
```

### 8. Session Management

#### DynamoDB Schema
```python
Table: newton_ai_sessions
Partition Key: session_id (String)
Sort Key: timestamp (String, ISO 8601)

Item:
{
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-15T10:30:45.123Z",
    "role": "user" | "assistant",
    "content": str  # Message content or JSON simulation
}
```

#### Message Storage
```python
def save_message(session_id: str, role: str, content: str):
    sessions_table.put_item(Item={
        "session_id": session_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "role": role,
        "content": content
    })
```

#### Message Retrieval
```python
def get_last_n_messages(session_id: str, n: int = 5) -> list:
    response = sessions_table.query(
        KeyConditionExpression=Key("session_id").eq(session_id),
        ScanIndexForward=False,  # Newest first
        Limit=n
    )
    items = response["Items"]
    items.reverse()  # Chronological order
    return format_for_gemini(items)
```

### 9. Performance Optimization

#### Token Limit Strategy
```python
STAGE_1_TOKENS = 2048   # Physics reasoning
STAGE_2_TOKENS = 8192   # JSON encoding (large)
STAGE_3_TOKENS = 8192   # Error correction (large)
```

**Rationale**:
- Stage 1: Reasoning is concise, 2048 sufficient
- Stage 2: JSON can be large (5000+ chars), need 8192
- Stage 3: Corrections may include full JSON, need 8192

#### History Optimization
```python
# DON'T pass history to simulation generation
raw_text = call_gemini(encoding_prompt, history=[])

# DO pass history to chat
chat_response = call_gemini(question, history=get_last_n_messages(session_id))
```

**Impact**:
- Saves 2000-5000 tokens per request
- Reduces generation time by 60-120 seconds
- Each simulation is independent

#### Load Balancing
```python
# Round-robin across keys
current_key_index = (current_key_index + 1) % len(GEMINI_API_KEYS)

# With 5 keys: 75 requests/minute (15 per key)
# With 3 keys: 45 requests/minute (15 per key)
```

### 10. Deployment Architecture

#### AWS Lambda
```python
# Mangum handler for Lambda
from mangum import Mangum
handler = Mangum(app)
```

**Configuration**:
- Runtime: Python 3.9
- Memory: 512 MB
- Timeout: 300 seconds (5 minutes)
- Environment variables from .env

#### Environment Variables
```bash
# Required
GEMINI_API_KEY_1=...
GEMINI_API_KEY_2=...

# Optional
USE_BEDROCK_FALLBACK=true
AWS_REGION=us-east-1
DYNAMO_TABLE_NAME=newton_ai_sessions
DEBUG_MODE=false
```

#### IAM Permissions
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel",
                "dynamodb:PutItem",
                "dynamodb:Query",
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "*"
        }
    ]
}
```

### 11. Monitoring and Observability

#### Health Endpoint
```python
GET /health

Response:
{
    "status": "ok",
    "model": "gemini-3-flash-preview",
    "api_keys_loaded": 3,
    "failed_keys": 0,
    "bedrock_fallback_enabled": true,
    "bedrock_available": true,
    "debug_mode": false
}
```

#### CloudWatch Metrics
- Request count
- Generation duration (by stage)
- Error rate (by type)
- API key failures
- Bedrock fallback usage

#### CloudWatch Logs
- Structured JSON logs
- Request ID tracking
- Stage-by-stage execution
- Error stack traces
- Performance metrics

### 12. Security Considerations

#### API Key Security
- Never log full API keys
- Store in environment variables
- Rotate regularly
- Use AWS Secrets Manager (production)

#### Input Validation
- Max prompt length: 500 chars
- Min prompt length: 3 chars
- Sanitize special characters
- Reject SQL injection patterns

#### CORS Configuration
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
```

## Design Decisions

### Why Three Stages?
1. **Stage 1 (Reasoning)**: Validates complexity early, saves tokens
2. **Stage 2 (Encoding)**: Separates reasoning from JSON generation
3. **Stage 3 (Correction)**: Auto-fixes common errors, improves success rate

### Why Bedrock Fallback?
- High availability when Gemini exhausted
- Seamless user experience
- No manual intervention required
- Cost-effective (only used when needed)

### Why No History in Generation?
- Each simulation is independent
- Saves 2000-5000 tokens per request
- Reduces generation time by 60-120 seconds
- History only useful for chat context

### Why Auto-Reset on Initial Conditions?
- Better UX than manual reset button
- Clear distinction: runtime vs initial conditions
- Immediate feedback on changes
- Matches user expectations

### Why Integrated Chat?
- Cleaner UI without separate dialogs
- More screen space for simulation
- Toggle between controls and chat
- Consistent with modern design patterns

## Future Enhancements

### Phase 2
- Caching layer for common simulations
- Streaming JSON generation
- WebSocket for real-time updates
- Advanced physics domains

### Phase 3
- Multi-language support
- User accounts and authentication
- Saved simulation library
- Collaborative features
- Mobile app

## Testing Strategy

### Unit Tests
- Validation functions
- JSON extraction
- Error handling
- Key rotation logic

### Integration Tests
- End-to-end generation pipeline
- Bedrock fallback behavior
- DynamoDB operations
- API endpoint responses

### Performance Tests
- Load testing with multiple keys
- Stress testing rate limits
- Latency measurements
- Token usage optimization

### User Acceptance Tests
- Generate 20 common scenarios
- Verify all controls work
- Test error messages
- Validate auto-reset behavior
