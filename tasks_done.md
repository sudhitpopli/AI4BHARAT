# NewtonAI — Tasks Done Log

## Phase 1: Foundation & Setup ✅
**Completed:** 2026-03-07 ~23:45 IST

- Scaffolded React frontend via `npx create-vite@latest frontend --template react-ts`
- Installed all dependencies: `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`, `tailwindcss@3`, `postcss`, `autoprefixer`, `@types/three`
- Configured `tailwind.config.js` (content paths) and `postcss.config.js`
- Set up `index.css` with Tailwind directives + full-height reset
- Created Python backend: `python -m venv venv` + installed `fastapi`, `uvicorn`, `pydantic`, `boto3`
- Created root `.gitignore` covering `node_modules/`, `venv/`, `__pycache__/`, etc.

---

## Phase 2: Strict JSON Schema Definition ✅
**Completed:** 2026-03-08 ~00:15 IST

### Backend (Pydantic)
- **`backend/schema.py`** — Full discriminated-union Pydantic models:
  - 8 object types: `SphereObject`, `BoxObject`, `CylinderObject`, `PlaneObject`, `RampObject`, `StringObject`, `SpringObject`, `FluidEmitterObject`
  - 7 link types: `RopeProperties`, `SpringLinkProperties`, `RigidRodProperties`, `HingeProperties`, `BallSocketProperties`, `WeldProperties`, `SliderProperties`
  - Shared models: `Vec3`, `RotationDeg`, `Material`, `Environment`, `CameraPosition`, `AttachmentRef`, `Link`, `Control`, `EducationalStep`
  - Top-level `PhysicsSchema` with `mode: Literal[1]` locked

### Frontend (TypeScript)
- **`frontend/src/types/physics.ts`** — 1:1 mirror of backend schema as TS interfaces with discriminated unions on `type` field

### Backend System Prompt
- **`backend/bedrock_prompt.py`** — Full Claude 3.5 Sonnet system prompt (object vocab, link vocab, attachment points, material presets, color vocab, few-shot examples) stored as `SYSTEM_PROMPT` constant

### Backend Boilerplate
- **`backend/main.py`** — FastAPI app skeleton with `POST /generate` route stub

---

## Phase 3: Physics Renderer Engine ✅
**Completed:** 2026-03-08 ~00:30 IST

### Engine Core — `frontend/src/engine/`

| File | Purpose |
|------|---------|
| `ObjectMesh.tsx` | Renders all 8 object types as Rapier `<RigidBody>` + Three.js meshes. Uses `forwardRef` for joint access. Handles colliders (`BallCollider`, `CuboidCollider`, `CylinderCollider`), materials (restitution, friction, density), initial velocities, and rotations. |
| `Joints.tsx` | Maps 7 link types to Rapier joint hooks (`useRopeJoint`, `useSpringJoint`, `useRevoluteJoint`, `useFixedJoint`, `usePrismaticJoint`, `useSphericalJoint`). Contains `resolveAnchor()` to convert attachment point names to local offset vectors per object type. Draws visual ropes (catenary sag), springs (zigzag coils), and rods via `useFrame` line updates. |
| `SceneSetup.tsx` | HDRI environment maps via `<Environment>`, directional + ambient + point lighting, `<Grid>`, `<GizmoHelper>` axes, and fog — all driven by schema `environment` config. |
| `PhysicsWorld.tsx` | Main orchestrator: creates `<Physics>` world with configurable gravity, creates refs for all objects, renders `ObjectMesh` + `JointRenderer` + `VisualLink` for each schema entry. Includes `applyOverrides()` for deep-cloning schema and applying control slider dot-notation overrides. |

### UI — `frontend/src/components/`

| File | Purpose |
|------|---------|
| `ControlPanel.tsx` | Groups sliders by `control.group`, shows value + unit, reveals `education_note` on hover, includes ↻ Restart Simulation button. |

### App — `frontend/src/`

| File | Purpose |
|------|---------|
| `App.tsx` | Split layout: 320px left sidebar (prompt input, sim info + tags, control panel) + flex-1 3D Canvas. Includes hardcoded bouncing-ball `DEMO_SCHEMA` for instant testing. Wired to `POST /generate` for backend integration. HUD overlay shows mode/object/link count. |
| `App.css` | Cleared (all styles via Tailwind). |
| `main.tsx` | Clean entry point with StrictMode. |
| `index.css` | Tailwind directives + full-height body reset. |

---

## Current File Tree

```
AI4BHARAT/
├── .gitignore
├── design.md
├── requirements.md
├── tasks.md
├── tasks_done.md              ← this file
│
├── backend/
│   ├── main.py                # FastAPI app skeleton
│   ├── schema.py              # Pydantic schema (all object/link types)
│   ├── bedrock_prompt.py      # Claude system prompt
│   └── venv/                  # (gitignored)
│
└── frontend/
    ├── package.json
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── App.css
        ├── index.css
        ├── types/
        │   └── physics.ts     # TS interfaces (mirrors Pydantic)
        ├── engine/
        │   ├── ObjectMesh.tsx  # 8 object type renderers
        │   ├── Joints.tsx      # 7 joint types + visual links
        │   ├── SceneSetup.tsx  # Lighting, env, grid, axes
        │   └── PhysicsWorld.tsx# Physics orchestrator
        └── components/
            └── ControlPanel.tsx# Slider controls UI
```

