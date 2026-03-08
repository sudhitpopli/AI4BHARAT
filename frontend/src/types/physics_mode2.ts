// Mode 2 TypeScript interfaces — Parameterized Math (useFrame, NO Rapier)

// ── Shared ──────────────────────────────────────────────────────────

export interface Vec3 { x: number; y: number; z: number; }

export interface Mode2Environment {
    gravity_y: number; // always 0 for Mode 2
    background: "space" | "lab" | "grid" | "black" | "white";
    ambient_light: number;
    show_axes: boolean;
    show_grid: boolean;
    camera_position: Vec3;
    fog_enabled: boolean;
}

// ═══ CLASSICAL PARAMETRIC ═══════════════════════════════════════════

export interface OrbitBody {
    type: "orbit_body"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    mass: number; radius: number;
    orbit_radius: number; eccentricity: number; orbital_speed: number;
    initial_angle_deg: number; axial_tilt_deg: number;
    is_central_body: boolean;
    has_ring: boolean; ring_inner_radius: number; ring_outer_radius: number;
    trail_length: number; atmosphere_color: string | null;
    texture_preset: "earth" | "moon" | "mars" | "sun" | "gas_giant" | "rocky" | "icy" | null;
}

export interface SecondWave {
    enabled: boolean; amplitude: number; frequency: number;
    phase_offset_deg: number; color: string;
}

export interface Wave {
    type: "wave"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    wave_type: "transverse" | "longitudinal" | "standing" | "torsional";
    amplitude: number; frequency: number; wavelength: number;
    phase_offset_deg: number; damping: number; num_points: number;
    medium: "vacuum" | "air" | "water" | "glass" | "string_medium" | "custom";
    medium_density: number;
    show_envelope: boolean; show_nodes: boolean;
    second_wave: SecondWave;
}

export interface SpringMass {
    type: "spring_mass"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    spring_constant: number; mass: number; natural_length: number;
    initial_extension: number; initial_velocity: number; damping: number;
    driving_frequency: number; driving_amplitude: number;
    orientation: "vertical" | "horizontal";
    anchor_position: Vec3; show_energy_bars: boolean;
    color_spring: string; color_mass: string;
}

export interface Projectile {
    type: "projectile"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    mass: number; radius: number;
    launch_speed: number; launch_angle_deg: number; launch_position: Vec3;
    drag_coefficient: number; air_density: number; gravity_y: number;
    show_trajectory: boolean; show_components: boolean;
}

// ═══ ELECTROMAGNETISM ═══════════════════════════════════════════════

export interface ChargedParticle {
    type: "charged_particle"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    charge: number; mass: number; initial_velocity: Vec3;
    radius: number; trail_length: number; trail_fade: boolean;
    show_force_vector: boolean; show_velocity_vector: boolean;
}

export interface ElectricField {
    type: "electric_field"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    field_type: "uniform" | "point_charge" | "dipole" | "parallel_plate";
    field_strength: number; field_direction: Vec3;
    plate_separation: number; plate_voltage: number;
    show_field_lines: boolean; num_field_lines: number;
    show_equipotential: boolean; num_equipotential: number;
    field_line_color: string; equipotential_color: string;
    region_bounds: Vec3;
}

export interface MagneticField {
    type: "magnetic_field"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    field_type: "uniform" | "straight_wire" | "solenoid" | "toroid" | "helmholtz_coil";
    field_strength: number; field_direction: Vec3;
    current: number; wire_length: number; turns: number; coil_radius: number;
    show_field_lines: boolean; show_flux_density: boolean;
}

export interface FieldLine {
    type: "field_line"; id: string; position: Vec3; color: string;
    field_type: "electric" | "magnetic";
    source_charge: number; num_lines: number; line_length: number;
    show_arrows: boolean; arrow_spacing: number;
}

export interface EMWave {
    type: "em_wave"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    frequency: number; amplitude_e: number; amplitude_b: number;
    polarization_deg: number; propagation_axis: "x" | "y" | "z";
    show_e_field: boolean; show_b_field: boolean; show_poynting: boolean;
    wavelength_bands: "radio" | "microwave" | "infrared" | "visible" | "uv" | "xray" | "gamma";
    color_e: string; color_b: string; num_cycles: number;
}

// ═══ ELECTRONICS — RLC ══════════════════════════════════════════════

export interface Parasitics_R { parasitic_L_nH: number; parasitic_C_pF: number; model: "ideal" | "parasitic" | "full"; }
export interface Parasitics_L { parallel_C_pF: number; core_loss_R: number; model: "ideal" | "ESR" | "full"; }
export interface Parasitics_C { series_R_ESR: number; series_L_ESL: number; parallel_R_leak: number; model: "ideal" | "ESR" | "ESR+ESL" | "full"; }

