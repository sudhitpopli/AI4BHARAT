# Design Document: NewtonAI - Generative Physics Imagination Engine

## Overview

NewtonAI is a cloud-native, AI-powered physics simulation platform that transforms natural language and image inputs into interactive 3D simulations. The system architecture follows a serverless pattern on AWS, with Unreal Engine 5 as the client runtime.

### Core Design Principles

1. **Cost-Effective Intelligence**: Semantic caching reduces Bedrock API costs by 70%
2. **Graceful Degradation**: Circuit breakers and fallback simulations ensure availability
3. **Immersive Learning**: First-person navigation and real-time parameter control
4. **Scalable Architecture**: Serverless components auto-scale with demand
5. **Physics Accuracy**: Validation layer ensures simulations obey physical laws

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        UE5 Client Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Chaos Physics│  │   Niagara    │  │  Procedural  │         │
│  │    Engine    │  │    Fluids    │  │Asset Spawner │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AWS API Gateway                            │
│              (REST API + WebSocket for notifications)           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AWS Lambda Functions                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │Query Handler │  │Image Analysis│  │Asset Processor│         │
│  │(Sync <30s)   │  │   Lambda     │  │  (Validator)  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐                           │
│  │Job Processor │  │  WebSocket   │                           │
│  │(Async >30s)  │  │  Notifier    │                           │
│  └──────────────┘  └──────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ElastiCache   │    │AWS Bedrock   │    │   AWS SQS    │
│   (Redis)    │    │Claude 3.5    │    │ Job Queue +  │
│Semantic Cache│    │   Sonnet     │    │     DLQ      │
└──────────────┘    └──────────────┘    └──────────────┘
         │                                       │
         ▼                                       ▼
┌──────────────┐                       ┌──────────────┐
│  DynamoDB    │                       │  CloudWatch  │
│ Manifest     │                       │   Logs +     │
│   Store      │                       │   Metrics    │
└──────────────┘                       └──────────────┘
         │
         ▼
┌──────────────┐
│   S3 + CDN   │
│  (Mumbai,    │
│Delhi, Blore) │
└──────────────┘
```

## Architecture

### Client Layer (Unreal Engine 5)

**Responsibilities:**
- Render 3D simulations with photorealistic quality
- Handle user input (text, images, parameter adjustments, navigation)
- Execute real-time physics using Chaos Physics engine
- Manage WebSocket connections for async job notifications
- Cache featured simulations locally for instant access

**Key Components:**

1. **Simulation Renderer**
   - Parses JSON manifests into UE5 scene objects
   - Spawns procedural assets based on manifest specifications
   - Applies physics properties (mass, velocity, forces) to objects
   - Renders electromagnetic fields using Niagara particle systems

2. **Parameter Control System**
   - Generates UI sliders from manifest parameter definitions
   - Updates physics simulation in real-time (60 FPS target)
   - Validates parameter bounds before applying changes
   - Syncs parameter state with AI Tutor context

3. **Camera Controller**
   - Orbit mode: Mouse drag to rotate, scroll to zoom
   - First-person mode: WASD movement, mouse look
   - Smooth transitions between camera modes
   - Collision detection to prevent camera clipping

4. **AI Tutor Interface**
   - Chat UI overlay with context-aware messaging
   - Sends current manifest + parameters with each query
   - Displays responses with LaTeX math rendering support
   - Suggests parameter adjustments as clickable actions

### Backend Layer (AWS Serverless)

**API Gateway Configuration:**
- REST API for synchronous requests (<30s)
- WebSocket API for async job notifications
- Cognito authorizer for JWT validation
- Rate limiting: 100 requests/hour per user
- CORS enabled for UE5 client origin

**Lambda Functions:**

1. **Query Handler Lambda** (Synchronous Path)
   - Runtime: Python 3.11, 3GB memory, 30s timeout
   - Receives text or image input from client
   - Checks semantic cache (Redis) for similar queries
   - On cache miss: Calls Bedrock with retry logic
   - Returns manifest JSON or queues job if >30s estimated
   - Implements circuit breaker pattern for Bedrock failures

2. **Asset Processor Lambda** (Validation)
   - Runtime: Python 3.11, 1GB memory, 10s timeout
   - Validates manifest JSON schema compliance
   - Checks asset references against S3 asset library
   - Substitutes fallback assets for missing references
   - Clamps parameters to physically reasonable bounds
   - Stores validated manifests in DynamoDB

3. **Job Processor Lambda** (Asynchronous Path)
   - Runtime: Python 3.11, 10GB memory, 900s timeout
   - Triggered by SQS messages for complex simulations
   - Processes long-running Bedrock generations
   - Updates job status in DynamoDB (PENDING → READY)
   - Sends WebSocket notification on completion
   - Moves failed jobs to DLQ after 3 retries

4. **Image Analysis Lambda**
   - Runtime: Python 3.11, 5GB memory, 60s timeout
   - Receives uploaded images (PNG/JPG, max 10MB)
   - Calls Bedrock with vision capabilities
   - Extracts physics objects, relationships, parameters
   - Returns structured data for manifest generation

### Caching Layer (ElastiCache Redis)

**Semantic Cache Design:**

The semantic cache reduces Bedrock API costs by storing manifests indexed by query embeddings.

**Cache Key Generation:**
1. Generate embedding vector for input query using Bedrock Titan Embeddings
2. Compute cosine similarity against all cached embeddings
3. If similarity > 0.85: Return cached manifest (cache hit)
4. If similarity ≤ 0.85: Generate new manifest, store with embedding (cache miss)

**Cache Entry Structure:**
```json
{
  "query_embedding": [0.123, -0.456, ...],  // 1536-dim vector
  "query_text": "Show me projectile motion with 45 degree angle",
  "manifest": { /* full simulation manifest */ },
  "created_at": "2024-01-15T10:30:00Z",
  "access_count": 42,
  "ttl": 604800  // 7 days in seconds
}
```

**Eviction Policy:**
- TTL: 7 days for all entries
- LRU eviction when memory exceeds 80% capacity
- Featured simulations: No TTL (permanent cache)

**Cache Warming:**
- Pre-populate with 20 featured simulations on deployment (one-time manual process)
- CloudWatch Logs Insights analyzes query patterns weekly to identify popular topics
- Platform operators manually generate and cache variations of top 10 most-requested simulations

### Data Storage

**DynamoDB Tables:**

1. **SimulationManifests** (Primary storage)
   - Partition Key: `manifest_id` (UUID)
   - Sort Key: `version` (integer)
   - Attributes: `manifest_json`, `created_by`, `created_at`, `physics_type`
   - GSI: `created_by-created_at-index` for user's saved labs

2. **JobStatus** (Async job tracking)
   - Partition Key: `job_id` (UUID)
   - Attributes: `status` (PENDING/READY/FAILED), `manifest_id`, `error_message`, `created_at`
   - TTL: 24 hours after completion

3. **UserSessions** (Authentication state)
   - Partition Key: `user_id` (Cognito sub)
   - Attributes: `jwt_token`, `expires_at`, `usage_count`, `monthly_cost`

**S3 Buckets:**

1. **newtonai-assets** (3D models, textures, materials)
   - Organized by physics type: `/classical_mechanics/`, `/electromagnetism/`, `/relativity/`
   - Versioned for rollback capability
   - Lifecycle policy: Archive to Glacier after 90 days of no access

2. **newtonai-user-uploads** (Student-uploaded images)
   - Partition by user_id: `/uploads/{user_id}/{timestamp}.jpg`
   - Lifecycle policy: Delete after 30 days
   - Server-side encryption enabled

**CloudFront CDN:**
- Origin: S3 newtonai-assets bucket
- Edge locations: Mumbai, Delhi, Bangalore (India focus)
- Cache TTL: 7 days for assets
- Gzip compression enabled

### Error Handling and Resilience

**Circuit Breaker Pattern:**

State machine for Bedrock API calls:

```
CLOSED (Normal operation)
  │
  │ 5 failures in 60s
  ▼
