import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Mode2Schema, Mode2Object, WireLink, RealWireLink, Resistor, Inductor, Capacitor, VoltageSource, GroundNode } from '../../types/physics_mode2';

/* ═══ COMPONENT DIMENSIONS — used by both meshes and terminals ═══ */
const COMP = {
    resistor: { hw: 0.9, hh: 0.35 },  // half-width, half-height
    inductor: { hw: 0.9, hh: 0.35 },
    capacitor: { hw: 0.35, hh: 0.55 },
    voltage_source: { hw: 0.5, hh: 0.5 },
    ground_node: { hw: 0.3, hh: 0.25 },
    default: { hw: 0.5, hh: 0.5 },
};

/* ═══ TERMINAL POSITIONS ═══════════════════════════════════════════
   Terminals sit at the *edges* of the component body along its
   orientation axis so wires visually connect flush.              */

function getTerminal(obj: Mode2Object, terminal: string): THREE.Vector3 {
    const px = obj.position.x, py = obj.position.y, pz = obj.position.z;
    if (obj.type === 'ground_node') {
        if (terminal === 'gnd') return new THREE.Vector3(px, py, pz);
        return new THREE.Vector3(px, py + 0.25, pz); // top of ground symbol
    }
    const dims = COMP[obj.type as keyof typeof COMP] ?? COMP.default;
    const orientDeg = 'orientation_deg' in obj ? (obj as Resistor).orientation_deg : 0;
    const rad = orientDeg * (Math.PI / 180);
    // "p" = start of component along orientation axis, "n" = end
    const offX = Math.cos(rad) * dims.hw;
    const offY = Math.sin(rad) * dims.hw;
    if (terminal === 'p') return new THREE.Vector3(px - offX, py - offY, pz);
    if (terminal === 'n') return new THREE.Vector3(px + offX, py + offY, pz);
    // Multi-terminal components
    if (terminal === 'base' || terminal === 'gate' || terminal === 'in_p') return new THREE.Vector3(px - 1.2, py, pz);
    if (terminal === 'collector' || terminal === 'drain' || terminal === 'out') return new THREE.Vector3(px + 1.2, py + 0.8, pz);
    if (terminal === 'emitter' || terminal === 'source' || terminal === 'in_n') return new THREE.Vector3(px + 1.2, py - 0.8, pz);
    if (terminal === 'gnd') return new THREE.Vector3(px, py, pz);
    return new THREE.Vector3(px, py, pz);
}

/* ═══ WIRE PATH ═══════════════════════════════════════════════════ */

function computeWirePath(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] {
    const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
    if (dx < 0.2 || dy < 0.2) return [a, b];
    // L-bend: horizontal first, then vertical
    return [a, new THREE.Vector3(b.x, a.y, a.z), b];
}

/* ═══ COMPONENT MESHES — scaled to be visible in the scene ═══════ */

function ResistorMesh({ obj }: { obj: Resistor }) {
    const w = COMP.resistor.hw * 2, h = COMP.resistor.hh * 2;
    return (
        <group position={[obj.position.x, obj.position.y, obj.position.z]} rotation={[0, 0, (obj.orientation_deg || 0) * Math.PI / 180]}>
            {/* Body */}
            <mesh><boxGeometry args={[w, h, 0.25]} /><meshStandardMaterial color={obj.color} metalness={0.3} roughness={0.5} /></mesh>
            {/* Color bands (cosmetic) */}
            {[-0.3, -0.1, 0.1, 0.3].map((x, i) => (
                <mesh key={i} position={[x, 0, 0.13]}><boxGeometry args={[0.08, h * 0.9, 0.01]} /><meshStandardMaterial color={['#ef4444', '#f97316', '#eab308', '#a855f7'][i]} /></mesh>
            ))}
            {/* Lead stubs */}
            <mesh position={[-w / 2 - 0.15, 0, 0]}><boxGeometry args={[0.3, 0.06, 0.06]} /><meshStandardMaterial color="#a1a1aa" metalness={0.7} /></mesh>
            <mesh position={[w / 2 + 0.15, 0, 0]}><boxGeometry args={[0.3, 0.06, 0.06]} /><meshStandardMaterial color="#a1a1aa" metalness={0.7} /></mesh>
            {/* Label */}
            <Text position={[0, h / 2 + 0.3, 0]} fontSize={0.25} color="#f8fafc" anchorX="center">{obj.label}</Text>
        </group>
    );
}

