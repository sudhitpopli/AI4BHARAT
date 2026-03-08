import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
    useSphericalJoint,
    useRevoluteJoint,
    useFixedJoint,
    usePrismaticJoint,
    useRopeJoint,
    useSpringJoint,
} from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import type { Link, PhysicsObject, Vec3, RopeProperties, SpringLinkProperties, HingeProperties, SliderProperties } from '../types/physics';

/* ── helpers ─────────────────────────────────────── */

function resolveAnchor(obj: PhysicsObject, point: string, off: Vec3): [number, number, number] {
    let b: [number, number, number] = [0, 0, 0];
    if (obj.type === 'sphere') {
        const r = obj.radius;
        const m: Record<string, [number, number, number]> = { top: [0, r, 0], bottom: [0, -r, 0], left: [-r, 0, 0], right: [r, 0, 0], front: [0, 0, r], back: [0, 0, -r], center: [0, 0, 0] };
        b = m[point] ?? [0, 0, 0];
    } else if (obj.type === 'box') {
        const hw = obj.width / 2, hh = obj.height / 2, hd = obj.depth / 2;
        const m: Record<string, [number, number, number]> = { center: [0, 0, 0], top_center: [0, hh, 0], bottom_center: [0, -hh, 0], top_left: [-hw, hh, 0], top_right: [hw, hh, 0], bottom_left: [-hw, -hh, 0], bottom_right: [hw, -hh, 0], left_center: [-hw, 0, 0], right_center: [hw, 0, 0], front_center: [0, 0, hd], back_center: [0, 0, -hd] };
        b = m[point] ?? [0, 0, 0];
    } else if (obj.type === 'cylinder') {
        const r = obj.radius, h = obj.height / 2;
        const m: Record<string, [number, number, number]> = { center: [0, 0, 0], top_center: [0, h, 0], bottom_center: [0, -h, 0], top_rim: [r, h, 0], bottom_rim: [r, -h, 0], side: [r, 0, 0] };
        b = m[point] ?? [0, 0, 0];
    } else if (obj.type === 'string' || obj.type === 'spring') {
        b = point === 'top' ? [0, 0.02, 0] : point === 'bottom' ? [0, -0.02, 0] : [0, 0, 0];
    }
    return [b[0] + off.x, b[1] + off.y, b[2] + off.z];
}

/* ── joint wrappers (each calls exactly ONE hook) ─── */

function RopeJoint({ refA, refB, ancA, ancB, link }: { refA: React.RefObject<RapierRigidBody>; refB: React.RefObject<RapierRigidBody>; ancA: [number, number, number]; ancB: [number, number, number]; link: Link }) {
    const props = link.properties as RopeProperties;
    useRopeJoint(refA, refB, [ancA, ancB, props.length]);
    return null;
}

function SpringJoint({ refA, refB, ancA, ancB, link }: { refA: React.RefObject<RapierRigidBody>; refB: React.RefObject<RapierRigidBody>; ancA: [number, number, number]; ancB: [number, number, number]; link: Link }) {
    const props = link.properties as SpringLinkProperties;
    useSpringJoint(refA, refB, [ancA, ancB, props.rest_length, props.spring_constant, props.damping]);
    return null;
}

function HingeJoint({ refA, refB, ancA, ancB, link }: { refA: React.RefObject<RapierRigidBody>; refB: React.RefObject<RapierRigidBody>; ancA: [number, number, number]; ancB: [number, number, number]; link: Link }) {
    const props = link.properties as HingeProperties;
    const axis: [number, number, number] = props.axis === 'x' ? [1, 0, 0] : props.axis === 'y' ? [0, 1, 0] : [0, 0, 1];
    useRevoluteJoint(refA, refB, [ancA, ancB, axis]);
    return null;
}

function BallSocketJoint({ refA, refB, ancA, ancB }: { refA: React.RefObject<RapierRigidBody>; refB: React.RefObject<RapierRigidBody>; ancA: [number, number, number]; ancB: [number, number, number] }) {
    useSphericalJoint(refA, refB, [ancA, ancB]);
    return null;
}

