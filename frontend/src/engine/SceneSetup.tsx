import { Environment, Grid, GizmoHelper, GizmoViewport, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import type { Environment as EnvConfig } from '../types/physics';

const BG_MAP: Record<string, string> = {
    lab: 'warehouse',
    space: 'night',
    grid: 'warehouse',
    black: 'night',
    white: 'dawn',
};

export function SceneSetup({ env, enableGlow = true }: { env: EnvConfig; enableGlow?: boolean }) {
    const isSpace = env.background === 'space' || env.background === 'black';

    return (
        <>
            {/* ── Dark background color ── */}
            <color attach="background" args={[isSpace ? '#030712' : '#0a0f1e']} />

            {/* ── Lighting — dim ambient + strong directional for neon contrast ── */}
            <ambientLight intensity={env.ambient_light * 0.3} color="#94a3b8" />
            <directionalLight
                position={[8, 12, 5]}
                intensity={0.8}
                castShadow
                shadow-mapSize={[2048, 2048]}
                color="#e2e8f0"
            />
            <pointLight position={[-6, 8, -4]} intensity={0.3} color="#38bdf8" />
            <pointLight position={[4, -2, 6]} intensity={0.15} color="#818cf8" />

            {/* ── Stars for space backgrounds ── */}
            {isSpace && (
                <Stars
                    radius={80}
                    depth={60}
                    count={3000}
                    factor={3}
                    saturation={0.3}
                    fade
                    speed={0.5}
                />
            )}

            {/* ── Environment map (subtle reflections) ── */}
            <Environment
                preset={BG_MAP[env.background] as never ?? 'warehouse'}
                background={false}
                environmentIntensity={0.15}
            />

            {/* ── Grid (subtle neon cyan lines) ── */}
            {env.show_grid && (
                <Grid
                    args={[40, 40]}
                    position={[0, -0.01, 0]}
                    cellSize={1}
                    sectionSize={5}
                    fadeDistance={25}
                    cellColor="#1e293b"
                    sectionColor="#334155"
                    cellThickness={0.6}
                    sectionThickness={1}
                    infiniteGrid
                />
            )}

            {/* ── Axes gizmo ── */}
            {env.show_axes && (
                <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
                    <GizmoViewport labelColor="white" axisHeadScale={1} />
                </GizmoHelper>
            )}

            {/* ── Fog (subtle depth) ── */}
            {env.fog_enabled && <fog attach="fog" args={['#030712', 15, 60]} />}

            {/* ── Post-processing: Bloom + Vignette for neon glow ── */}
            {enableGlow && (
                <EffectComposer>
                    <Bloom
                        intensity={1.2}
                        luminanceThreshold={0.2}
                        luminanceSmoothing={0.9}
                        mipmapBlur
                        radius={0.8}
                    />
                    <Vignette eskil={false} offset={0.15} darkness={0.6} />
                </EffectComposer>
            )}
        </>
    );
}
