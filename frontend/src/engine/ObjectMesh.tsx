import { forwardRef } from 'react';
import { RigidBody, BallCollider, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import type { PhysicsObject } from '../types/physics';

const D2R = Math.PI / 180;

export const ObjectMesh = forwardRef<RapierRigidBody, { obj: PhysicsObject }>(
    ({ obj }, ref) => {
        const t = obj.is_static || obj.is_anchor ? 'fixed' as const : 'dynamic' as const;
        const p: [number, number, number] = [obj.position.x, obj.position.y, obj.position.z];

        switch (obj.type) {
            case 'sphere': {
                const v: [number, number, number] = obj.initial_velocity
                    ? [obj.initial_velocity.x, obj.initial_velocity.y, obj.initial_velocity.z]
                    : [0, 0, 0];
                return (
                    <RigidBody ref={ref} type={t} position={p} linearVelocity={v} colliders={false}>
                        <BallCollider args={[obj.radius]} restitution={obj.material.restitution} friction={obj.material.friction} density={obj.material.density} />
                        <mesh castShadow receiveShadow>
                            <sphereGeometry args={[obj.radius, 32, 32]} />
                            <meshStandardMaterial color={obj.color} metalness={0.35} roughness={0.4} emissive={obj.color} emissiveIntensity={0.8} />
                        </mesh>
                    </RigidBody>
                );
            }

            case 'box': {
                const r: [number, number, number] = [obj.rotation_deg.x * D2R, obj.rotation_deg.y * D2R, obj.rotation_deg.z * D2R];
                const v: [number, number, number] = [obj.initial_velocity.x, obj.initial_velocity.y, obj.initial_velocity.z];
                return (
                    <RigidBody ref={ref} type={t} position={p} rotation={r} linearVelocity={v} colliders={false}>
                        <CuboidCollider args={[obj.width / 2, obj.height / 2, obj.depth / 2]} restitution={obj.material.restitution} friction={obj.material.friction} density={obj.material.density} />
                        <mesh castShadow receiveShadow>
                            <boxGeometry args={[obj.width, obj.height, obj.depth]} />
                            <meshStandardMaterial color={obj.color} metalness={0.2} roughness={0.5} emissive={obj.color} emissiveIntensity={0.8} />
                        </mesh>
                    </RigidBody>
                );
            }

            case 'cylinder': {
                const r: [number, number, number] = obj.rotation_deg
                    ? [obj.rotation_deg.x * D2R, obj.rotation_deg.y * D2R, obj.rotation_deg.z * D2R]
                    : [0, 0, 0];
                return (
                    <RigidBody ref={ref} type={t} position={p} rotation={r} colliders={false}>
                        <CylinderCollider args={[obj.height / 2, obj.radius]} restitution={obj.material.restitution} friction={obj.material.friction} density={obj.material.density} />
                        <mesh castShadow receiveShadow>
                            <cylinderGeometry args={[obj.radius, obj.radius, obj.height, 32]} />
                            <meshStandardMaterial color={obj.color} metalness={0.3} roughness={0.4} emissive={obj.color} emissiveIntensity={0.8} />
                        </mesh>
                    </RigidBody>
                );
            }

            case 'plane': {
                const r: [number, number, number] = [obj.rotation_deg.x * D2R, obj.rotation_deg.y * D2R, obj.rotation_deg.z * D2R];
                return (
                    <RigidBody ref={ref} type="fixed" position={p} rotation={r} colliders={false}>
                        <CuboidCollider args={[obj.width / 2, 0.05, obj.depth / 2]} restitution={obj.material.restitution} friction={obj.material.friction} density={obj.material.density} />
                        <mesh receiveShadow>
                            <boxGeometry args={[obj.width, 0.1, obj.depth]} />
                            <meshStandardMaterial color={obj.color} side={THREE.DoubleSide} metalness={0.05} roughness={0.85} emissive="#1e293b" emissiveIntensity={0.15} />
                        </mesh>
                    </RigidBody>
                );
            }

            case 'ramp':
                return (
                    <RigidBody ref={ref} type="fixed" position={p} rotation={[0, 0, obj.angle_deg * D2R]} colliders={false}>
                        <CuboidCollider args={[obj.width / 2, obj.height / 2, obj.depth / 2]} restitution={obj.material.restitution} friction={obj.material.friction} density={obj.material.density} />
                        <mesh castShadow receiveShadow>
                            <boxGeometry args={[obj.width, obj.height, obj.depth]} />
                            <meshStandardMaterial color={obj.color} metalness={0.1} roughness={0.7} emissive={obj.color} emissiveIntensity={0.3} />
                        </mesh>
                    </RigidBody>
                );

            case 'string':
                // Visual‑only anchor; physics comes from rope links
                return (
                    <RigidBody ref={ref} type={t} position={p} colliders={false}>
                        <BallCollider args={[0.02]} density={0.01} sensor />
                    </RigidBody>
                );

            case 'spring':
                // Fixed anchor point; spring joint handles physics
                return (
                    <RigidBody ref={ref} type="fixed" position={[obj.anchor_position.x, obj.anchor_position.y, obj.anchor_position.z]} colliders={false}>
                        <BallCollider args={[0.12]} density={1} sensor />
                        <mesh>
                            <sphereGeometry args={[0.12]} />
                            <meshStandardMaterial color={obj.color} metalness={0.5} roughness={0.3} emissive={obj.color} emissiveIntensity={2.0} />
                        </mesh>
                    </RigidBody>
                );

            case 'fluid_emitter':
                return (
                    <RigidBody ref={ref} type="fixed" position={p} colliders={false}>
                        <mesh>
                            <coneGeometry args={[0.3, 0.5, 8]} />
                            <meshStandardMaterial color={obj.color} transparent opacity={0.5} />
                        </mesh>
                    </RigidBody>
                );

            default:
                return null;
        }
    }
);

ObjectMesh.displayName = 'ObjectMesh';
