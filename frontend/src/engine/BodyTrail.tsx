/**
 * BodyTrail — draws a fading neon line behind a moving Rapier rigid body.
 *
 * Samples body position every frame, pushes to a ring buffer,
 * renders as a THREE.Line with per-vertex fading opacity.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RapierRigidBody } from '@react-three/rapier';

interface Props {
    bodyRef: React.RefObject<RapierRigidBody | null>;
    color?: string;
    maxPoints?: number;
}

export function BodyTrail({
    bodyRef,
    color = '#38bdf8',
    maxPoints = 120,
}: Props) {
    const positions = useRef(new Float32Array(maxPoints * 3));
    const colors = useRef(new Float32Array(maxPoints * 4));
    const countRef = useRef(0);
    const frameSkip = useRef(0);

    const baseColor = useMemo(() => new THREE.Color(color), [color]);

    // Create geometry + material + line object once
    const { geometry, lineObj } = useMemo(() => {
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxPoints * 3), 3));
        geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxPoints * 4), 4));
        geom.setDrawRange(0, 0);

        const mat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
        });

        const line = new THREE.Line(geom, mat);
        line.frustumCulled = false;

        return { geometry: geom, material: mat, lineObj: line };
    }, [maxPoints]);

    useFrame(() => {
        const body = bodyRef.current;
        if (!body) return;

        // Sample every 2nd frame for performance
        frameSkip.current++;
        if (frameSkip.current % 2 !== 0) return;

        const pos = body.translation();
        const posArr = positions.current;
        const colArr = colors.current;
        const count = Math.min(countRef.current + 1, maxPoints);
        countRef.current = count;

        // Shift old positions backward
        for (let i = (count - 1) * 3; i >= 3; i -= 3) {
            posArr[i] = posArr[i - 3];
            posArr[i + 1] = posArr[i - 2];
            posArr[i + 2] = posArr[i - 1];
        }

        // Insert new position at front
        posArr[0] = pos.x;
        posArr[1] = pos.y;
        posArr[2] = pos.z;

        // Update vertex colors with fading alpha
        for (let i = 0; i < count; i++) {
            const alpha = 1.0 - (i / count);
            const i4 = i * 4;
            colArr[i4] = baseColor.r;
            colArr[i4 + 1] = baseColor.g;
            colArr[i4 + 2] = baseColor.b;
            colArr[i4 + 3] = alpha * alpha; // quadratic fade
        }

        // Update buffer attributes
        const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
        const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
        posAttr.set(posArr.subarray(0, count * 3));
        colAttr.set(colArr.subarray(0, count * 4));
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        geometry.setDrawRange(0, count);
    });

    return <primitive object={lineObj} />;
}