function InductorMesh({ obj }: { obj: Inductor }) {
    const coils = 4;
    return (
        <group position={[obj.position.x, obj.position.y, obj.position.z]} rotation={[0, 0, (obj.orientation_deg || 0) * Math.PI / 180]}>
            {Array.from({ length: coils }, (_, i) => (
                <mesh key={i} position={[(i - coils / 2 + 0.5) * 0.4, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                    <torusGeometry args={[0.25, 0.07, 8, 20, Math.PI]} /><meshStandardMaterial color={obj.color} metalness={0.6} roughness={0.3} />
                </mesh>
            ))}
            <mesh position={[-0.95, 0, 0]}><boxGeometry args={[0.15, 0.06, 0.06]} /><meshStandardMaterial color="#a1a1aa" metalness={0.7} /></mesh>
            <mesh position={[0.95, 0, 0]}><boxGeometry args={[0.15, 0.06, 0.06]} /><meshStandardMaterial color="#a1a1aa" metalness={0.7} /></mesh>
            <Text position={[0, 0.55, 0]} fontSize={0.25} color="#f8fafc" anchorX="center">{obj.label}</Text>
        </group>
    );
}

function CapacitorMesh({ obj }: { obj: Capacitor }) {
    return (
        <group position={[obj.position.x, obj.position.y, obj.position.z]} rotation={[0, 0, (obj.orientation_deg || 0) * Math.PI / 180]}>
            {/* Two plates */}
            <mesh position={[-0.12, 0, 0]}><boxGeometry args={[0.06, 1.0, 0.35]} /><meshStandardMaterial color={obj.color} metalness={0.5} /></mesh>
            <mesh position={[0.12, 0, 0]}><boxGeometry args={[0.06, 1.0, 0.35]} /><meshStandardMaterial color={obj.color} metalness={0.5} /></mesh>
            {/* Lead stubs */}
            <mesh position={[-0.25, 0, 0]}><boxGeometry args={[0.2, 0.06, 0.06]} /><meshStandardMaterial color="#a1a1aa" metalness={0.7} /></mesh>
            <mesh position={[0.25, 0, 0]}><boxGeometry args={[0.2, 0.06, 0.06]} /><meshStandardMaterial color="#a1a1aa" metalness={0.7} /></mesh>
            <Text position={[0, 0.75, 0]} fontSize={0.25} color="#f8fafc" anchorX="center">{obj.label}</Text>
        </group>
    );
}

function VSourceMesh({ obj }: { obj: VoltageSource }) {
    return (
        <group position={[obj.position.x, obj.position.y, obj.position.z]}>
            {/* Circle body */}
            <mesh><ringGeometry args={[0.4, 0.5, 32]} /><meshStandardMaterial color={obj.color} side={THREE.DoubleSide} /></mesh>
            <mesh><circleGeometry args={[0.4, 32]} /><meshStandardMaterial color="#000000" transparent opacity={0.3} side={THREE.DoubleSide} /></mesh>
            {/* + and - symbols */}
            <mesh position={[0, 0.15, 0.01]}><boxGeometry args={[0.2, 0.04, 0.01]} /><meshBasicMaterial color="#f8fafc" /></mesh>
            <mesh position={[0, 0.15, 0.01]}><boxGeometry args={[0.04, 0.2, 0.01]} /><meshBasicMaterial color="#f8fafc" /></mesh>
            <mesh position={[0, -0.15, 0.01]}><boxGeometry args={[0.2, 0.04, 0.01]} /><meshBasicMaterial color="#f8fafc" /></mesh>
            {/* Lead stubs */}
            <mesh position={[-0.65, 0, 0]}><boxGeometry args={[0.3, 0.06, 0.06]} /><meshStandardMaterial color="#a1a1aa" metalness={0.7} /></mesh>
            <mesh position={[0.65, 0, 0]}><boxGeometry args={[0.3, 0.06, 0.06]} /><meshStandardMaterial color="#a1a1aa" metalness={0.7} /></mesh>
            <Text position={[0, 0.8, 0]} fontSize={0.25} color="#f8fafc" anchorX="center">{obj.label}</Text>
        </group>
    );
}

function GroundMesh({ obj }: { obj: GroundNode }) {
    return (
        <group position={[obj.position.x, obj.position.y, obj.position.z]}>
            {[0, -0.12, -0.24].map((y, i) => (
                <mesh key={i} position={[0, y, 0]}><boxGeometry args={[0.6 - i * 0.2, 0.05, 0.2]} /><meshStandardMaterial color="#a1a1aa" metalness={0.5} /></mesh>
            ))}
            {/* Lead stub going up */}
            <mesh position={[0, 0.15, 0]}><boxGeometry args={[0.06, 0.3, 0.06]} /><meshStandardMaterial color="#a1a1aa" metalness={0.7} /></mesh>
        </group>
    );
}

function ComponentMesh({ obj }: { obj: Mode2Object }) {
    switch (obj.type) {
        case 'resistor': return <ResistorMesh obj={obj} />;
        case 'inductor': return <InductorMesh obj={obj} />;
        case 'capacitor': return <CapacitorMesh obj={obj} />;
        case 'voltage_source': return <VSourceMesh obj={obj} />;
        case 'ground_node': return <GroundMesh obj={obj as GroundNode} />;
        default: return (
            <group position={[obj.position.x, obj.position.y, obj.position.z]}>
                <mesh><boxGeometry args={[0.8, 0.8, 0.3]} /><meshStandardMaterial color={obj.color} wireframe /></mesh>
                {'label' in obj && <Text position={[0, 0.7, 0]} fontSize={0.2} color="#f8fafc" anchorX="center">{String((obj as unknown as Record<string, unknown>).label)}</Text>}
            </group>
        );
    }
}

/* ═══ CHARGE FLOW — InstancedMesh positive charge spheres ══════ */

const CHARGES_PER_WIRE = 10;
const CHARGE_RADIUS = 0.08;
const CHARGE_COLOR = new THREE.Color('#fbbf24');

function ChargeFlow({ wirePaths, currentMagnitude }: { wirePaths: THREE.Vector3[][]; currentMagnitude: number }) {
    const totalCharges = wirePaths.length * CHARGES_PER_WIRE;
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const offsets = useRef<number[]>([]);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    useEffect(() => {
        offsets.current = Array.from({ length: totalCharges }, (_, i) => (i % CHARGES_PER_WIRE) / CHARGES_PER_WIRE);
    }, [totalCharges]);

    useFrame((_, dt) => {
        if (!meshRef.current || offsets.current.length === 0) return;
        const speed = Math.min(Math.abs(currentMagnitude) * 0.5 + 0.3, 2.5);
        let idx = 0;
        for (let w = 0; w < wirePaths.length; w++) {
            const path = wirePaths[w];
            if (path.length < 2) { idx += CHARGES_PER_WIRE; continue; }
            const lengths: number[] = [0];
            for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + path[i].distanceTo(path[i - 1]));
            const totalLen = lengths[lengths.length - 1];
            if (totalLen < 0.01) { idx += CHARGES_PER_WIRE; continue; }

            for (let c = 0; c < CHARGES_PER_WIRE; c++) {
                if (idx >= offsets.current.length) break;
                offsets.current[idx] = (offsets.current[idx] + speed * dt / totalLen) % 1;
                const targetDist = offsets.current[idx] * totalLen;
                let seg = 0;
                for (let i = 1; i < lengths.length; i++) { if (lengths[i] >= targetDist) { seg = i - 1; break; } }
                if (seg + 1 >= path.length) seg = path.length - 2;
                const segLen = lengths[seg + 1] - lengths[seg];
                const t = segLen > 0 ? (targetDist - lengths[seg]) / segLen : 0;
                const pos = new THREE.Vector3().lerpVectors(path[seg], path[Math.min(seg + 1, path.length - 1)], t);
                dummy.position.copy(pos);
                dummy.scale.setScalar(1);
                dummy.updateMatrix();
                meshRef.current.setMatrixAt(idx, dummy.matrix);
                idx++;
            }
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    if (totalCharges === 0) return null;
    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, totalCharges]} frustumCulled={false}>
            <sphereGeometry args={[CHARGE_RADIUS, 8, 8]} />
            <meshStandardMaterial color={CHARGE_COLOR} emissive={CHARGE_COLOR} emissiveIntensity={1.0} toneMapped={false} />
        </instancedMesh>
    );
}

/* ═══ CIRCUIT SCENE ════════════════════════════════════════════════ */

export function CircuitScene({ schema }: { schema: Mode2Schema }) {
    const CIRCUIT_TYPES = ['resistor', 'inductor', 'capacitor', 'voltage_source', 'current_source', 'ground_node', 'rlc_network', 'transmission_line_segment', 'transistor_bjt', 'transistor_mosfet', 'op_amp'];
    const circuitObjs = schema.objects.filter(o => CIRCUIT_TYPES.includes(o.type));
    const objMap = useMemo(() => { const m: Record<string, Mode2Object> = {}; circuitObjs.forEach(o => { m[o.id] = o; }); return m; }, [circuitObjs]);

    const wireLinks = schema.circuit_links.filter((l): l is WireLink | RealWireLink => l.type === 'wire' || l.type === 'real_wire');
    const wirePaths = useMemo(() => {
        return wireLinks.map(w => {
            const a = objMap[w.node_a_id], b = objMap[w.node_b_id];
            if (!a || !b) return [];
            const pA = getTerminal(a, w.node_a_terminal);
            const pB = getTerminal(b, w.node_b_terminal);
            return computeWirePath(pA, pB);
        }).filter(p => p.length > 0);
    }, [wireLinks, objMap]);

    const current = useMemo(() => {
        const vSrc = circuitObjs.find(o => o.type === 'voltage_source') as VoltageSource | undefined;
        const resistor = circuitObjs.find(o => o.type === 'resistor') as Resistor | undefined;
        if (!vSrc || !resistor) return 0.5;
        const V = vSrc.ac_amplitude || vSrc.dc_voltage || 10;
        const R = resistor.resistance || 100;
        return Math.min(V / R, 3);
    }, [circuitObjs]);

    return (
        <group>
            {circuitObjs.map(obj => <ComponentMesh key={obj.id} obj={obj} />)}
            {wirePaths.map((path, i) => {
                const pts = new Float32Array(path.flatMap(p => [p.x, p.y, p.z]));
                return (
                    <line key={`wire-${i}`}>
                        <bufferGeometry><bufferAttribute attach="attributes-position" args={[pts, 3]} count={path.length} /></bufferGeometry>
                        <lineBasicMaterial color="#a1a1aa" />
                    </line>
                );
            })}
            <ChargeFlow wirePaths={wirePaths} currentMagnitude={current} />
        </group>
    );
}
