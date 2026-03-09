import { createRef, useMemo, useEffect } from 'react';
import { Physics } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { ObjectMesh } from './ObjectMesh';
import { BodyTrail } from './BodyTrail';
import { JointRenderer, VisualLink } from './Joints';
import { SceneSetup } from './SceneSetup';
import type { PhysicsSchema } from '../types/physics';

interface Props {
    schema: PhysicsSchema;
    controlOverrides: Record<string, number>;
    enableGlow?: boolean;
    enableTrail?: boolean;
}

/** Resolve dot-notation path on schema to get a value */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((acc: any, key) => acc?.[key], obj as any);
}

/** Deep clone + apply control overrides to a schema copy */
function applyOverrides(schema: PhysicsSchema, overrides: Record<string, number>): PhysicsSchema {
    const clone = JSON.parse(JSON.stringify(schema)) as PhysicsSchema;
    for (const [param, val] of Object.entries(overrides)) {
        const parts = param.split('.');
        // Environment overrides
        if (parts[0] === 'environment') {
            let target: any = clone.environment;
            for (let i = 1; i < parts.length - 1; i++) {
                if (target && target[parts[i]] !== undefined) {
                    target = target[parts[i]];
                } else {
                    target = null;
                    break;
                }
            }
            if (target) target[parts[parts.length - 1]] = val;
            continue;
        }
        // Object / link overrides (first part is the id)
        const id = parts[0];
        const obj = (clone.objects as unknown as Array<Record<string, any>>).find((o) => o.id === id);
        if (obj) {
            let target: any = obj;
            for (let i = 1; i < parts.length - 1; i++) {
                if (target && target[parts[i]] !== undefined) {
                    target = target[parts[i]];
                } else {
                    target = null;
                    break;
                }
            }
            if (target) target[parts[parts.length - 1]] = val;
            continue;
        }
        const link = (clone.links as unknown as Array<Record<string, any>>).find((l) => l.id === id);
        if (link) {
            let target: any = link;
            for (let i = 1; i < parts.length - 1; i++) {
                if (target && target[parts[i]] !== undefined) {
                    target = target[parts[i]];
                } else {
                    target = null;
                    break;
                }
            }
            if (target) target[parts[parts.length - 1]] = val;
        }
    }
    return clone;
}

export function PhysicsWorld({ schema: baseSchema, controlOverrides, enableGlow = true, enableTrail = false }: Props) {
    const schema = useMemo(() => applyOverrides(baseSchema, controlOverrides), [baseSchema, controlOverrides]);

    // Create a key for properties that require full remount (material properties, geometry, initial conditions)
    // This includes: restitution, friction, density, radius, width, height, depth, length, initial_velocity
    const remountKey = useMemo(() => {
        const criticalProps: string[] = [];
        Object.entries(controlOverrides).forEach(([param, value]) => {
            // Check if this is a property that requires remount
            if (param.includes('material.') || param.includes('radius') || 
                param.includes('width') || param.includes('height') || 
                param.includes('depth') || param.includes('length') ||
                param.includes('initial_velocity') || param.includes('rotation_deg')) {
                criticalProps.push(`${param}:${value}`);
            }
        });
        return criticalProps.join('|');
    }, [controlOverrides]);

    // Create stable refs keyed by object id
    // Recreate refs when remountKey changes to ensure fresh references after remount
    const refs = useMemo(() => {
        const m: Record<string, React.RefObject<RapierRigidBody | null>> = {};
        schema.objects.forEach((o) => { m[o.id] = createRef<RapierRigidBody>(); });
        return m;
    }, [schema.objects.map((o) => o.id).join(','), remountKey]);

    // Build object lookup for anchor resolution
    const objMap = useMemo(() => {
        const m: Record<string, (typeof schema.objects)[number]> = {};
        schema.objects.forEach((o) => { m[o.id] = o; });
        return m;
    }, [schema]);

    const gravity: [number, number, number] = [0, schema.environment.gravity_y, 0];

    // Update physics bodies when control overrides change (for properties that CAN be updated)
    useEffect(() => {
        schema.objects.forEach((obj) => {
            const ref = refs[obj.id];
            if (!ref?.current) return;

            const body = ref.current;

            // Update position if it changed
            const currentPos = body.translation();
            if (currentPos.x !== obj.position.x || currentPos.y !== obj.position.y || currentPos.z !== obj.position.z) {
                body.setTranslation({ x: obj.position.x, y: obj.position.y, z: obj.position.z }, true);
                // Reset velocity when position changes
                body.setLinvel({ x: 0, y: 0, z: 0 }, true);
                body.setAngvel({ x: 0, y: 0, z: 0 }, true);
            }
        });
    }, [schema.objects, refs]);

    return (
        <>
            <SceneSetup env={schema.environment} enableGlow={enableGlow} />
            <Physics key={remountKey} gravity={gravity} debug={false}>
                {/* Objects */}
                {schema.objects.map((obj) => (
                    <ObjectMesh key={obj.id} ref={refs[obj.id]} obj={obj} />
                ))}

                {/* Joints (physics constraints) */}
                {schema.links.map((link) => {
                    const rA = refs[link.object_a.id];
                    const rB = refs[link.object_b.id];
                    const oA = objMap[link.object_a.id];
                    const oB = objMap[link.object_b.id];
                    if (!rA || !rB || !oA || !oB) return null;
                    return <JointRenderer key={link.id} link={link} refA={rA} refB={rB} objA={oA} objB={oB} />;
                })}

                {/* Visual links (ropes, springs drawn as lines) */}
                {schema.links.map((link) => {
                    const rA = refs[link.object_a.id];
                    const rB = refs[link.object_b.id];
                    if (!rA || !rB) return null;
                    if (!['rope', 'spring_link', 'rigid_rod'].includes(link.type)) return null;
                    return <VisualLink key={`vis-${link.id}`} refA={rA} refB={rB} link={link} />;
                })}

                {/* Trails for dynamic bodies */}
                {enableTrail && schema.objects
                    .filter((obj) => !obj.is_static && !obj.is_anchor && obj.type !== 'string')
                    .map((obj) => (
                        <BodyTrail
                            key={`trail-${obj.id}`}
                            bodyRef={refs[obj.id]}
                            color={obj.color}
                            maxPoints={120}
                        />
                    ))
                }
            </Physics>
        </>
    );
}
