import type { PhysicsSchema } from '../types/physics';
import type { Mode2Schema } from '../types/physics_mode2';

/* ═══════════════════════════════════════════════════════════════════
   DEMO 1 — Double Pendulum (Mode 1 / Rapier)
   ═══════════════════════════════════════════════════════════════════
   Uses THREE existing primitives:
     • 1 static anchor sphere (ceiling pivot)
     • 2 dynamic sphere bobs
     • 2 rope links with proper attachment refs + properties
   Rapier simulates all the chaotic physics.                      */

export const DOUBLE_PENDULUM: PhysicsSchema = {
    simulation_id: 'double-pendulum-demo',
    title: 'Double Pendulum — Chaotic Motion',
    description: 'Two bobs connected by rods swing from a ceiling pivot. Even tiny changes in initial angle produce wildly different trajectories — the hallmark of chaos.',
    physics_concept: 'Chaos Theory, Lagrangian Mechanics, Conservation of Energy',
    mode: 1,
    difficulty: 'intermediate',
    tags: ['pendulum', 'chaos', 'lagrangian', 'energy'],
    is_qualitative: false,

    environment: {
        gravity_y: -9.81,
        background: 'black',
        ambient_light: 0.6,
        show_axes: false,
        show_grid: true,
        camera_position: { x: 0, y: 0, z: 14 },
        fog_enabled: false,
    },

    objects: [
        {
            type: 'sphere', id: 'anchor', label: 'Ceiling Pivot',
            education_note: 'Fixed pivot point on the ceiling.',
            is_static: true, is_anchor: true, color: '#a1a1aa',
            position: { x: 0, y: 5, z: 0 }, radius: 0.12,
            material: { preset: 'steel', restitution: 0, friction: 0.5, density: 10 },
        },
        {
            type: 'sphere', id: 'bob1', label: 'Bob 1 (upper)',
            education_note: 'Upper bob. Displaced sideways to inject potential energy PE = mgh.',
            is_static: false, is_anchor: false, color: '#ef4444',
            position: { x: 2.0, y: 2.5, z: 0 }, radius: 0.35,
            material: { preset: 'steel', restitution: 0, friction: 0.1, density: 5 },
        },
        {
            type: 'sphere', id: 'bob2', label: 'Bob 2 (lower)',
            education_note: 'Lower bob. Its trajectory is chaotically sensitive to initial conditions.',
            is_static: false, is_anchor: false, color: '#3b82f6',
            position: { x: 3.5, y: 0, z: 0 }, radius: 0.35,
            material: { preset: 'steel', restitution: 0, friction: 0.1, density: 5 },
        },
    ],

    links: [
        {
            id: 'rod1', type: 'rope',
            label: 'Upper Rod',
            education_note: 'Connects the ceiling pivot to the upper bob.',
            object_a: { id: 'anchor', attachment_point: 'center', offset: { x: 0, y: 0, z: 0 } },
            object_b: { id: 'bob1', attachment_point: 'center', offset: { x: 0, y: 0, z: 0 } },
            properties: {
                length: 3.0,
                stiffness: 1.0,
                damping: 0,
                break_force: null,
                show_segments: 2,
                color: '#f8fafc',
            },
        },
        {
            id: 'rod2', type: 'rope',
            label: 'Lower Rod',
            education_note: 'Connects the upper bob to the lower bob.',
            object_a: { id: 'bob1', attachment_point: 'center', offset: { x: 0, y: 0, z: 0 } },
            object_b: { id: 'bob2', attachment_point: 'center', offset: { x: 0, y: 0, z: 0 } },
            properties: {
                length: 3.0,
                stiffness: 1.0,
                damping: 0,
                break_force: null,
                show_segments: 2,
                color: '#f8fafc',
            },
        },
    ],

    controls: [
        { group: 'Environment', label: 'Gravity', param: 'environment.gravity_y', min: -25, max: -0.5, default: -9.81, step: 0.1, unit: 'm/s²', education_note: 'g determines pendulum period. Try Moon (-1.62) for slow, graceful motion.' },
        { group: 'Bob 1', label: 'Start X', param: 'bob1.position.x', min: -4, max: 4, default: 2, step: 0.1, unit: 'm', education_note: 'Initial horizontal offset. Even 0.1m change leads to wildly different trajectory — chaos!' },
        { group: 'Bob 2', label: 'Start X', param: 'bob2.position.x', min: -4, max: 4, default: 3.5, step: 0.1, unit: 'm', education_note: 'Try different starting positions.' },
    ],

    educational_sequence: [
        { step: 1, title: 'Observe Chaos', instruction: 'Let it swing. The lower bob traces unpredictable paths.', focus_objects: ['bob1', 'bob2'], focus_controls: [] },
        { step: 2, title: 'Butterfly Effect', instruction: 'Reset. Change Bob 1 X from 2.0 to 2.1. Completely different trajectory!', focus_objects: ['bob1'], focus_controls: ['bob1.position.x'] },
    ],
};

