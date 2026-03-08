import { Environment, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import type { Environment as EnvConfig } from '../types/physics';

const BG_MAP: Record<string, string> = {
    lab: 'warehouse',
    space: 'night',
    grid: 'warehouse',
    black: 'night',
    white: 'dawn',
};

export function SceneSetup({ env }: { env: EnvConfig }) {
    return (
        <>
            {/* Lighting */}
            <ambientLight intensity={env.ambient_light} />
            <directionalLight position={[8, 12, 5]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} />
            <pointLight position={[-6, 8, -4]} intensity={0.4} />

            {/* Sky / Environment map */}
            <Environment preset={BG_MAP[env.background] as never ?? 'warehouse'} background={env.background !== 'black'} />

            {/* Grid */}
            {env.show_grid && <Grid args={[40, 40]} position={[0, -0.01, 0]} cellSize={1} sectionSize={5} fadeDistance={30} cellColor="#444" sectionColor="#888" />}

            {/* Axes gizmo */}
            {env.show_axes && (
                <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
                    <GizmoViewport labelColor="white" axisHeadScale={1} />
                </GizmoHelper>
            )}

            {/* Fog */}
            {env.fog_enabled && <fog attach="fog" args={['#1a1a2e', 10, 50]} />}
        </>
    );
}
