// ── Shared primitives ──────────────────────────────────────────────

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export interface RotationDeg {
    x: number;
    y: number;
    z: number;
}

export type MaterialPreset = "rubber" | "steel" | "wood" | "glass" | "clay" | "ice" | "custom";

export interface Material {
    preset: MaterialPreset;
    restitution: number;
    friction: number;
    density: number;
}

// ── Environment ────────────────────────────────────────────────────

export type Background = "space" | "lab" | "grid" | "black" | "white";

export interface CameraPosition {
    x: number;
    y: number;
    z: number;
}

export interface Environment {
    gravity_y: number;
    background: Background;
    ambient_light: number;
    show_axes: boolean;
    show_grid: boolean;
    camera_position: CameraPosition;
    fog_enabled: boolean;
}

// ── Object types ───────────────────────────────────────────────────

interface BaseObject {
    id: string;
    label: string;
    education_note: string;
    is_static: boolean;
    is_anchor: boolean;
    color: string;
    position: Vec3;
    material: Material;
}

export interface SphereObject extends BaseObject {
    type: "sphere";
    radius: number;
    initial_velocity?: Vec3;
}

export interface BoxObject extends BaseObject {
    type: "box";
    width: number;
    height: number;
    depth: number;
    rotation_deg: RotationDeg;
    initial_velocity: Vec3;
}

export interface CylinderObject extends BaseObject {
    type: "cylinder";
    radius: number;
    height: number;
    rotation_deg?: RotationDeg;
    initial_velocity?: Vec3;
}

export interface PlaneObject extends BaseObject {
    type: "plane";
    width: number;
    depth: number;
    rotation_deg: RotationDeg;
}

export interface RampObject extends BaseObject {
    type: "ramp";
    width: number;
    height: number;
    depth: number;
    angle_deg: number;
}

export interface StringObject extends BaseObject {
    type: "string";
    segments: number;
    length: number;
    stiffness: number;
}

export interface SpringObject extends BaseObject {
    type: "spring";
    spring_constant: number;
    natural_length: number;
    initial_extension: number;
    damping: number;
    orientation: "vertical" | "horizontal";
    anchor_position: Vec3;
}

export interface FluidEmitterObject extends BaseObject {
    type: "fluid_emitter";
    emit_rate: number;
    particle_radius: number;
    fluid_type: "water" | "oil" | "lava" | "gas";
    initial_velocity: Vec3;
    max_particles: number;
    fluid_group_id: string;
}

export type PhysicsObject =
    | SphereObject
    | BoxObject
    | CylinderObject
    | PlaneObject
    | RampObject
    | StringObject
    | SpringObject
    | FluidEmitterObject;

// ── Link properties ────────────────────────────────────────────────

export interface RopeProperties {
    length: number;
    stiffness: number;
    damping: number;
    break_force: number | null;
    show_segments: number;
    color: string;
}

export interface SpringLinkProperties {
    rest_length: number;
    spring_constant: number;
    damping: number;
    break_force: number | null;
    show_coil: boolean;
    color: string;
}

export interface RigidRodProperties {
    length: number;
    break_force: number | null;
}

export interface HingeProperties {
    axis: "x" | "y" | "z";
    min_angle_deg: number;
    max_angle_deg: number;
    motor_torque: number | null;
}

export interface BallSocketProperties {
    max_cone_angle_deg: number;
}

export interface WeldProperties {
    break_force: number | null;
}

export interface SliderProperties {
    axis: "x" | "y" | "z";
    min_distance: number;
    max_distance: number;
    friction: number;
}

export type LinkProperties =
    | RopeProperties
    | SpringLinkProperties
    | RigidRodProperties
    | HingeProperties
    | BallSocketProperties
    | WeldProperties
    | SliderProperties;

// ── Links ──────────────────────────────────────────────────────────

export type LinkType = "rope" | "spring_link" | "rigid_rod" | "hinge" | "ball_socket" | "weld" | "slider";

export interface AttachmentRef {
    id: string;
    attachment_point: string;
    offset: Vec3;
}

export interface Link {
    id: string;
    type: LinkType;
    label: string;
    education_note: string;
    object_a: AttachmentRef;
    object_b: AttachmentRef;
    properties: LinkProperties;
}

// ── Controls ───────────────────────────────────────────────────────

export interface Control {
    group: string;
    label: string;
    param: string;
    min: number;
    max: number;
    default: number;
    step: number;
    unit: string;
    education_note: string;
}

// ── Educational sequence ───────────────────────────────────────────

export interface EducationalStep {
    step: number;
    title: string;
    instruction: string;
    focus_objects: string[];
    focus_controls: string[];
}

// ── Top-level schema ───────────────────────────────────────────────

export interface PhysicsSchema {
    simulation_id: string;
    title: string;
    description: string;
    physics_concept: string;
    mode: 1;
    difficulty: "beginner" | "intermediate" | "advanced";
    tags: string[];
    is_qualitative: boolean;

    environment: Environment;
    objects: PhysicsObject[];
    links: Link[];
    controls: Control[];
    educational_sequence: EducationalStep[];
}
