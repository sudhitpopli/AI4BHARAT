# NewtonAI Architecture - Gemini Integration

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    React Frontend                           │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │ │
│  │  │  Landing     │  │  Simulation  │  │  Control     │     │ │
│  │  │  Page        │  │  View        │  │  Panel       │     │ │
│  │  │              │  │              │  │  + Chat      │     │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │ │
│  │                                                              │ │
│  │  localStorage:                                               │ │
│  │  - newton_session_id                                        │ │
│  │  - newton_simulation_history                                │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/JSON
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Endpoints:                                                 │ │
│  │  • POST /generate  → Generate simulation                   │ │
│  │  • POST /chat      → Ask questions                         │ │
│  │  • GET  /health    → Check status                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Load Balancer (Round-Robin)                               │ │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐        │ │
│  │  │ Key1 │→ │ Key2 │→ │ Key3 │→ │ Key4 │→ │ Key5 │→ Key1  │ │
│  │  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Session Storage (In-Memory)                               │ │
│  │  { session_id: [messages] }                                │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ API Call
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Google AI Studio                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         Gemini 2.0 Flash (gemini-2.0-flash-exp)           │ │
│  │                      FREE TIER                              │ │
│  │  • System Prompt: Physics JSON generator                   │ │
│  │  • Temperature: 0.1 (precise)                               │ │
│  │  • Max Tokens: 8192                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Simulation Generation

```
1. User Input
   ┌─────────────────────────────────────┐
   │ "Show me a bouncing ball"           │
   └─────────────────────────────────────┘
                  │
                  ▼
2. Frontend (React)
   ┌─────────────────────────────────────┐
   │ POST /generate                      │
   │ {                                   │
   │   prompt: "Show me...",             │
   │   session_id: "uuid" (optional)     │
   │ }                                   │
   └─────────────────────────────────────┘
                  │
                  ▼
3. Backend (FastAPI)
   ┌─────────────────────────────────────┐
   │ • Generate/reuse session_id         │
   │ • Get last 5 messages from storage  │
   │ • Select next API key (round-robin) │
   └─────────────────────────────────────┘
                  │
                  ▼
4. Gemini API
   ┌─────────────────────────────────────┐
   │ • Receive prompt + history          │
   │ • Generate JSON simulation          │
   │ • Return structured response        │
   └─────────────────────────────────────┘
                  │
                  ▼
5. Backend Validation
   ┌─────────────────────────────────────┐
   │ • Extract JSON from response        │
   │ • Validate with Pydantic            │
   │ • Save to session storage           │
   └─────────────────────────────────────┘
                  │
                  ▼
6. Frontend Rendering
   ┌─────────────────────────────────────┐
   │ • Store session_id in localStorage  │
   │ • Add to simulation history         │
   │ • Render with Three.js + Rapier     │
   └─────────────────────────────────────┘
```

---

## Data Flow: Chat Interaction

```
1. User Question
   ┌─────────────────────────────────────┐
   │ "Why does the ball bounce?"         │
   └─────────────────────────────────────┘
                  │
                  ▼
2. ControlPanel (React)
   ┌─────────────────────────────────────┐
   │ POST /chat                          │
   │ {                                   │
   │   session_id: "uuid",               │
   │   question: "Why...",               │
   │   simulation_id: "bouncing-ball"    │
   │ }                                   │
   └─────────────────────────────────────┘
                  │
                  ▼
3. Backend (FastAPI)
   ┌─────────────────────────────────────┐
   │ • Get conversation history          │
   │ • Select next API key               │
   │ • Use chat system prompt            │
   └─────────────────────────────────────┘
                  │
                  ▼
4. Gemini API
   ┌─────────────────────────────────────┐
   │ • Receive question + history        │
   │ • Generate tutor response           │
   │ • Return plain text answer          │
   └─────────────────────────────────────┘
                  │
                  ▼
5. Backend Storage
   ┌─────────────────────────────────────┐
   │ • Save question to session          │
   │ • Save answer to session            │
   │ • Return response                   │
   └─────────────────────────────────────┘
                  │
                  ▼
6. ControlPanel Display
   ┌─────────────────────────────────────┐
   │ • Add to message list               │
   │ • Scroll to bottom                  │
   │ • Enable input for next question    │
   └─────────────────────────────────────┘
```