export interface Resistor {
    type: "resistor"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    resistance: number; tolerance_percent: number; temperature_coeff: number;
    max_power_watts: number; is_nonlinear: boolean;
    orientation_deg: number;
    show_power_dissipation: boolean; show_voltage_label: boolean; show_current_label: boolean;
    parasitics: Parasitics_R;
}

export interface Inductor {
    type: "inductor"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    inductance: number; dc_resistance: number; saturation_current: number;
    self_resonant_freq: number; coupling_coefficient: number; coupled_to_id: string | null;
    turns_ratio: number; core_type: "air" | "ferrite" | "iron" | "toroidal" | "laminated";
    core_permeability: number; physical_turns: number; coil_radius: number; coil_length: number;
    orientation_deg: number;
    show_magnetic_field: boolean; show_energy_storage: boolean;
    parasitics: Parasitics_L;
}

export interface Capacitor {
    type: "capacitor"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    capacitance: number; esr: number; esl: number; voltage_rating: number;
    initial_charge_V: number; leakage_current_nA: number;
    dielectric_type: string; dielectric_constant: number; temperature_coeff: string;
    plate_area: number; plate_separation: number; is_polarized: boolean;
    orientation_deg: number;
    show_electric_field: boolean; show_charge_animation: boolean; show_energy_storage: boolean;
    parasitics: Parasitics_C;
}

export interface VoltageSource {
    type: "voltage_source"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    source_type: "dc" | "ac_sine" | "ac_square" | "ac_triangle" | "ac_pulse" | "step" | "arbitrary";
    dc_voltage: number; ac_amplitude: number; ac_frequency: number; ac_phase_deg: number; dc_offset: number;
    pulse_rise_time: number; pulse_fall_time: number; pulse_width: number; pulse_period: number;
    source_impedance: number; show_waveform: boolean;
}

export interface CurrentSource {
    type: "current_source"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    source_type: "dc" | "ac_sine" | "ac_pulse" | "step";
    dc_current: number; ac_amplitude: number; ac_frequency: number;
    parallel_impedance: number;
}

export interface GroundNode { type: "ground_node"; id: string; position: Vec3; }

export interface RLCNetwork {
    type: "rlc_network"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    network_type: "series_rlc" | "parallel_rlc" | "series_rc" | "parallel_rc" | "series_rl" | "parallel_rl" | "custom";
    R: number; L: number; C: number;
    source_voltage: number; source_type: string | null;
    source_frequency: number; source_amplitude: number;
    topology: "series" | "parallel" | "ladder" | "pi" | "t" | "bridged_t";
    show_phasor: boolean; show_bode: boolean; show_impedance_locus: boolean;
}

export interface TransmissionLineSegment {
    type: "transmission_line_segment"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    segment_length: number; R_per_unit: number; L_per_unit: number; G_per_unit: number; C_per_unit: number;
    num_segments: number; line_type: string; characteristic_impedance: number;
    source_voltage: number; source_impedance: number; load_impedance: number | null; frequency: number;
    show_voltage_wave: boolean; show_current_wave: boolean; show_standing_wave: boolean; show_reflection: boolean;
}

export interface TransistorBJT {
    type: "transistor_bjt"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    polarity: "NPN" | "PNP"; model: string;
    expand_to_rlc: boolean; show_operating_point: boolean;
    dc_operating_point: { Ic: number; Vce: number; Ib: number };
    hybrid_pi_params: { gm: number; r_pi: number; r_o: number; C_pi: number; C_mu: number; r_b: number; r_e: number };
    dc_params: { beta_F: number; V_A: number; Is: number; V_be_on: number };
}

export interface TransistorMOSFET {
    type: "transistor_mosfet"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    channel_type: "NMOS" | "PMOS"; model: string;
    expand_to_rlc: boolean;
    dc_operating_point: { Id: number; Vgs: number; Vds: number; Vth: number };
    small_signal_params: { gm: number; gds: number; Cgs: number; Cgd: number; Cds: number };
}

export interface OpAmp {
    type: "op_amp"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    model: "ideal" | "macromodel" | "full_rlc";
    supply_voltage: number; configuration: string;
    feedback_R1: number; feedback_R2: number;
    expand_to_rlc: boolean;
}

// ═══ RELATIVITY ═════════════════════════════════════════════════════

export interface RelativisticParticle {
    type: "relativistic_particle"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    rest_mass: number; velocity_fraction: number; direction: Vec3;
    show_length_contraction: boolean; show_time_dilation: boolean;
    show_relativistic_momentum: boolean; show_kinetic_energy: boolean;
    reference_frame: "lab" | "rest"; trail_length: number;
}

export interface SpacetimeDiagram {
    type: "spacetime_diagram"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    show_light_cone: boolean; frame_velocity: number;
    events: Array<{ t: number; x: number; label: string }>;
    worldlines: Array<{ velocity_fraction: number; color: string }>;
}

// ═══ THERMODYNAMICS ═════════════════════════════════════════════════

