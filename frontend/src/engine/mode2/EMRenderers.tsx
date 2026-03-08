import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ChargedParticle, ElectricField, MagneticField, FieldLine, EMWave, Mode2Object, PhysicsLink, EMForceLink } from '../../types/physics_mode2';



/* ═══ CHARGED PARTICLE ══════════════════════════════════════════
   Now with:
   1) Harmonic restoring force F = -k·displacement toward origin
      so the particle oscillates instead of flying away.
   2) Position clamping within a bounding sphere.
   3) Only applies external field forces from *different* objects
      (uniform/parallel_plate E-fields and B-fields), NOT from
      point-charge fields centered at the same position (self-force).
   4) Velocity-Verlet for stability.                              */

const BOUND_RADIUS = 15;
const RESTORING_K = 2.0; // spring constant for harmonic trap

export function ChargedParticleRenderer({ obj, allObjects, physicsLinks }: { obj: ChargedParticle; allObjects: Mode2Object[]; physicsLinks: PhysicsLink[] }) {
    const meshRef = useRef<THREE.Mesh>(null!);
    const trailRef = useRef<THREE.Line>(null!);
    const origin = useRef(new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z));
    const vel = useRef(new THREE.Vector3(obj.initial_velocity.x, obj.initial_velocity.y, obj.initial_velocity.z));
    const trail = useRef<THREE.Vector3[]>([]);

    // Find linked EXTERNAL fields (exclude self-positioned point charges)
    const linked = useMemo(() => {
        const ids = (physicsLinks.filter(l => l.type === 'em_force') as EMForceLink[])
            .filter(l => l.particle_id === obj.id).map(l => l.field_id);
        return allObjects.filter(o => {
            if (!ids.includes(o.id)) return false;
            // Skip point-charge E-fields at our own position (self-interaction)
            if (o.type === 'electric_field' && o.field_type === 'point_charge') {
                const dx = o.position.x - obj.position.x;
                const dy = o.position.y - obj.position.y;
                const dz = o.position.z - obj.position.z;
                if (dx * dx + dy * dy + dz * dz < 0.01) return false;
            }
            return true;
        });
    }, [obj, physicsLinks, allObjects]);

    useFrame((_, dt) => {
        if (!meshRef.current || obj.is_fixed) return;
        const pos = meshRef.current.position;
        const q = obj.charge, m = obj.mass;
        const clampDt = Math.min(dt, 0.016);

        // 1) Harmonic restoring force toward origin (keeps particle bounded)
        const disp = new THREE.Vector3().subVectors(pos, origin.current);
        const force = disp.clone().multiplyScalar(-RESTORING_K * m);

        // 2) External field forces
        for (const f of linked) {
            if (f.type === 'electric_field' && (f.field_type === 'uniform' || f.field_type === 'parallel_plate')) {
                const E = new THREE.Vector3(f.field_direction.x, f.field_direction.y, f.field_direction.z).multiplyScalar(f.field_strength);
                force.add(E.multiplyScalar(q));
            } else if (f.type === 'magnetic_field') {
                const B = new THREE.Vector3(f.field_direction.x, f.field_direction.y, f.field_direction.z).multiplyScalar(f.field_strength);
                force.add(new THREE.Vector3().crossVectors(vel.current, B).multiplyScalar(q));
            }
        }

        // 3) Velocity-Verlet integration
        const acc = force.divideScalar(m);
        vel.current.add(acc.clone().multiplyScalar(clampDt));
        // Light damping to keep energy stable
        vel.current.multiplyScalar(0.999);
        pos.add(vel.current.clone().multiplyScalar(clampDt));

        // 4) Hard clamp
        if (pos.length() > BOUND_RADIUS) {
            pos.normalize().multiplyScalar(BOUND_RADIUS);
            vel.current.multiplyScalar(-0.5); // bounce back
        }

        // 5) Trail
        if (obj.trail_length > 0 && trailRef.current) {
            trail.current.push(pos.clone());
            if (trail.current.length > obj.trail_length) trail.current.shift();
            trailRef.current.geometry.setFromPoints(trail.current);
        }
    });

    return (
        <group>
            <mesh ref={meshRef} position={[obj.position.x, obj.position.y, obj.position.z]} castShadow>
                <sphereGeometry args={[obj.radius, 24, 24]} />
                <meshStandardMaterial color={obj.color} emissive={obj.color} emissiveIntensity={0.5} metalness={0.5} roughness={0.3} />
            </mesh>
            {obj.trail_length > 0 && (
                <line ref={trailRef as never}><bufferGeometry /><lineBasicMaterial color={obj.color} transparent opacity={0.5} /></line>
            )}
        </group>
    );
}

/* ═══ ELECTRIC FIELD (field lines from point charge / uniform) ═ */

