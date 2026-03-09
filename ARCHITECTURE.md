# NewtonAI - System Architecture

## Overview

NewtonAI is an educational 3D physics simulator that generates interactive simulations from natural language prompts. The system uses AI models (Google Gemini + AWS Bedrock fallback) to convert user descriptions into structured JSON simulations rendered in a 3D environment.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  React + TypeScript Frontend                               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │ Control Panel│  │ Physics World│  │ Simulation      │  │  │
│  │  │ + Chat       │  │ (Three.js +  │  │ History Sidebar │  │  │
│  │  │              │  │  Rapier)     │  │                 │  │  │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTPS / REST API
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND (Python 3.9)                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Three-Stage Generation Pipeline                          │  │
│  │  Stage 1: Physics Reasoning → Stage 2: JSON Encoding →   │  │
│  │  Stage 3: Validation + Error Correction                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  AI Model Integration (Primary + Fallback)                │  │
│  │  • Google Gemini (1-5 keys, round-robin)                  │  │
│  │  • AWS Bedrock Nova Pro (automatic fallback)              │  │
│  └────────────────────────────────────────────────────────────┘  │
└───────────────────────┬───────────────────┬──────────────────────┘
                        │                   │
                        ▼                   ▼
        ┌───────────────────────┐  ┌──────────────────┐
        │  Google Gemini API    │  │  AWS Bedrock     │
        │  (gemini-3-flash-     │  │  (Nova Pro)      │
        │   preview)            │  │                  │
        └───────────────────────┘  └──────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────┐
        │  AWS DynamoDB                     │
        │  • Session storage                │
        │  • Chat history                   │
        └───────────────────────────────────┘
```

## System Components

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript
- **3D Rendering**: Three.js + React Three Fiber
- **Physics Engine**: Rapier (WebAssembly)
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **State**: React hooks (useState, useEffect, useMemo)

### Backend (Python + FastAPI)
- **Framework**: FastAPI 0.100+
- **AI SDK**: google-generativeai, boto3
- **Validation**: Pydantic
- **ASGI Server**: Uvicorn
- **Lambda Handler**: Mangum

### Infrastructure
- **Backend Hosting**: AWS Lambda + API Gateway
- **Frontend Hosting**: S3 + CloudFront
- **Session Storage**: DynamoDB
- **Logging**: CloudWatch Logs
- **Monitoring**: CloudWatch Metrics

## Three-Stage Generation Pipeline

### Stage 1: Physics Reasoning
- **Purpose**: Generate plain English reasoning with complexity validation
- **Input**: User prompt + PHYSICS_REASONING_PROMPT
- **Output**: Reasoning text + complexity check (STATUS:0-4)
- **Token Limit**: 2048
- **Temperature**: 0.7

### Stage 2: JSON Encoding
- **Purpose**: Convert reasoning to structured JSON
- **Input**: User prompt + reasoning + SYSTEM_PROMPT
- **Output**: Raw JSON string
- **Token Limit**: 8192
- **Temperature**: 0.1
- **MIME Type**: application/json

### Stage 3: Validation + Error Correction
- **Purpose**: Validate and auto-correct errors
- **Input**: Raw JSON + validation errors
- **Output**: Validated simulation dict
- **Token Limit**: 8192
- **Temperature**: 0.0

## AI Model Integration

### Primary: Google Gemini
- **Model**: gemini-3-flash-preview
- **Keys**: 1-5 API keys (round-robin)
- **Rate Limit**: 15 requests/minute per key
- **Total Capacity**: 15-75 requests/minute
- **Fallback**: Automatic on rate limit (429, quota, rate)

### Fallback: AWS Bedrock Nova Pro
- **Model**: us.amazon.nova-pro-v1:0
- **Trigger**: All Gemini keys exhausted
- **Behavior**: Seamless automatic switch
- **Cost**: ~$0.10-0.20 per simulation

## Data Flow

### Simulation Generation
```
User Prompt
  ↓
POST /generate
  ↓
Stage 1: Physics Reasoning (Gemini/Bedrock)
  ↓
