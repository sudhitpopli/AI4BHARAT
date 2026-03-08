import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitBody, Wave, SpringMass, Projectile, Mode2Object, PhysicsLink } from '../../types/physics_mode2';

const D2R = Math.PI / 180;

/* ═══ ORBIT BODY ═══════════════════════════════════════════════ */

export function OrbitRenderer({ obj }: { obj: OrbitBody; allObjects: Mode2Object[]; physicsLinks: PhysicsLink[] }) {
    const meshRef = useRef<THREE.Mesh>(null!);
    const trailRef = useRef<THREE.Line>(null!);
    const angleRef = useRef(obj.initial_angle_deg * D2R);
    const trail = useRef<THREE.Vector3[]>([]);

    // Static orbit path
    const orbitPts = useMemo(() => {
        if (obj.is_central_body || obj.orbit_radius <= 0) return null;
        const pts: THREE.Vector3[] = [];
        const a = obj.orbit_radius, e = obj.eccentricity;
        for (let i = 0; i <= 128; i++) {
            const th = (i / 128) * Math.PI * 2;
            const r = a * (1 - e * e) / (1 + e * Math.cos(th));
            pts.push(new THREE.Vector3(r * Math.cos(th), 0, r * Math.sin(th)));
        }
        return new Float32Array(pts.flatMap(p => [p.x, p.y, p.z]));
    }, [obj.orbit_radius, obj.eccentricity, obj.is_central_body]);

    useFrame((_, dt) => {
        if (!meshRef.current || obj.is_central_body) return;
        angleRef.current += obj.orbital_speed * 0.8 * dt;
        const a = obj.orbit_radius, e = obj.eccentricity, th = angleRef.current;
        const r = a * (1 - e * e) / (1 + e * Math.cos(th));
        const x = r * Math.cos(th), z = r * Math.sin(th);
        meshRef.current.position.set(x, obj.position.y, z);
        meshRef.current.rotation.y += dt * 0.5;

        if (obj.trail_length > 0 && trailRef.current) {
            trail.current.push(new THREE.Vector3(x, obj.position.y, z));
            if (trail.current.length > obj.trail_length) trail.current.shift();
            trailRef.current.geometry.setFromPoints(trail.current);
        }
    });

    return (
        <group>
            <mesh ref={meshRef} position={[obj.position.x, obj.position.y, obj.position.z]} castShadow>
                <sphereGeometry args={[obj.radius, 32, 32]} />
                <meshStandardMaterial color={obj.color} emissive={obj.is_central_body ? obj.color : '#000'} emissiveIntensity={obj.is_central_body ? 1.2 : 0} metalness={0.3} roughness={0.5} />
            </mesh>
            {obj.atmosphere_color && (
                <mesh position={[obj.position.x, obj.position.y, obj.position.z]}>
                    <sphereGeometry args={[obj.radius * 1.15, 32, 32]} />
                    <meshStandardMaterial color={obj.atmosphere_color} transparent opacity={0.15} side={THREE.BackSide} />
                </mesh>
            )}
            {obj.has_ring && (
                <mesh position={[obj.position.x, obj.position.y, obj.position.z]} rotation={[Math.PI / 2 + obj.axial_tilt_deg * D2R, 0, 0]}>
                    <ringGeometry args={[obj.ring_inner_radius, obj.ring_outer_radius, 64]} />
                    <meshStandardMaterial color={obj.color} transparent opacity={0.45} side={THREE.DoubleSide} />
                </mesh>
            )}
            {orbitPts && (
                <line><bufferGeometry><bufferAttribute attach="attributes-position" args={[orbitPts, 3]} count={orbitPts.length / 3} /></bufferGeometry><lineBasicMaterial color={obj.color} transparent opacity={0.2} /></line>
            )}
            {obj.trail_length > 0 && <line ref={trailRef as never}><bufferGeometry /><lineBasicMaterial color={obj.color} transparent opacity={0.5} /></line>}
            {obj.is_central_body && <pointLight position={[obj.position.x, obj.position.y, obj.position.z]} intensity={2} distance={50} color={obj.color} />}
        </group>
    );
}

