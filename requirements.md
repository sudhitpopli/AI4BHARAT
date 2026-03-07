# NewtonAI - Requirements Document

## 1. Technology Stack (STRICT)
**Frontend:**
- React
- React Three Fiber (`@react-three/fiber`)
- Drei (`@react-three/drei`)
- Rapier Physics (`@react-three/rapier`)
- TailwindCSS

**Backend:**
- Python
- FastAPI
- Uvicorn
- Pydantic
- Boto3

**AI/LLM:**
- Claude 3.5 Sonnet (Invoked strictly via AWS Bedrock `boto3` client).

## 2. Banned Technologies (DO NOT USE)
- Unreal Engine 5, C++, Blueprints
- Redis, AWS SQS, DynamoDB
- PySpice, Ngspice, COMSOL
- Custom fluid dynamics math or complex real-time solving.

## 3. System Requirements & Rules of Engagement
- **Efficiency:** All code must be the shortest, most efficient React or Python code possible. No over-engineering.
- **Real Implementation:** Write actual implementation for Three.js meshes and FastAPI routes. No dummy placeholders.
- **Constraint Acknowledgement:** For mathematically impossible/complex real-time renders (e.g., fluids), must fallback to **Mode 3 (Canned Animations)** and explain limit to user.
- **Schema Adherence:** All LLM generations must perfectly map to the predefined strictly-typed Pydantic JSON schema.
- **Speed & Completeness:** Provide complete files that can be copy-pasted directly without missing imports.

## 4. Product Goal
A web-based generative physics imagination engine capable of demonstrating:
- **Mode 1:** Classical Mechanics natively (Gravity, ball bouncing, collisions)
- **Mode 2:** Parameterized Math (Trigonometric scaling particle rendering for relativity/electromagnetism)
- **Mode 3:** Pre-rendered complex scenes (Fluid dynamics)
