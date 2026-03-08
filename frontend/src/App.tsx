import { useState, useCallback, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { PhysicsWorld } from './engine/PhysicsWorld';
import { Mode2World } from './engine/mode2/Mode2World';
import { ControlPanel } from './components/ControlPanel';
import { DOUBLE_PENDULUM, EM_RADIATION } from './demos/mode2Demos';
import SCENARIO_DIPOLE from './demos/scenario_dipole.json';
import type { PhysicsSchema } from './types/physics';
import type { Mode2Schema } from './types/physics_mode2';

type AnySchema = PhysicsSchema | Mode2Schema;

/* ── Demo schema: bouncing ball ────────────────────────────────── */
const DEMO_SCHEMA: PhysicsSchema = {
  simulation_id: 'bouncing-ball-demo',
  title: 'Bouncing Ball',
  description: 'A rubber ball dropped onto a wooden floor demonstrates gravity and elastic collisions.',
  physics_concept: 'Gravity, Elastic Collision, Coefficient of Restitution',
  mode: 1,
  difficulty: 'beginner',
  tags: ['gravity', 'bounce', 'restitution'],
  is_qualitative: false,
  environment: {
    gravity_y: -9.81, background: 'lab', ambient_light: 0.5,
    show_axes: true, show_grid: true,
    camera_position: { x: 0, y: 6, z: 16 }, fog_enabled: false,
  },
  objects: [
    {
      type: 'sphere', id: 'ball', label: 'Rubber Ball',
      education_note: 'Restitution controls how much energy is conserved on each bounce.',
      is_static: false, is_anchor: false, color: '#ef4444',
      position: { x: 0, y: 8, z: 0 }, radius: 0.5,
      material: { preset: 'rubber', restitution: 0.85, friction: 0.5, density: 1.2 },
    },
    {
      type: 'plane', id: 'floor', label: 'Floor',
      education_note: 'A static surface that absorbs and reflects the ball based on material properties.',
      is_static: true, is_anchor: false, color: '#f8fafc',
      position: { x: 0, y: 0, z: 0 }, width: 20, depth: 20,
      rotation_deg: { x: 0, y: 0, z: 0 },
      material: { preset: 'wood', restitution: 0.4, friction: 0.6, density: 0.7 },
    },
  ],
  links: [],
  controls: [
    { group: 'Ball', label: 'Restitution', param: 'ball.material.restitution', min: 0, max: 1, default: 0.85, step: 0.05, unit: '', education_note: '1.0 = perfectly elastic. 0.0 = perfectly inelastic.' },
    { group: 'Ball', label: 'Drop Height', param: 'ball.position.y', min: 1, max: 20, default: 8, step: 0.5, unit: 'm', education_note: 'Higher drops = more PE = higher first bounce.' },
    { group: 'Environment', label: 'Gravity', param: 'environment.gravity_y', min: -25, max: -0.1, default: -9.81, step: 0.1, unit: 'm/s²', education_note: 'Try Moon (-1.62) or Jupiter (-24.8).' },
  ],
  educational_sequence: [
    { step: 1, title: 'Observe', instruction: 'Watch the ball bounce.', focus_objects: ['ball'], focus_controls: [] },
  ],
};

const ALL_DEMOS: { label: string; schema: AnySchema }[] = [
  { label: 'Bouncing Ball', schema: DEMO_SCHEMA },
  { label: 'Electric Dipole', schema: SCENARIO_DIPOLE as unknown as Mode2Schema },
  { label: 'Double Pendulum', schema: DOUBLE_PENDULUM },
  { label: 'EM Radiation', schema: EM_RADIATION },
];

/* ── Atom SVG icon ─────────────────────────────────────────────── */
function AtomIcon({ className = '', size = 40 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Nucleus */}
      <circle cx="50" cy="50" r="6" fill="#38bdf8" />
      <circle cx="50" cy="50" r="10" fill="#38bdf8" opacity="0.2" />
      {/* Orbits */}
      <ellipse cx="50" cy="50" rx="40" ry="14" stroke="#38bdf8" strokeWidth="1.5" opacity="0.6" transform="rotate(0 50 50)" />
      <ellipse cx="50" cy="50" rx="40" ry="14" stroke="#38bdf8" strokeWidth="1.5" opacity="0.6" transform="rotate(60 50 50)" />
      <ellipse cx="50" cy="50" rx="40" ry="14" stroke="#38bdf8" strokeWidth="1.5" opacity="0.6" transform="rotate(-60 50 50)" />
      {/* Electrons */}
      <circle cx="90" cy="50" r="3" fill="#38bdf8" opacity="0.9" />
      <circle cx="30" cy="30" r="3" fill="#38bdf8" opacity="0.9" />
      <circle cx="30" cy="70" r="3" fill="#38bdf8" opacity="0.9" />
    </svg>
  );
}