/* ═══ WAVE ══════════════════════════════════════════════════════ */

export function WaveRenderer({ obj }: { obj: Wave; physicsLinks: PhysicsLink[]; allObjects: Mode2Object[] }) {
    const lineRef = useRef<THREE.Line>(null!);
    const lineRef2 = useRef<THREE.Line>(null!);
    const resultRef = useRef<THREE.Line>(null!);
    const N = obj.num_points;
    const pts = useRef(Array.from({ length: N }, () => new THREE.Vector3()));
    const pts2 = useRef(Array.from({ length: N }, () => new THREE.Vector3()));
    const ptsR = useRef(Array.from({ length: N }, () => new THREE.Vector3()));

    useFrame((state) => {
        if (!lineRef.current) return;
        const t = state.clock.getElapsedTime();
        const k = (2 * Math.PI) / obj.wavelength, omega = 2 * Math.PI * obj.frequency, phi = obj.phase_offset_deg * D2R;
        const xLen = obj.wavelength * 3;
        for (let i = 0; i < N; i++) {
            const x = (i / (N - 1)) * xLen - xLen / 2;
            const y = obj.wave_type === 'standing'
                ? 2 * obj.amplitude * Math.cos(omega * t) * Math.sin(k * x + phi)
                : obj.amplitude * Math.sin(omega * t - k * x + phi) * Math.exp(-obj.damping * t);
            pts.current[i].set(x + obj.position.x, y + obj.position.y, obj.position.z);
        }
        lineRef.current.geometry.setFromPoints(pts.current);

        if (obj.second_wave.enabled && lineRef2.current && resultRef.current) {
            const o2 = 2 * Math.PI * obj.second_wave.frequency, phi2 = obj.second_wave.phase_offset_deg * D2R;
            for (let i = 0; i < N; i++) {
                const x = (i / (N - 1)) * xLen - xLen / 2;
                const y2 = obj.second_wave.amplitude * Math.sin(o2 * t - k * x + phi2);
                pts2.current[i].set(x + obj.position.x, y2 + obj.position.y - 3, obj.position.z);
                ptsR.current[i].set(x + obj.position.x, (pts.current[i].y - obj.position.y) + y2 + obj.position.y + 3, obj.position.z);
            }
            lineRef2.current.geometry.setFromPoints(pts2.current);
            resultRef.current.geometry.setFromPoints(ptsR.current);
        }
    });

    return (
        <group>
            <line ref={lineRef as never}><bufferGeometry /><lineBasicMaterial color={obj.color} linewidth={2} /></line>
            {obj.second_wave.enabled && <>
                <line ref={lineRef2 as never}><bufferGeometry /><lineBasicMaterial color={obj.second_wave.color} linewidth={2} /></line>
                <line ref={resultRef as never}><bufferGeometry /><lineBasicMaterial color="#fbbf24" linewidth={3} /></line>
            </>}
        </group>
    );
}

/* ═══ SPRING-MASS ═══════════════════════════════════════════════ */

