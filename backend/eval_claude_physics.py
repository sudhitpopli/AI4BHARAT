"""
NewtonAI — Nova Pro Physics Eval Suite
======================================
Tests whether the model UNDERSTANDS physics correctly, not just whether
the JSON is structurally valid.

Uses LLM-as-judge: a second Nova Pro call grades the first Nova Pro's output.

Run:
    python eval_claude_physics.py              # run full suite
    python eval_claude_physics.py --quick      # 5 prompts only
    python eval_claude_physics.py --save       # save results to eval_results.json
"""

import json
import time
import argparse
import boto3
from datetime import datetime
from typing import Any


# ═══════════════════════════════════════════════════════════════════
# EVAL CASES
# ═══════════════════════════════════════════════════════════════════

EVAL_CASES = [

    # ── MODE 1 — Classical Mechanics ────────────────────────────────

    {
        "id": "pendulum_simple",
        "prompt": "show me a simple pendulum",
        "mode": 1,
        "required_forces": ["gravity"],
        "forbidden_forces": ["coulomb", "magnetic", "lorentz"],
        "required_concepts": ["period", "gravity", "tension"],
        "min_objects": 2,
        "physics_check": (
            "A pendulum needs: (1) a fixed anchor/pivot, "
            "(2) a bob with mass, (3) a connecting rod/rope with high stiffness. "
            "Period T = 2π√(L/g). The rod should be near-inextensible (stiffness > 500). "
            "There should be NO restitution on the bob."
        ),
    },
    {
        "id": "atwood_machine",
        "prompt": "simulate an atwood machine",
        "mode": 1,
        "required_forces": ["gravity"],
        "forbidden_forces": ["coulomb", "drag"],
        "required_concepts": ["acceleration", "tension", "mass difference"],
        "min_objects": 3,
        "physics_check": (
            "Atwood machine needs: (1) a fixed pulley at top, "
            "(2) two masses connected by a rope over the pulley, "
            "(3) both masses feel gravity. "
            "Acceleration a = (m1-m2)g/(m1+m2). "
            "The rope must pass OVER the pulley — check that one rope end connects "
            "to pulley, the other segments connect to each mass. "
            "Pulley should be static/pinned."
        ),
    },
    {
        "id": "elastic_collision",
        "prompt": "two balls colliding elastically",
        "mode": 1,
        "required_forces": ["gravity"],
        "forbidden_forces": [],
        "required_concepts": ["momentum", "kinetic energy", "conservation"],
        "min_objects": 3,
        "physics_check": (
            "Elastic collision: both balls should have restitution = 1.0 "
            "(or very close to 1.0). "
            "If restitution < 1.0 it's inelastic — kinetic energy is lost. "
            "The education_note should mention conservation of both momentum AND kinetic energy. "
            "Balls should approach each other with initial velocities, not both moving same direction."
        ),
    },
    {
        "id": "projectile_motion",
        "prompt": "projectile motion — ball thrown at an angle",
        "mode": 1,
        "required_forces": ["gravity"],
        "forbidden_forces": ["magnetic", "spring"],
        "required_concepts": ["parabola", "range", "angle", "velocity components"],
        "min_objects": 2,
        "physics_check": (
            "Projectile: ball should have an initial velocity with BOTH x and y components "
            "(thrown at an angle, not straight up or horizontal). "
            "Gravity acts downward. No drag unless explicitly requested. "
            "Range R = v²sin(2θ)/g — maximum at 45°. "
            "Education notes should mention this relationship."
        ),
    },
    {
        "id": "spring_oscillation",
        "prompt": "mass on a spring oscillating",
        "mode": 1,
        "required_forces": ["spring", "gravity"],
        "forbidden_forces": ["coulomb"],
        "required_concepts": ["hooke", "period", "frequency", "amplitude"],
        "min_objects": 2,
        "physics_check": (
            "Spring-mass: needs a fixed anchor at top, a mass hanging below, "
            "connected by a spring link (not rope). "
            "Spring constant k affects period: T = 2π√(m/k). "
            "If there's no damping, oscillation continues forever. "
            "Equilibrium position is where spring force balances gravity: x_eq = mg/k."
        ),
    },

    # ── MODE 1 — Tricky Cases ────────────────────────────────────────

    {
        "id": "double_pendulum_chaos",
        "prompt": "double pendulum showing chaos",
        "mode": 1,
        "required_forces": ["gravity"],
        "forbidden_forces": [],
        "required_concepts": ["chaos", "butterfly effect", "sensitive"],
        "min_objects": 3,
        "physics_check": (
            "Double pendulum: anchor → bob1 (rod1) → bob2 (rod2). "
            "Both rods must have HIGH stiffness (>= 800) — otherwise they stretch "
            "and chaos is destroyed by elastic dynamics. "
            "The educational value is sensitivity to initial conditions — "
            "there should be a control to change the initial angle of bob1. "
            "The education_note on bob2 should mention 'chaos' or 'butterfly effect'."
        ),
    },
    {
        "id": "inclined_plane_friction",
        "prompt": "block sliding down a ramp with friction",
        "mode": 1,
        "required_forces": ["gravity"],
        "forbidden_forces": ["spring", "coulomb"],
        "required_concepts": ["friction", "normal force", "angle", "coefficient"],
        "min_objects": 2,
        "physics_check": (
            "Inclined plane: needs a ramp object (not a flat floor) with a non-zero rotation. "
            "Block should have friction coefficient > 0. "
            "Net acceleration along ramp = g(sinθ - μcosθ). "
            "Block should NOT slide if μ > tanθ — the sim should demonstrate this. "
            "Education note should show the relationship between angle and friction."
        ),
    },

    # ── MODE 2 — EM & Circuits ───────────────────────────────────────

    {
        "id": "rlc_resonance",
        "prompt": "series RLC circuit showing resonance",
        "mode": 2,
        "required_forces": [],
        "forbidden_forces": [],
        "required_concepts": ["resonance", "impedance", "Q factor", "frequency"],
        "min_objects": 4,
        "physics_check": (
            "Series RLC: VS → R → L → C → GND → VS (this exact loop). "
            "Current flows: VS.p → R.p, R.n → L.p, L.n → C.p, C.n → GND, GND → VS.n. "
            "CRITICAL: L.n must connect to C.p (positive terminal of C). "
            "f₀ = 1/(2π√LC) — verify L and C values give f₀ ≈ source frequency. "
            "Q = ω₀L/R. Education notes must mention resonance frequency formula."
        ),
    },
    {
        "id": "charged_particle_magnetic",
        "prompt": "charged particle moving in a magnetic field — circular motion",
        "mode": 2,
        "required_forces": ["lorentz", "magnetic"],
        "forbidden_forces": ["gravity", "spring"],
        "required_concepts": ["cyclotron", "radius", "perpendicular", "magnetic force"],
        "min_objects": 2,
        "physics_check": (
            "Charged particle in B field: needs a charged_particle and a magnetic_field object. "
            "Lorentz force F = qv×B is ALWAYS perpendicular to velocity. "
            "This means NO energy gain — only direction changes. "
            "The particle should move in a circle (or helix if v has component along B). "
            "Cyclotron radius r = mv/(qB). "
            "gravity_y should be 0 — gravity ruins circular motion."
        ),
    },
    {
        "id": "em_wave_radiation",
        "prompt": "oscillating charge generating electromagnetic radiation",
        "mode": 2,
        "required_forces": [],
        "forbidden_forces": ["gravity"],
        "required_concepts": ["larmor", "acceleration", "radiation", "transverse"],
        "min_objects": 2,
        "physics_check": (
            "EM radiation: needs a charged_particle that oscillates (harmonic trap or spring). "
            "The em_wave objects should be COUPLED to the charge — not hardcoded frequencies. "
            "E and B fields are transverse (perpendicular to propagation). "
            "No radiation along the oscillation axis (the dipole axis). "
            "Larmor formula: P ∝ q²a². Faster oscillation = more power radiated. "
            "The physics_links array should NOT be empty if coupling is required."
        ),
    },

    # ── Edge Cases — things the model should NOT hallucinate ───────────

    {
        "id": "pendulum_no_em",
        "prompt": "show me a pendulum",
        "mode": 1,
        "required_forces": ["gravity"],
        "forbidden_forces": ["coulomb", "magnetic", "radiation"],
        "required_concepts": [],
        "min_objects": 2,
        "physics_check": (
            "A pendulum has NO electromagnetic forces. "
            "Claude should not add coulomb, lorentz, or radiation forces to a pendulum. "
            "It should not add drag unless the prompt says 'in air' or 'with damping'. "
            "Keep it simple: gravity + rigid constraint."
        ),
    },
    {
        "id": "no_overcomplicated_simple",
        "prompt": "show me a ball bouncing",
        "mode": 1,
        "required_forces": ["gravity"],
        "forbidden_forces": [],
        "required_concepts": [],
        "min_objects": 2,
        "physics_check": (
            "A bouncing ball should be SIMPLE: one ball, one floor, gravity, restitution. "
            "Nova Pro should not over-engineer this with multiple forces, complex joints, "
            "or unnecessary objects. Max 3 objects total. "
            "Restitution should be between 0.5 and 0.95 for visible bouncing."
        ),
    },
]