/* ═══════════════════════════════════════════════════════════════════
   DEMO 2 — Series RLC Circuit
   ═══════════════════════════════════════════════════════════════════
   Tight rectangular layout. Components 3 units apart:

       VS(-2,2) ——— R(2,2)
       |                   |
       GND(-2,-2) — C(2,-2)
*/

export const SERIES_RLC: Mode2Schema = {
    simulation_id: 'series-rlc-demo',
    title: 'Series RLC Circuit — Resonance',
    description: 'An AC source drives R, L, C in a loop. At resonance (~1000 Hz) impedance is minimum and charges flow fastest.',
    physics_concept: 'Impedance, Resonance, Q-Factor',
    mode: 2,
    difficulty: 'intermediate',
    tags: ['rlc', 'resonance', 'impedance'],
    is_qualitative: false,

    environment: {
        gravity_y: 0,
        background: 'black',
        ambient_light: 0.7,
        show_axes: false,
        show_grid: true,
        camera_position: { x: 0, y: 0, z: 12 },
        fog_enabled: false,
    },

    objects: [
        {
            type: 'voltage_source', id: 'vs1', label: 'AC 10V @ 1kHz',
            education_note: 'At resonance f₀ = 1/(2π√LC) ≈ 1kHz, impedance Z = R (minimum).',
            position: { x: -3, y: 2, z: 0 }, color: '#eab308',
            source_type: 'ac_sine', dc_voltage: 0, ac_amplitude: 10, ac_frequency: 1000,
            ac_phase_deg: 0, dc_offset: 0, pulse_rise_time: 0, pulse_fall_time: 0,
            pulse_width: 0, pulse_period: 0, source_impedance: 0, show_waveform: true,
        },
        {
            type: 'resistor', id: 'r1', label: 'R = 100Ω',
            education_note: 'R sets Q-factor: Q = ω₀L/R.',
            position: { x: 3, y: 2, z: 0 }, color: '#ef4444',
            resistance: 100, tolerance_percent: 5, temperature_coeff: 100,
            max_power_watts: 0.25, is_nonlinear: false, orientation_deg: 0,
            show_power_dissipation: false, show_voltage_label: true, show_current_label: false,
            parasitics: { parasitic_L_nH: 0, parasitic_C_pF: 0, model: 'ideal' },
        },
        {
            type: 'capacitor', id: 'c1', label: 'C = 2.5µF',
            education_note: 'Z_C = 1/(jωC). At resonance |Z_L| = |Z_C|, they cancel.',
            position: { x: 3, y: -2, z: 0 }, color: '#22c55e',
            capacitance: 2.533e-6, esr: 0.1, esl: 0, voltage_rating: 50,
            initial_charge_V: 0, leakage_current_nA: 0, dielectric_type: 'film',
            dielectric_constant: 3.5, temperature_coeff: '', plate_area: 0.001,
            plate_separation: 0.0001, is_polarized: false, orientation_deg: 0,
            show_electric_field: false, show_charge_animation: true, show_energy_storage: false,
            parasitics: { series_R_ESR: 0.1, series_L_ESL: 0, parallel_R_leak: 1e9, model: 'ideal' },
        },
        {
            type: 'ground_node', id: 'gnd',
            position: { x: -3, y: -2, z: 0 },
        },
    ],

    circuit_links: [
        // Top: VS → R (straight horizontal, same y=2)
        { type: 'wire', id: 'w1', node_a_id: 'vs1', node_a_terminal: 'n', node_b_id: 'r1', node_b_terminal: 'p', wire_routing: 'manhattan', show_current: true, show_voltage: false, color: '#f8fafc' },
        // Right: R → C (straight vertical, same x=3)
        { type: 'wire', id: 'w2', node_a_id: 'r1', node_a_terminal: 'n', node_b_id: 'c1', node_b_terminal: 'n', wire_routing: 'manhattan', show_current: true, show_voltage: false, color: '#f8fafc' },
        // Bottom: C → GND (straight horizontal, same y=-2)
        { type: 'wire', id: 'w3', node_a_id: 'c1', node_a_terminal: 'p', node_b_id: 'gnd', node_b_terminal: 'gnd', wire_routing: 'manhattan', show_current: true, show_voltage: false, color: '#f8fafc' },
        // Left: GND → VS (straight vertical, same x=-3)
        { type: 'wire', id: 'w4', node_a_id: 'gnd', node_a_terminal: 'gnd', node_b_id: 'vs1', node_b_terminal: 'p', wire_routing: 'manhattan', show_current: true, show_voltage: false, color: '#f8fafc' },
    ],

    physics_links: [],

    controls: [
        { group: 'Source', label: 'Frequency', param: 'vs1.ac_frequency', min: 100, max: 10000, default: 1000, step: 10, unit: 'Hz', education_note: 'Resonance at f₀ ≈ 1kHz. Charges flow fastest there!' },
        { group: 'Components', label: 'Resistance', param: 'r1.resistance', min: 5, max: 500, default: 100, step: 5, unit: 'Ω', education_note: 'Low R → sharp resonance. High R → flat, overdamped.' },
    ],

    educational_sequence: [
        { step: 1, title: 'Find Resonance', instruction: 'Sweep frequency. Golden charges flow fastest at ~1000 Hz.', focus_objects: ['vs1'], focus_controls: ['vs1.ac_frequency'] },
    ],
};