export function ElectricFieldRenderer({ obj, allObjects = [] }: { obj: ElectricField; allObjects?: Mode2Object[] }) {
    const linesData = useMemo(() => {
        const lines: Float32Array[] = [];
        const N = obj.num_field_lines;

        if (obj.field_type === 'dipole') {
            // Find point charges in the scene
            const charges = allObjects
                .filter(o => o.type === 'charged_particle')
                .map(o => ({
                    p: new THREE.Vector3(o.position.x, o.position.y, o.position.z),
                    q: (o as ChargedParticle).charge
                }));

            if (charges.length === 0) return lines;

            // Trace lines starting from each positive charge
            const posCharges = charges.filter(c => c.q > 0);
            for (const src of posCharges) {
                for (let i = 0; i < N; i++) {
                    const phi = (i / N) * Math.PI * 2;
                    
                    let curr = src.p.clone().add(new THREE.Vector3(Math.cos(phi) * 0.4, Math.sin(phi) * 0.4, 0));
                    const pts: number[] = [curr.x, curr.y, curr.z];

                    for (let step = 0; step < 250; step++) {
                        const E = new THREE.Vector3(0, 0, 0);
                        let targetCharge: THREE.Vector3 | null = null;
                        
                        for (const c of charges) {
                            const rVec = new THREE.Vector3().subVectors(curr, c.p);
                            const dist = rVec.length();
                            
                            // If we enter the radius of a negative charge, terminate there
                            if (dist < 0.45 && c.q < 0) {
                                targetCharge = c.p;
                                break;
                            }
                            
                            // Superposition of point charge fields: E = k * q * r_hat / r^2
                            if (dist > 0.01) {
                                E.add(rVec.normalize().multiplyScalar(c.q / (dist * dist)));
                            }
                        }

                        if (targetCharge) {
                            pts.push(targetCharge.x, targetCharge.y, targetCharge.z);
                            break;
                        }

                        if (E.length() < 0.0001) break;
                        
                        curr.add(E.normalize().multiplyScalar(0.1));
                        pts.push(curr.x, curr.y, curr.z);

                        // Bound check so lines don't fly off forever
                        if (curr.length() > 20) break;
                    }
                    lines.push(new Float32Array(pts));
                }
            }
        } else if (obj.field_type === 'point_charge') {
            for (let i = 0; i < N; i++) {
                const theta = (i / N) * Math.PI * 2;
                const pts: number[] = [];
                for (let j = 0; j < 40; j++) {
                    const r = 0.3 + j * 0.25;
                    pts.push(obj.position.x + r * Math.cos(theta), obj.position.y + r * Math.sin(theta), obj.position.z);
                }
                lines.push(new Float32Array(pts));
            }
        } else {
            // Uniform field — parallel lines
            const dir = new THREE.Vector3(obj.field_direction.x, obj.field_direction.y, obj.field_direction.z).normalize();
            for (let i = 0; i < N; i++) {
                const offset = (i - N / 2) * 0.8;
                const pts: number[] = [];
                for (let j = 0; j < 20; j++) {
                    const t = (j - 10) * 0.5;
                    pts.push(obj.position.x + dir.x * t, obj.position.y + dir.y * t + offset, obj.position.z + dir.z * t);
                }
                lines.push(new Float32Array(pts));
            }
        }
        return lines;
    }, [obj, allObjects]);

    return (
        <group>
            {obj.field_type === 'point_charge' && (
                <mesh position={[obj.position.x, obj.position.y, obj.position.z]}>
                    <sphereGeometry args={[0.2, 16, 16]} />
                    <meshStandardMaterial color={obj.color} emissive={obj.color} emissiveIntensity={0.6} />
                </mesh>
            )}
            {obj.show_field_lines && linesData.map((pts, i) => (
                <line key={i}>
                    <bufferGeometry><bufferAttribute attach="attributes-position" args={[pts, 3]} count={pts.length / 3} /></bufferGeometry>
                    <lineBasicMaterial color={obj.field_line_color} transparent opacity={0.6} />
                </line>
            ))}
            {obj.field_type === 'parallel_plate' && <>
                <mesh position={[obj.position.x - obj.plate_separation / 2, obj.position.y, obj.position.z]}>
                    <boxGeometry args={[0.05, 3, 2]} /><meshStandardMaterial color="#ef4444" metalness={0.6} />
                </mesh>
                <mesh position={[obj.position.x + obj.plate_separation / 2, obj.position.y, obj.position.z]}>
                    <boxGeometry args={[0.05, 3, 2]} /><meshStandardMaterial color="#3b82f6" metalness={0.6} />
                </mesh>
            </>}
        </group>
    );
}

/* ═══ MAGNETIC FIELD ════════════════════════════════════════════ */