export function SpringMassRenderer({ obj }: { obj: SpringMass }) {
    const massRef = useRef<THREE.Mesh>(null!);
    const springRef = useRef<THREE.Line>(null!);
    const isV = obj.orientation === 'vertical';
    const w0 = Math.sqrt(obj.spring_constant / obj.mass);
    const gam = obj.damping / obj.mass;
    const SEGS = 82;
    const coilPts = useRef(Array.from({ length: SEGS }, () => new THREE.Vector3()));

    useFrame((state) => {
        if (!massRef.current) return;
        const t = state.clock.getElapsedTime();
        const wd = Math.sqrt(Math.max(w0 * w0 - gam * gam / 4, 0.01));
        let d = obj.initial_extension * Math.cos(wd * t) * Math.exp(-gam * t / 2);
        if (obj.driving_frequency > 0) {
            const wf = 2 * Math.PI * obj.driving_frequency;
            d += (obj.driving_amplitude / obj.mass) / Math.sqrt((w0 * w0 - wf * wf) ** 2 + (gam * wf) ** 2) * Math.sin(wf * t);
        }
        const a = obj.anchor_position;
        const mx = isV ? a.x : a.x + obj.natural_length + d;
        const my = isV ? a.y - obj.natural_length - d : a.y;
        massRef.current.position.set(mx, my, a.z);

        if (springRef.current) {
            const dir = new THREE.Vector3(mx - a.x, my - a.y, 0);
            const len = dir.length(); dir.normalize();
            const perp = new THREE.Vector3(-dir.y, dir.x, 0);
            for (let i = 0; i < SEGS; i++) {
                const f = i / (SEGS - 1), al = f * len;
                const zig = (i === 0 || i === SEGS - 1) ? 0 : Math.sin(f * 20 * Math.PI * 2) * 0.12;
                coilPts.current[i].set(a.x + dir.x * al + perp.x * zig, a.y + dir.y * al + perp.y * zig, a.z);
            }
            springRef.current.geometry.setFromPoints(coilPts.current);
        }
    });

    return (
        <group>
            <mesh position={[obj.anchor_position.x, obj.anchor_position.y, obj.anchor_position.z]}>
                <sphereGeometry args={[0.1]} /><meshStandardMaterial color="#f8fafc" metalness={0.5} />
            </mesh>
            <line ref={springRef as never}><bufferGeometry /><lineBasicMaterial color={obj.color_spring} /></line>
            <mesh ref={massRef} castShadow>
                <sphereGeometry args={[0.25 + obj.mass * 0.04]} /><meshStandardMaterial color={obj.color_mass} metalness={0.4} roughness={0.4} />
            </mesh>
        </group>
    );
}

/* ═══ PROJECTILE ════════════════════════════════════════════════ */

export function ProjectileRenderer({ obj }: { obj: Projectile }) {
    const meshRef = useRef<THREE.Mesh>(null!);
    const timeRef = useRef(0);
    const vx = obj.launch_speed * Math.cos(obj.launch_angle_deg * D2R);
    const vy = obj.launch_speed * Math.sin(obj.launch_angle_deg * D2R);
    const g = Math.abs(obj.gravity_y);
    const lp = obj.launch_position;

    const trajPts = useMemo(() => {
        const pts: number[] = [];
        const tMax = (2 * vy) / g + 0.5;
        for (let i = 0; i < 200; i++) {
            const t = (i / 199) * tMax;
            const y = vy * t - 0.5 * g * t * t + lp.y;
            if (y < -0.1 && t > 0.1) break;
            pts.push(vx * t + lp.x, Math.max(y, 0), lp.z);
        }
        return new Float32Array(pts);
    }, [vx, vy, g, lp]);

    useFrame((_, dt) => {
        if (!meshRef.current) return;
        timeRef.current += dt;
        const t = timeRef.current;
        let y = vy * t - 0.5 * g * t * t + lp.y;
        if (y < 0) { timeRef.current = 0; y = lp.y; }
        meshRef.current.position.set(vx * t + lp.x, y, lp.z);
    });

    return (
        <group>
            <mesh ref={meshRef} position={[lp.x, lp.y, lp.z]} castShadow>
                <sphereGeometry args={[obj.radius, 16, 16]} /><meshStandardMaterial color={obj.color} metalness={0.3} roughness={0.4} />
            </mesh>
            {obj.show_trajectory && (
                <line><bufferGeometry><bufferAttribute attach="attributes-position" args={[trajPts, 3]} count={trajPts.length / 3} /></bufferGeometry><lineBasicMaterial color={obj.color} transparent opacity={0.3} /></line>
            )}
            <mesh position={[0, -0.05, 0]} receiveShadow><boxGeometry args={[40, 0.1, 10]} /><meshStandardMaterial color="#f8fafc" transparent opacity={0.12} /></mesh>
        </group>
    );
}