function WeldJoint({ refA, refB, ancA, ancB }: { refA: React.RefObject<RapierRigidBody>; refB: React.RefObject<RapierRigidBody>; ancA: [number, number, number]; ancB: [number, number, number] }) {
    useFixedJoint(refA, refB, [ancA, [0, 0, 0, 1], ancB, [0, 0, 0, 1]]);
    return null;
}

function SliderJoint({ refA, refB, ancA, ancB, link }: { refA: React.RefObject<RapierRigidBody>; refB: React.RefObject<RapierRigidBody>; ancA: [number, number, number]; ancB: [number, number, number]; link: Link }) {
    const props = link.properties as SliderProperties;
    const axis: [number, number, number] = props.axis === 'x' ? [1, 0, 0] : props.axis === 'y' ? [0, 1, 0] : [0, 0, 1];
    usePrismaticJoint(refA, refB, [ancA, ancB, axis]);
    return null;
}

/* ── visual line between two bodies (updated every frame) ── */

export function VisualLink({ refA, refB, link }: { refA: React.RefObject<RapierRigidBody>; refB: React.RefObject<RapierRigidBody>; link: Link }) {
    const lineRef = useRef<THREE.Line>(null);
    const isSpring = link.type === 'spring_link';
    const segments = isSpring ? 40 : (link.type === 'rope' ? (link.properties as RopeProperties).show_segments : 2);
    const pts = useRef(Array.from({ length: segments + 1 }, () => new THREE.Vector3()));
    const color = 'color' in link.properties ? (link.properties as RopeProperties).color : '#f8fafc';

    useFrame(() => {
        if (!refA.current || !refB.current || !lineRef.current) return;
        const a = refA.current.translation();
        const b = refB.current.translation();
        const dir = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
        const len = dir.length();
        dir.normalize();

        const perp = new THREE.Vector3();
        if (Math.abs(dir.y) < 0.9) perp.crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        else perp.crossVectors(dir, new THREE.Vector3(1, 0, 0)).normalize();

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const along = t * len;
            let offX = 0, offY = 0, offZ = 0;

            if (isSpring && i > 0 && i < segments) {
                const zigzag = Math.sin(t * 10 * Math.PI * 2) * 0.12;
                offX = perp.x * zigzag;
                offY = perp.y * zigzag;
                offZ = perp.z * zigzag;
            } else if (link.type === 'rope') {
                const sag = Math.sin(Math.PI * t) * len * 0.06;
                offY = -sag;
            }

            pts.current[i].set(
                a.x + dir.x * along + offX,
                a.y + dir.y * along + offY - (link.type === 'rope' ? Math.sin(Math.PI * t) * len * 0.06 : 0),
                a.z + dir.z * along + offZ
            );
        }
        lineRef.current.geometry.setFromPoints(pts.current);
    });

    return (
        <line ref={lineRef as never}>
            <bufferGeometry />
            <lineBasicMaterial color={color} />
        </line>
    );
}

/* ── main joint router ─────────────────────────────── */

export function JointRenderer({
    link, refA, refB, objA, objB,
}: {
    link: Link;
    refA: React.RefObject<RapierRigidBody>;
    refB: React.RefObject<RapierRigidBody>;
    objA: PhysicsObject;
    objB: PhysicsObject;
}) {
    const ancA = resolveAnchor(objA, link.object_a.attachment_point, link.object_a.offset);
    const ancB = resolveAnchor(objB, link.object_b.attachment_point, link.object_b.offset);

    switch (link.type) {
        case 'rope': return <RopeJoint refA={refA} refB={refB} ancA={ancA} ancB={ancB} link={link} />;
        case 'spring_link': return <SpringJoint refA={refA} refB={refB} ancA={ancA} ancB={ancB} link={link} />;
        case 'hinge': return <HingeJoint refA={refA} refB={refB} ancA={ancA} ancB={ancB} link={link} />;
        case 'ball_socket': return <BallSocketJoint refA={refA} refB={refB} ancA={ancA} ancB={ancB} />;
        case 'weld': return <WeldJoint refA={refA} refB={refB} ancA={ancA} ancB={ancB} />;
        case 'rigid_rod': return <WeldJoint refA={refA} refB={refB} ancA={ancA} ancB={ancB} />;
        case 'slider': return <SliderJoint refA={refA} refB={refB} ancA={ancA} ancB={ancB} link={link} />;
        default: return null;
    }
}
