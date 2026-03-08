import { useState, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { PhysicsWorld } from './engine/PhysicsWorld';
import { ControlPanel } from './components/ControlPanel';
import type { PhysicsSchema } from './types/physics';

/* ── Demo schema: bouncing ball (instant test without backend) ── */
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
    gravity_y: -9.81,
    background: 'lab',
    ambient_light: 0.5,
    show_axes: true,
    show_grid: true,
    camera_position: { x: 0, y: 6, z: 16 },
    fog_enabled: false,
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
    { group: 'Ball', label: 'Restitution', param: 'ball.material.restitution', min: 0, max: 1, default: 0.85, step: 0.05, unit: '', education_note: '1.0 = perfectly elastic (no energy lost). 0.0 = perfectly inelastic (all energy absorbed).' },
    { group: 'Ball', label: 'Drop Height', param: 'ball.position.y', min: 1, max: 20, default: 8, step: 0.5, unit: 'm', education_note: 'Higher drops = more potential energy = higher first bounce. PE = mgh.' },
    { group: 'Environment', label: 'Gravity', param: 'environment.gravity_y', min: -25, max: -0.1, default: -9.81, step: 0.1, unit: 'm/s²', education_note: 'Try Moon (-1.62) or Jupiter (-24.8). Time of fall = √(2h/g).' },
  ],
  educational_sequence: [
    { step: 1, title: 'Observe the Bounce', instruction: 'Watch the ball bounce. Count how many times it bounces before coming to rest.', focus_objects: ['ball'], focus_controls: [] },
    { step: 2, title: 'Change Restitution', instruction: 'Set restitution to 1.0 for a perfectly elastic ball, then to 0.0 for clay. What happens?', focus_objects: ['ball'], focus_controls: ['ball.material.restitution'] },
  ],
};

function Loader() {
  return (
    <Html center>
      <div className="text-white text-lg font-semibold animate-pulse">Loading simulation…</div>
    </Html>
  );
}

export default function App() {
  const [schema, setSchema] = useState<PhysicsSchema>(DEMO_SCHEMA);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [simKey, setSimKey] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleControl = useCallback((param: string, value: number) => {
    setOverrides((prev) => ({ ...prev, [param]: value }));
  }, []);

  const handleReset = useCallback(() => {
    setOverrides({});
    setSimKey((k) => k + 1);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      setSchema(data);
      setOverrides({});
      setSimKey((k) => k + 1);
    } catch (e) {
      console.error('Generation failed:', e);
    } finally {
      setLoading(false);
    }
  }, [prompt]);

  return (
    <div className="h-screen w-screen flex bg-[#0f0f1a] text-white overflow-hidden">
      {/* ── Left panel ── */}
      <aside className="w-80 flex-shrink-0 flex flex-col border-r border-white/10 bg-[#12122a]/80 backdrop-blur-xl">
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            ⚛ NewtonAI
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">Generative Physics Engine</p>
        </div>

        {/* Prompt input */}
        <div className="p-4 border-b border-white/10 space-y-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe a physics scenario…"
            className="w-full h-20 bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-semibold text-sm hover:from-cyan-500 hover:to-indigo-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            {loading ? '⏳ Generating…' : '▶ Generate Simulation'}
          </button>
        </div>

        {/* Simulation info */}
        <div className="p-4 border-b border-white/10">
          <h2 className="text-sm font-bold text-white">{schema.title}</h2>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{schema.description}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {schema.tags.map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 text-[9px] rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">{tag}</span>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex-1 overflow-y-auto p-4">
          <ControlPanel controls={schema.controls} values={overrides} onChange={handleControl} onReset={handleReset} />
        </div>
      </aside>

      {/* ── Canvas ── */}
      <main className="flex-1 relative">
        <Canvas
          key={simKey}
          shadows
          camera={{
            position: [schema.environment.camera_position.x, schema.environment.camera_position.y, schema.environment.camera_position.z],
            fov: 50,
            near: 0.1,
            far: 200,
          }}
        >
          <Suspense fallback={<Loader />}>
            <PhysicsWorld schema={schema} controlOverrides={overrides} />
          </Suspense>
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        </Canvas>

        {/* HUD overlay */}
        <div className="absolute top-4 left-4 pointer-events-none">
          <span className="px-2 py-1 text-[10px] font-mono bg-black/60 rounded-md text-emerald-400 backdrop-blur-sm">
            Mode 1 · Rapier · {schema.objects.length} objects · {schema.links.length} links
          </span>
        </div>
      </main>
    </div>
  );
}
