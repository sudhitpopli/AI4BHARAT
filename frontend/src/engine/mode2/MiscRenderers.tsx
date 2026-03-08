import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type {
    RelativisticParticle, SpacetimeDiagram,
    GasParticleSystem, HeatDiffusion,
    LightRay, OpticalMedium, Mode2Object, PhysicsLink,
} from '../../types/physics_mode2';

/* ═══ RELATIVISTIC PARTICLE ════════════════════════════════════ */

export function RelativisticParticleRenderer({ obj }: { obj: RelativisticParticle }) {
    const meshRef = useRef<THREE.Mesh>(null!);
    const gamma = 1 / Math.sqrt(1 - obj.velocity_fraction ** 2);
    const contractedScale = obj.show_length_contraction ? 1 / gamma : 1;

    useFrame((_, dt) => {
        if (!meshRef.current) return;
        const speed = obj.velocity_fraction * 5; // scaled for scene
        meshRef.current.position.x += obj.direction.x * speed * dt;
        meshRef.current.position.y += obj.direction.y * speed * dt;
        meshRef.current.position.z += obj.direction.z * speed * dt;
        // Wrap around
        if (meshRef.current.position.x > 15) meshRef.current.position.x = -15;
        if (meshRef.current.position.x < -15) meshRef.current.position.x = 15;
    });

    return (
        <group>
            <mesh ref={meshRef} position={[obj.position.x, obj.position.y, obj.position.z]} scale={[contractedScale, 1, 1]}>
                <sphereGeometry args={[0.3, 24, 24]} />
                <meshStandardMaterial color={obj.color} emissive={obj.color} emissiveIntensity={0.4 + obj.velocity_fraction * 0.6} />
            </mesh>
            {/* Info overlay */}
            {obj.show_time_dilation && (
                <mesh position={[obj.position.x, obj.position.y + 1, obj.position.z]}>
                    <planeGeometry args={[2, 0.5]} />
                    <meshBasicMaterial color="#1a1a2e" transparent opacity={0.7} />
                </mesh>
            )}
        </group>
    );
}

/* ═══ SPACETIME DIAGRAM ════════════════════════════════════════ */

export function SpacetimeDiagramRenderer({ obj }: { obj: SpacetimeDiagram }) {
    const axesColor = '#f8fafc';
    return (
        <group position={[obj.position.x, obj.position.y, obj.position.z]}>
            {/* Axes */}
            <line><bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array([-5, 0, 0, 5, 0, 0]), 3]} count={2} /></bufferGeometry><lineBasicMaterial color={axesColor} /></line>
            <line><bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array([0, -5, 0, 0, 5, 0]), 3]} count={2} /></bufferGeometry><lineBasicMaterial color={axesColor} /></line>
            {/* Light cone */}
            {obj.show_light_cone && <>
                <line><bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array([-5, -5, 0, 5, 5, 0]), 3]} count={2} /></bufferGeometry><lineBasicMaterial color="#eab308" transparent opacity={0.5} /></line>
                <line><bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array([5, -5, 0, -5, 5, 0]), 3]} count={2} /></bufferGeometry><lineBasicMaterial color="#eab308" transparent opacity={0.5} /></line>
            </>}
            {/* Worldlines */}
            {obj.worldlines.map((wl, i) => {
                const pts = new Float32Array([-5 * wl.velocity_fraction, -5, 0, 5 * wl.velocity_fraction, 5, 0]);
                return <line key={i}><bufferGeometry><bufferAttribute attach="attributes-position" args={[pts, 3]} count={2} /></bufferGeometry><lineBasicMaterial color={wl.color} linewidth={2} /></line>;
            })}
            {/* Events */}
            {obj.events.map((ev, i) => (
                <mesh key={i} position={[ev.x, ev.t, 0]}>
                    <sphereGeometry args={[0.1]} /><meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.6} />
                </mesh>
            ))}
        </group>
    );
}

/* ═══ GAS PARTICLE SYSTEM (Maxwell-Boltzmann) ══════════════════ */