export interface GasParticleSystem {
    type: "gas_particle_system"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    num_particles: number; temperature_K: number; particle_mass: number;
    box_dimensions: Vec3;
    show_velocity_histogram: boolean; show_pressure_indicator: boolean; show_temperature_color: boolean;
    wall_type: "elastic" | "thermal"; color_hot: string; color_cold: string;
}

export interface HeatDiffusion {
    type: "heat_diffusion"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    grid_width: number; grid_height: number; thermal_diffusivity: number;
    initial_temp_K: number; hot_source_temp: number; cold_sink_temp: number;
    colormap: "thermal" | "plasma" | "cool" | "greyscale"; show_isotherms: boolean;
}

// ═══ OPTICS ═════════════════════════════════════════════════════════

export interface LightRay {
    type: "light_ray"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    origin: Vec3; direction: Vec3; wavelength_nm: number;
    show_refracted: boolean; show_reflected: boolean; show_normal: boolean;
    max_bounces: number;
}

export interface OpticalMedium {
    type: "optical_medium"; id: string; label: string; education_note: string;
    position: Vec3; color: string;
    refractive_index: number; shape: "slab" | "prism" | "lens_convex" | "lens_concave" | "sphere";
    dimensions: Vec3; focal_length: number; show_index_label: boolean; opacity: number;
}

// ═══ UNION ══════════════════════════════════════════════════════════

export type Mode2Object =
    | OrbitBody | Wave | SpringMass | Projectile
    | ChargedParticle | ElectricField | MagneticField | FieldLine | EMWave
    | Resistor | Inductor | Capacitor | VoltageSource | CurrentSource | GroundNode
    | RLCNetwork | TransmissionLineSegment | TransistorBJT | TransistorMOSFET | OpAmp
    | RelativisticParticle | SpacetimeDiagram
    | GasParticleSystem | HeatDiffusion
    | LightRay | OpticalMedium;

// ═══ LINKS ══════════════════════════════════════════════════════════

export interface WireLink { type: "wire"; id: string; node_a_id: string; node_a_terminal: string; node_b_id: string; node_b_terminal: string; wire_routing: "straight" | "manhattan" | "curved"; show_current: boolean; show_voltage: boolean; color: string; }
export interface RealWireLink { type: "real_wire"; id: string; node_a_id: string; node_a_terminal: string; node_b_id: string; node_b_terminal: string; length_m: number; gauge_AWG: number; resistance: number; inductance_nH: number; show_current: boolean; color: string; }
export interface CoupledInductorLink { type: "coupled_inductor_link"; id: string; inductor_a_id: string; inductor_b_id: string; coupling_coefficient: number; show_flux_lines: boolean; }
export interface TransmissionLineLink { type: "transmission_line_link"; id: string; source_id: string; line_id: string; load_id: string; show_reflections: boolean; }

export type CircuitLink = WireLink | RealWireLink | CoupledInductorLink | TransmissionLineLink;

export interface OrbitalGravityLink { type: "orbital_gravity"; id: string; body_a_id: string; body_b_id: string; G_scaled: number; show_force_vector: boolean; show_potential_well: boolean; }
export interface EMForceLink { type: "em_force"; id: string; particle_id: string; field_id: string; show_force_arrow: boolean; }
export interface WaveSuperpositionLink { type: "wave_superposition"; id: string; wave_a_id: string; wave_b_id: string; show_resultant: boolean; show_constructive_destructive: boolean; result_color: string; }
export interface SpringCouplingLink { type: "spring_coupling"; id: string; mass_a_id: string; mass_b_id: string; coupling_spring_constant: number; coupling_rest_length: number; show_normal_modes: boolean; }
export interface RefractionBoundaryLink { type: "refraction_boundary"; id: string; medium_a_id: string; medium_b_id: string; boundary_normal: Vec3; show_angle_labels: boolean; }

export type PhysicsLink = OrbitalGravityLink | EMForceLink | WaveSuperpositionLink | SpringCouplingLink | RefractionBoundaryLink;

// ═══ CONTROLS & EDUCATIONAL ═════════════════════════════════════════

export interface Control { group: string; label: string; param: string; min: number; max: number; default: number; step: number; unit: string; education_note: string; }
export interface EducationalStep { step: number; title: string; instruction: string; focus_objects: string[]; focus_controls: string[]; }

// ═══ TOP-LEVEL ══════════════════════════════════════════════════════

export interface Mode2Schema {
    simulation_id: string;
    title: string;
    description: string;
    physics_concept: string;
    mode: 2;
    difficulty: "beginner" | "intermediate" | "advanced";
    tags: string[];
    is_qualitative: boolean;
    environment: Mode2Environment;
    objects: Mode2Object[];
    circuit_links: CircuitLink[];
    physics_links: PhysicsLink[];
    controls: Control[];
    educational_sequence: EducationalStep[];
}