---

## Component Hierarchy

```
App
├── LandingPage
│   ├── Logo
│   ├── Prompt Input
│   └── Simulation History Sidebar
│       ├── User Simulations (cyan)
│       └── Example Demos (slate)
│
└── SimulationView
    ├── Canvas (Three.js)
    │   ├── PhysicsWorld (Mode 1)
    │   │   └── Rapier Physics
    │   └── Mode2World (Mode 2)
    │       └── Custom Math
    │
    ├── ControlPanel (top-right)
    │   ├── Header + Collapse
    │   ├── Chat Interface (when open)
    │   │   ├── Messages
    │   │   ├── Input
    │   │   └── Send Button
    │   ├── Sliders (when closed)
    │   │   └── Grouped Controls
    │   └── Action Buttons
    │       ├── Reset
    │       └── Toggle Chat/Controls
    │
    └── Render Toggles (bottom-left)
        ├── Glow
        └── Trail
```

---

## Load Balancing Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    API Key Pool                              │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐         │
│  │ Key1 │  │ Key2 │  │ Key3 │  │ Key4 │  │ Key5 │         │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘         │
│     ▲                                          │             │
│     │                                          │             │
│     └──────────────────────────────────────────┘             │
│              Round-Robin Rotation                            │
└─────────────────────────────────────────────────────────────┘

Request Flow:
Request 1 → Key1 → Gemini API → Response
Request 2 → Key2 → Gemini API → Response
Request 3 → Key3 → Gemini API → Response
Request 4 → Key4 → Gemini API → Response
Request 5 → Key5 → Gemini API → Response
Request 6 → Key1 → Gemini API → Response (wraps around)
...

Benefits:
✓ Prevents rate limiting
✓ Distributes quota usage
✓ Automatic failover
✓ No manual intervention
```

---

## Session Storage Structure

```javascript
// In-Memory Storage (Backend)
session_storage = {
  "uuid-1": [
    {
      role: "user",
      content: "Show me a bouncing ball",
      timestamp: "2024-01-01T12:00:00Z"
    },
    {
      role: "assistant",
      content: '{"simulation_id": "bouncing-ball-001", ...}',
      timestamp: "2024-01-01T12:00:03Z"
    },
    {
      role: "user",
      content: "Why does it bounce?",
      timestamp: "2024-01-01T12:01:00Z"
    },
    {
      role: "assistant",
      content: "The ball bounces because...",
      timestamp: "2024-01-01T12:01:02Z"
    }
  ],
  "uuid-2": [ /* another session */ ]
}

// localStorage (Frontend)
{
  "newton_session_id": "uuid-1",
  "newton_simulation_history": [
    {
      label: "Bouncing Ball",
      schema: { /* full simulation JSON */ }
    },
    {
      label: "Simple Pendulum",
      schema: { /* full simulation JSON */ }
    }
  ]
}
```

---

## ControlPanel States

```
┌─────────────────────────────────────────────────────────────┐
│                    ControlPanel                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  STATE 1: Controls Mode (chatOpen = false)                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Title: "Bouncing Ball"                    [Collapse]  │ │
│  │  ────────────────────────────────────────────────────  │ │
│  │  BALL                                                  │ │
│  │  Restitution: 0.85 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │
│  │  Drop Height: 8.0m ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │
│  │  ────────────────────────────────────────────────────  │ │
│  │  ENVIRONMENT                                           │ │
│  │  Gravity: -9.81 m/s² ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │
│  │  ────────────────────────────────────────────────────  │ │
│  │  [↻ Reset Simulation]                                 │ │
│  │  [💬 Open Chat]                                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  STATE 2: Chat Mode (chatOpen = true)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Title: "Bouncing Ball"                    [Collapse]  │ │
│  │  ────────────────────────────────────────────────────  │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ 🟢 Physics Tutor                          [X]    │ │ │
│  │  ├──────────────────────────────────────────────────┤ │ │
│  │  │                                                  │ │ │
│  │  │  User: Why does the ball bounce?                │ │ │
│  │  │                                                  │ │ │
│  │  │  Tutor: The ball bounces because of the         │ │ │
│  │  │  coefficient of restitution...                  │ │ │
│  │  │                                                  │ │ │
│  │  ├──────────────────────────────────────────────────┤ │ │
│  │  │ [Ask about the physics...        ] [Send]       │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ────────────────────────────────────────────────────  │ │
│  │  [↻ Reset Simulation]                                 │ │
│  │  [📊 Show Controls]                                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
- **Framework**: React 18
- **3D Rendering**: Three.js + React Three Fiber
- **Physics**: Rapier (WASM)
- **Styling**: TailwindCSS
- **State**: React Hooks + localStorage