# ═══════════════════════════════════════════════════════════════════
# PROMPTS
# ═══════════════════════════════════════════════════════════════════

GENERATION_SYSTEM_PROMPT = """You are a physics simulation engine for NewtonAI.
Output RAW JSON only. No markdown, no backticks, no explanation.
First character must be { and last must be }.
Generate a complete simulation payload for the given prompt.
Mode 1 uses Rapier rigid body physics.
Mode 2 uses useFrame parametric math (electronics, EM, orbits).
Mode 3 uses particle simulation with free equation forces."""


JUDGE_SYSTEM_PROMPT = """You are a physics professor grading an AI-generated physics simulation.

You will receive:
1. The student prompt that was given to the AI
2. The JSON payload the AI generated
3. The physics check criteria

Your job: determine if the AI correctly modeled the physics.

Respond with ONLY a JSON object in this exact format:
{
  "pass": true or false,
  "score": 0-10,
  "critical_errors": ["list of physically wrong things that would mislead students"],
  "missing_forces": ["forces that should be present but aren't"],
  "wrong_forces": ["forces present that shouldn't be"],
  "physics_notes": "brief explanation of what's right and wrong",
  "would_mislead_student": true or false
}

Be strict. A simulation that LOOKS correct but has wrong physics is a FAIL.
A missing force that changes the qualitative behavior is a FAIL.
Wrong parameter scale (e.g. stiffness=1 for a rigid rod) is a FAIL."""