Complexity Check (STATUS:0-4)
  ↓
If rejected → Return 400 error
  ↓
Stage 2: JSON Encoding (Gemini/Bedrock)
  ↓
Extract JSON
  ↓
If malformed → Stage 3 correction
  ↓
Stage 3: Validation (Pydantic)
  ↓
If errors → Auto-correction (Gemini/Bedrock)
  ↓
Post-validation complexity check
  ↓
Save to DynamoDB
  ↓
Return simulation JSON
  ↓
Frontend: Render 3D scene
```

### Chat Interaction
```
User Question
  ↓
POST /chat
  ↓
Retrieve last 5 messages (DynamoDB)
  ↓
Call Gemini with history
  ↓
Generate answer
  ↓
Save to DynamoDB
  ↓
Return answer
```

## Logging Architecture

### Request Tracking
- **Request ID**: 8-char UUID for each request
- **Format**: `[request_id] LEVEL Message`
- **Timestamps**: ISO 8601 UTC
- **Stage Durations**: Logged for each stage

### Startup Banner
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
```

### CloudWatch Integration
- **Log Group**: `/aws/lambda/newtonai-backend`
- **Retention**: 30 days
- **Format**: Structured for parsing
- **Metrics**: Custom metrics for monitoring

## Deployment

### Local Development
```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

### AWS Lambda Production
```bash
# Backend
cd backend
zip -r deployment.zip .
aws lambda update-function-code \
  --function-name newtonai \
  --zip-file fileb://deployment.zip

# Frontend
cd frontend
npm run build
aws s3 sync dist/ s3://newtonai-frontend
aws cloudfront create-invalidation \
  --distribution-id XXXXX \
  --paths "/*"
```

### Environment Variables
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

## Security

### API Key Management
- Store in AWS Secrets Manager (production)
- Environment variables (development)
- Never log full keys
- Rotate every 90 days

### Input Validation
- Max prompt: 500 chars
- Min prompt: 3 chars
- Sanitize special characters
- Reject malicious patterns

### CORS Configuration
```python
allow_origins=["https://newtonai.com"]
allow_credentials=True
allow_methods=["GET", "POST"]
allow_headers=["Content-Type"]
```

## Performance

### Target Metrics
- **Generation Time**: 60-90 seconds average
- **Success Rate**: >95%
- **Concurrent Users**: 10+ (auto-scaling)
- **API Response**: <5 seconds (health check)

### Optimization
- No history in generation (saves 60-120s)
- Round-robin load balancing
- Efficient token limits
- Automatic Bedrock fallback

## Monitoring

### Health Endpoint
```bash
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

### CloudWatch Metrics
- Generation duration (by stage)
- Error rate (by type)
- API key failures
- Bedrock fallback usage
- Request count

### Alarms
- High error rate (>5%)
- Slow generation (>120s)
- All keys failed
- Bedrock usage spike

## Scalability

### Horizontal Scaling
- Lambda: Auto-scales to 1000+ executions
- DynamoDB: On-demand capacity
- CloudFront: Global CDN
- API Gateway: Unlimited requests

### Cost Optimization
- Gemini free tier: $0
- Bedrock: Pay per use
- Lambda: Free tier covers development
- DynamoDB: On-demand pricing

## Technology Decisions

### Why FastAPI?
- Modern Python framework
- Automatic OpenAPI docs
- Async support
- Pydantic validation
- Easy Lambda deployment

### Why Gemini + Bedrock?
- Gemini: Free tier, fast, good quality
- Bedrock: High availability fallback
- Automatic failover
- Cost-effective

### Why Three.js + Rapier?
- Three.js: Industry standard 3D
- Rapier: Fast WebAssembly physics
- React Three Fiber: React integration
- Good documentation

## Future Enhancements

### Phase 2
- Redis caching layer
- WebSocket for real-time updates
- Multi-region deployment
- Advanced rate limiting

### Phase 3
- Microservices architecture
- Kubernetes deployment
- GraphQL API
- Real-time collaboration
- Mobile app backend
