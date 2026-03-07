export interface ObjectStyle {
  color: string;
  geometry: string; // e.g., 'box', 'sphere'
}

export interface ObjectProperties {
  mass: number;
  restitution: number; // Bounciness factor (0 to 1)
  position: [number, number, number];
  velocity: [number, number, number];
}

export interface PhysicsObject {
  id: string;
  type: 'rigid' | 'kinematic' | 'fixed'; // Rapier modes
  style: ObjectStyle;
  properties: ObjectProperties;
}

export interface PhysicsSchema {
  mode: 1 | 2 | 3; // 1: Rapier, 2: Parameterized Math, 3: Canned
  description: string;
  gravity: [number, number, number];
  objects: PhysicsObject[];
  animation_id?: string; // Present only if Mode 3
}