---

## Verification Results
- **TypeScript:** `npx tsc --noEmit` → **0 errors**
- **Vite dev server:** `npm run dev` → running on `http://localhost:5173`

---

## Phase 4: Mode 2 Schema — Parameterized Math ✅
**Completed:** 2026-03-08 ~10:15 IST

### Pydantic — `backend/schema_mode2.py`
- 25+ object types across 6 domains:
  - **Classical Parametric:** `OrbitBody`, `Wave`, `SpringMass`, `Projectile`
  - **Electromagnetism:** `ChargedParticle`, `ElectricField`, `MagneticField`, `FieldLine`, `EMWave`
  - **Electronics (RLC):** `Resistor`, `Inductor`, `Capacitor`, `VoltageSource`, `CurrentSource`, `GroundNode`, `RLCNetwork`, `TransmissionLineSegment`, `TransistorBJT`, `TransistorMOSFET`, `OpAmp`
  - **Relativity:** `RelativisticParticle`, `SpacetimeDiagram`
  - **Thermodynamics:** `GasParticleSystem`, `HeatDiffusion`
  - **Optics:** `LightRay`, `OpticalMedium`
- 4 circuit link types: `WireLink`, `RealWireLink`, `CoupledInductorLink`, `TransmissionLineLink`
- 5 physics link types: `OrbitalGravityLink`, `EMForceLink`, `WaveSuperpositionLink`, `SpringCouplingLink`, `RefractionBoundaryLink`
- Top-level `Mode2Schema` with `mode: Literal[2]` locked

### TypeScript — `frontend/src/types/physics_mode2.ts`
- 1:1 mirror of Pydantic schema as discriminated union interfaces

### Verification
- **Pydantic:** `Mode2Schema` imports and validates → **14 top-level fields**
- **TypeScript:** `npx tsc --noEmit` → **0 errors**

### Updated File Tree
```
backend/
├── schema.py           # Mode 1 Pydantic
├── schema_mode2.py     # Mode 2 Pydantic (NEW)
├── bedrock_prompt.py   # Mode 1 system prompt
└── main.py

frontend/src/types/
├── physics.ts          # Mode 1 TypeScript
└── physics_mode2.ts    # Mode 2 TypeScript (NEW)
```

---

## Phase 5: Mode 2 Renderer Engine — Pure Math Physics ✅
**Completed:** 2026-03-08 ~10:30 IST

### Engine Files — `frontend/src/engine/mode2/`

| File | Lines | Description |
|------|-------|-------------|
| `Mode2World.tsx` | ~85 | Main orchestrator — routes 25+ object types to domain renderers, applies control overrides, separates circuit objects into dedicated scene |
| `ClassicalRenderers.tsx` | ~175 | **OrbitRenderer**: Keplerian elliptical motion with trails, rings, atmosphere glow, point light for stars. **WaveRenderer**: transverse/longitudinal/standing waves with second-wave superposition. **SpringMassRenderer**: damped + driven SHM with zigzag spring coil visual. **ProjectileRenderer**: parabolic trajectory with ground reset |
| `EMRenderers.tsx` | ~175 | **ChargedParticleRenderer**: Lorentz force F=q(E+v×B) integration per frame with trails. **ElectricFieldRenderer**: point charge radial + uniform parallel field lines + parallel plate capacitor. **MagneticFieldRenderer**: straight wire circular + solenoid field lines. **FieldLineRenderer**: radial lines from point sources. **EMWaveRenderer**: coupled E/B sinusoidal oscillations |
| `CircuitRenderer.tsx` | ~195 | **Component meshes**: 3D R (box), L (torus coils), C (parallel plates), V source (cylinder), ground (stacked bars). **Wire routing**: manhattan-style paths between terminals. **ChargeFlow**: InstancedMesh of golden glowing spheres flowing along wire paths proportional to I=V/R |
| `MiscRenderers.tsx` | ~195 | **RelativisticParticleRenderer**: Lorentz contraction, γ-based glow. **SpacetimeDiagramRenderer**: axes, light cones, worldlines, events. **GasParticleRenderer**: N-body InstancedMesh with Maxwell-Boltzmann velocities, elastic wall bounces, temperature-color gradient. **HeatDiffusionRenderer**: 2D finite-difference heat equation on colored grid. **LightRayRenderer**: Snell's law refraction at optical boundaries. **OpticalMediumRenderer**: transparent shapes (slab/prism/lens/sphere) |

### App.tsx Integration
- Added `AnySchema = PhysicsSchema | Mode2Schema` union type
- Canvas routes to `PhysicsWorld` (mode 1) or `Mode2World` (mode 2) based on `schema.mode`
- HUD overlay shows correct mode label dynamically

### Verification
- **TypeScript:** `npx tsc --noEmit` → **0 errors**

### Updated File Tree Addition
```
frontend/src/engine/mode2/
├── Mode2World.tsx          # Orchestrator
├── ClassicalRenderers.tsx  # Orbit, Wave, SpringMass, Projectile
├── EMRenderers.tsx         # ChargedParticle, E/B Fields, EM Wave
├── CircuitRenderer.tsx     # Electronics RLC + charge flow
└── MiscRenderers.tsx       # Relativity, Thermo, Optics
```
