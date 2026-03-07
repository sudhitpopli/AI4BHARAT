# NewtonAI - Architecture & Design Document

## 1. High-Level Architecture
**Pattern:** "Intelligent Form Filler"
The platform acts as a bridge between natural language prompts and a strictly typed 3D physics rendering engine. We avoid generating raw physics code on the fly; instead, we parameterize predefined physics models.

### Data Flow
1. **User Input:** Natural language prompt via React frontend.
2. **Backend Processing:** FastAPI server receives the prompt and calls Claude 3.5 Sonnet (via AWS Bedrock boto3).
3. **Parameterization:** Claude 3.5 Sonnet translates the prompt into a **STRICT JSON SCHEMA** representing object properties, environmental constants, and physics mode.
4. **Validation:** Pydantic validates the JSON payload to ensure strict adherence.
5. **Rendering:** The React frontend receives the validated JSON and acts as a "dumb renderer", routing data to pre-built React Three Fiber components.

## 2. Physics Render Modes
All simulations are routed through one of three distinct modes based on the generated schema.

### Mode 1: Classical Mechanics (Rapier)
- **Use Case:** Gravity, collisions, projectiles, bouncing.
- **Implementation:** Wrap objects in `<RigidBody>` from `@react-three/rapier`. Rapier handles all physics math natively.

### Mode 2: Parameterized Math (useFrame)
- **Use Case:** Electromagnetism, relativity, orbital mechanics (non-collision).
- **Implementation:** Disable Rapier gravity. Use generic `useFrame` loops in React Three Fiber with basic trigonometry (sin/cos) or algebraic scaling to animate particles based on JSON parameters.

### Mode 3: Canned / Featured Animations
- **Use Case:** Mathematically complex or real-time impossible simulations (e.g., fluid dynamics, quantum tunneling, Navier-Stokes).
- **Implementation:** Do not attempt real-time calculation. Trigger a pre-coded, hardcoded 3D animation sequence block.

## 3. Component Architecture
- **Web Client:** TailwindCSS for UI, Zustand/Context for application state representing the JSON payload.
- **3D Canvas:** `<Canvas>` enclosing `<Suspense>`, scene lighting, and the dynamically chosen Physics Mode component.
- **REST API:** FastAPI endpoint accepting the prompt and returning the Pydantic-validated JSON schema reliably.