export function GasParticleRenderer({ obj }: { obj: GasParticleSystem }) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const N = obj.num_particles;
    const box = obj.box_dimensions;
    const kB = 1.38e-23;

    // Initialize particle positions and velocities
    const particles = useRef<{ pos: THREE.Vector3; vel: THREE.Vector3 }[]>([]);
    if (particles.current.length === 0) {
        const vrms = Math.sqrt(3 * kB * obj.temperature_K / obj.particle_mass) * 1e-12; // scaled
        for (let i = 0; i < N; i++) {
            particles.current.push({
                pos: new THREE.Vector3((Math.random() - 0.5) * box.x, (Math.random() - 0.5) * box.y, (Math.random() - 0.5) * box.z),
                vel: new THREE.Vector3((Math.random() - 0.5) * vrms, (Math.random() - 0.5) * vrms, (Math.random() - 0.5) * vrms),
            });
        }
    }

    const hot = useMemo(() => new THREE.Color(obj.color_hot), [obj.color_hot]);
    const cold = useMemo(() => new THREE.Color(obj.color_cold), [obj.color_cold]);

    useFrame((_, dt) => {
        if (!meshRef.current) return;
        const clampDt = Math.min(dt, 0.02);
        const hx = box.x / 2, hy = box.y / 2, hz = box.z / 2;

        for (let i = 0; i < N; i++) {
            const p = particles.current[i];
            p.pos.add(p.vel.clone().multiplyScalar(clampDt * 60));
            // Wall bounces
            if (p.pos.x > hx || p.pos.x < -hx) { p.vel.x *= -1; p.pos.x = Math.max(-hx, Math.min(hx, p.pos.x)); }
            if (p.pos.y > hy || p.pos.y < -hy) { p.vel.y *= -1; p.pos.y = Math.max(-hy, Math.min(hy, p.pos.y)); }
            if (p.pos.z > hz || p.pos.z < -hz) { p.vel.z *= -1; p.pos.z = Math.max(-hz, Math.min(hz, p.pos.z)); }

            dummy.position.copy(p.pos).add(new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z));
            dummy.scale.setScalar(1);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);

            if (obj.show_temperature_color) {
                const speed = p.vel.length();
                const t = Math.min(speed / 2, 1);
                meshRef.current.setColorAt(i, new THREE.Color().lerpColors(cold, hot, t));
            }
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    });

    return (
        <group>
            {/* Box */}
            <mesh position={[obj.position.x, obj.position.y, obj.position.z]}>
                <boxGeometry args={[box.x, box.y, box.z]} />
                <meshStandardMaterial color="#f8fafc" transparent opacity={0.05} wireframe />
            </mesh>
            <instancedMesh ref={meshRef} args={[undefined, undefined, N]} frustumCulled={false}>
                <sphereGeometry args={[0.05, 6, 6]} />
                <meshStandardMaterial color={obj.color_hot} toneMapped={false} />
            </instancedMesh>
        </group>
    );
}

/* ═══ HEAT DIFFUSION (2D grid) ═════════════════════════════════ */

export function HeatDiffusionRenderer({ obj }: { obj: HeatDiffusion }) {
    const W = obj.grid_width, H = obj.grid_height;
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const grid = useRef<Float32Array>(new Float32Array(W * H).fill(obj.initial_temp_K));
    const gridNext = useRef(new Float32Array(W * H));
    const hot = useMemo(() => new THREE.Color('#ef4444'), []);
    const cold = useMemo(() => new THREE.Color('#3b82f6'), []);

    // Set boundary conditions
    useRef(() => { for (let j = 0; j < H; j++) { grid.current[j * W] = obj.hot_source_temp; grid.current[j * W + W - 1] = obj.cold_sink_temp; } }).current?.();

    useFrame(() => {
        if (!meshRef.current) return;
        const a = obj.thermal_diffusivity * 500; // scaled
        const g = grid.current, gn = gridNext.current;
        // Finite difference step
        for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
            const idx = j * W + i;
            gn[idx] = g[idx] + a * (g[idx + 1] + g[idx - 1] + g[(j + 1) * W + i] + g[(j - 1) * W + i] - 4 * g[idx]);
        }
        // Boundaries
        for (let j = 0; j < H; j++) { gn[j * W] = obj.hot_source_temp; gn[j * W + W - 1] = obj.cold_sink_temp; }
        grid.current.set(gn);

        // Update visuals
        const tRange = obj.hot_source_temp - obj.cold_sink_temp || 1;
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
            const idx = j * W + i;
            dummy.position.set(i * 0.3 + obj.position.x - W * 0.15, j * 0.3 + obj.position.y - H * 0.15, obj.position.z);
            dummy.scale.setScalar(1);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(idx, dummy.matrix);
            const t = Math.max(0, Math.min(1, (g[idx] - obj.cold_sink_temp) / tRange));
            meshRef.current.setColorAt(idx, new THREE.Color().lerpColors(cold, hot, t));
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, W * H]} frustumCulled={false}>
            <boxGeometry args={[0.28, 0.28, 0.1]} />
            <meshStandardMaterial toneMapped={false} />
        </instancedMesh>
    );
}