export function MagneticFieldRenderer({ obj }: { obj: MagneticField }) {
    const linesData = useMemo(() => {
        const lines: Float32Array[] = [];
        if (!obj.show_field_lines) return lines;
        const N = 8;
        if (obj.field_type === 'straight_wire') {
            for (let i = 0; i < N; i++) {
                const th0 = (i / N) * Math.PI * 2;
                const pts: number[] = [];
                for (let j = 0; j <= 64; j++) {
                    const th = th0 + (j / 64) * Math.PI * 2;
                    const r = 1.5;
                    pts.push(obj.position.x + r * Math.cos(th), obj.position.y + (j / 64 - 0.5) * 0.1, obj.position.z + r * Math.sin(th));
                }
                lines.push(new Float32Array(pts));
            }
        } else {
            // Uniform field lines
            for (let i = 0; i < N; i++) {
                const off = (i - N / 2) * 0.7;
                const pts: number[] = [];
                for (let j = 0; j < 30; j++) { const t = (j - 15) * 0.4; pts.push(obj.position.x + off, obj.position.y + t, obj.position.z); }
                lines.push(new Float32Array(pts));
            }
        }
        return lines;
    }, [obj]);

    return (
        <group>
            {obj.field_type === 'straight_wire' && (
                <mesh position={[obj.position.x, obj.position.y, obj.position.z]}>
                    <cylinderGeometry args={[0.05, 0.05, obj.wire_length, 16]} /><meshStandardMaterial color={obj.color} metalness={0.7} />
                </mesh>
            )}
            {obj.field_type === 'solenoid' && (
                <mesh position={[obj.position.x, obj.position.y, obj.position.z]}>
                    <torusGeometry args={[obj.coil_radius, 0.03, 8, obj.turns * 4]} /><meshStandardMaterial color={obj.color} metalness={0.5} wireframe />
                </mesh>
            )}
            {linesData.map((pts, i) => (
                <line key={i}><bufferGeometry><bufferAttribute attach="attributes-position" args={[pts, 3]} count={pts.length / 3} /></bufferGeometry><lineBasicMaterial color={obj.color} transparent opacity={0.4} /></line>
            ))}
        </group>
    );
}

/* ═══ FIELD LINE ════════════════════════════════════════════════ */

export function FieldLineRenderer({ obj }: { obj: FieldLine }) {
    const linesData = useMemo(() => {
        const lines: Float32Array[] = [];
        for (let i = 0; i < obj.num_lines; i++) {
            const th = (i / obj.num_lines) * Math.PI * 2;
            const pts: number[] = [];
            for (let j = 0; j < 30; j++) {
                const r = 0.2 + (j / 29) * obj.line_length;
                pts.push(obj.position.x + r * Math.cos(th), obj.position.y + r * Math.sin(th), obj.position.z);
            }
            lines.push(new Float32Array(pts));
        }
        return lines;
    }, [obj]);

    return (
        <group>
            <mesh position={[obj.position.x, obj.position.y, obj.position.z]}>
                <sphereGeometry args={[0.15]} /><meshStandardMaterial color={obj.color} emissive={obj.color} emissiveIntensity={0.5} />
            </mesh>
            {linesData.map((pts, i) => (
                <line key={i}><bufferGeometry><bufferAttribute attach="attributes-position" args={[pts, 3]} count={pts.length / 3} /></bufferGeometry><lineBasicMaterial color={obj.color} transparent opacity={0.5} /></line>
            ))}
        </group>
    );
}

/* ═══ EM WAVE (coupled E and B) ═════════════════════════════════ */

export function EMWaveRenderer({ obj }: { obj: EMWave }) {
    const eRef = useRef<THREE.Line>(null!);
    const bRef = useRef<THREE.Line>(null!);
    const N = 120;
    const ePts = useRef(Array.from({ length: N }, () => new THREE.Vector3()));
    const bPts = useRef(Array.from({ length: N }, () => new THREE.Vector3()));

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        const omega = 2 * Math.PI * obj.frequency * 0.3; // slow down for visibility
        const k = (2 * Math.PI * obj.num_cycles) / 10;
        const axisIdx = obj.propagation_axis === 'x' ? 0 : obj.propagation_axis === 'y' ? 1 : 2;

        for (let i = 0; i < N; i++) {
            const z = (i / (N - 1)) * 10 - 5;
            const eVal = obj.amplitude_e * Math.sin(k * z - omega * t);
            const bVal = (obj.amplitude_b || obj.amplitude_e * 0.5) * Math.sin(k * z - omega * t);
            const base = [obj.position.x, obj.position.y, obj.position.z];
            base[axisIdx] = z + obj.position[obj.propagation_axis];

            if (obj.show_e_field && eRef.current) {
                const eP = [...base] as [number, number, number];
                eP[axisIdx === 0 ? 1 : 0] = eVal + obj.position[axisIdx === 0 ? 'y' : 'x'];
                ePts.current[i].set(...eP);
            }
            if (obj.show_b_field && bRef.current) {
                const bP = [...base] as [number, number, number];
                bP[axisIdx === 2 ? 0 : 2] = bVal + obj.position[axisIdx === 2 ? 'x' : 'z'];
                bPts.current[i].set(...bP);
            }
        }
        if (eRef.current) eRef.current.geometry.setFromPoints(ePts.current);
        if (bRef.current) bRef.current.geometry.setFromPoints(bPts.current);
    });

    return (
        <group>
            {obj.show_e_field && <line ref={eRef as never}><bufferGeometry /><lineBasicMaterial color={obj.color_e} linewidth={2} /></line>}
            {obj.show_b_field && <line ref={bRef as never}><bufferGeometry /><lineBasicMaterial color={obj.color_b} linewidth={2} /></line>}
        </group>
    );
}
