"""Mode 2 Pydantic schema — Parameterized Math (useFrame-driven, NO Rapier).

Covers: Classical Parametric, Electromagnetism, Electronics (RLC),
        Relativity, Thermodynamics, Optics.
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Union

# ── Shared ──────────────────────────────────────────────────────────

class Vec3(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0

class Environment(BaseModel):
    gravity_y: float = 0.0
    background: Literal["space", "lab", "grid", "black", "white"] = "black"
    ambient_light: float = 0.6
    show_axes: bool = False
    show_grid: bool = True
    camera_position: Vec3 = Vec3(x=0, y=0, z=20)
    fog_enabled: bool = False

# ── Base for all Mode-2 objects ─────────────────────────────────────

class Mode2BaseObject(BaseModel):
    id: str
    label: str = ""
    education_note: str = ""
    position: Vec3 = Vec3()
    color: str = "#f8fafc"

# ═══ CLASSICAL PARAMETRIC ═══════════════════════════════════════════

class OrbitBody(Mode2BaseObject):
    type: Literal["orbit_body"] = "orbit_body"
    mass: float
    radius: float
    orbit_radius: float = 0.0
    eccentricity: float = 0.0
    orbital_speed: float = 1.0
    initial_angle_deg: float = 0.0
    axial_tilt_deg: float = 0.0
    is_central_body: bool = False
    has_ring: bool = False
    ring_inner_radius: float = 0.0
    ring_outer_radius: float = 0.0
    trail_length: int = Field(100, ge=0, le=300)
    atmosphere_color: Optional[str] = None
    texture_preset: Optional[Literal["earth", "moon", "mars", "sun", "gas_giant", "rocky", "icy"]] = None

class SecondWave(BaseModel):
    enabled: bool = False
    amplitude: float = 0.5
    frequency: float = 1.0
    phase_offset_deg: float = 0.0
    color: str = "#a855f7"

class Wave(Mode2BaseObject):
    type: Literal["wave"] = "wave"
    wave_type: Literal["transverse", "longitudinal", "standing", "torsional"]
    amplitude: float
    frequency: float
    wavelength: float
    phase_offset_deg: float = 0.0
    damping: float = 0.0
    num_points: int = Field(100, ge=20, le=200)
    medium: Literal["vacuum", "air", "water", "glass", "string_medium", "custom"] = "vacuum"
    medium_density: float = 0.0
    show_envelope: bool = False
    show_nodes: bool = False
    second_wave: SecondWave = SecondWave()

class SpringMass(Mode2BaseObject):
    type: Literal["spring_mass"] = "spring_mass"
    spring_constant: float
    mass: float
    natural_length: float
    initial_extension: float = 0.0
    initial_velocity: float = 0.0
    damping: float = 0.0
    driving_frequency: float = 0.0
    driving_amplitude: float = 0.0
    orientation: Literal["vertical", "horizontal"] = "vertical"
    anchor_position: Vec3 = Vec3()
    show_energy_bars: bool = False
    color_spring: str = "#f8fafc"
    color_mass: str = "#ef4444"

class Projectile(Mode2BaseObject):
    type: Literal["projectile"] = "projectile"
    mass: float
    radius: float
    launch_speed: float
    launch_angle_deg: float
    launch_position: Vec3 = Vec3()
    drag_coefficient: float = 0.0
    air_density: float = 1.225
    gravity_y: float = -9.81
    show_trajectory: bool = True
    show_components: bool = False

# ═══ ELECTROMAGNETISM ═══════════════════════════════════════════════

class ChargedParticle(Mode2BaseObject):
    type: Literal["charged_particle"] = "charged_particle"
    charge: float
    mass: float
    initial_velocity: Vec3 = Vec3()
    radius: float = 0.15
    trail_length: int = Field(100, ge=0, le=300)
    trail_fade: bool = True
    show_force_vector: bool = True
    show_velocity_vector: bool = True

class ElectricField(Mode2BaseObject):
    type: Literal["electric_field"] = "electric_field"
    field_type: Literal["uniform", "point_charge", "dipole", "parallel_plate"]
    field_strength: float
    field_direction: Vec3 = Vec3(x=1)
    plate_separation: float = 1.0
    plate_voltage: float = 0.0
    show_field_lines: bool = True
    num_field_lines: int = Field(8, ge=4, le=32)
    show_equipotential: bool = False
    num_equipotential: int = 5
    field_line_color: str = "#ef4444"
    equipotential_color: str = "#22c55e"
    region_bounds: Vec3 = Vec3(x=5, y=5, z=5)

class MagneticField(Mode2BaseObject):
    type: Literal["magnetic_field"] = "magnetic_field"
    field_type: Literal["uniform", "straight_wire", "solenoid", "toroid", "helmholtz_coil"]
    field_strength: float
    field_direction: Vec3 = Vec3(y=1)
    current: float = 0.0
    wire_length: float = 5.0
    turns: int = 10
    coil_radius: float = 0.5
    show_field_lines: bool = True
    show_flux_density: bool = False

class FieldLine(Mode2BaseObject):
    type: Literal["field_line"] = "field_line"
    field_type: Literal["electric", "magnetic"]
    source_charge: float = 1.0
    num_lines: int = Field(8, ge=4, le=48)
    line_length: float = 5.0
    show_arrows: bool = True
    arrow_spacing: float = 1.0

class EMWave(Mode2BaseObject):
    type: Literal["em_wave"] = "em_wave"
    frequency: float
    amplitude_e: float
    amplitude_b: float = 0.0
    polarization_deg: float = 0.0
    propagation_axis: Literal["x", "y", "z"] = "z"
    show_e_field: bool = True
    show_b_field: bool = True
    show_poynting: bool = False
    wavelength_bands: Literal["radio", "microwave", "infrared", "visible", "uv", "xray", "gamma"] = "visible"
    color_e: str = "#ef4444"
    color_b: str = "#3b82f6"
    num_cycles: int = Field(3, ge=1, le=8)

# ═══ ELECTRONICS — RLC PRIMITIVES ══════════════════════════════════

class Parasitics_R(BaseModel):
    parasitic_L_nH: float = 0.0
    parasitic_C_pF: float = 0.0
    model: Literal["ideal", "parasitic", "full"] = "ideal"

class Resistor(Mode2BaseObject):
    type: Literal["resistor"] = "resistor"
    resistance: float
    tolerance_percent: float = 5.0
    temperature_coeff: float = 100.0
    max_power_watts: float = 0.25
    is_nonlinear: bool = False
    nonlinear_vi_curve: Optional[List[dict]] = None
    orientation_deg: float = 0.0
    show_power_dissipation: bool = True
    show_voltage_label: bool = True
    show_current_label: bool = True
    parasitics: Parasitics_R = Parasitics_R()

class Parasitics_L(BaseModel):
    parallel_C_pF: float = 0.0
    core_loss_R: float = 0.0
    model: Literal["ideal", "ESR", "full"] = "ideal"

class Inductor(Mode2BaseObject):
    type: Literal["inductor"] = "inductor"
    inductance: float
    dc_resistance: float = 0.0
    saturation_current: float = 10.0
    self_resonant_freq: float = 1e9
    coupling_coefficient: float = 0.0
    coupled_to_id: Optional[str] = None
    turns_ratio: float = 1.0
    core_type: Literal["air", "ferrite", "iron", "toroidal", "laminated"] = "air"
    core_permeability: float = 1.0
    physical_turns: int = 10
    coil_radius: float = 0.02
    coil_length: float = 0.04
    orientation_deg: float = 0.0
    show_magnetic_field: bool = False
    show_energy_storage: bool = False
    parasitics: Parasitics_L = Parasitics_L()

class Parasitics_C(BaseModel):
    series_R_ESR: float = 0.0
    series_L_ESL: float = 0.0
    parallel_R_leak: float = 1e9
    model: Literal["ideal", "ESR", "ESR+ESL", "full"] = "ideal"

class Capacitor(Mode2BaseObject):
    type: Literal["capacitor"] = "capacitor"
    capacitance: float
    esr: float = 0.0
    esl: float = 0.0
    voltage_rating: float = 50.0
    initial_charge_V: float = 0.0
    leakage_current_nA: float = 0.0
    dielectric_type: Literal["air", "ceramic", "electrolytic", "tantalum", "film", "mica", "supercap"] = "ceramic"
    dielectric_constant: float = 1.0
    temperature_coeff: str = ""
    plate_area: float = 0.001
    plate_separation: float = 0.0001
    is_polarized: bool = False
    orientation_deg: float = 0.0
    show_electric_field: bool = False
    show_charge_animation: bool = True
    show_energy_storage: bool = False
    parasitics: Parasitics_C = Parasitics_C()

class VoltageSource(Mode2BaseObject):
    type: Literal["voltage_source"] = "voltage_source"
    source_type: Literal["dc", "ac_sine", "ac_square", "ac_triangle", "ac_pulse", "step", "arbitrary"]
    dc_voltage: float = 0.0
    ac_amplitude: float = 0.0
    ac_frequency: float = 0.0
    ac_phase_deg: float = 0.0
    dc_offset: float = 0.0
    pulse_rise_time: float = 0.0
    pulse_fall_time: float = 0.0
    pulse_width: float = 0.0
    pulse_period: float = 0.0
    source_impedance: float = 0.0
    show_waveform: bool = True

class CurrentSource(Mode2BaseObject):
    type: Literal["current_source"] = "current_source"
    source_type: Literal["dc", "ac_sine", "ac_pulse", "step"]
    dc_current: float = 0.0
    ac_amplitude: float = 0.0
    ac_frequency: float = 0.0
    parallel_impedance: float = 1e9

class GroundNode(BaseModel):
    type: Literal["ground_node"] = "ground_node"
    id: str
    position: Vec3 = Vec3()

class RLCNetwork(Mode2BaseObject):
    type: Literal["rlc_network"] = "rlc_network"
    network_type: Literal["series_rlc", "parallel_rlc", "series_rc", "parallel_rc", "series_rl", "parallel_rl", "custom"]
    R: float = 0.0
    L: float = 0.0
    C: float = 0.0
    source_voltage: float = 0.0
    source_type: Optional[Literal["dc", "ac_sine", "ac_square", "ac_pulse", "step"]] = None
    source_frequency: float = 0.0
    source_amplitude: float = 0.0
    topology: Literal["series", "parallel", "ladder", "pi", "t", "bridged_t"] = "series"
    show_phasor: bool = False
    show_bode: bool = False
    show_impedance_locus: bool = False

class TransmissionLineSegment(Mode2BaseObject):
    type: Literal["transmission_line_segment"] = "transmission_line_segment"
    segment_length: float
    R_per_unit: float = 0.0
    L_per_unit: float
    G_per_unit: float = 0.0
    C_per_unit: float
    num_segments: int = Field(10, ge=2, le=20)
    line_type: Literal["coaxial", "microstrip", "stripline", "two_wire", "waveguide", "custom"] = "coaxial"
    characteristic_impedance: float
    source_voltage: float = 1.0
    source_impedance: float = 50.0
    load_impedance: Optional[float] = 50.0
    frequency: float = 1e6
    show_voltage_wave: bool = True
    show_current_wave: bool = False
    show_standing_wave: bool = False
    show_reflection: bool = False

class DCOperatingPoint_BJT(BaseModel):
    Ic: float = 0.001
    Vce: float = 5.0
    Ib: float = 1e-5

class HybridPiParams(BaseModel):
    gm: float = 0.04
    r_pi: float = 2500.0
    r_o: float = 50000.0
    C_pi: float = 1e-12
    C_mu: float = 0.5e-12
    r_b: float = 100.0
    r_e: float = 25.0

class DCParams_BJT(BaseModel):
    beta_F: float = 100.0
    beta_R: float = 1.0
    V_A: float = 100.0
    Is: float = 1e-15
    V_be_on: float = 0.65

class TransistorBJT(Mode2BaseObject):
    type: Literal["transistor_bjt"] = "transistor_bjt"
    polarity: Literal["NPN", "PNP"]
    model: Literal["ebers_moll", "hybrid_pi", "gummel_poon"] = "hybrid_pi"
    dc_operating_point: DCOperatingPoint_BJT = DCOperatingPoint_BJT()
    hybrid_pi_params: HybridPiParams = HybridPiParams()
    dc_params: DCParams_BJT = DCParams_BJT()
    expand_to_rlc: bool = False
    show_operating_point: bool = False

class SmallSignalParams_MOS(BaseModel):
    gm: float = 0.01
    gds: float = 1e-5
    Cgs: float = 1e-12
    Cgd: float = 0.2e-12
    Cds: float = 0.1e-12
    Cbs: float = 0.0
    Cbd: float = 0.0
    Rd: float = 0.0
    Rs: float = 0.0
    Rg: float = 0.0

class DCOperatingPoint_MOS(BaseModel):
    Id: float = 0.001
    Vgs: float = 2.0
    Vds: float = 5.0
    Vth: float = 0.7

class TransistorMOSFET(Mode2BaseObject):
    type: Literal["transistor_mosfet"] = "transistor_mosfet"
    channel_type: Literal["NMOS", "PMOS"]
    model: Literal["level1", "level2", "bsim", "small_signal"] = "small_signal"
    dc_operating_point: DCOperatingPoint_MOS = DCOperatingPoint_MOS()
    small_signal_params: SmallSignalParams_MOS = SmallSignalParams_MOS()
    expand_to_rlc: bool = False

class IdealOpAmpParams(BaseModel):
    open_loop_gain: float = 100000.0
    input_impedance: float = 1e12
    output_impedance: float = 75.0
    gbw_product: float = 1e6
    slew_rate: float = 1.0

class MacromodelOpAmpParams(BaseModel):
    R_in_diff: float = 1e12
    R_in_cm: float = 1e12
    C_in: float = 1e-12
    R_out: float = 75.0
    C_comp: float = 30e-12
    Gm1: float = 0.02
    Gm2: float = 0.1
    V_os: float = 0.0

class OpAmp(Mode2BaseObject):
    type: Literal["op_amp"] = "op_amp"
    model: Literal["ideal", "macromodel", "full_rlc"] = "ideal"
    ideal_params: IdealOpAmpParams = IdealOpAmpParams()
    macromodel_params: MacromodelOpAmpParams = MacromodelOpAmpParams()
    supply_voltage: float = 15.0
    configuration: Literal["inverting", "non_inverting", "differentiator", "integrator", "comparator", "instrumentation"] = "inverting"
    feedback_R1: float = 1000.0
    feedback_R2: float = 10000.0
    expand_to_rlc: bool = False

# ═══ RELATIVITY ═════════════════════════════════════════════════════

class RelativisticParticle(Mode2BaseObject):
    type: Literal["relativistic_particle"] = "relativistic_particle"
    rest_mass: float
    velocity_fraction: float = Field(..., ge=0.0, le=0.9999)
    direction: Vec3 = Vec3(x=1)
    show_length_contraction: bool = True
    show_time_dilation: bool = True
    show_relativistic_momentum: bool = False
    show_kinetic_energy: bool = False
    reference_frame: Literal["lab", "rest"] = "lab"
    trail_length: int = 50

class SpacetimeEvent(BaseModel):
    t: float
    x: float
    label: str = ""

class Worldline(BaseModel):
    velocity_fraction: float
    color: str = "#ef4444"

class SpacetimeDiagram(Mode2BaseObject):
    type: Literal["spacetime_diagram"] = "spacetime_diagram"
    show_light_cone: bool = True
    frame_velocity: float = 0.0
    events: List[SpacetimeEvent] = []
    worldlines: List[Worldline] = []

# ═══ THERMODYNAMICS ═════════════════════════════════════════════════

class GasParticleSystem(Mode2BaseObject):
    type: Literal["gas_particle_system"] = "gas_particle_system"
    num_particles: int = Field(100, ge=10, le=500)
    temperature_K: float
    particle_mass: float
    box_dimensions: Vec3 = Vec3(x=5, y=5, z=5)
    show_velocity_histogram: bool = True
    show_pressure_indicator: bool = False
    show_temperature_color: bool = True
    wall_type: Literal["elastic", "thermal"] = "elastic"
    color_hot: str = "#ef4444"
    color_cold: str = "#3b82f6"

class HeatDiffusion(Mode2BaseObject):
    type: Literal["heat_diffusion"] = "heat_diffusion"
    grid_width: int = Field(20, ge=10, le=50)
    grid_height: int = Field(20, ge=10, le=50)
    thermal_diffusivity: float
    initial_temp_K: float
    hot_source_temp: float
    cold_sink_temp: float
    colormap: Literal["thermal", "plasma", "cool", "greyscale"] = "thermal"
    show_isotherms: bool = False

# ═══ OPTICS ═════════════════════════════════════════════════════════

class LightRay(Mode2BaseObject):
    type: Literal["light_ray"] = "light_ray"
    origin: Vec3 = Vec3()
    direction: Vec3 = Vec3(x=1)
    wavelength_nm: float = 550.0
    show_refracted: bool = True
    show_reflected: bool = True
    show_normal: bool = True
    max_bounces: int = Field(3, ge=1, le=10)

class OpticalMedium(Mode2BaseObject):
    type: Literal["optical_medium"] = "optical_medium"
    refractive_index: float = 1.5
    shape: Literal["slab", "prism", "lens_convex", "lens_concave", "sphere"]
    dimensions: Vec3 = Vec3(x=2, y=2, z=2)
    focal_length: float = 0.0
    show_index_label: bool = True
    opacity: float = 0.3

# ═══ UNION OF ALL MODE 2 OBJECTS ═══════════════════════════════════

Mode2ObjectUnion = Union[
    # Classical
    OrbitBody, Wave, SpringMass, Projectile,
    # EM
    ChargedParticle, ElectricField, MagneticField, FieldLine, EMWave,
    # Electronics
    Resistor, Inductor, Capacitor, VoltageSource, CurrentSource, GroundNode,
    RLCNetwork, TransmissionLineSegment, TransistorBJT, TransistorMOSFET, OpAmp,
    # Relativity
    RelativisticParticle, SpacetimeDiagram,
    # Thermo
    GasParticleSystem, HeatDiffusion,
    # Optics
    LightRay, OpticalMedium,
]

# ═══ CIRCUIT LINKS ══════════════════════════════════════════════════

class WireLink(BaseModel):
    type: Literal["wire"] = "wire"
    id: str
    node_a_id: str
    node_a_terminal: str
    node_b_id: str
    node_b_terminal: str
    wire_routing: Literal["straight", "manhattan", "curved"] = "manhattan"
    show_current: bool = True
    show_voltage: bool = False
    color: str = "#f8fafc"

class RealWireLink(BaseModel):
    type: Literal["real_wire"] = "real_wire"
    id: str
    node_a_id: str
    node_a_terminal: str
    node_b_id: str
    node_b_terminal: str
    length_m: float = 1.0
    gauge_AWG: int = 24
    resistance: float = 0.0
    inductance_nH: float = 0.0
    show_current: bool = True
    color: str = "#f8fafc"

class CoupledInductorLink(BaseModel):
    type: Literal["coupled_inductor_link"] = "coupled_inductor_link"
    id: str
    inductor_a_id: str
    inductor_b_id: str
    coupling_coefficient: float = Field(0.95, ge=0.0, le=1.0)
    show_flux_lines: bool = False

class TransmissionLineLink(BaseModel):
    type: Literal["transmission_line_link"] = "transmission_line_link"
    id: str
    source_id: str
    line_id: str
    load_id: str
    show_reflections: bool = True

CircuitLinkUnion = Union[WireLink, RealWireLink, CoupledInductorLink, TransmissionLineLink]

# ═══ PHYSICS LINKS ══════════════════════════════════════════════════

class OrbitalGravityLink(BaseModel):
    type: Literal["orbital_gravity"] = "orbital_gravity"
    id: str
    body_a_id: str
    body_b_id: str
    G_scaled: float = 1.0
    show_force_vector: bool = False
    show_potential_well: bool = False

class EMForceLink(BaseModel):
    type: Literal["em_force"] = "em_force"
    id: str
    particle_id: str
    field_id: str
    show_force_arrow: bool = True

class WaveSuperpositionLink(BaseModel):
    type: Literal["wave_superposition"] = "wave_superposition"
    id: str
    wave_a_id: str
    wave_b_id: str
    show_resultant: bool = True
    show_constructive_destructive: bool = False
    result_color: str = "#fbbf24"

class SpringCouplingLink(BaseModel):
    type: Literal["spring_coupling"] = "spring_coupling"
    id: str
    mass_a_id: str
    mass_b_id: str
    coupling_spring_constant: float
    coupling_rest_length: float
    show_normal_modes: bool = False

class RefractionBoundaryLink(BaseModel):
    type: Literal["refraction_boundary"] = "refraction_boundary"
    id: str
    medium_a_id: str
    medium_b_id: str
    boundary_normal: Vec3 = Vec3(y=1)
    show_angle_labels: bool = True

PhysicsLinkUnion = Union[OrbitalGravityLink, EMForceLink, WaveSuperpositionLink, SpringCouplingLink, RefractionBoundaryLink]

# ═══ CONTROLS & EDUCATIONAL SEQUENCE (shared with Mode 1) ══════════

class Control(BaseModel):
    group: str
    label: str
    param: str
    min: float
    max: float
    default: float
    step: float
    unit: str
    education_note: str = ""

class EducationalStep(BaseModel):
    step: int
    title: str
    instruction: str
    focus_objects: List[str] = []
    focus_controls: List[str] = []

# ═══ TOP-LEVEL MODE 2 SCHEMA ═══════════════════════════════════════

class Mode2Schema(BaseModel):
    simulation_id: str
    title: str
    description: str
    physics_concept: str
    mode: Literal[2] = 2
    difficulty: Literal["beginner", "intermediate", "advanced"]
    tags: List[str]
    is_qualitative: bool = False

    environment: Environment
    objects: List[Mode2ObjectUnion] = Field(..., min_length=1, max_length=30)
    circuit_links: List[CircuitLinkUnion] = Field(default_factory=list)
    physics_links: List[PhysicsLinkUnion] = Field(default_factory=list)
    controls: List[Control] = Field(..., min_length=2, max_length=10)
    educational_sequence: List[EducationalStep] = []