### Backend
- **Framework**: FastAPI
- **AI Model**: Gemini 2.0 Flash (gemini-2.0-flash-exp) - FREE TIER
- **Validation**: Pydantic
- **Session Storage**: In-memory dict (production: Redis/PostgreSQL)
- **Environment**: python-dotenv

### Infrastructure
- **Development**: localhost:8000 (backend), localhost:5173 (frontend)
- **Production**: Any hosting platform (Railway, Render, Vercel, etc.)
- **Database**: None required (optional for production)

---

## Security Considerations

### API Keys
- ✅ Stored in `.env` file (not committed to git)
- ✅ Server-side only (never exposed to frontend)
- ✅ Multiple keys for redundancy

### CORS
- ⚠️ Currently allows all origins (`["*"]`)
- 🔒 Production: Restrict to specific domains

### Rate Limiting
- ⚠️ Currently none
- 🔒 Production: Add per-user rate limiting

### Session Storage
- ⚠️ Currently in-memory (lost on restart)
- 🔒 Production: Use Redis/PostgreSQL with encryption

---

## Performance Metrics

### Latency
- **Simulation Generation**: 2-5 seconds
- **Chat Response**: 1-2 seconds
- **UI Interaction**: <16ms (60 FPS)

### Throughput
- **Concurrent Users**: Limited by Gemini API quotas
- **Requests/Minute**: 15 (free tier) per API key
- **With 5 Keys**: 75 requests/minute

### Storage
- **Session Data**: ~1KB per message
- **Simulation History**: ~10KB per simulation
- **Total per User**: ~100KB (10 simulations + 10 messages)

---

## Monitoring & Logging

### Backend Logs
```
✓ Loaded 5 Gemini API key(s)
🚀 NewtonAI backend started
📊 Using 5 Gemini API key(s) for load balancing
Using API key #1/5
📝 Generating simulation for: 'Show me a bouncing ball...'
✓ Generated: 'Bouncing Ball' (mode=1)
```

### Frontend Console
```
Session ID: uuid-1234
Simulation added to history
Chat message sent
Chat response received
```

### Health Check
```bash
curl http://localhost:8000/health
{
  "status": "ok",
  "model": "gemini-2.0-flash-exp",
  "api_keys_loaded": 5
}
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Production Setup                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Frontend (Vercel/Netlify)                                  │
│  ├── Static files (HTML, JS, CSS)                           │
│  ├── CDN distribution                                        │
│  └── Environment: VITE_API_URL                              │
│                                                              │
│  Backend (Railway/Render/Fly.io)                            │
│  ├── FastAPI application                                    │
│  ├── Environment: GEMINI_API_KEY_1-5                        │
│  └── HTTPS enabled                                          │
│                                                              │
│  Database (Optional - Supabase/MongoDB Atlas)               │
│  ├── Session storage                                        │
│  ├── User data                                              │
│  └── Analytics                                              │
│                                                              │
│  External APIs                                              │
│  └── Google AI Studio (Gemini)                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Future Enhancements

### Short-term
- [ ] Persistent session storage (Redis)
- [ ] User authentication
- [ ] Rate limiting per user
- [ ] Error recovery & retry logic

### Medium-term
- [ ] Analytics dashboard
- [ ] Export simulation as link
- [ ] Voice input for chat
- [ ] Multi-language support

### Long-term
- [ ] Mobile app (React Native)
- [ ] VR/AR integration
- [ ] Collaborative simulations
- [ ] Custom physics engines
