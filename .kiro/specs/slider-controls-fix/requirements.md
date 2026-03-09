# Slider Controls Fix - Requirements

## Problem Statement

Some simulation sliders don't appear to work because they modify initial conditions (like launch velocity, starting position) that only take effect when the simulation is reset. Users expect sliders to have immediate visible effects, but changing initial velocity mid-simulation doesn't reset the object's position.

## User Stories

### 1. As a student, I want sliders to have immediate visible effects
**Acceptance Criteria:**
- 1.1 When I move a slider, I should see the simulation respond immediately
- 1.2 I should not need to manually click "Reset Simulation" to see slider changes
- 1.3 The distinction between "runtime" and "initial condition" controls should be clear

### 2. As a student, I want to understand what each slider does
**Acceptance Criteria:**
- 2.1 Sliders that affect initial conditions should be clearly labeled
- 2.2 The UI should indicate when a slider requires a reset to take effect
- 2.3 Controls should be grouped logically (Initial Conditions vs Runtime Properties)

### 3. As a student exploring projectile motion, I want intuitive launch controls
**Acceptance Criteria:**
- 3.1 I should be able to control launch angle in degrees (not separate x/y velocity components)
- 3.2 I should be able to control launch speed in m/s
- 3.3 The simulation should auto-reset when I change launch parameters
- 3.4 I should see a visual indicator of the launch angle before the simulation starts

## Technical Context

### Current Behavior
- Controls that modify `initial_velocity`, `position`, or `rotation_deg` trigger a remount via `remountKey`
- Remounting recreates physics bodies with new initial values
- BUT the object has already moved from its starting position, so the change isn't visible
- User must manually click "Reset Simulation" to see the effect

### Root Causes
1. **Engine Issue**: Initial condition changes don't auto-reset object positions
2. **Prompt Issue**: Gemini creates controls for `initial_velocity.x` and `initial_velocity.y` separately (not intuitive)
3. **UX Issue**: No visual feedback that a slider requires reset to take effect

## Proposed Solutions

### Option A: Auto-Reset on Initial Condition Changes (Recommended)
- Detect when a control modifies an initial condition property
- Automatically reset the simulation when these controls change
- Provide visual feedback (brief flash or indicator) that reset occurred

### Option B: Separate Control Modes
- Add a "Setup Mode" where initial conditions can be changed
- Add a "Run Mode" where only runtime properties can be changed
- Require explicit transition between modes

### Option C: Hybrid Approach
- Auto-reset for simple simulations (1-3 objects)
- Show "Apply Changes" button for complex simulations
- Let Gemini decide based on simulation complexity

## Constraints

- Must not break existing simulations
- Must work with both Mode 1 (classical mechanics) and Mode 2 (EM/circuits)
- Must be intuitive for students with no physics background
- Performance: Auto-reset should be instant (< 100ms)

## Success Metrics

- Users no longer report "sliders not working"
- Reduced need for "Reset Simulation" button clicks
- Improved user satisfaction with control responsiveness

## Out of Scope

- Changing the underlying physics engine (Rapier)
- Adding new object types or link types
- Modifying the JSON schema structure
