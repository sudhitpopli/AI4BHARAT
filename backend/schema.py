from __future__ import annotations

from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Union


# ── Shared sub-models ──────────────────────────────────────────────

class Vec3(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0


class RotationDeg(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0


class Material(BaseModel):
    preset: Literal["rubber", "steel", "wood", "glass", "clay", "ice", "custom"]
    restitution: float
    friction: float
    density: float


# ── Environment ─────────────────────────────────────────────────────

class CameraPosition(BaseModel):
    x: float = 0.0
    y: float = 6.0
    z: float = 22.0


class Environment(BaseModel):
    gravity_y: float = -9.81
    background: Literal["space", "lab", "grid", "black", "white"] = "lab"
    ambient_light: float = 0.5
    show_axes: bool = True
    show_grid: bool = False
    camera_position: CameraPosition = CameraPosition()
    fog_enabled: bool = False


# ── Object type-specific fields ─────────────────────────────────────

class SphereObject(BaseModel):
    type: Literal["sphere"] = "sphere"
    id: str
    label: str
    education_note: str
    is_static: bool = False
    is_anchor: bool = False
    color: str
    position: Vec3
    radius: float
    initial_velocity: Optional[Vec3] = None
    material: Material


class BoxObject(BaseModel):
    type: Literal["box"] = "box"
    id: str
    label: str
    education_note: str
    is_static: bool = False
    is_anchor: bool = False
    color: str
    position: Vec3
    width: float
    height: float
    depth: float
    rotation_deg: RotationDeg = RotationDeg()
    initial_velocity: Vec3 = Vec3()
    material: Material


class CylinderObject(BaseModel):
    type: Literal["cylinder"] = "cylinder"
    id: str
    label: str
    education_note: str
    is_static: bool = False
    is_anchor: bool = False
    color: str
    position: Vec3
    radius: float
    height: float
    material: Material


class PlaneObject(BaseModel):
    type: Literal["plane"] = "plane"
    id: str
    label: str
    education_note: str
    is_static: bool = True
    is_anchor: bool = False
    color: str
    position: Vec3
    width: float
    depth: float
    rotation_deg: RotationDeg = RotationDeg()
    material: Material


class RampObject(BaseModel):
    type: Literal["ramp"] = "ramp"
    id: str
    label: str
    education_note: str
    is_static: bool = True
    is_anchor: bool = False
    color: str
    position: Vec3
    width: float
    height: float
    depth: float
    angle_deg: float = Field(..., ge=0, le=85)
    material: Material


class StringObject(BaseModel):
    type: Literal["string"] = "string"
    id: str
    label: str
    education_note: str
    is_static: bool = False
    is_anchor: bool = False
    color: str
    position: Vec3
    segments: int = Field(..., ge=3, le=20)
    length: float
    stiffness: float
    material: Material


class SpringObject(BaseModel):
    type: Literal["spring"] = "spring"
    id: str
    label: str
    education_note: str
    is_static: bool = False
    is_anchor: bool = False
    color: str
    position: Vec3
    spring_constant: float
    natural_length: float
    initial_extension: float = 0.0
    damping: float = 0.0
    orientation: Literal["vertical", "horizontal"] = "vertical"
    anchor_position: Vec3
    material: Material


class FluidEmitterObject(BaseModel):
    type: Literal["fluid_emitter"] = "fluid_emitter"
    id: str
    label: str
    education_note: str
    is_static: bool = False
    is_anchor: bool = False
    color: str
    position: Vec3
    emit_rate: int
    particle_radius: float
    fluid_type: Literal["water", "oil", "lava", "gas"]
    initial_velocity: Vec3 = Vec3()
    max_particles: int = Field(200, le=400)
    fluid_group_id: str
    material: Material


PhysicsObjectUnion = Union[
    SphereObject, BoxObject, CylinderObject, PlaneObject,
    RampObject, StringObject, SpringObject, FluidEmitterObject,
]


# ── Link properties (per link type) ────────────────────────────────

class RopeProperties(BaseModel):
    length: float
    stiffness: float
    damping: float
    break_force: Optional[float] = None
    show_segments: int = 8
    color: str = "#f8fafc"


class SpringLinkProperties(BaseModel):
    rest_length: float
    spring_constant: float
    damping: float
    break_force: Optional[float] = None
    show_coil: bool = True
    color: str = "#f8fafc"


class RigidRodProperties(BaseModel):
    length: float
    break_force: Optional[float] = None


class HingeProperties(BaseModel):
    axis: Literal["x", "y", "z"]
    min_angle_deg: float = -180.0
    max_angle_deg: float = 180.0
    motor_torque: Optional[float] = None


class BallSocketProperties(BaseModel):
    max_cone_angle_deg: float = 180.0


class WeldProperties(BaseModel):
    break_force: Optional[float] = None


class SliderProperties(BaseModel):
    axis: Literal["x", "y", "z"]
    min_distance: float
    max_distance: float
    friction: float = 0.0


LinkPropertiesUnion = Union[
    RopeProperties, SpringLinkProperties, RigidRodProperties,
    HingeProperties, BallSocketProperties, WeldProperties, SliderProperties,
]


# ── Link attachment ─────────────────────────────────────────────────

class AttachmentRef(BaseModel):
    id: str
    attachment_point: str
    offset: Vec3 = Vec3()


class Link(BaseModel):
    id: str
    type: Literal["rope", "spring_link", "rigid_rod", "hinge", "ball_socket", "weld", "slider"]
    label: str
    education_note: str
    object_a: AttachmentRef
    object_b: AttachmentRef
    properties: LinkPropertiesUnion


# ── Controls ────────────────────────────────────────────────────────

class Control(BaseModel):
    group: str
    label: str
    param: str = Field(..., description="Dot notation path e.g. 'bob.material.density'")
    min: float
    max: float
    default: float
    step: float
    unit: str
    education_note: str


# ── Educational sequence ────────────────────────────────────────────

class EducationalStep(BaseModel):
    step: int
    title: str
    instruction: str
    focus_objects: List[str]
    focus_controls: List[str]


# ── Top-level schema ───────────────────────────────────────────────

class PhysicsSchema(BaseModel):
    simulation_id: str
    title: str
    description: str
    physics_concept: str
    mode: Literal[1] = 1
    difficulty: Literal["beginner", "intermediate", "advanced"]
    tags: List[str]
    is_qualitative: bool = False

    environment: Environment
    objects: List[PhysicsObjectUnion] = Field(..., min_length=1, max_length=12)
    links: List[Link] = Field(default_factory=list, max_length=10)
    controls: List[Control] = Field(..., min_length=2, max_length=8)
    educational_sequence: List[EducationalStep]