/* ═══ LIGHT RAY (Snell's law) ══════════════════════════════════ */

export function LightRayRenderer({ obj, allObjects, physicsLinks }: { obj: LightRay; allObjects: Mode2Object[]; physicsLinks: PhysicsLink[] }) {
    const rayPts = useMemo(() => {
        const pts: number[] = [obj.origin.x, obj.origin.y, obj.origin.z];
        let dir = new THREE.Vector3(obj.direction.x, obj.direction.y, obj.direction.z).normalize();
        let pos = new THREE.Vector3(obj.origin.x, obj.origin.y, obj.origin.z);
        // Fire ray forward, check refraction boundaries
        const refLinks = physicsLinks.filter(l => l.type === 'refraction_boundary');
        for (let bounce = 0; bounce < obj.max_bounces; bounce++) {
            const ext = pos.clone().add(dir.clone().multiplyScalar(8));
            pts.push(ext.x, ext.y, ext.z);
            pos = ext;
            // Simple refraction at boundaries (simplified for hackathon)
            for (const rl of refLinks) {
                const mA = allObjects.find(o => o.id === rl.medium_a_id) as OpticalMedium | undefined;
                const mB = allObjects.find(o => o.id === rl.medium_b_id) as OpticalMedium | undefined;
                if (mA && mB) {
                    const n1 = mA.refractive_index, n2 = mB.refractive_index;
                    const normal = new THREE.Vector3(rl.boundary_normal.x, rl.boundary_normal.y, rl.boundary_normal.z);
                    const cosI = -dir.dot(normal);
                    const sinT2 = (n1 / n2) ** 2 * (1 - cosI ** 2);
                    if (sinT2 <= 1) {
                        dir = dir.clone().multiplyScalar(n1 / n2).add(normal.clone().multiplyScalar(n1 / n2 * cosI - Math.sqrt(1 - sinT2)));
                        dir.normalize();
                    }
                }
            }
        }
        return new Float32Array(pts);
    }, [obj, physicsLinks, allObjects]);

    return (
        <line>
            <bufferGeometry><bufferAttribute attach="attributes-position" args={[rayPts, 3]} count={rayPts.length / 3} /></bufferGeometry>
            <lineBasicMaterial color={obj.color} linewidth={2} />
        </line>
    );
}

/* ═══ OPTICAL MEDIUM ═══════════════════════════════════════════ */

export function OpticalMediumRenderer({ obj }: { obj: OpticalMedium }) {
    const p: [number, number, number] = [obj.position.x, obj.position.y, obj.position.z];
    return (
        <mesh position={p}>
            {obj.shape === 'slab' && <boxGeometry args={[obj.dimensions.x, obj.dimensions.y, obj.dimensions.z]} />}
            {obj.shape === 'sphere' && <sphereGeometry args={[obj.dimensions.x / 2, 32, 32]} />}
            {obj.shape === 'prism' && <coneGeometry args={[obj.dimensions.x / 2, obj.dimensions.y, 3]} />}
            {(obj.shape === 'lens_convex' || obj.shape === 'lens_concave') && <sphereGeometry args={[obj.dimensions.x / 2, 24, 24]} />}
            <meshStandardMaterial color={obj.color} transparent opacity={obj.opacity} side={THREE.DoubleSide} />
        </mesh>
    );
}
