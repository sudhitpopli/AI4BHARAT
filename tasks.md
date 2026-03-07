# NewtonAI - MVP Task Breakdown

## Phase 1: Foundation & Setup
- [ ] Initialize React frontend project (Vite/Next.js).
- [ ] Install Three, React Three Fiber, Drei, Rapier, and TailwindCSS in frontend.
- [ ] Initialize Python backend with FastAPI, Uvicorn, Pydantic, and Boto3.
- [ ] Define the STRICT expected JSON Schema (Pydantic model in backend, TypeScript interface in frontend) representing Physics parameters.

## Phase 2: Backend Implementation
- [ ] Implement AWS Bedrock client configuration using `boto3`.
- [ ] Standardize the system prompt to force Claude 3.5 Sonnet to map user intent into the strict JSON schema perfectly.
- [ ] Create FastAPI route (`POST /generate`) to handle prompt, invoke Claude, and validate response with Pydantic.

## Phase 3: Frontend "Dumb Renderer" Setup
- [ ] Build the main UI layout holding the input text prompt and the right-hand Canvas area using TailwindCSS.
- [ ] Create the **Master Renderer** Component that reads the parsed JSON state and routes it to Mode 1, Mode 2, or Mode 3 components.

## Phase 4: Implementation of Physics Modes
- [ ] **Mode 1 (Rapier):** Build the Classical Mechanics component containing `<Physics>` and `<RigidBody>` elements parameterized by JSON properties (e.g., restitution, mass, colliders).
- [ ] **Mode 2 (Parameterized):** Build the `useFrame` mathematical component avoiding Rapier gravity. Use loop-driven trigonometric values (sin/cos) for animated orbitals or waves.
- [ ] **Mode 3 (Canned):** Build 1-2 hardcoded 3D animation meshes/scenes for complex scenarios (like fluid) to act as visual fallbacks.

## Phase 5: Integration
- [ ] Connect Frontend App state to FastAPI backend (send user prompt -> get JSON schema back -> update Canvas).
- [ ] Test edge case prompts and refine Claude 3.5 Sonnet's JSON output accuracy.
