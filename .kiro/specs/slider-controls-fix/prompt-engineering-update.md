# Prompt Engineering Update - Summary

## Changes Made

### 1. Updated Physics Reasoning Prompt (backend/main.py)

**Added STATUS Code System:**
- Response must start with `STATUS:X` in first 5-6 characters
- Status codes:
  - `STATUS:1` = Approved, within scope
  - `STATUS:2` = Out of scope (forbidden domain)
  - `STATUS:3` = Too complex (>5 objects or >3 links)
  - `STATUS:4` = Ambiguous or unclear request
  - `STATUS:0` = Other rejection reason

**Added Control Design Philosophy:**
- Strongly prefer runtime properties over initial conditions
- Runtime controls (work immediately):
  - ✓ Gravity strength
  - ✓ Material properties (restitution, friction, density)
  - ✓ Object size (radius, width, height, length)
  - ✓ Link properties (spring constant, damping, rope length)
  - ✓ For projectiles: angle (degrees) and speed (m/s)

- Avoid initial conditions (require reset):
  - ✗ Direct position controls
  - ✗ Direct velocity components
  - ✗ Rotation angles

- Exception: Initial conditions OK if they're the primary learning objective

### 2. Updated Status Parsing Logic (backend/main.py)

**Enhanced `reason_about_physics()` function:**
- Parses `STATUS:X` from first 10 characters using regex
- Maps status codes to error types
- Returns enhanced complexity_check dict with:
  - `status`: "APPROVED" | "OUT_OF_SCOPE" | "TOO_COMPLEX" | "AMBIGUOUS"
  - `status_code`: int (0-4)
  - `domain`: "mechanical" | "electrostatic"
  - `reason`: str | None

**Updated error handling in `/generate` endpoint:**
- Checks `status != "APPROVED"` instead of just `== "OUT_OF_SCOPE"`
- Maps status codes to error types:
  - 2 → "out_of_scope"
  - 3 → "too_complex"
  - 4 → "ambiguous"
  - 0 → "rejected"

### 3. Removed Manual Keyword Detection

**Deleted `detect_complexity()` function:**
- Removed the manual keyword-based complexity checking
- Gemini now handles ALL complexity checking via STATUS codes
- Eliminates redundant validation layer
- Simpler, more maintainable code

**Benefits:**
- Single source of truth (Gemini) for complexity decisions
- More intelligent rejection reasons (Gemini explains why)
- Fewer false positives/negatives from keyword matching
- Reduced code complexity

### 4. Updated Projectile Motion Instructions (backend/bedrock_prompt.py)

**Clarified control preferences:**
- BEST: Gravity, ball size, material properties
- OK: "Horizontal Launch Speed" and "Vertical Launch Speed"
- Note added: Launch velocity controls will auto-reset the simulation

## Benefits

### 1. Faster Rejection Detection
- Backend can parse STATUS code immediately (first 5 chars)
- No need to scan entire response for keywords
- More reliable than text parsing

### 2. Better Control Design
- Gemini will prefer runtime controls that work immediately
- Fewer confusing "sliders that don't work" issues
- Better user experience with responsive controls

### 3. More Granular Error Handling
- Can distinguish between "out of scope" vs "too complex"
- Better error messages for users
- Easier debugging and analytics

### 4. Simpler Architecture
- Removed redundant keyword detection layer
- Single source of truth for complexity decisions
- Gemini provides better explanations than keyword matching

## Testing Recommendations

Test with these prompts to verify STATUS codes:

1. **STATUS:1 (Approved)**
   - "bouncing ball"
   - "simple pendulum"
   - "two charged particles"

2. **STATUS:2 (Out of Scope)**
   - "water flowing through pipe" (fluids)
   - "LED circuit" (circuits)
   - "quantum tunneling" (quantum)

3. **STATUS:3 (Too Complex)**
   - "10 balls bouncing"
   - "Newton's cradle with 8 balls"
   - "complex bridge with many supports"

4. **STATUS:4 (Ambiguous)**
   - "physics thing"
   - "make it move"
   - "something cool"

## Example Response Format

**Approved:**
```
STATUS:1
DOMAIN: mechanical

Objects needed:
- Sphere (ball): radius 0.5m, rubber material...
- Plane (floor): 20m x 10m, wood material...

Controls (prefer runtime):
- Gravity: -9.81 to -1.62 m/s²
- Ball bounciness: 0.0 to 1.0
- Ball radius: 0.1 to 1.5m
```

**Rejected:**
```
STATUS:2
REASON: This requires fluid dynamics simulation which is not supported. Fluid flow involves complex Navier-Stokes equations beyond our simple mechanical domain.
```

## Compatibility

- ✓ Backward compatible with existing error handling
- ✓ Frontend already handles all error types
- ✓ No schema changes required
- ✓ Works with existing auto-reset feature

## Architecture Simplification

**Before:**
```
User Prompt
    ↓
Backend keyword check (detect_complexity)
    ↓ (if passed)
Gemini reasoning (with complexity check)
    ↓
JSON encoding
```

**After:**
```
User Prompt
    ↓
Gemini reasoning (with STATUS code)
    ↓ (if STATUS:1)
JSON encoding
```

Removed one entire validation layer, making the system simpler and more reliable.

## Future Enhancements

Potential improvements not implemented yet:
- Add STATUS:5 for "needs clarification" (ask follow-up questions)
- Add STATUS:6 for "partially supported" (suggest simplification)
- Track status code analytics to improve prompt engineering
- A/B test different control design strategies
