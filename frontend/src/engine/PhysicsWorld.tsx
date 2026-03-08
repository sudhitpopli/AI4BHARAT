import { createRef, useMemo } from 'react';
import { Physics } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { ObjectMesh } from './ObjectMesh';
import { JointRenderer, VisualLink } from './Joints';
import { SceneSetup } from './SceneSetup';
import type { PhysicsSchema } from '../types/physics';

interface Props {
    schema: PhysicsSchema;
    controlOverrides: Record<string, number>;
}

/** Resolve dot-notation path on schema to get a value */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((acc, key) => (acc as Record<string, unknown>)?.[key], obj);
}

/** Deep clone + apply control overrides to a schema copy */
function applyOverrides(schema: PhysicsSchema, overrides: Record<string, number>): PhysicsSchema {
    const clone = JSON.parse(JSON.stringify(schema)) as PhysicsSchema;
    for (const [param, val] of Object.entries(overrides)) {
        const parts = param.split('.');
        // Environment overrides
        if (parts[0] === 'environment') {
            let target: Record<string, unknown> = clone.environment as unknown as Record<string, unknown>;
            for (let i = 1; i < parts.length - 1; i++) target = target[parts[i]] as Record<string, unknown>;
            target[parts[parts.length - 1]] = val;
            continue;
        }
        // Object / link overrides (first part is the id)
        const id = parts[0];
        const obj = (clone.objects as unknown as Array<Record<string, unknown>>).find((o) => o.id === id);
        if (obj) {
            let target: Record<string, unknown> = obj;
            for (let i = 1; i < parts.length - 1; i++) target = target[parts[i]] as Record<string, unknown>;
            target[parts[parts.length - 1]] = val;
            continue;
        }
        const link = (clone.links as unknown as Array<Record<string, unknown>>).find((l) => l.id === id);
        if (link) {
            let target: Record<string, unknown> = link;
            for (let i = 1; i < parts.length - 1; i++) target = target[parts[i]] as Record<string, unknown>;
            target[parts[parts.length - 1]] = val;
        }
    }
    return clone;
}

export function PhysicsWorld({ schema: baseSchema, controlOverrides }: Props) {
    const schema = useMemo(() => applyOverrides(baseSchema, controlOverrides), [baseSchema, controlOverrides]);

    // Create stable refs keyed by object id
    const refs = useMemo(() => {
        const m: Record<string, React.RefObject<RapierRigidBody>> = {};
        schema.objects.forEach((o) => { m[o.id] = createRef<RapierRigidBody>(); });
        return m;
    }, [schema.objects.map((o) => o.id).join(',')]);

    // Build object lookup for anchor resolution
    const objMap = useMemo(() => {
        const m: Record<string, (typeof schema.objects)[number]> = {};
        schema.objects.forEach((o) => { m[o.id] = o; });
        return m;
    }, [schema]);

    const gravity: [number, number, number] = [0, schema.environment.gravity_y, 0];

    return (
        <>
            <SceneSetup env={schema.environment} />
            <Physics gravity={gravity} debug={false}>
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
            </Physics>
        </>
    );
}