def call_bedrock(prompt: str, system: str, model: str = "amazon.nova-pro-v1:0") -> str:
    client = boto3.client("bedrock-runtime", region_name="us-east-1")
    response = client.invoke_model(
        modelId=model,
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
    result = json.loads(response["body"].read())
    return result["output"]["message"]["content"][0]["text"].strip()


def generate_simulation(prompt: str) -> tuple[dict | None, str]:
    """Call Nova Pro to generate a simulation payload."""
    try:
        import re
        text = call_bedrock(prompt, GENERATION_SYSTEM_PROMPT)
        text = re.sub(r'^```[a-z]*\n?', '', text)
        text = re.sub(r'\n?```$', '', text)
        return json.loads(text), text
    except json.JSONDecodeError as e:
        return None, f"JSON_PARSE_ERROR: {e}"
    except Exception as e:
        return None, f"BEDROCK_ERROR: {e}"


def judge_simulation(prompt: str, payload: dict, physics_check: str) -> dict:
    """Call judge Nova Pro to evaluate physics correctness."""
    import re
    judge_prompt = f"""
STUDENT PROMPT: "{prompt}"

PHYSICS CHECK CRITERIA:
{physics_check}

AI-GENERATED PAYLOAD:
{json.dumps(payload, indent=2)[:6000]}

Grade this simulation. Does it correctly model the physics described in the criteria?
"""
    try:
        text = call_bedrock(judge_prompt, JUDGE_SYSTEM_PROMPT)
        text = re.sub(r'^```[a-z]*\n?', '', text)
        text = re.sub(r'\n?```$', '', text)
        return json.loads(text)
    except Exception as e:
        return {
            "pass": False,
            "score": 0,
            "critical_errors": [f"Judge call failed: {e}"],
            "missing_forces": [],
            "wrong_forces": [],
            "physics_notes": "Judge error",
            "would_mislead_student": True,
        }


def run_eval_case(case: dict) -> dict:
    """Run a single eval case. Returns full result dict."""
    print(f"\n  ▶ {case['id']}: '{case['prompt']}'")

    # Generate
    t0 = time.time()
    payload, raw = generate_simulation(case["prompt"])
    gen_time = time.time() - t0

    if payload is None:
        return {
            "id": case["id"],
            "prompt": case["prompt"],
            "generation_failed": True,
            "parse_error": raw,
            "judge_result": None,
            "final_pass": False,
            "gen_time_s": gen_time,
        }

    # Structural checks (fast, no LLM)
    from test_newton import validate_payload
    validation = validate_payload(payload)

    # Judge (slow, LLM)
    t1 = time.time()
    judge = judge_simulation(case["prompt"], payload, case["physics_check"])
    judge_time = time.time() - t1

    # Combine: must pass BOTH structural validation AND judge
    final_pass = (
        validation["passed"] and
        judge.get("pass", False) and
        not judge.get("would_mislead_student", True)
    )

    result = {
        "id":                  case["id"],
        "prompt":              case["prompt"],
        "mode":                case["mode"],
        "generation_failed":   False,
        "structural_pass":     validation["passed"],
        "structural_errors":   validation["structural_errors"] + validation["reference_errors"],
        "judge_result":        judge,
        "final_pass":          final_pass,
        "gen_time_s":          round(gen_time, 2),
        "judge_time_s":        round(judge_time, 2),
    }

    # Print immediate feedback
    status = "✅" if final_pass else "❌"
    score  = judge.get("score", 0)
    print(f"  {status} Score: {score}/10 | "
          f"Structural: {'✓' if validation['passed'] else '✗'} | "
          f"Physics: {'✓' if judge.get('pass') else '✗'} | "
          f"Gen: {gen_time:.1f}s")

    if not final_pass:
        for err in judge.get("critical_errors", [])[:2]:
            print(f"     ⚠ {err}")
        for err in (validation["structural_errors"] + validation["reference_errors"])[:2]:
            print(f"     ✗ {err}")

    time.sleep(0.5)  # rate limit
    return result


def run_eval_suite(cases: list[dict], save: bool = False) -> dict:
    """Run full eval suite. Returns summary."""
    print("\n" + "═" * 60)
    print("NewtonAI — Nova Pro Physics Eval Suite")
    print(f"Running {len(cases)} eval cases...")
    print("═" * 60)

    results = []
    for case in cases:
        result = run_eval_case(case)
        results.append(result)

    # Summary stats
    total       = len(results)
    passes      = sum(1 for r in results if r["final_pass"])
    gen_fails   = sum(1 for r in results if r["generation_failed"])
    struct_fails= sum(1 for r in results
                      if not r["generation_failed"] and not r["structural_pass"])
    judge_fails = sum(1 for r in results
                      if not r["generation_failed"] and r["structural_pass"]
                      and not r.get("judge_result", {}).get("pass", False))

    pass_rate = passes / total if total > 0 else 0

    avg_score = sum(
        r["judge_result"]["score"]
        for r in results
        if r.get("judge_result") and "score" in r["judge_result"]
    ) / max(1, sum(1 for r in results if r.get("judge_result")))

    summary = {
        "timestamp":     datetime.now().isoformat(),
        "total":         total,
        "passes":        passes,
        "pass_rate":     round(pass_rate, 3),
        "avg_score":     round(avg_score, 2),
        "gen_failures":  gen_fails,
        "struct_failures":struct_fails,
        "judge_failures":judge_fails,
        "results":       results,

        "failure_breakdown": {
            "json_parse":       gen_fails,
            "schema_structure": struct_fails,
            "wrong_physics":    judge_fails,
        },

        "failed_cases": [r["id"] for r in results if not r["final_pass"]],
        "passed_cases": [r["id"] for r in results if r["final_pass"]],
    }

    # Print summary
    print("\n" + "═" * 60)
    print("EVAL SUMMARY")
    print("═" * 60)
    print(f"  Pass rate:        {pass_rate*100:.1f}%  ({passes}/{total})")
    print(f"  Average score:    {avg_score:.1f}/10")
    print(f"  JSON parse fails: {gen_fails}")
    print(f"  Schema fails:     {struct_fails}")
    print(f"  Physics fails:    {judge_fails}")

    print(f"\n  Failed cases:")
    for cid in summary["failed_cases"]:
        case = next(c for c in cases if c["id"] == cid)
        print(f"    ✗ {cid}: '{case['prompt']}'")

    # Deployment gate
    print("\n" + "═" * 60)
    PASS_RATE_THRESHOLD = 0.75
    SCORE_THRESHOLD     = 6.5
    if pass_rate >= PASS_RATE_THRESHOLD and avg_score >= SCORE_THRESHOLD:
        print(f"✅ DEPLOYMENT GATE: PASSED")
        print(f"   Pass rate {pass_rate*100:.0f}% >= {PASS_RATE_THRESHOLD*100:.0f}%")
        print(f"   Avg score {avg_score:.1f} >= {SCORE_THRESHOLD}")
        gate_passed = True
    else:
        print(f"❌ DEPLOYMENT GATE: FAILED")
        if pass_rate < PASS_RATE_THRESHOLD:
            print(f"   Pass rate {pass_rate*100:.0f}% < {PASS_RATE_THRESHOLD*100:.0f}% required")
        if avg_score < SCORE_THRESHOLD:
            print(f"   Avg score {avg_score:.1f} < {SCORE_THRESHOLD} required")
        gate_passed = False

    summary["gate_passed"] = gate_passed

    if save:
        fname = f"eval_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(fname, "w") as f:
            json.dump(summary, f, indent=2)
        print(f"\n  Results saved to {fname}")

    return summary


# ═══════════════════════════════════════════════════════════════════
# TREND TRACKING
# ═══════════════════════════════════════════════════════════════════

def compare_eval_runs(file1: str, file2: str):
    """Compare two eval result files to track trends."""
    with open(file1) as f: r1 = json.load(f)
    with open(file2) as f: r2 = json.load(f)

    print(f"\nEval Trend: {r1['timestamp'][:10]} → {r2['timestamp'][:10]}")
    print(f"  Pass rate: {r1['pass_rate']*100:.1f}% → {r2['pass_rate']*100:.1f}%  "
          f"({'↑' if r2['pass_rate'] > r1['pass_rate'] else '↓'})")
    print(f"  Avg score: {r1['avg_score']:.1f} → {r2['avg_score']:.1f}  "
          f"({'↑' if r2['avg_score'] > r1['avg_score'] else '↓'})")

    newly_failed  = set(r2['failed_cases']) - set(r1['failed_cases'])
    newly_passed  = set(r1['failed_cases']) - set(r2['failed_cases'])

    if newly_failed:
        print(f"\n  ⚠ Newly failing (regression):")
        for cid in newly_failed:
            print(f"    ✗ {cid}")
    if newly_passed:
        print(f"\n  ✓ Newly passing (improvement):")
        for cid in newly_passed:
            print(f"    ✓ {cid}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--quick", action="store_true",
                        help="Run only 5 cases (fast check)")
    parser.add_argument("--save", action="store_true",
                        help="Save results to JSON file")
    parser.add_argument("--compare", nargs=2, metavar=("FILE1", "FILE2"),
                        help="Compare two eval result files")
    args = parser.parse_args()

    if args.compare:
        compare_eval_runs(args.compare[0], args.compare[1])
    else:
        cases = EVAL_CASES[:5] if args.quick else EVAL_CASES
        summary = run_eval_suite(cases, save=args.save)
        exit(0 if summary["gate_passed"] else 1)
