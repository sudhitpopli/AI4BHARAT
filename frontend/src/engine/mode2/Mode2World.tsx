import { useMemo } from 'react';
import { SceneSetup } from '../SceneSetup';
import { OrbitRenderer, WaveRenderer, SpringMassRenderer, ProjectileRenderer } from './ClassicalRenderers';
import { ChargedParticleRenderer, ElectricFieldRenderer, MagneticFieldRenderer, FieldLineRenderer, EMWaveRenderer } from './EMRenderers';
import { CircuitScene } from './CircuitRenderer';
import { RelativisticParticleRenderer, SpacetimeDiagramRenderer, GasParticleRenderer, HeatDiffusionRenderer, LightRayRenderer, OpticalMediumRenderer } from './MiscRenderers';
import type { Mode2Schema, Mode2Object, ChargedParticle } from '../../types/physics_mode2';

/* ── Deep-clone + apply control overrides (same logic as Mode 1) ── */
function applyOverrides(schema: Mode2Schema, overrides: Record<string, number>): Mode2Schema {
    if (Object.keys(overrides).length === 0) return schema;
    const clone: Mode2Schema = JSON.parse(JSON.stringify(schema));
    for (const [param, val] of Object.entries(overrides)) {
        const parts = param.split('.');
        if (parts[0] === 'environment') {
            let t: Record<string, unknown> = clone.environment as unknown as Record<string, unknown>;
            for (let i = 1; i < parts.length - 1; i++) t = t[parts[i]] as Record<string, unknown>;
            t[parts[parts.length - 1]] = val;
            continue;
        }
        if (parts[0] === 'special') {
            const pos = clone.objects.find(o => o.id === 'positive_charge') as ChargedParticle;
            const neg = clone.objects.find(o => o.id === 'negative_charge') as ChargedParticle;
            if (parts[1] === 'dipole_x' && pos && neg) {
                pos.position.x = -val;
                neg.position.x = val;
            } else if (parts[1] === 'dipole_q' && pos && neg) {
                pos.charge = val;
                neg.charge = -val;
            }
            continue;
        }
        const id = parts[0];
        const obj = (clone.objects as unknown as Array<Record<string, unknown>>).find(o => o.id === id);
        if (obj) {
            let t: Record<string, unknown> = obj;
            for (let i = 1; i < parts.length - 1; i++) t = t[parts[i]] as Record<string, unknown>;
            t[parts[parts.length - 1]] = val;
        }
    }
    return clone;
}

/* ── Single-object router ──────────────────────────────────────── */
function Mode2ObjectRenderer({ obj, schema }: { obj: Mode2Object; schema: Mode2Schema }) {
    switch (obj.type) {
        // Classical
        case 'orbit_body': return <OrbitRenderer obj={obj} allObjects={schema.objects} physicsLinks={schema.physics_links} />;
        case 'wave': return <WaveRenderer obj={obj} physicsLinks={schema.physics_links} allObjects={schema.objects} />;
        case 'spring_mass': return <SpringMassRenderer obj={obj} />;
        case 'projectile': return <ProjectileRenderer obj={obj} />;
        // EM
        case 'charged_particle': return <ChargedParticleRenderer obj={obj} allObjects={schema.objects} physicsLinks={schema.physics_links} />;
        case 'electric_field': return <ElectricFieldRenderer obj={obj} allObjects={schema.objects} />;
        case 'magnetic_field': return <MagneticFieldRenderer obj={obj} />;
        case 'field_line': return <FieldLineRenderer obj={obj} />;
        case 'em_wave': return <EMWaveRenderer obj={obj} />;
        // Electronics handled separately as a circuit scene
        case 'resistor': case 'inductor': case 'capacitor':
        case 'voltage_source': case 'current_source': case 'ground_node':
        case 'rlc_network': case 'transmission_line_segment':
        case 'transistor_bjt': case 'transistor_mosfet': case 'op_amp':
            return null; // handled by CircuitScene below
        // Relativity
        case 'relativistic_particle': return <RelativisticParticleRenderer obj={obj} />;
        case 'spacetime_diagram': return <SpacetimeDiagramRenderer obj={obj} />;
        // Thermo
        case 'gas_particle_system': return <GasParticleRenderer obj={obj} />;
        case 'heat_diffusion': return <HeatDiffusionRenderer obj={obj} />;
        // Optics
        case 'light_ray': return <LightRayRenderer obj={obj} allObjects={schema.objects} physicsLinks={schema.physics_links} />;
        case 'optical_medium': return <OpticalMediumRenderer obj={obj} />;
        default: return null;
    }
}

/* ── Check if schema has any electronics objects ─────────────── */
const CIRCUIT_TYPES = new Set(['resistor', 'inductor', 'capacitor', 'voltage_source', 'current_source', 'ground_node', 'rlc_network', 'transmission_line_segment', 'transistor_bjt', 'transistor_mosfet', 'op_amp']);

/* ── Main Mode 2 world ─────────────────────────────────────── */
export function Mode2World({ schema: base, controlOverrides }: { schema: Mode2Schema; controlOverrides: Record<string, number> }) {
    const schema = useMemo(() => applyOverrides(base, controlOverrides), [base, controlOverrides]);
    const hasCircuit = useMemo(() => schema.objects.some(o => CIRCUIT_TYPES.has(o.type)), [schema]);

    return (
        <>
            <SceneSetup env={schema.environment as never} />
            {/* Non-circuit objects */}
            {schema.objects.map(obj => {
                if (CIRCUIT_TYPES.has(obj.type)) return null;
                return <Mode2ObjectRenderer key={obj.id} obj={obj} schema={schema} />;
            })}
            {/* Circuit scene (renders all electronic objects + wires + charge flow) */}
            {hasCircuit && <CircuitScene schema={schema} />}
        </>
    );
}
