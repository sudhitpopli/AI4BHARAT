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