/* ── Sparkle icon ──────────────────────────────────────────────── */
function SparkleIcon() {
  return (
    <div className="sparkle fixed bottom-6 right-6 z-50 pointer-events-none">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L14.09 8.26L20 9.27L15.45 13.97L16.18 20L12 17.27L7.82 20L8.55 13.97L4 9.27L9.91 8.26L12 2Z" fill="#38bdf8" opacity="0.8" />
      </svg>
    </div>
  );
}

/* ── 3D loader ─────────────────────────────────────────────────── */
function Loader() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
        <span className="text-sm text-cyan-300/80 font-medium">Loading simulation…</span>
      </div>
    </Html>
  );
}

/* ══════════════════════════════════════════════════════════════════
   LANDING PAGE
   ══════════════════════════════════════════════════════════════════ */
function LandingPage({
  onSelectDemo,
  onGenerate,
  userHistory,
}: {
  onSelectDemo: (schema: AnySchema) => void;
  onGenerate: (schema: AnySchema) => void;
  userHistory: { label: string; schema: AnySchema }[];
}) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const sessionId = localStorage.getItem('newton_session_id');
      const res = await fetch('http://localhost:8000/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: prompt.trim(),
          session_id: sessionId 
        }),
      });
      const data = await res.json();
      
      // Store session ID
      if (data.session_id) {
        localStorage.setItem('newton_session_id', data.session_id);
      }
      
      // Pass the simulation data
      onGenerate(data.simulation);
    } catch {
      // Fallback: just load the first demo
      onSelectDemo(DEMO_SCHEMA);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex bg-gradient-to-br from-[#080c18] via-[#0a1025] to-[#0c1530] text-white overflow-hidden">
      {/* ── Left sidebar: Previous Simulations ── */}
      <div className="absolute top-8 left-8 z-10">
        <h3 className="text-sm font-semibold text-white/90 mb-3 tracking-wide">Previous Simulations</h3>
        <div className="space-y-2">
          {userHistory.map((demo, i) => (
            <button
              key={i}
              onClick={() => onSelectDemo(demo.schema)}
              className="block text-sm text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer text-left font-medium"
            >
              {demo.label}
            </button>
          ))}
          {userHistory.length > 0 && ALL_DEMOS.length > 0 && (
            <div className="border-t border-slate-700 my-3 pt-3">
              <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Examples</h4>
            </div>
          )}
          {ALL_DEMOS.map((demo, i) => (
            <button
              key={`demo-${i}`}
              onClick={() => onSelectDemo(demo.schema)}
              className="block text-sm text-slate-400 hover:text-slate-300 transition-colors cursor-pointer text-left font-medium"
            >
              {demo.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Center: Logo + Prompt ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <AtomIcon size={56} className="atom-spin" />
          <h1 className="text-5xl font-bold tracking-tight">
            <span className="text-cyan-400 glow-text">Newton</span>
            <span className="text-slate-300">AI</span>
          </h1>
        </div>

        {/* Prompt input */}
        <div className="w-full max-w-2xl glow-border rounded-xl border border-cyan-500/30 bg-slate-900/50 backdrop-blur-sm transition-shadow duration-300">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What physics would you like to simulate? (e.g., 'Show me electron drift in copper')"
            rows={3}
            className="w-full bg-transparent text-white/90 placeholder-slate-500 p-5 text-base resize-none focus:outline-none leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>

        {loading && (
          <div className="mt-6 flex items-center gap-3 text-cyan-400/80">
            <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
            <span className="text-sm font-medium">Generating simulation…</span>
          </div>
        )}
      </div>

      <SparkleIcon />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SIMULATION VIEW — full-screen canvas + glassmorphic controls
   ══════════════════════════════════════════════════════════════════ */
function SimulationView({
  schema,
  onBack,
}: {
  schema: AnySchema;
  onBack: () => void;
}) {
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [simKey, setSimKey] = useState(0);
  const [enableGlow, setEnableGlow] = useState(true);
  const [enableTrail, setEnableTrail] = useState(false);

  const handleControl = useCallback((param: string, value: number) => {
    setOverrides((prev) => ({ ...prev, [param]: value }));
  }, []);

  const handleReset = useCallback(() => {
    setOverrides({});
    setSimKey((k) => k + 1);
  }, []);

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden relative">
      {/* ── Full-screen 3D Canvas ── */}
      <Canvas
        key={simKey}
        shadows
        className="!absolute inset-0"
        camera={{
          position: [
            schema.environment.camera_position.x,
            schema.environment.camera_position.y,
            schema.environment.camera_position.z,
          ],
          fov: 50,
          near: 0.1,
          far: 200,
        }}
      >
        <Suspense fallback={<Loader />}>
          {schema.mode === 1
            ? <PhysicsWorld
              schema={schema as PhysicsSchema}
              controlOverrides={overrides}
              enableGlow={enableGlow}
              enableTrail={enableTrail}
            />
            : <Mode2World schema={schema as Mode2Schema} controlOverrides={overrides} />
          }
        </Suspense>
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      </Canvas>

      {/* ── Top-left: back button + small logo ── */}
      <div className="absolute top-5 left-5 z-20 flex items-center gap-3">
        {/* Back arrow */}
        <button
          onClick={onBack}
          className="p-2 rounded-xl glass-panel hover:bg-white/10 transition-colors cursor-pointer"
          title="Back to home"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Logo */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
        >
          <AtomIcon size={28} className="atom-spin" />
          <span className="text-lg font-bold tracking-tight">
            <span className="text-cyan-400">Newton</span>
            <span className="text-slate-400">AI</span>
          </span>
        </button>
      </div>

      {/* ── Top-right: glassmorphic control panel ── */}
      <div className="absolute top-5 right-5 z-20">
        <ControlPanel
          controls={schema.controls}
          values={overrides}
          onChange={handleControl}
          onReset={handleReset}
          simulationId={schema.simulation_id}
          title={schema.title}
        />
      </div>

      {/* ── Bottom-left: render toggles ── */}
      <div className="absolute bottom-6 left-6 z-20 flex items-center gap-4">
        {/* Glow toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none group">
          <div className="relative">
            <input
              type="checkbox"
              checked={enableGlow}
              onChange={(e) => setEnableGlow(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 rounded-full bg-slate-700 peer-checked:bg-cyan-600 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform peer-checked:translate-x-4" />
          </div>
          <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">
            Glow
          </span>
        </label>

        {/* Trail toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none group">
          <div className="relative">
            <input
              type="checkbox"
              checked={enableTrail}
              onChange={(e) => setEnableTrail(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 rounded-full bg-slate-700 peer-checked:bg-cyan-600 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform peer-checked:translate-x-4" />
          </div>
          <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">
            Trail
          </span>
        </label>
      </div>

      <SparkleIcon />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   APP ROOT — switches between landing page and simulation view
   ══════════════════════════════════════════════════════════════════ */
export default function App() {
  const [activeSchema, setActiveSchema] = useState<AnySchema | null>(null);
  const [userHistory, setUserHistory] = useState<{ label: string; schema: AnySchema }[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('newton_simulation_history');
    if (saved) {
      try {
        setUserHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load history:', e);
      }
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (userHistory.length > 0) {
      localStorage.setItem('newton_simulation_history', JSON.stringify(userHistory));
    }
  }, [userHistory]);

  const handleGenerate = (schema: AnySchema) => {
    // Add to history (limit to 10 most recent)
    setUserHistory((prev) => {
      const newHistory = [
        { label: schema.title, schema },
        ...prev.filter((item) => item.schema.simulation_id !== schema.simulation_id),
      ].slice(0, 10);
      return newHistory;
    });
    setActiveSchema(schema);
  };

  if (!activeSchema) {
    return (
      <LandingPage
        onSelectDemo={(schema) => setActiveSchema(schema)}
        onGenerate={handleGenerate}
        userHistory={userHistory}
      />
    );
  }

  return (
    <SimulationView
      schema={activeSchema}
      onBack={() => setActiveSchema(null)}
    />
  );
}
