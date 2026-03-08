"""
NewtonAI — Complete Test Harness
=================================
Tests three things separately:
  1. Schema validation  — does the JSON structurally conform?
  2. Claude reliability — does Claude fill the schema correctly across N prompts?
  3. Renderer contract  — does the validated JSON actually render without errors?

Run:
  pip install pytest boto3 pydantic py-expression-eval --break-system-packages
  pytest test_newton.py -v --tb=short
  pytest test_newton.py -v -k "test_claude" --runs=20   # stress test Claude
"""

import json
import math
import re
import time
import pytest
import boto3
from typing import Any
from py_expression_eval import Parser
from pydantic import BaseModel, ValidationError

# ═══════════════════════════════════════════════════════════════════
# 1. MINIMAL PYDANTIC MODELS
#    Just enough to catch structural errors — not the full schema
# ═══════════════════════════════════════════════════════════════════

class Vec3(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0

class Environment(BaseModel):
    gravity_y: float
    background: str
    ambient_light: float
    show_axes: bool
    show_grid: bool
    camera_position: Vec3

class ControlSlider(BaseModel):
    group: str
    label: str
    param: str
    min: float
    max: float
    default: float
    step: float
    unit: str

class SimulationPayloadBase(BaseModel):
    simulation_id: str
    title: str
    description: str
    physics_concept: str
    mode: int
    difficulty: str
    tags: list[str]
    is_qualitative: bool
    environment: Environment
    controls: list[ControlSlider]

# ═══════════════════════════════════════════════════════════════════
# 2. CROSS-REFERENCE VALIDATOR
#    Checks consistency BETWEEN fields — Pydantic can't do this
# ═══════════════════════════════════════════════════════════════════

VALID_MATERIAL_PRESETS = {"rubber", "steel", "wood", "glass", "clay", "ice", "custom", "metal"}
VALID_BACKGROUNDS      = {"space", "lab", "grid", "black", "white", "void"}
VALID_DIFFICULTIES     = {"beginner", "intermediate", "advanced"}
VALID_MODES            = {1, 2, 3}

# Mode 1 valid object types
VALID_MODE1_TYPES = {
    "sphere", "box", "cylinder", "plane", "ramp",
    "string", "spring", "fluid_emitter"
}

# Mode 2 valid object types
VALID_MODE2_TYPES = {
    "orbit_body", "wave", "spring_mass", "projectile",
    "charged_particle", "electric_field", "magnetic_field",
    "field_line", "em_wave", "resistor", "inductor",
    "capacitor", "voltage_source", "current_source",
    "ground_node", "rlc_network", "transmission_line_segment",
    "transistor_bjt", "transistor_mosfet", "op_amp"
}

# Valid attachment points per object type
ATTACHMENT_POINTS = {
    "sphere":    {"center", "top", "bottom", "left", "right", "front", "back"},
    "box":       {"center", "top_center", "bottom_center", "top_left", "top_right",
                  "bottom_left", "bottom_right", "left_center", "right_center",
                  "front_center", "back_center"},
    "cylinder":  {"center", "top_center", "bottom_center", "top_rim", "bottom_rim", "side"},
    "plane":     {"center", "top_edge", "bottom_edge", "left_edge", "right_edge"},
    "ramp":      {"top_edge", "bottom_edge", "center"},
    "string":    {"top", "bottom"},
    "spring":    {"top", "bottom"},
}

# Valid circuit terminals per component type
CIRCUIT_TERMINALS = {
    "resistor":         {"p", "n"},
    "inductor":         {"p", "n"},
    "capacitor":        {"p", "n"},
    "voltage_source":   {"p", "n"},
    "current_source":   {"p", "n"},
    "ground_node":      {"gnd"},
    "transistor_bjt":   {"base", "collector", "emitter"},
    "transistor_mosfet":{"gate", "drain", "source", "body"},
    "op_amp":           {"in_p", "in_n", "out", "vcc", "vee"},
    "rlc_network":      {"in_p", "in_n", "out_p", "out_n"},
    "transmission_line_segment": {"in_p", "in_n", "out_p", "out_n"},
}

# Equation scope variables by interaction type
EXTERNAL_VARS  = {"px","py","pz","vx","vy","vz","speed","speed2","mass","charge",
                  "radius","age","lifetime","life_frac","id_index",
                  "sx","sy","sz","r","r2","r3","r4","r_inv","dx","dy","dz","ux","uy","uz",
                  "t","dt","frame","G","k_e","c","hbar","k_B","mu_0","epsilon_0",
                  "PI","E","TAU","Bx","By","Bz","Ex","Ey","Ez"}

PAIRWISE_VARS  = EXTERNAL_VARS | {
                  "other_px","other_py","other_pz","other_vx","other_vy","other_vz",
                  "other_speed","other_mass","other_charge","other_radius",
                  "other_r","other_r2","other_r3","other_dx","other_dy","other_dz"}

BONDED_VARS    = PAIRWISE_VARS | {"rest_length","bond_stretch","bond_strain","bond_length"}

PAIRWISE_ONLY  = PAIRWISE_VARS - EXTERNAL_VARS
BONDED_ONLY    = BONDED_VARS   - PAIRWISE_VARS
EXTERNAL_ONLY  = {"r","r2","r3","r4","r_inv","dx","dy","dz","sx","sy","sz","ux","uy","uz"}


def validate_cross_references(payload: dict) -> list[str]:
    """Check consistency between fields. Returns list of error strings."""
    errors = []

    # ── Basic field checks ──────────────────────────────────────────
    if payload.get("mode") not in VALID_MODES:
        errors.append(f"mode={payload.get('mode')} is not valid. Must be 1, 2, or 3.")

    if payload.get("difficulty") not in VALID_DIFFICULTIES:
        errors.append(f"difficulty='{payload.get('difficulty')}' not in {VALID_DIFFICULTIES}")

    env = payload.get("environment", {})
    if env.get("background") not in VALID_BACKGROUNDS:
        errors.append(f"environment.background='{env.get('background')}' not valid.")

    # ── Collect all defined ids ─────────────────────────────────────
    objects       = payload.get("objects", [])
    particles     = payload.get("particles", [])
    groups        = payload.get("particle_groups", [])
    forces        = payload.get("forces", [])
    links         = payload.get("links", [])
    circuit_links = payload.get("circuit_links", [])
    controls      = payload.get("controls", [])

    object_ids  = {o["id"] for o in objects  if "id" in o}
    particle_ids= {p["id"] for p in particles if "id" in p}
    group_ids   = {g["id"] for g in groups   if "id" in g}
    force_ids   = {f["id"] for f in forces   if "id" in f}
    link_ids    = {l["id"] for l in links    if "id" in l}
    all_ids     = object_ids | particle_ids | group_ids

    # ── Mode 1: Object type validation ─────────────────────────────
    mode = payload.get("mode")
    if mode == 1:
        for obj in objects:
            if obj.get("type") not in VALID_MODE1_TYPES:
                errors.append(
                    f"Object '{obj.get('id')}' has invalid type='{obj.get('type')}' "
                    f"for Mode 1. Valid: {VALID_MODE1_TYPES}"
                )
            mat = obj.get("material", {})
            if mat.get("preset") and mat["preset"] not in VALID_MATERIAL_PRESETS:
                errors.append(
                    f"Object '{obj.get('id')}' material.preset='{mat['preset']}' "
                    f"is not valid. Valid: {VALID_MATERIAL_PRESETS}"
                )

    # ── Mode 1: Link structure validation ──────────────────────────
    if mode == 1:
        for link in links:
            lid = link.get("id", "?")

            # Check object_a/b are full objects, not plain strings
            for side in ["object_a", "object_b"]:
                val = link.get(side)
                if isinstance(val, str):
                    errors.append(
                        f"Link '{lid}' {side}='{val}' is a plain string. "
                        f"Must be {{id, attachment_point, offset}} object."
                    )
                elif isinstance(val, dict):
                    ref_id = val.get("id")
                    if ref_id and ref_id not in all_ids:
                        errors.append(
                            f"Link '{lid}' {side}.id='{ref_id}' does not exist in objects."
                        )
                    # Check attachment_point validity
                    obj_type = next(
                        (o.get("type") for o in objects if o.get("id") == ref_id),
                        None
                    )
                    ap = val.get("attachment_point")
                    if obj_type and ap and obj_type in ATTACHMENT_POINTS:
                        if ap not in ATTACHMENT_POINTS[obj_type]:
                            errors.append(
                                f"Link '{lid}' {side}.attachment_point='{ap}' "
                                f"is not valid for type='{obj_type}'. "
                                f"Valid: {ATTACHMENT_POINTS[obj_type]}"
                            )

            # Check properties exist
            props = link.get("properties")
            if props is None:
                errors.append(
                    f"Link '{lid}' has no 'properties' field. "
                    f"Must include properties: {{length, stiffness, damping, ...}}."
                )
            else:
                # Check stiffness for pendulums (common mistake)
                link_type = link.get("type", "")
                if link_type == "rope":
                    stiffness = props.get("stiffness", 1.0) if isinstance(props, dict) else 1.0
                    if stiffness < 100:
                        errors.append(
                            f"Link '{lid}' type='rope' has properties.stiffness={stiffness}. "
                            f"This is very elastic — bobs will fall through the floor. "
                            f"Use stiffness >= 800 for inextensible ropes/rods."
                        )

                    # Check geometry: length vs actual distance
                    length = props.get("length", 0) if isinstance(props, dict) else 0
                    if isinstance(link.get("object_a"), dict) and isinstance(link.get("object_b"), dict):
                        id_a = link["object_a"].get("id")
                        id_b = link["object_b"].get("id")
                        obj_a = next((o for o in objects if o.get("id") == id_a), None)
                        obj_b = next((o for o in objects if o.get("id") == id_b), None)
                        if obj_a and obj_b and length > 0:
                            pa = obj_a.get("position", {})
                            pb = obj_b.get("position", {})
                            dist = math.sqrt(
                                (pa.get("x",0)-pb.get("x",0))**2 +
                                (pa.get("y",0)-pb.get("y",0))**2 +
                                (pa.get("z",0)-pb.get("z",0))**2
                            )
                            if abs(dist - length) / max(length, 0.01) > 0.3:
                                errors.append(
                                    f"Link '{lid}' properties.length={length:.2f} but actual distance "
                                    f"between '{id_a}' and '{id_b}' = {dist:.2f}. "
                                    f"Difference is {abs(dist-length)/max(length,0.01)*100:.1f}% — "
                                    f"will cause impulse at simulation start."
                                )

    # ── Mode 2: Circuit link validation ────────────────────────────
    if mode == 2:
        obj_type_map = {o["id"]: o["type"] for o in objects if "id" in o and "type" in o}

        for cl in circuit_links:
            clid = cl.get("id", "?")
            for side_id, side_term in [
                (cl.get("node_a_id"), cl.get("node_a_terminal")),
                (cl.get("node_b_id"), cl.get("node_b_terminal")),
            ]:
                if side_id and side_id not in object_ids:
                    errors.append(
                        f"circuit_link '{clid}' references '{side_id}' "
                        f"which does not exist in objects."
                    )
                    continue
                obj_type = obj_type_map.get(side_id)
                if obj_type and side_term and obj_type in CIRCUIT_TERMINALS:
                    if side_term not in CIRCUIT_TERMINALS[obj_type]:
                        errors.append(
                            f"circuit_link '{clid}' uses terminal='{side_term}' "
                            f"on '{side_id}' (type='{obj_type}'). "
                            f"Valid terminals: {CIRCUIT_TERMINALS[obj_type]}"
                        )

        # Check circuit topology: every non-ground node should have
        # at least one incoming and one outgoing connection
        node_connections: dict[str, list] = {}
        for cl in circuit_links:
            a = cl.get("node_a_id")
            b = cl.get("node_b_id")
            if a:
                node_connections.setdefault(a, []).append(b)
            if b:
                node_connections.setdefault(b, []).append(a)
        for oid in object_ids:
            obj_type = obj_type_map.get(oid)
            if obj_type == "ground_node":
                continue
            conns = node_connections.get(oid, [])
            if len(conns) < 2:
                errors.append(
                    f"Object '{oid}' (type='{obj_type}') has only {len(conns)} "
                    f"circuit_link connection(s). Components need at least 2 connections "
                    f"(one per terminal) to be part of a circuit."
                )

    # ── Mode 3: Force validation ────────────────────────────────────
    if mode == 3:
        # Check applied_forces in particles reference real force ids
        for p in particles:
            pid = p.get("id", "?")
            for fid in p.get("applied_forces", []):
                if fid not in force_ids:
                    errors.append(
                        f"Particle '{pid}' applied_forces includes '{fid}' "
                        f"which does not exist in forces array."
                    )

        # Check group particle_template applied_forces
        for g in groups:
            gid = g.get("id", "?")
            tmpl = g.get("particle_template", {})
            for fid in tmpl.get("applied_forces", []):
                if fid not in force_ids:
                    errors.append(
                        f"Group '{gid}' particle_template.applied_forces includes '{fid}' "
                        f"which does not exist in forces array."
                    )

        # Check force source_ids exist
        for f in forces:
            fid = f.get("id", "?")
            src = f.get("source_id")
            if src and src not in all_ids:
                errors.append(
                    f"Force '{fid}' source_id='{src}' does not exist "
                    f"in particles or groups."
                )

        # Check interaction_type vs scope variables in free equations
        for f in forces:
            if f.get("use_template"):
                continue
            fid = f.get("id", "?")
            itype = f.get("interaction_type", "")
            for axis in ["force_x", "force_y", "force_z"]:
                eq = f.get(axis, "")
                if not eq:
                    errors.append(f"Force '{fid}' missing equation '{axis}'.")
                    continue
                if itype == "external":
                    for var in PAIRWISE_ONLY | BONDED_ONLY:
                        if re.search(r'\b' + var + r'\b', eq):
                            errors.append(
                                f"Force '{fid}' (external) equation '{axis}' "
                                f"uses pairwise/bonded variable '{var}'. "
                                f"Not available for external forces."
                            )
                elif itype == "pairwise":
                    for var in EXTERNAL_ONLY | BONDED_ONLY:
                        if re.search(r'\b' + var + r'\b', eq):
                            errors.append(
                                f"Force '{fid}' (pairwise) equation '{axis}' "
                                f"uses external/bonded variable '{var}'."
                            )

    # ── Controls: param paths point to real fields ──────────────────
    for ctrl in controls:
        param = ctrl.get("param", "")
        parts = param.split(".")
        if len(parts) < 2:
            errors.append(
                f"Control '{ctrl.get('label')}' param='{param}' "
                f"has no dot notation — cannot resolve to a field."
            )
            continue
        # First part should be a known object id or 'environment'
        root = parts[0]
        known_roots = all_ids | {"environment", "forces", "physics_links",
                                  "circuit_links", "named_forces", "free_equations"}
        if root not in known_roots:
            errors.append(
                f"Control '{ctrl.get('label')}' param='{param}' "
                f"root '{root}' does not match any object id or 'environment'."
            )
        # Check default is within min/max
        mn = ctrl.get("min", 0)
        mx = ctrl.get("max", 0)
        df = ctrl.get("default", 0)
        if not (mn <= df <= mx):
            errors.append(
                f"Control '{ctrl.get('label')}' default={df} is outside "
                f"[min={mn}, max={mx}]."
            )

    return errors


# ═══════════════════════════════════════════════════════════════════
# 3. EQUATION DRY-RUN VALIDATOR
# ═══════════════════════════════════════════════════════════════════

SAFE_SCOPE = {
    # self
    "px":0.0,"py":5.0,"pz":0.0,"vx":1.0,"vy":-2.0,"vz":0.0,
    "speed":2.24,"speed2":5.0,"mass":1.0,"charge":1.0,"radius":0.5,
    "age":1.0,"lifetime":10.0,"life_frac":0.1,"id_index":3,
    # source geometry
    "sx":0.0,"sy":0.0,"sz":0.0,
    "r":5.0,"r2":25.0,"r3":125.0,"r4":625.0,"r_inv":0.2,
    "dx":0.0,"dy":1.0,"dz":0.0,
    "ux":0.0,"uy":5.0,"uz":0.0,
    # pairwise
    "other_px":2.0,"other_py":3.0,"other_pz":0.0,
    "other_vx":-1.0,"other_vy":1.0,"other_vz":0.0,"other_speed":1.41,
    "other_mass":2.0,"other_charge":-1.0,"other_radius":0.3,
    "other_r":3.0,"other_r2":9.0,"other_r3":27.0,
    "other_dx":0.67,"other_dy":0.33,"other_dz":0.0,
    # bonded
    "rest_length":2.0,"bond_stretch":0.5,"bond_strain":0.25,"bond_length":2.5,
    # time
    "t":1.5,"dt":0.016,"frame":90,
    # fields
    "Bx":0.0,"By":0.1,"Bz":0.0,"Ex":1.0,"Ey":0.0,"Ez":0.0,
    # constants
    "G":6.674e-11,"k_e":8.99e9,"c":3e8,"hbar":1.055e-34,
    "k_B":1.38e-23,"mu_0":1.257e-6,"epsilon_0":8.854e-12,
    "PI":3.14159,"E":2.71828,"TAU":6.28318,
    # common custom_params
    "G_s":500.0,"M":1e12,"soft":0.5,"k_s":1000.0,
    "A":100.0,"lambda":5.0,"eps":1.0,"sig":1.0,
    "rho":1.225,"Cd":0.47,"k_B_s":1.0,"T":300.0,
    "c_s":15.0,"I_s":100.0,"lx":1.0,"ly":0.0,"lz":0.0,
    "Bx_s":0.0,"By_s":0.1,"Bz_s":0.0,
    "n":3.0,"omega":3.14,"neg_mass":-500.0,
}

def validate_equations(payload: dict) -> list[str]:
    """Dry-run all free equations with safe dummy values."""
    errors = []
    parser = Parser()
    forces = payload.get("forces", [])

    for force in forces:
        if force.get("use_template"):
            continue
        fid = force.get("id", "?")
        scope = {**SAFE_SCOPE, **force.get("params", {})}

        for axis in ["force_x", "force_y", "force_z"]:
            eq = force.get(axis, "")
            if not eq:
                errors.append(f"Force '{fid}' missing equation '{axis}'.")
                continue
            try:
                result = parser.parse(eq).evaluate(scope)
                if not isinstance(result, (int, float)):
                    errors.append(
                        f"Force '{fid}' equation '{axis}' returned "
                        f"non-numeric type {type(result).__name__}: {result}"
                    )
                if math.isnan(result) or math.isinf(result):
                    errors.append(
                        f"Force '{fid}' equation '{axis}' returned "
                        f"{'NaN' if math.isnan(result) else 'Inf'} "
                        f"with safe test values. Check for division by zero. "
                        f"Equation: {eq}"
                    )
            except Exception as ex:
                errors.append(
                    f"Force '{fid}' equation '{axis}' failed evaluation: {ex}\n"
                    f"  Equation: {eq}\n"
                    f"  Hint: check variable names against EQUATION_SCOPE"
                )
    return errors


# ═══════════════════════════════════════════════════════════════════
# 4. PHYSICS SANITY CHECKS
#    Not structural — checks if values make physical sense
# ═══════════════════════════════════════════════════════════════════

def validate_physics_sanity(payload: dict) -> list[str]:
    """Catch physically nonsensical values that won't crash but will look wrong."""
    warnings = []
    mode = payload.get("mode")
    env  = payload.get("environment", {})
    objects = payload.get("objects", [])

    # ── Gravity checks ───────────────────────────────────────────
    gy = env.get("gravity_y", -9.81)
    if mode in (1, 2) and gy > 0:
        warnings.append(
            f"gravity_y={gy} is positive (upward). "
            f"Objects will fall UP. Intentional?"
        )
    if mode in (1, 2) and gy == 0 and "space" not in env.get("background",""):
        warnings.append(
            f"gravity_y=0 but background is not 'space'. "
            f"Objects will float in a lab environment. Intentional?"
        )

    # ── Restitution checks ───────────────────────────────────────
    for obj in objects:
        mat = obj.get("material", {})
        r = mat.get("restitution", 0)
        if r > 1.0:
            warnings.append(
                f"Object '{obj.get('id')}' restitution={r} > 1.0. "
                f"This adds energy on each bounce — physically impossible. "
                f"Objects will bounce HIGHER each time."
            )
        if r < 0:
            warnings.append(
                f"Object '{obj.get('id')}' restitution={r} < 0. "
                f"Negative restitution is undefined behavior in Rapier."
            )

    # ── Resonant frequency check for RLC ─────────────────────────
    if mode == 2:
        inductors   = [o for o in objects if o.get("type") == "inductor"]
        capacitors  = [o for o in objects if o.get("type") == "capacitor"]
        sources     = [o for o in objects if o.get("type") == "voltage_source"]
        if inductors and capacitors and sources:
            L  = inductors[0].get("inductance", 0)
            C  = capacitors[0].get("capacitance", 0)
            f_src = sources[0].get("ac_frequency", 0)
            if L > 0 and C > 0:
                f0 = 1 / (2 * math.pi * math.sqrt(L * C))
                if f_src > 0:
                    ratio = f_src / f0
                    if ratio < 0.05 or ratio > 20:
                        warnings.append(
                            f"Source frequency {f_src:.1f} Hz is far from "
                            f"resonance f₀ = {f0:.1f} Hz (ratio={ratio:.2f}). "
                            f"Resonance demo will not show resonance at default settings."
                        )
                    else:
                        warnings.append(
                            f"✓ PHYSICS OK: f₀ = 1/(2π√LC) = {f0:.1f} Hz, "
                            f"source = {f_src:.1f} Hz, ratio = {ratio:.3f}"
                        )

    # ── Link stiffness warnings ───────────────────────────────────
    for link in payload.get("links", []):
        props = link.get("properties", {})
        stiffness = props.get("stiffness", 950) if isinstance(props, dict) else 950
        ltype = link.get("type", "")
        if ltype == "rope" and stiffness < 100:
            warnings.append(
                f"Link '{link.get('id')}' stiffness={stiffness} is very low. "
                f"Rope will be elastic, not rigid. Pendulum dynamics will be wrong."
            )

    return warnings


# ═══════════════════════════════════════════════════════════════════
# 5. FULL VALIDATION PIPELINE
# ═══════════════════════════════════════════════════════════════════

def validate_payload(payload: dict) -> dict:
    """
    Run all validators. Returns:
    {
        "structural_errors": [...],   # Pydantic
        "reference_errors":  [...],   # cross-reference
        "equation_errors":   [...],   # expr-eval dry run
        "physics_warnings":  [...],   # sanity checks
        "passed": bool
    }
    """
    structural_errors = []
    try:
        SimulationPayloadBase(**payload)
    except ValidationError as e:
        for err in e.errors():
            loc = ".".join(str(l) for l in err["loc"])
            structural_errors.append(f"{loc}: {err['msg']}")

    reference_errors = validate_cross_references(payload)
    equation_errors  = validate_equations(payload)
    physics_warnings = validate_physics_sanity(payload)

    passed = not structural_errors and not reference_errors and not equation_errors

    return {
        "structural_errors": structural_errors,
        "reference_errors":  reference_errors,
        "equation_errors":   equation_errors,
        "physics_warnings":  physics_warnings,
        "passed": passed,
    }


### 6. LLM RELIABILITY TEST HARNESS
#    Calls Bedrock N times with the same prompt, measures pass rate
# ═══════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = """You are a physics simulation engine. Output RAW JSON only.
No markdown. No backticks. No explanation.
First character must be { last must be }.
Fill the NewtonAI simulation schema for the given prompt."""

def call_llm(prompt: str, system: str = SYSTEM_PROMPT) -> tuple[dict | None, str]:
    """Call Amazon Nova Pro via Bedrock. Returns (parsed_dict, raw_text)."""
    client = boto3.client("bedrock-runtime", region_name="us-east-1")
    try:
        response = client.invoke_model(
            modelId="amazon.nova-pro-v1:0",
            body=json.dumps({
                "system": [{"text": system}],
                "messages": [
                    {
                        "role": "user",
                        "content": [{"text": prompt}]
                    }
                ],
                "inferenceConfig": {
                    "max_new_tokens": 8192
                }
            }),
        )
        raw = json.loads(response["body"].read())
        text = raw["output"]["message"]["content"][0]["text"].strip()
        # Strip any accidental markdown fences
        text = re.sub(r'^```[a-z]*\n?', '', text)
        text = re.sub(r'\n?```$', '', text)
        try:
            return json.loads(text), text
        except json.JSONDecodeError as e:
            return None, f"JSON_PARSE_ERROR: {e}\nRaw: {text[:500]}"
    except Exception as e:
        return None, f"BEDROCK_ERROR: {e}"


# ═══════════════════════════════════════════════════════════════════
# 7. PYTEST TEST SUITE
# ═══════════════════════════════════════════════════════════════════

# ── Static fixture payloads ──────────────────────────────────────

VALID_MODE1_PAYLOAD = {
    "simulation_id": "test-bouncing-ball",
    "title": "Bouncing Ball",
    "description": "A rubber ball dropped from height.",
    "physics_concept": "Coefficient of Restitution",
    "mode": 1,
    "difficulty": "beginner",
    "tags": ["gravity", "collision"],
    "is_qualitative": False,
    "environment": {
        "gravity_y": -9.81,
        "background": "lab",
        "ambient_light": 0.5,
        "show_axes": True,
        "show_grid": False,
        "camera_position": {"x": 0, "y": 4, "z": 14},
    },
    "objects": [
        {
            "type": "plane", "id": "floor", "is_static": True, "is_anchor": False,
            "color": "#f8fafc", "position": {"x":0,"y":0,"z":0},
            "width": 20, "depth": 10,
            "rotation_deg": {"x":0,"y":0,"z":0},
            "material": {"preset": "wood", "restitution": 0.4, "friction": 0.6, "density": 1.0},
            "label": "Floor", "education_note": "The floor.",
        },
        {
            "type": "sphere", "id": "ball", "is_static": False, "is_anchor": False,
            "color": "#3b82f6", "position": {"x":0,"y":8,"z":0},
            "radius": 0.5,
            "material": {"preset": "rubber", "restitution": 0.8, "friction": 0.5, "density": 1.2},
            "label": "Ball", "education_note": "The ball.",
        },
    ],
    "links": [],
    "controls": [
        {"group": "Ball", "label": "Gravity", "param": "environment.gravity_y",
         "min": -20, "max": -0.1, "default": -9.81, "step": 0.1, "unit": "m/s²",
         "education_note": "Gravity."},
    ],
}

BROKEN_STIFFNESS_PAYLOAD = {
    **VALID_MODE1_PAYLOAD,
    "simulation_id": "test-broken-stiffness",
    "objects": VALID_MODE1_PAYLOAD["objects"],
    "links": [
        {
            "type": "rope", "id": "rod1",
            "label": "Test Rod", "education_note": "Test",
            "object_a": {"id": "floor", "attachment_point": "center", "offset": {"x":0,"y":0,"z":0}},
            "object_b": {"id": "ball",  "attachment_point": "top",    "offset": {"x":0,"y":0,"z":0}},
            "properties": {
                "length": 8.0,
                "stiffness": 1.0,  # ← intentionally broken
                "damping": 0,
                "break_force": None,
                "show_segments": 2,
                "color": "#fff",
            },
        }
    ],
}

BROKEN_CIRCUIT_PAYLOAD = {
    "simulation_id": "test-broken-circuit",
    "title": "Broken RLC", "description": "Test.", "physics_concept": "RLC",
    "mode": 2, "difficulty": "beginner", "tags": [], "is_qualitative": False,
    "environment": {
        "gravity_y": 0, "background": "black", "ambient_light": 0.5,
        "show_axes": False, "show_grid": False,
        "camera_position": {"x":0,"y":0,"z":10},
    },
    "objects": [
        {"type": "voltage_source", "id": "vs1", "source_type": "ac_sine",
         "dc_voltage": 0, "ac_amplitude": 10, "ac_frequency": 1000,
         "position": {"x":-3,"y":0,"z":0}, "color": "#eab308",
         "label": "VS", "education_note": ""},
        {"type": "resistor", "id": "r1", "resistance": 100,
         "position": {"x":0,"y":0,"z":0}, "color": "#ef4444",
         "label": "R", "education_note": ""},
        {"type": "ground_node", "id": "gnd", "position": {"x":-3,"y":-2,"z":0}},
    ],
    "circuit_links": [
        # r1 only has ONE connection — should trigger topology error
        {"type": "wire", "id": "w1", "node_a_id": "vs1", "node_a_terminal": "p",
         "node_b_id": "r1", "node_b_terminal": "p",
         "wire_routing": "manhattan", "show_current": True, "show_voltage": False, "color": "#fff"},
        {"type": "wire", "id": "w2", "node_a_id": "gnd", "node_a_terminal": "gnd",
         "node_b_id": "vs1", "node_b_terminal": "n",
         "wire_routing": "manhattan", "show_current": False, "show_voltage": False, "color": "#fff"},
    ],
    "physics_links": [],
    "controls": [],
}

VALID_FREE_EQ_PAYLOAD = {
    "simulation_id": "test-free-eq",
    "title": "1/r³ Gravity", "description": "Test.", "physics_concept": "Custom",
    "mode": 3, "difficulty": "advanced", "tags": [], "is_qualitative": False,
    "environment": {
        "gravity_y": 0, "background": "space", "ambient_light": 0.3,
        "show_axes": True, "show_grid": False,
        "camera_position": {"x":0,"y":30,"z":0},
    },
    "forces": [
        {
            "id": "f_r3",
            "label": "1/r³ Gravity",
            "interaction_type": "external",
            "use_template": False,
            "applies_to": "orbiter",
            "source_id": "center_particle",
            "force_x": "-(G_s * M * mass / r3) * dx",
            "force_y": "-(G_s * M * mass / r3) * dy",
            "force_z": "-(G_s * M * mass / r3) * dz",
            "params": {"G_s": 500, "M": 1e10},
            "enabled": True,
            "strength_multiplier": 1.0,
            "is_hypothetical": True,
            "reference_equation": "F = -GMm/r³",
            "variables_used": ["r3", "dx", "dy", "dz", "mass"],
            "education_note": "Hypothetical 1/r³ law."
        }
    ],
    "particles": [
        {
            "id": "center_particle", "label": "Center", "education_note": "",
            "position": {"x":0,"y":0,"z":0}, "velocity": {"x":0,"y":0,"z":0},
            "mass": 1e10, "charge": 0, "radius": 2.0, "color": "#eab308",
            "opacity": 1.0, "emissive": True, "emissive_intensity": 3.0,
            "shape": "sphere", "trail_length": 0, "tags": ["source"],
            "group_id": None, "pinned": True, "collision": False,
            "applied_forces": ["f_r3"], "applied_links": [],
        }
    ],
    "particle_groups": [],
    "emitters": [],
    "links": [],
    "controls": [],
}

BROKEN_EQ_PAYLOAD = {
    **VALID_FREE_EQ_PAYLOAD,
    "simulation_id": "test-broken-eq",
    "forces": [
        {
            **VALID_FREE_EQ_PAYLOAD["forces"][0],
            "id": "f_broken",
            # ← wrong variable: uses 'other_dx' in an external force
            "force_x": "-(G_s * M * mass / r3) * other_dx",
            "force_y": "-(G_s * M * mass / r3) * other_dy",
            "force_z": "-(G_s * M * mass / r3) * other_dz",
        }
    ],
    "particles": [{
        **VALID_FREE_EQ_PAYLOAD["particles"][0],
        "applied_forces": ["f_broken"],
    }],
}


# ── Test classes ─────────────────────────────────────────────────

class TestSchemaValidation:
    """Tests for static payload validation — no Bedrock calls."""

    def test_valid_mode1_passes(self):
        result = validate_payload(VALID_MODE1_PAYLOAD)
        assert result["passed"], (
            f"Valid payload failed validation:\n"
            f"  structural: {result['structural_errors']}\n"
            f"  reference:  {result['reference_errors']}\n"
            f"  equations:  {result['equation_errors']}"
        )

    def test_broken_stiffness_caught(self):
        result = validate_payload(BROKEN_STIFFNESS_PAYLOAD)
        ref_errors = result["reference_errors"]
        stiffness_errors = [e for e in ref_errors if "stiffness" in e.lower()]
        assert stiffness_errors, (
            f"Stiffness=1.0 on rope should be caught. Got: {ref_errors}"
        )

    def test_broken_circuit_topology_caught(self):
        result = validate_payload(BROKEN_CIRCUIT_PAYLOAD)
        ref_errors = result["reference_errors"]
        topology_errors = [e for e in ref_errors if "connection" in e.lower()]
        assert topology_errors, (
            f"Incomplete circuit topology should be caught. Got: {ref_errors}"
        )

    def test_valid_free_equation_passes(self):
        result = validate_payload(VALID_FREE_EQ_PAYLOAD)
        assert not result["equation_errors"], (
            f"Valid equation failed: {result['equation_errors']}"
        )

    def test_broken_equation_scope_caught(self):
        result = validate_payload(BROKEN_EQ_PAYLOAD)
        ref_errors = result["reference_errors"]
        scope_errors = [e for e in ref_errors if "other_dx" in e or "pairwise" in e.lower()]
        assert scope_errors, (
            f"Wrong scope variable 'other_dx' in external force should be caught. "
            f"Got: {ref_errors}"
        )

    def test_link_plain_string_caught(self):
        bad = {
            **VALID_MODE1_PAYLOAD,
            "simulation_id": "test-plain-string-link",
            "links": [{
                "type": "rope", "id": "r1",
                "label": "Test", "education_note": "",
                "object_a": "floor",  # ← plain string, should fail
                "object_b": "ball",
                "properties": {
                    "length": 8.0, "stiffness": 950,
                    "damping": 0, "break_force": None,
                    "show_segments": 2, "color": "#fff",
                },
            }]
        }
        result = validate_payload(bad)
        link_errors = [e for e in result["reference_errors"] if "plain string" in e]
        assert link_errors, f"Plain string link should be caught. Got: {result['reference_errors']}"

    def test_control_default_out_of_range_caught(self):
        bad = {
            **VALID_MODE1_PAYLOAD,
            "simulation_id": "test-bad-control-default",
            "controls": [{
                "group": "Test", "label": "Bad Control",
                "param": "environment.gravity_y",
                "min": -20, "max": -5,
                "default": -1,  # ← outside min/max
                "step": 0.1, "unit": "m/s²", "education_note": ""
            }]
        }
        result = validate_payload(bad)
        ctrl_errors = [e for e in result["reference_errors"] if "default" in e.lower()]
        assert ctrl_errors, f"Default out of range should be caught. Got: {result['reference_errors']}"

    def test_resonance_frequency_sanity(self):
        result = validate_payload(VALID_MODE1_PAYLOAD)
        # Physics warnings should not crash
        assert isinstance(result["physics_warnings"], list)


class TestNovaProReliability:
    """
    Tests Nova Pro's JSON generation reliability.
    These call Bedrock — skip with pytest -k "not test_nova" if no AWS credentials.
    """

    PROMPTS_MODE1 = [
        "show me a bouncing rubber ball",
        "simulate a pendulum",
        "two blocks colliding on a frictionless surface",
        "a ball rolling down a ramp",
        "atwood machine with two blocks over a pulley",
    ]

    PROMPTS_MODE2 = [
        "series RLC circuit at resonance",
        "earth orbiting the sun",
        "a charged particle in a magnetic field",
        "wave interference between two sources",
    ]

    PROMPTS_EDGE = [
        "neutron star merger",
        "show me quantum entanglement",
        "simulate a nuclear reactor",
        "what if gravity was repulsive",
        "show me how a gecko climbs a wall",
    ]

    def _run_prompt_n_times(self, prompt: str, n: int = 5) -> dict:
        """Run a prompt N times, collect pass/fail stats."""
        results = {
            "prompt": prompt,
            "runs": n,
            "parse_failures": 0,
            "validation_failures": 0,
            "passes": 0,
            "errors_seen": [],
        }
        for i in range(n):
            payload, raw = call_llm(prompt)
            if payload is None:
                results["parse_failures"] += 1
                results["errors_seen"].append(f"Run {i+1}: PARSE_FAIL: {raw[:200]}")
                time.sleep(1)
                continue
            result = validate_payload(payload)
            if result["passed"]:
                results["passes"] += 1
            else:
                results["validation_failures"] += 1
                all_errors = (
                    result["structural_errors"] +
                    result["reference_errors"] +
                    result["equation_errors"]
                )
                results["errors_seen"].append(f"Run {i+1}: {all_errors[:3]}")
            time.sleep(0.5)  # rate limit

        results["pass_rate"] = results["passes"] / n
        return results

    @pytest.mark.parametrize("prompt", PROMPTS_MODE1)
    def test_nova_mode1_reliability(self, prompt):
        """Nova Pro should pass validation >= 80% of the time on standard Mode 1 prompts."""
        result = self._run_prompt_n_times(prompt, n=5)
        assert result["pass_rate"] >= 0.8, (
            f"Claude pass rate {result['pass_rate']*100:.0f}% < 80% for:\n"
            f"  Prompt: '{prompt}'\n"
            f"  Errors seen: {result['errors_seen']}"
        )

    @pytest.mark.parametrize("prompt", PROMPTS_MODE2)
    def test_nova_mode2_reliability(self, prompt):
        """Nova Pro should pass validation >= 70% of the time on Mode 2 prompts."""
        result = self._run_prompt_n_times(prompt, n=5)
        assert result["pass_rate"] >= 0.7, (
            f"Claude pass rate {result['pass_rate']*100:.0f}% < 70% for:\n"
            f"  Prompt: '{prompt}'\n"
            f"  Errors: {result['errors_seen']}"
        )

    @pytest.mark.parametrize("prompt", PROMPTS_EDGE)
    def test_nova_edge_cases_dont_crash(self, prompt):
        """Edge case prompts should not produce completely unparseable output."""
        payload, raw = call_llm(prompt)
        assert payload is not None, (
            f"Claude produced unparseable output for edge case:\n"
            f"  Prompt: '{prompt}'\n"
            f"  Raw: {raw[:500]}"
        )

    def test_nova_never_uses_eval(self):
        """Nova Pro's free equations should never contain JS eval or dangerous patterns."""
        dangerous_patterns = [
            r'\beval\b', r'\bFunction\b', r'\bwindow\b',
            r'\bdocument\b', r'\brequire\b', r'\bimport\b',
            r'__proto__', r'constructor',
        ]
        prompt = "create a hypothetical gravity simulation where force is 1/r^4"
        payload, raw = call_llm(prompt)
        if payload is None:
            pytest.skip("Claude call failed")
        forces = payload.get("forces", [])
        for f in forces:
            for axis in ["force_x", "force_y", "force_z"]:
                eq = f.get(axis, "")
                for pattern in dangerous_patterns:
                    assert not re.search(pattern, eq), (
                        f"Dangerous pattern '{pattern}' found in equation: {eq}"
                    )


class TestRendererContract:
    """
    Tests that validated payloads contain everything the renderer needs.
    No rendering — just contract checks.
    """

    def test_mode1_has_floor(self):
        """Every Mode 1 simulation should have at least one static plane."""
        objects = VALID_MODE1_PAYLOAD.get("objects", [])
        static_planes = [
            o for o in objects
            if o.get("type") == "plane" and o.get("is_static") == True
        ]
        assert static_planes, "Mode 1 simulation has no static floor plane."

    def test_mode1_camera_not_inside_objects(self):
        """Camera should not be inside any object."""
        cam = VALID_MODE1_PAYLOAD["environment"]["camera_position"]
        objects = VALID_MODE1_PAYLOAD.get("objects", [])
        for obj in objects:
            pos = obj.get("position", {})
            radius = obj.get("radius", 0.5)
            dist = math.sqrt(
                (cam.get("x",0)-pos.get("x",0))**2 +
                (cam.get("y",0)-pos.get("y",0))**2 +
                (cam.get("z",0)-pos.get("z",0))**2
            )
            assert dist > radius, (
                f"Camera is inside object '{obj.get('id')}' "
                f"(dist={dist:.2f} < radius={radius})"
            )

    def test_all_control_params_resolvable(self):
        """All control param paths must start with a known object id or 'environment'."""
        result = validate_payload(VALID_MODE1_PAYLOAD)
        param_errors = [
            e for e in result["reference_errors"]
            if "param" in e.lower() or "root" in e.lower()
        ]
        assert not param_errors, f"Unresolvable control params: {param_errors}"

    def test_simulation_id_is_slug(self):
        """simulation_id must be lowercase hyphenated (URL-safe)."""
        sid = VALID_MODE1_PAYLOAD["simulation_id"]
        assert re.match(r'^[a-z0-9-]+$', sid), (
            f"simulation_id='{sid}' is not a valid lowercase hyphenated slug."
        )

    def test_mode2_gravity_is_zero(self):
        """Mode 2 simulations should have gravity_y=0."""
        env = BROKEN_CIRCUIT_PAYLOAD.get("environment", {})
        assert env.get("gravity_y") == 0, (
            f"Mode 2 simulation has gravity_y={env.get('gravity_y')}. "
            f"Should be 0 — Mode 2 uses useFrame math, not Rapier."
        )


class TestRegressionSuite:
    """
    Load known-good payloads and verify they still pass.
    Add every new verified simulation here.
    """

    KNOWN_GOOD_PAYLOADS = [
        VALID_MODE1_PAYLOAD,
        VALID_FREE_EQ_PAYLOAD,
    ]

    @pytest.mark.parametrize("payload", KNOWN_GOOD_PAYLOADS)
    def test_known_good_still_passes(self, payload):
        """Regression: previously verified payloads should still pass."""
        result = validate_payload(payload)
        assert result["passed"], (
            f"Known-good payload '{payload.get('simulation_id')}' "
            f"now fails validation:\n"
            f"  structural: {result['structural_errors']}\n"
            f"  reference:  {result['reference_errors']}\n"
            f"  equations:  {result['equation_errors']}"
        )

    def test_no_known_bad_payloads_pass(self):
        """Anti-regression: known broken payloads should still fail."""
        known_bad = [BROKEN_STIFFNESS_PAYLOAD, BROKEN_EQ_PAYLOAD]
        for payload in known_bad:
            result = validate_payload(payload)
            assert not result["passed"], (
                f"Known-bad payload '{payload.get('simulation_id')}' "
                f"is now passing validation — validator may have regressed."
            )


# ═══════════════════════════════════════════════════════════════════
# 9. CLI RUNNER — validate any JSON file directly
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python test_newton.py <payload.json>")
        print("       python test_newton.py --prompt 'show me a pendulum'")
        sys.exit(1)

    if sys.argv[1] == "--prompt":
        prompt = sys.argv[2]
        print(f"\n🤖 Calling Nova Pro: '{prompt}'")
        payload, raw = call_llm(prompt)
        if payload is None:
            print(f"❌ Nova Pro failed: {raw}")
            sys.exit(1)
        print("✓ Nova Pro returned valid JSON")
    else:
        with open(sys.argv[1]) as f:
            payload = json.load(f)
        print(f"\n📂 Validating: {sys.argv[1]}")

    result = validate_payload(payload)

    icons = {"passed": "✅", "failed": "❌"}
    status = "passed" if result["passed"] else "failed"
    print(f"\n{icons[status]} Validation {status.upper()}")
    print(f"  simulation_id: {payload.get('simulation_id', '?')}")
    print(f"  mode: {payload.get('mode', '?')}")

    if result["structural_errors"]:
        print(f"\n🔴 Structural Errors ({len(result['structural_errors'])}):")
        for e in result["structural_errors"]:
            print(f"  • {e}")

    if result["reference_errors"]:
        print(f"\n🟠 Reference Errors ({len(result['reference_errors'])}):")
        for e in result["reference_errors"]:
            print(f"  • {e}")

    if result["equation_errors"]:
        print(f"\n🟡 Equation Errors ({len(result['equation_errors'])}):")
        for e in result["equation_errors"]:
            print(f"  • {e}")

    if result["physics_warnings"]:
        print(f"\n🔵 Physics Warnings ({len(result['physics_warnings'])}):")
        for w in result["physics_warnings"]:
            print(f"  • {w}")

    sys.exit(0 if result["passed"] else 1)