/* ═══════════════════════════════════════════════════════════════════
   DEMO 3 — Oscillating Charge EM Radiation
   ═══════════════════════════════════════════════════════════════════
   Charge oscillates via harmonic restoring force (engine built-in).
   Only E-field waves shown to avoid "4 waves" confusion.        */

export const EM_RADIATION: Mode2Schema = {
    simulation_id: 'em-radiation-demo',
    title: 'Oscillating Charge — EM Radiation',
    description: 'A charged particle oscillates vertically in a harmonic trap, radiating electromagnetic waves outward. This is how all EM radiation works — from antennas to light.',
    physics_concept: 'EM Radiation, Oscillating Dipole, Larmor Formula',
    mode: 2,
    difficulty: 'advanced',
    tags: ['em-wave', 'radiation', 'antenna'],
    is_qualitative: false,

    environment: {
        gravity_y: 0,
        background: 'space',
        ambient_light: 0.4,
        show_axes: true,
        show_grid: false,
        camera_position: { x: 6, y: 4, z: 10 },
        fog_enabled: false,
    },

    objects: [
        {
            type: 'charged_particle', id: 'charge',
            label: 'Oscillating Charge',
            education_note: 'Oscillates in a harmonic trap. Acceleration produces EM radiation (Larmor formula).',
            position: { x: 0, y: 0, z: 0 }, color: '#ef4444',
            charge: 1e-6, mass: 1e-10,
            initial_velocity: { x: 0, y: 3, z: 0 },
            radius: 0.3, trail_length: 120, trail_fade: true,
            show_force_vector: true, show_velocity_vector: true,
        },
        {
            type: 'em_wave', id: 'wave_z',
            label: 'EM Wave (+z)',
            education_note: 'E-field oscillation propagating along +z. Transverse to propagation direction.',
            position: { x: 0, y: 0, z: 3 }, color: '#f8fafc',
            frequency: 0.4, amplitude_e: 1.8, amplitude_b: 0.6,
            polarization_deg: 0, propagation_axis: 'z',
            show_e_field: true, show_b_field: false,
            show_poynting: false,
            wavelength_bands: 'visible', color_e: '#ef4444', color_b: '#3b82f6', num_cycles: 3,
        },
        {
            type: 'em_wave', id: 'wave_x',
            label: 'EM Wave (+x)',
            education_note: 'E-field oscillation propagating along +x. Radiation is strongest perpendicular to oscillation axis.',
            position: { x: 3, y: 0, z: 0 }, color: '#f8fafc',
            frequency: 0.4, amplitude_e: 1.8, amplitude_b: 0.6,
            polarization_deg: 0, propagation_axis: 'x',
            show_e_field: true, show_b_field: false,
            show_poynting: false,
            wavelength_bands: 'visible', color_e: '#f97316', color_b: '#8b5cf6', num_cycles: 3,
        },
    ],

    circuit_links: [],
    physics_links: [],

    controls: [
        { group: 'Charge', label: 'Oscillation Speed', param: 'charge.initial_velocity.y', min: 0.5, max: 8, default: 3, step: 0.1, unit: 'm/s', education_note: 'Faster → higher amplitude → stronger radiation.' },
        { group: 'Wave', label: 'E-Field Amplitude', param: 'wave_z.amplitude_e', min: 0.3, max: 4, default: 1.8, step: 0.1, unit: 'V/m', education_note: 'E₀ ∝ q·a/r.' },
        { group: 'Wave', label: 'Frequency', param: 'wave_z.frequency', min: 0.1, max: 2, default: 0.4, step: 0.05, unit: 'Hz (scaled)', education_note: 'Real EM waves travel at c = 3×10⁸ m/s.' },
    ],

    educational_sequence: [
        { step: 1, title: 'Watch Oscillation', instruction: 'Red charge oscillates vertically. Its trail shows sinusoidal motion.', focus_objects: ['charge'], focus_controls: [] },
        { step: 2, title: 'See the Waves', instruction: 'Two E-field waves propagate outward along +z and +x. Both transverse to propagation.', focus_objects: ['wave_z', 'wave_x'], focus_controls: [] },
    ],
};

/** All demos for quick switching */
export const MODE2_DEMOS = { DOUBLE_PENDULUM, SERIES_RLC, EM_RADIATION };
