from pydantic import BaseModel, Field
from typing import List, Optional

class ObjectStyle(BaseModel):
    color: str
    geometry: str

class ObjectProperties(BaseModel):
    mass: float
    restitution: float = Field(..., description="Bounciness factor, usually between 0 and 1")
    position: List[float]
    velocity: List[float]

class PhysicsObject(BaseModel):
    id: str
    type: str = Field(..., description="'rigid', 'kinematic', or 'fixed'")
    style: ObjectStyle
    properties: ObjectProperties

class PhysicsSchema(BaseModel):
    mode: int = Field(..., description="1 for Classical (Rapier), 2 for Parameterized, 3 for Canned/Complex")
    description: str = Field(..., description="Explanation of what is happening")
    gravity: List[float] = Field(..., description="Vector representing gravity in the scene")
    objects: List[PhysicsObject]
    animation_id: Optional[str] = Field(None, description="Identifier for Mode 3 animations")