OPEN (Reject requests, return featured simulations)
  │
  │ After 30s
  ▼
HALF_OPEN (Test with 1 request)
  │
  ├─ Success → CLOSED (resume normal operation)
  └─ Failure → OPEN (remain in fallback mode for another 30s)
```

**Implementation:**
- Track failure count in Redis with 60s TTL
- On circuit open: Return 3 relevant featured simulations
- Display message: "AI generation temporarily unavailable. Try a featured simulation."

**Retry Logic with Exponential Backoff:**

For retriable errors (timeout, 429, 500):
1. First retry: Wait 1 second
2. Second retry: Wait 2 seconds
3. Third retry: Wait 4 seconds
4. After 3 failures: Mark as failed, trigger DLQ or circuit breaker

Non-retriable errors (400, 401, 403): Fail immediately

**Dead Letter Queue (DLQ):**
- SQS queue for jobs that fail after 3 retries
- Retention: 14 days
- CloudWatch alarm when depth > 10
- Manual retry capability for operators

## Components and Interfaces

### Component: Query Handler Lambda

**Interface:**

```python
def handle_query(event: dict) -> dict:
    """
    Process simulation generation request.
    
    Args:
        event: {
            "user_id": str,
            "query_text": str (optional),
            "image_data": str (optional, base64),
            "request_id": str
        }
    
    Returns:
        {
            "status": "success" | "queued" | "error",
            "manifest": dict (if status=success),
            "job_id": str (if status=queued),
            "error_message": str (if status=error),
            "cache_hit": bool,
            "latency_ms": int
        }
    """
```

**Behavior:**
1. Validate input (text XOR image required)
2. Check circuit breaker state
3. If circuit open: Return featured simulations
4. Generate semantic embedding for query
5. Check Redis cache for similar queries (cosine similarity > 0.85)
6. On cache hit: Return cached manifest
7. On cache miss: Estimate generation time
8. If <30s: Call Bedrock synchronously with retry logic
9. If >30s: Queue job to SQS, return job_id
10. Validate and store manifest
11. Update cache with new entry

### Component: Semantic Cache Service

**Interface:**

```python
class SemanticCache:
    def get(self, query_embedding: List[float]) -> Optional[dict]:
        """
        Retrieve cached manifest if similar query exists.
        
        Args:
            query_embedding: 1536-dim vector from Bedrock Titan
        
        Returns:
            Cached manifest dict if similarity > 0.85, else None
        """
    
    def put(self, query_embedding: List[float], query_text: str, manifest: dict) -> None:
        """
        Store manifest with semantic key.
        
        Args:
            query_embedding: 1536-dim vector
            query_text: Original query for debugging
            manifest: Validated simulation manifest
        """
    
    def compute_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Compute cosine similarity between two embeddings.
        
        Returns:
            Similarity score in range [0, 1]
        """
```

**Implementation Details:**
- Use Redis sorted sets for efficient similarity search
- Store embeddings as binary blobs (compressed with msgpack)
- Index by approximate nearest neighbor (ANN) using Redis Vector Similarity Search
- Track cache hit rate in CloudWatch custom metric

### Component: Asset Processor

**Interface:**

```python
def validate_manifest(manifest: dict) -> dict:
    """
    Validate and sanitize simulation manifest.
    
    Args:
        manifest: Raw manifest from Bedrock
    
    Returns:
        {
            "valid": bool,
            "manifest": dict (sanitized),
            "warnings": List[str],
            "errors": List[str]
        }
    """
```

**Validation Rules:**
1. **Schema Compliance**: Verify required fields (version, objects, parameters, physics_type)
2. **Asset References**: Check all asset paths exist in S3
3. **Parameter Bounds**: Clamp values to safe ranges
   - Mass: [0.001, 10000] kg
   - Velocity: [0, 0.99c] m/s
   - Charge: [-1000, 1000] Coulombs
   - Voltage: [0, 10000] Volts
4. **Physics Consistency**: Verify equations match physics_type
5. **Fallback Substitution**: Replace missing assets with defaults

**Fallback Assets:**
- Missing mesh → Default sphere
- Missing texture → Gray material
- Missing particle system → Simple point particles

### Component: Bedrock Integration Service

**Interface:**

```python
class BedrockService:
    def generate_manifest(
        self,
        query_text: str = None,
        image_data: bytes = None,
        physics_type: str = None
    ) -> dict:
        """
        Generate simulation manifest using Claude 3.5 Sonnet.
        
        Args:
            query_text: Natural language description
            image_data: Image bytes (for vision analysis)
            physics_type: Hint for physics domain (optional)
        
        Returns:
            Simulation manifest dict
        
        Raises:
            BedrockTimeoutError: If generation exceeds 30s
            BedrockRateLimitError: If 429 received
            BedrockServerError: If 500 received
        """
```

**Prompt Engineering:**

System prompt for manifest generation:
```
You are a physics simulation generator. Given a natural language description or image, 
generate a JSON manifest for a 3D physics simulation.

Output ONLY valid JSON matching this schema:
{
  "version": "1.0",
  "physics_type": "classical_mechanics" | "electromagnetism" | "special_relativity",
  "objects": [
    {
      "id": "unique_id",
      "type": "sphere" | "box" | "cylinder" | "particle_system",
      "asset_path": "s3://newtonai-assets/path/to/asset.uasset",
      "position": [x, y, z],
      "rotation": [pitch, yaw, roll],
      "scale": [x, y, z],
      "physics": {
        "mass": float,
        "velocity": [vx, vy, vz],
        "angular_velocity": [wx, wy, wz],
        "charge": float (for EM),
        "is_static": bool
      }
    }
  ],
  "parameters": [
    {
      "name": "parameter_name",
      "display_name": "Human Readable Name",
      "type": "float" | "vector3" | "bool",
      "default": value,
      "min": value,
      "max": value,
      "unit": "kg" | "m/s" | "V" | etc
    }
  ],
  "environment": {
    "gravity": [0, 0, -9.81],
    "air_resistance": float,
    "time_scale": 1.0
  }
}

Ensure all asset paths reference existing assets in the library.
Use physically accurate default values.
```

**Token Optimization:**
- Use Claude 3.5 Sonnet (200K context, lower cost than Opus)
- Limit output tokens to 4000 (sufficient for complex manifests)
- Cache system prompt across requests (Bedrock prompt caching)

### Component: UE5 Simulation Renderer

**Interface:**

```cpp
class USimulationRenderer : public UObject
{
public:
    /**
     * Load and render simulation from manifest JSON.
     * 
     * @param ManifestJson - JSON string from backend
     * @return true if successfully loaded
     */
    bool LoadSimulation(const FString& ManifestJson);
    
    /**
     * Update parameter value in real-time.
     * 
     * @param ParameterName - Name from manifest
     * @param NewValue - New parameter value
     */
    void UpdateParameter(const FString& ParameterName, float NewValue);
    
    /**
     * Switch between orbit and first-person camera modes.
     * 
     * @param bFirstPerson - true for FPS mode, false for orbit
     */
    void SetCameraMode(bool bFirstPerson);
    
    /**
     * Get current physics state for AI Tutor context.
     * 
     * @return JSON string with current object states
     */
    FString GetCurrentState() const;
};
```

**Rendering Pipeline:**
1. Parse JSON manifest into UE5 data structures
2. Spawn actors for each object in manifest
3. Apply physics properties to Chaos Physics components
4. Create Niagara systems for field visualizations
5. Generate UI sliders from parameter definitions
6. Start physics simulation loop (60 FPS)

### Component: First-Person Controller

**Interface:**

```cpp
class AFirstPersonSimulationPawn : public APawn
{
public:
    /** Movement speed in m/s */
    UPROPERTY(EditAnywhere, Category="Movement")
    float MovementSpeed = 5.0f;
    
    /** Mouse sensitivity for look */
    UPROPERTY(EditAnywhere, Category="Camera")
    float LookSensitivity = 1.0f;
    
    /** Enable flying mode (no gravity) */
    UPROPERTY(EditAnywhere, Category="Movement")
    bool bFlyingMode = true;
    
    /** Display velocity and position HUD */
    void UpdateHUD();
};
```

**Controls:**
- W/A/S/D: Move forward/left/back/right
- Mouse: Look around
- Space: Move up (flying mode)
- Ctrl: Move down (flying mode)
- Shift: Sprint (2x speed)
- Tab: Toggle back to orbit mode

### Component: WebSocket Notification Service

**Interface:**

```python
class WebSocketNotifier:
    def send_job_complete(self, connection_id: str, job_id: str, manifest_id: str) -> None:
        """
        Notify client when async job completes.
        
        Args:
            connection_id: WebSocket connection ID from API Gateway
            job_id: Completed job ID
            manifest_id: ID of generated manifest
        """
    
    def send_error(self, connection_id: str, job_id: str, error_message: str) -> None:
        """
        Notify client when job fails permanently.
        
        Args:
            connection_id: WebSocket connection ID from API Gateway
            job_id: Failed job ID
            error_message: Descriptive error message
        """
```

**Behavior:**
1. API Gateway maintains persistent WebSocket connections with clients
2. When student submits async job, connection_id is stored with job_id in DynamoDB
3. When Job Processor Lambda completes, it retrieves connection_id and calls WebSocketNotifier
4. Success message sent to connection_id: `{"type": "JOB_COMPLETE", "job_id": "...", "manifest_id": "..."}`
5. Error message sent to connection_id: `{"type": "JOB_FAILED", "job_id": "...", "error": "..."}`
6. UE5_Client receives WebSocket message and fetches manifest or displays error
7. Connection_id is cleaned up after message delivery or 24-hour timeout

**WebSocket Routes:**
- `$connect`: Establish connection, store connection_id with user_id
- `$disconnect`: Clean up connection_id from storage
- `$default`: Handle incoming messages (ping/pong for keep-alive)

## Data Models

### Simulation Manifest Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["version", "physics_type", "objects", "parameters"],
  "properties": {
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+$",
      "description": "Schema version (e.g., '1.0')"
    },
    "physics_type": {
      "type": "string",
      "enum": ["classical_mechanics", "electromagnetism", "special_relativity"]
    },
    "objects": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "type", "asset_path", "position", "physics"],
        "properties": {
          "id": { "type": "string" },
          "type": { "type": "string", "enum": ["sphere", "box", "cylinder", "particle_system", "field_lines"] },
          "asset_path": { "type": "string", "pattern": "^s3://newtonai-assets/" },
          "position": { "type": "array", "items": { "type": "number" }, "minItems": 3, "maxItems": 3 },
          "rotation": { "type": "array", "items": { "type": "number" }, "minItems": 3, "maxItems": 3 },
          "scale": { "type": "array", "items": { "type": "number" }, "minItems": 3, "maxItems": 3 },
          "physics": {
            "type": "object",
            "properties": {
              "mass": { "type": "number", "minimum": 0.001, "maximum": 10000 },
              "velocity": { "type": "array", "items": { "type": "number" }, "minItems": 3, "maxItems": 3 },
              "angular_velocity": { "type": "array", "items": { "type": "number" }, "minItems": 3, "maxItems": 3 },
              "charge": { "type": "number", "minimum": -1000, "maximum": 1000 },
              "is_static": { "type": "boolean" }
            }
          }
        }
      }
    },
    "parameters": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "display_name", "type", "default"],
        "properties": {
          "name": { "type": "string" },
          "display_name": { "type": "string" },
          "type": { "type": "string", "enum": ["float", "vector3", "bool"] },
          "default": {},
          "min": { "type": "number" },
          "max": { "type": "number" },
          "unit": { "type": "string" }
        }
      }
    },
    "environment": {
      "type": "object",
      "properties": {
        "gravity": { "type": "array", "items": { "type": "number" }, "minItems": 3, "maxItems": 3 },
        "air_resistance": { "type": "number", "minimum": 0, "maximum": 1 },
        "time_scale": { "type": "number", "minimum": 0.1, "maximum": 10 }
      }
    }
  }
}
```

### Cache Entry Model

```python
from dataclasses import dataclass
from typing import List
from datetime import datetime

@dataclass
class CacheEntry:
    query_embedding: List[float]  # 1536-dim vector
    query_text: str
    manifest: dict
    created_at: datetime
    access_count: int
    ttl_seconds: int
    
    def to_redis_hash(self) -> dict:
        """Convert to Redis hash structure."""
        return {
            "embedding": msgpack.packb(self.query_embedding),
            "query": self.query_text,
            "manifest": json.dumps(self.manifest),
            "created_at": self.created_at.isoformat(),
            "access_count": str(self.access_count)
        }
```

### Job Status Model

```python
from enum import Enum
from dataclasses import dataclass
from datetime import datetime

class JobStatus(Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    READY = "READY"
    FAILED = "FAILED"

@dataclass
class SimulationJob:
    job_id: str
    user_id: str
    query_text: str
    status: JobStatus
    manifest_id: str | None
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None
    
    def to_dynamodb_item(self) -> dict:
        """Convert to DynamoDB item format."""
        item = {
            "job_id": self.job_id,
            "user_id": self.user_id,
            "query_text": self.query_text,
            "status": self.status.value,
            "created_at": self.created_at.isoformat()
        }
        if self.manifest_id:
            item["manifest_id"] = self.manifest_id
        if self.error_message:
            item["error_message"] = self.error_message
        if self.completed_at:
            item["completed_at"] = self.completed_at.isoformat()
        return item
```

### Featured Simulation Model

```python
@dataclass
class FeaturedSimulation:
    id: str
    title: str
    description: str
    physics_type: str
    tags: List[str]  # For semantic matching
    manifest: dict
    thumbnail_url: str
    difficulty: str  # "beginner" | "intermediate" | "advanced"
    
    def matches_query(self, query_embedding: List[float], threshold: float = 0.75) -> bool:
        """Check if this featured simulation is relevant to query."""
        # Compute similarity between query and pre-computed tag embeddings
        pass
```

### User Cost Tracking Model

```python
from dataclasses import dataclass

@dataclass
class UserCostTracking:
    user_id: str
    month: str  # "2024-01"
    bedrock_calls: int
    cache_hits: int
    cache_misses: int
    total_tokens: int
    estimated_cost_inr: float
    
    def calculate_cost(self) -> float:
        """
        Calculate monthly cost in INR:
        - Bedrock: $0.015 per 1K tokens (Claude 3.5 Sonnet)
        - Lambda: $0.0000166667 per GB-second
        - Storage: $0.023 per GB-month (S3)
        - USD to INR conversion: ~83 INR per USD
        
        Target: ₹6/month per student
        """
        # Bedrock cost
        bedrock_cost_usd = (self.total_tokens / 1000) * 0.015
        
        # Lambda cost (assume 3GB memory, 2s avg per call)
        lambda_cost_usd = self.bedrock_calls * 2 * 0.0000166667 * 3
        
        # Storage cost (assume 1GB per user for saved labs)
        storage_cost_usd = 0.023
        
        # Total in USD
        total_usd = bedrock_cost_usd + lambda_cost_usd + storage_cost_usd
        
        # Convert to INR
        return total_usd * 83
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Semantic Cache Consistency

*For any* query text, if two queries have cosine similarity > 0.85 in their embeddings, then the cache service should return the same cached manifest for both queries.

**Validates: Requirements 1.2, 7.2, 7.3**

### Property 2: Cache Performance Bounds

*For any* cached manifest request, the system should return the manifest within 50ms (p95 latency).

**Validates: Requirements 1.3, 11.1**

### Property 3: Generation Performance Bounds

*For any* new manifest generation request (cache miss), the system should return a manifest within 5 seconds (p95 latency) or queue it for asynchronous processing.

**Validates: Requirements 1.4, 11.2**

### Property 4: Manifest Schema Compliance

*For any* generated simulation manifest, it should include all required fields: version, physics_type, objects array (with position, rotation, scale, physics properties), and parameters array.

**Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**

### Property 5: Manifest Round-Trip Consistency

*For any* valid simulation manifest, parsing it to JSON, then pretty-printing it, then parsing again should produce an equivalent manifest object.

**Validates: Requirements 14.7**

### Property 6: Asset Validation and Fallback

*For any* manifest with asset references, if an asset path does not exist in the S3 asset library, then the asset processor should substitute a default fallback asset and the manifest should remain valid.

**Validates: Requirements 9.1, 9.2**

### Property 7: Parameter Bounds Clamping

*For any* manifest with numeric parameters, if a parameter value is outside the physically reasonable bounds (e.g., mass < 0.001 or > 10000), then the asset processor should clamp it to the safe limit and log a warning.

**Validates: Requirements 9.4, 9.5**

### Property 8: Validation Error Messaging

*For any* invalid manifest that fails critical validation, the system should return a descriptive error message to the student explaining what failed.

**Validates: Requirements 1.7, 9.3**

### Property 9: Cache Storage After Generation

*For any* newly generated valid manifest, the system should store it in the cache with its semantic embedding and a TTL of 7 days.

**Validates: Requirements 1.6, 7.4**

### Property 10: LRU Cache Eviction

*For any* cache at full capacity, when a new entry needs to be stored, the system should evict the least recently used entry.

**Validates: Requirements 7.6**

### Property 11: Parameter Slider Generation

*For any* simulation manifest with a parameters array, the UE5 client should generate an interactive slider for each parameter in the array.

**Validates: Requirements 5.1**

### Property 12: Real-Time Parameter Update Performance

*For any* parameter adjustment via slider, the simulation should update within 16ms (60 FPS) to maintain smooth interaction.

**Validates: Requirements 5.2**

### Property 13: Parameter Value Display Consistency

*For any* parameter slider, the displayed numeric value should always match the current parameter value in the simulation.

**Validates: Requirements 5.5**

### Property 14: Physics Accuracy After Parameter Change

*For any* parameter adjustment, the resulting simulation behavior should obey the governing physics equations for the simulation's physics_type (classical mechanics, electromagnetism, or special relativity).

**Validates: Requirements 5.4**

### Property 15: AI Tutor Context Completeness

*For any* AI tutor query, the system should send the complete current simulation manifest and all current parameter values as context to the AI.

**Validates: Requirements 6.2**

### Property 16: AI Tutor Response Latency

*For any* AI tutor query, the system should display the response within 3 seconds.

**Validates: Requirements 6.3**

### Property 17: Simulation Lab Save Completeness

*For any* save operation, the system should store both the complete simulation manifest and all current parameter values, associated with the student's user ID.

**Validates: Requirements 8.1, 8.2**

### Property 18: Simulation Lab Retrieval Accuracy

*For any* saved simulation lab, when loaded, the system should restore the exact simulation state (manifest + parameters) that was saved.

**Validates: Requirements 8.3, 8.4**

### Property 19: Object Selection and Property Display

*For any* simulated object in the scene, when clicked, the UE5 client should highlight it and display its current physics properties (mass, velocity, charge, etc.).

**Validates: Requirements 13.3**

### Property 20: Authentication Token Validity

*For any* successful authentication, the system should issue a JWT token that is valid for exactly 24 hours.

**Validates: Requirements 10.3**

### Property 21: Rate Limiting Enforcement

*For any* student account, the system should enforce a limit of 100 API requests per hour, rejecting requests that exceed this limit.

**Validates: Requirements 10.5**

### Property 22: Comprehensive Logging

*For any* Bedrock API call, circuit breaker state change, or job failure, the system should log the event to CloudWatch with relevant details (token counts, error messages, timestamps).

**Validates: Requirements 12.1, 18.5, 20.2**

### Property 23: Metrics Tracking

*For any* cache hit/miss, retry attempt, or cost calculation, the system should record the metric in CloudWatch for monitoring.

**Validates: Requirements 12.2, 21.6**

### Property 24: Usage Warning Threshold

*For any* student who generates more than 50 new simulations in a month, the system should display a usage warning.

**Validates: Requirements 12.3**

### Property 25: Cost Calculation Accuracy

*For any* student account, the system should calculate monthly cost as: (number of Bedrock API calls × cost per call) + (storage costs), displayed in the admin dashboard.

**Validates: Requirements 12.4**

### Property 26: Cache Hit Rate Alerting

*For any* time period where cache hit rate falls below 60%, the system should trigger a CloudWatch alarm to alert platform operators.

**Validates: Requirements 12.5**

### Property 27: Image Upload and Processing

*For any* uploaded image (PNG/JPG/JPEG, ≤10MB), the system should send it to Bedrock with vision capabilities and generate a manifest within 8 seconds (allowing extra time for vision processing overhead compared to text-only generation).

**Validates: Requirements 15.2, 15.4**

### Property 28: Image-Based Cache Consistency

*For any* uploaded image, the system should cache the resulting manifest using a hash of the image content, so uploading the same image twice produces a cache hit.

**Validates: Requirements 15.7**

### Property 29: Asynchronous Job Queuing

*For any* simulation request estimated to take >30 seconds, the system should queue it to SQS and immediately return a job_id with status "PENDING".

**Validates: Requirements 16.1, 16.2**

### Property 30: Job Status Lifecycle

*For any* queued job, the status should transition from PENDING → PROCESSING → READY (on success) or PENDING → PROCESSING → FAILED (on failure), with the manifest stored when status becomes READY.

**Validates: Requirements 16.4, 16.6**

### Property 31: Job Status Polling

*For any* pending job, the UE5 client should poll the job status every 5 seconds until the status is READY or FAILED.

**Validates: Requirements 16.5**

### Property 32: Job Result Retention

*For any* completed job (READY or FAILED), the system should retain the result for 24 hours before cleanup.

**Validates: Requirements 16.7**

### Property 33: First-Person Camera Positioning

*For any* simulation, when first-person mode is activated, the camera should be repositioned to be inside or near the simulation environment (not at the default orbit position).

**Validates: Requirements 17.2**

### Property 34: First-Person HUD Display

*For any* simulation in first-person mode, the UE5 client should display a velocity indicator and position coordinates on the HUD.

**Validates: Requirements 17.6**

### Property 35: Circuit Breaker Opening

*For any* 60-second window, if Bedrock API calls fail 5 times, the system should open the circuit breaker and stop calling Bedrock.

**Validates: Requirements 18.1**

### Property 36: Circuit Breaker Fallback Behavior

*For any* request when the circuit breaker is open, the system should return 3 relevant featured simulations instead of calling Bedrock, and display the message "AI generation temporarily unavailable. Try a featured simulation."

**Validates: Requirements 18.2, 18.4**

### Property 37: Circuit Breaker Recovery

*For any* open circuit breaker, after 30 seconds, the system should attempt to close it with a test request; if successful, resume normal operation; if failed, remain open.

**Validates: Requirements 18.3, 18.6**

### Property 38: Featured Simulation Fallback

*For any* Bedrock failure or circuit breaker open state, the system should suggest 3 relevant featured simulations based on semantic similarity to the query.

**Validates: Requirements 19.2**

### Property 39: Featured Simulation Performance

*For any* featured simulation, it should load within 500ms without requiring any API calls.

**Validates: Requirements 19.4**

### Property 40: Featured Simulation Labeling

*For any* featured simulation displayed to the user, the UE5 client should clearly label it as "Pre-built Simulation" to distinguish it from custom generations.

**Validates: Requirements 19.5**

### Property 41: Featured Simulation Usage Tracking

*For any* featured simulation that is loaded, the system should log the usage event to track popular topics.

**Validates: Requirements 19.6**

### Property 42: Dead Letter Queue Placement

*For any* simulation job that fails after 3 retries, the system should move it to the Dead Letter Queue with the failure reason logged.

**Validates: Requirements 20.1, 20.2**

### Property 43: DLQ Depth Alerting

*For any* time when the Dead Letter Queue contains more than 10 messages, the system should trigger a CloudWatch alarm.

**Validates: Requirements 20.3**

### Property 44: Permanent Job Failure Messaging

*For any* job that fails permanently (moved to DLQ), the system should display to the student: "Generation failed. Please try rephrasing your request or try a featured simulation."

**Validates: Requirements 20.4**

### Property 45: Retry Logic with Exponential Backoff

*For any* Bedrock API call that fails with a retriable error (timeout, 429, 500), the system should retry up to 3 times with exponential backoff delays of 1s, 2s, and 4s.

**Validates: Requirements 21.1, 21.2, 21.3**

### Property 46: Non-Retriable Error Handling

*For any* Bedrock API call that fails with a non-retriable error (400, 401, 403), the system should NOT retry and should immediately mark the request as failed.

**Validates: Requirements 21.5**

### Property 47: Retry Exhaustion Flow

*For any* request where all 3 retries are exhausted, the system should log the error and trigger either the circuit breaker (if threshold reached) or DLQ flow (for async jobs).

**Validates: Requirements 21.4**

## Error Handling

### Error Categories

**1. Client-Side Errors (4xx)**
- **400 Bad Request**: Invalid query format, missing required fields
  - Response: "Please check your input and try again"
  - Action: Display error message, do not retry
- **401 Unauthorized**: Invalid or expired JWT token
  - Response: "Your session has expired. Please log in again"
  - Action: Redirect to authentication
- **403 Forbidden**: Insufficient permissions
  - Response: "You don't have permission to access this resource"
  - Action: Display error message, do not retry
- **429 Too Many Requests**: Rate limit exceeded
  - Response: "You've reached the request limit. Please try again in {time}"
  - Action: Display countdown timer, retry after cooldown

**2. Server-Side Errors (5xx)**
- **500 Internal Server Error**: Unexpected backend failure
  - Response: "Something went wrong. We're working on it"
  - Action: Retry with exponential backoff (3 attempts)
- **503 Service Unavailable**: Bedrock or downstream service unavailable
  - Response: "AI generation temporarily unavailable. Try a featured simulation"
  - Action: Open circuit breaker, return featured simulations
- **504 Gateway Timeout**: Request exceeded time limit
  - Response: "This simulation is taking longer than expected. We've queued it for you"
  - Action: Convert to async job, return job_id

**3. Validation Errors**
- **Invalid Manifest Schema**: Generated JSON doesn't match schema
  - Response: "Failed to generate simulation. Please try rephrasing your request"
  - Action: Log error, suggest featured simulations
- **Missing Assets**: Referenced assets don't exist in library
  - Response: Warning logged, fallback assets substituted
  - Action: Continue with fallback assets, notify user of substitutions
- **Out-of-Bounds Parameters**: Physics parameters exceed safe limits
  - Response: "Some parameters were adjusted to safe limits"
  - Action: Clamp values, log warning, continue

**4. Physics Errors**
- **Numerical Instability**: Simulation becomes unstable (NaN values)
  - Response: "Simulation became unstable. Try adjusting parameters"
  - Action: Reset simulation to initial state, suggest parameter ranges
- **Collision Explosion**: Objects accelerate uncontrollably
  - Response: "Physics collision detected. Resetting simulation"
  - Action: Reset simulation, reduce time scale

### Error Recovery Strategies

**Circuit Breaker Pattern:**
- Prevents cascading failures when Bedrock is unavailable
- Three states: CLOSED (normal), OPEN (failing), HALF_OPEN (testing)
- Automatically recovers when service is healthy

**Retry with Exponential Backoff:**
- Handles transient failures gracefully
- Prevents overwhelming failing services
- Gives time for services to recover

**Graceful Degradation:**
- Featured simulations when AI generation fails
- Fallback assets when specific assets missing
- Cached results when backend is slow

**User Communication:**
- Clear, actionable error messages
- Progress indicators for long operations
- Suggestions for alternative actions

## Testing Strategy

### Dual Testing Approach

NewtonAI requires both unit testing and property-based testing for comprehensive coverage:

**Unit Tests**: Verify specific examples, edge cases, and error conditions
- Specific simulation scenarios (projectile at 45°, pendulum with 1m length)
- Edge cases (empty query, 10MB image, 50 saved labs)
- Error conditions (invalid JSON, missing assets, expired tokens)
- Integration points (API Gateway → Lambda, Lambda → Bedrock)

**Property Tests**: Verify universal properties across all inputs
- Universal correctness properties (cache consistency, round-trip serialization)
- Performance bounds (latency requirements, FPS targets)
- Comprehensive input coverage through randomization (100+ iterations per test)

Both approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across the input space.

### Property-Based Testing Configuration

**Framework Selection:**
- **Python Backend**: Use Hypothesis for Lambda functions
- **C++ UE5 Client**: Use RapidCheck for client-side logic
- **TypeScript** (if used): Use fast-check for any TS components

**Test Configuration:**
- Minimum 100 iterations per property test (due to randomization)
- Each property test must reference its design document property
- Tag format: `Feature: newtonai, Property {number}: {property_text}`

**Example Property Test (Python/Hypothesis):**

```python
from hypothesis import given, strategies as st
import pytest

# Feature: newtonai, Property 5: Manifest Round-Trip Consistency
@given(st.builds(generate_random_manifest))
def test_manifest_round_trip(manifest):
    """
    For any valid simulation manifest, parsing it to JSON, then pretty-printing it,
    then parsing again should produce an equivalent manifest object.
    """
    # Serialize to JSON
    json_str = json.dumps(manifest)
    
    # Parse back
    parsed = json.loads(json_str)
    
    # Pretty print
    pretty_json = json.dumps(parsed, indent=2, sort_keys=True)
    
    # Parse again
    reparsed = json.loads(pretty_json)
    
    # Should be equivalent
    assert reparsed == manifest
```

**Example Property Test (C++/RapidCheck):**

```cpp
// Feature: newtonai, Property 12: Real-Time Parameter Update Performance
RC_GTEST_PROP(SimulationRenderer, ParameterUpdatePerformance,
              (const std::string& paramName, float newValue)) {
    // For any parameter adjustment via slider, the simulation should update
    // within 16ms (60 FPS) to maintain smooth interaction.
    // Note: Using 20ms threshold to allow for variance in test environment
    
    USimulationRenderer renderer;
    renderer.LoadSimulation(GetTestManifest());
    
    auto start = std::chrono::high_resolution_clock::now();
    renderer.UpdateParameter(paramName, newValue);
    auto end = std::chrono::high_resolution_clock::now();
    
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end - start);
    
    // 16ms target + 4ms margin for test environment variance
    RC_ASSERT(duration.count() <= 20);
}
```

### Unit Test Coverage

**Backend Lambda Functions:**
- Query handler: Cache hit/miss paths, timeout handling, error responses
- Asset processor: Schema validation, asset substitution, parameter clamping
- Job processor: SQS message handling, status updates, DLQ placement
- Image analysis: Image format validation, vision API calls, manifest generation

**Caching Layer:**
- Semantic similarity computation (cosine similarity)
- Cache hit/miss logic (threshold = 0.85)
- LRU eviction when capacity reached
- TTL expiration (7 days)

**UE5 Client:**
- Manifest parsing and scene spawning
- Parameter slider generation and updates
- Camera mode switching (orbit ↔ first-person)
- Object selection and property display
- AI tutor chat interface

**Error Handling:**
- Circuit breaker state transitions
- Retry logic with exponential backoff
- DLQ placement after 3 failures
- Featured simulation fallback

### Integration Testing

**End-to-End Flows:**
1. **Happy Path**: Query → Cache miss → Bedrock → Validation → Render
2. **Cached Path**: Query → Cache hit → Render (verify <50ms)
3. **Async Path**: Complex query → SQS → Background processing → Notification
4. **Error Path**: Invalid query → Validation error → Featured simulations
5. **Circuit Breaker**: 5 failures → Circuit open → Featured simulations → Recovery

**Performance Testing:**
- Cache retrieval latency (target: <50ms p95)
- New generation latency (target: <5s p95)
- Parameter update latency (target: <16ms)
- Featured simulation load (target: <500ms)

**Load Testing:**
- 100 concurrent users generating simulations
- Cache hit rate measurement (target: >70%)
- Rate limiting enforcement (100 req/hour per user)
- Cost per user calculation (target: ₹6/month)

### Test Data Generation

**Manifest Generators:**
- Random classical mechanics scenarios (projectiles, pendulums, collisions)
- Random electromagnetism scenarios (fields, circuits, induction)
- Random relativity scenarios (time dilation, length contraction)
- Edge cases: Empty objects array, missing parameters, invalid physics_type

**Query Generators:**
- Natural language variations ("show me projectile motion", "simulate a ball being thrown")
- Physics terminology ("parabolic trajectory with initial velocity 20 m/s at 45 degrees")
- Ambiguous queries ("make something move")
- Invalid queries (empty string, non-physics requests)

**Image Generators:**
- Circuit diagrams (simple circuits, complex circuits, hand-drawn)
- Schematic sketches (force diagrams, field lines)
- Photos of physical spaces (classroom, lab setup)
- Edge cases: Non-physics images, corrupted files, oversized files

### Monitoring and Observability

**CloudWatch Metrics:**
- `CacheHitRate`: Percentage of cache hits (target: >70%)
- `BedrockLatency`: Time to generate manifests (target: <5s p95)
- `CacheLatency`: Time to retrieve from cache (target: <50ms p95)
- `CircuitBreakerState`: Current state (CLOSED/OPEN/HALF_OPEN)
- `DLQDepth`: Number of messages in Dead Letter Queue (alert if >10)
- `CostPerUser`: Estimated monthly cost per student (target: ₹6)
- `RetryCount`: Number of retries per request
- `FeaturedSimulationUsage`: Usage count for each featured simulation

**CloudWatch Alarms:**
- Cache hit rate < 60%: Alert operators to investigate
- DLQ depth > 10: Alert operators to review failures
- Circuit breaker open for >5 minutes: Alert operators to check Bedrock
- Cost per user > ₹8: Alert operators to optimize

**Logging Strategy:**
- All Bedrock API calls: Query text, token counts, latency, cost
- All validation failures: Manifest content, error details
- All circuit breaker state changes: Timestamp, trigger reason
- All DLQ placements: Job ID, failure reason, retry count
- All cache operations: Hit/miss, similarity scores, evictions

### Test Execution

**CI/CD Pipeline:**
1. **Unit Tests**: Run on every commit (fast feedback)
2. **Property Tests**: Run on every PR (comprehensive coverage)
3. **Integration Tests**: Run on merge to main (end-to-end validation)
4. **Performance Tests**: Run nightly (detect regressions)
5. **Load Tests**: Run weekly (capacity planning)

**Test Environment:**
- Staging environment with mock Bedrock (for cost control)
- Production-like data (anonymized student queries)
- Isolated test accounts (no impact on real users)

**Success Criteria:**
- All unit tests pass (100% pass rate)
- All property tests pass with 100 iterations each
- Integration tests complete end-to-end flows
- Performance tests meet latency targets
- Load tests handle 100 concurrent users
- Cost per user stays under ₹6/month
