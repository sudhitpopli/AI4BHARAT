# Requirements Document: NewtonAI - Generative Physics Imagination Engine

## Introduction

NewtonAI is an AI-powered generative physics simulation platform that transforms natural language descriptions into interactive, photorealistic 3D physics simulations. Built on Unreal Engine 5 and AWS Bedrock, it enables students and researchers to visualize abstract physics concepts through the simple principle: "If you can describe it, we can simulate it."

The MVP focuses on delivering core simulation generation capabilities for classical mechanics, electromagnetism, and special relativity, with an emphasis on cost-effective caching, real-time interaction, and AI-guided learning.

## Glossary

- **Student**: A high school student, college student, or research professional using the platform
- **Simulation_Manifest**: A JSON document describing physics objects, properties, and behaviors
- **Asset_Processor**: Backend service that validates and stores simulation manifests
- **UE5_Client**: Unreal Engine 5 application running on student's device
- **AI_Tutor**: Claude-powered conversational assistant providing physics explanations
- **Cache_Service**: Redis-based semantic caching layer for simulation manifests
- **Bedrock_Service**: AWS Bedrock API using Claude 3.5 Sonnet for generation
- **Simulation_Lab**: A saved collection of simulation parameters and state
- **Physics_Parameter**: Adjustable value like mass, velocity, voltage, or field strength
- **Job_Queue**: AWS SQS queue for asynchronous processing of complex simulations
- **Circuit_Breaker**: Fault tolerance pattern that prevents cascading failures when Bedrock is unavailable
- **Dead_Letter_Queue**: AWS SQS queue for storing failed jobs that require manual investigation
- **Featured_Simulation**: Pre-generated simulation manifest for common physics scenarios

## Requirements

### Requirement 1: Natural Language Simulation Generation

**User Story:** As a student, I want to describe a physics scenario in plain English, so that I can quickly visualize concepts without learning complex simulation tools.

#### Acceptance Criteria

1. WHEN a student submits a natural language query, THE System SHALL send the query to the backend API
2. WHEN the backend receives a query, THE Cache_Service SHALL check for semantically similar cached manifests
3. IF a cache hit occurs, THEN THE System SHALL return the cached Simulation_Manifest within 50ms
4. IF a cache miss occurs, THEN THE Bedrock_Service SHALL generate a new Simulation_Manifest within 5 seconds
5. WHEN Bedrock generates a manifest, THE Asset_Processor SHALL validate the JSON schema compliance
6. IF the manifest is valid, THEN THE System SHALL store it in the cache and return it to the UE5_Client
7. IF the manifest is invalid, THEN THE System SHALL return an error message to the student

### Requirement 2: Classical Mechanics Simulations

**User Story:** As a student, I want to generate simulations of classical mechanics scenarios, so that I can understand motion, forces, and energy concepts.

#### Acceptance Criteria

1. WHEN a student requests a projectile motion simulation, THE System SHALL generate a manifest with initial velocity, angle, and gravitational parameters
2. WHEN a student requests a pendulum simulation, THE System SHALL generate a manifest with length, mass, and initial displacement parameters
3. WHEN a student requests a collision simulation, THE System SHALL generate a manifest with object masses, velocities, and collision types (elastic/inelastic)
4. WHEN a student requests a rotational motion simulation, THE System SHALL generate a manifest with moment of inertia, angular velocity, and torque parameters
5. THE UE5_Client SHALL render all classical mechanics simulations using Chaos Physics engine

### Requirement 3: Electromagnetism Simulations

**User Story:** As a student, I want to generate simulations of electromagnetic phenomena, so that I can visualize invisible fields and forces.

#### Acceptance Criteria

1. WHEN a student requests an electric field simulation, THE System SHALL generate a manifest with charge distributions and field visualization parameters
2. WHEN a student requests a magnetic field simulation, THE System SHALL generate a manifest with current sources and field line parameters
3. WHEN a student requests an electromagnetic induction simulation, THE System SHALL generate a manifest with changing flux and induced current parameters
4. WHEN a student requests a circuit simulation, THE System SHALL generate a manifest with components (resistors, capacitors, inductors) and voltage sources
5. THE UE5_Client SHALL render electromagnetic simulations using Niagara particle systems for field visualization

### Requirement 4: Special Relativity Simulations

**User Story:** As a student, I want to generate simulations of relativistic effects, so that I can understand time dilation and length contraction.

#### Acceptance Criteria

1. WHEN a student requests a time dilation simulation, THE System SHALL generate a manifest with reference frames and relative velocities approaching light speed
2. WHEN a student requests a length contraction simulation, THE System SHALL generate a manifest showing object dimensions in different reference frames
3. THE UE5_Client SHALL render relativistic effects with visual distortions and time indicators
4. WHEN rendering relativistic simulations, THE System SHALL display both proper time and coordinate time measurements

### Requirement 5: Real-Time Parameter Adjustment

**User Story:** As a student, I want to adjust simulation parameters in real-time, so that I can explore how changes affect physical behavior.

#### Acceptance Criteria

1. WHEN a simulation is loaded, THE UE5_Client SHALL display interactive sliders for all adjustable Physics_Parameters
2. WHEN a student adjusts a parameter slider, THE UE5_Client SHALL update the simulation within 16ms (60 FPS)
3. THE System SHALL support adjustment of at least these parameter types: mass, velocity, acceleration, charge, voltage, current, angle, and time scale
4. WHEN a parameter is adjusted, THE UE5_Client SHALL maintain physics accuracy according to the governing equations
5. THE UE5_Client SHALL display current parameter values numerically alongside sliders

### Requirement 6: AI Tutor Integration

**User Story:** As a student, I want to ask questions about the simulation I'm viewing, so that I can deepen my understanding with context-aware explanations.

#### Acceptance Criteria

1. WHEN a simulation is active, THE UE5_Client SHALL provide a chat interface for the AI_Tutor
2. WHEN a student asks a question, THE AI_Tutor SHALL receive the current Simulation_Manifest and parameter values as context
3. WHEN the AI_Tutor responds, THE System SHALL display the explanation within 3 seconds
4. THE AI_Tutor SHALL provide explanations that reference the specific physics principles governing the active simulation
5. THE AI_Tutor SHALL suggest parameter adjustments to demonstrate specific concepts when relevant

### Requirement 7: Semantic Caching for Cost Optimization

**User Story:** As a platform operator, I want to cache semantically similar queries, so that I can reduce API costs while maintaining fast response times.

#### Acceptance Criteria

1. WHEN a query is received, THE Cache_Service SHALL generate a semantic embedding of the query text
2. WHEN checking the cache, THE Cache_Service SHALL compare the query embedding against stored embeddings using cosine similarity
3. IF the similarity score exceeds 0.85, THEN THE Cache_Service SHALL return the cached manifest as a cache hit
4. WHEN a new manifest is generated, THE Cache_Service SHALL store it with its semantic embedding and a TTL of 7 days
5. THE Cache_Service SHALL achieve a cache hit rate of at least 70% after the first 1000 queries
6. WHEN the cache is full, THE Cache_Service SHALL evict the least recently used entries

### Requirement 8: Simulation Lab Persistence

**User Story:** As a student, I want to save and load my simulation configurations, so that I can return to experiments later or share them with others.

#### Acceptance Criteria

1. WHEN a student clicks save, THE System SHALL store the current Simulation_Manifest and all parameter values
2. WHEN saving a lab, THE System SHALL associate it with the student's user ID via Cognito authentication
3. WHEN a student requests their saved labs, THE System SHALL return a list of lab names and creation timestamps
4. WHEN a student loads a saved lab, THE UE5_Client SHALL restore the exact simulation state within 2 seconds
5. THE System SHALL support at least 50 saved labs per student account
6. THE System SHALL allow students to delete saved labs, freeing up space in their 50-lab quota

### Requirement 9: Asset Validation and Error Handling

**User Story:** As a platform operator, I want to validate generated manifests before rendering, so that invalid or non-existent assets don't crash the client.

#### Acceptance Criteria

1. WHEN the Asset_Processor receives a manifest, THE Asset_Processor SHALL validate all referenced asset paths against the available asset library
2. IF a manifest references non-existent assets, THEN THE Asset_Processor SHALL substitute default fallback assets
3. WHEN validation fails critically, THE Asset_Processor SHALL return a descriptive error message to the student
4. THE Asset_Processor SHALL validate that all numeric parameters are within physically reasonable bounds
5. IF parameters are out of bounds, THEN THE Asset_Processor SHALL clamp them to safe limits and log a warning

### Requirement 10: User Authentication and Session Management

**User Story:** As a student, I want to securely log in to the platform, so that my saved labs and usage are tracked to my account.

#### Acceptance Criteria

1. WHEN a student opens the UE5_Client, THE System SHALL prompt for authentication via AWS Cognito
2. THE System SHALL support email/password authentication and social login (Google)
3. WHEN authentication succeeds, THE System SHALL issue a JWT token valid for 24 hours
4. WHEN a token expires, THE System SHALL prompt for re-authentication without losing unsaved work
5. THE System SHALL enforce rate limiting of 100 API requests per student per hour

### Requirement 11: Performance and Latency Requirements

**User Story:** As a student, I want simulations to load quickly and run smoothly, so that I can maintain focus on learning rather than waiting.

#### Acceptance Criteria

1. WHEN a cached manifest is requested, THE System SHALL return it within 50ms (p95)
2. WHEN a new manifest is generated from text input, THE System SHALL return it within 5 seconds (p95). Image-based generation may take up to 8 seconds due to vision processing overhead.
3. WHEN the UE5_Client renders a simulation, THE System SHALL maintain at least 60 FPS on recommended hardware
4. THE System SHALL serve assets via CloudFront CDN with edge locations in Mumbai, Delhi, and Bangalore
5. WHEN network latency exceeds 200ms, THE UE5_Client SHALL display a loading indicator

### Requirement 12: Cost Control and Monitoring

**User Story:** As a platform operator, I want to monitor and control API costs, so that the platform remains economically sustainable at ₹6/month per student.

#### Acceptance Criteria

1. THE System SHALL log all Bedrock API calls with token counts to CloudWatch
2. THE System SHALL track cache hit rates and cost savings in CloudWatch metrics
3. WHEN a student exceeds 50 new generations per month, THE System SHALL display a usage warning
4. THE System SHALL calculate and display estimated monthly cost per student in the admin dashboard
5. IF cache hit rate falls below 60%, THEN THE System SHALL alert platform operators

### Requirement 13: 3D Navigation and Interaction

**User Story:** As a student, I want to navigate around simulations in 3D space, so that I can examine physics phenomena from different perspectives.

#### Acceptance Criteria

1. THE UE5_Client SHALL support orbit camera controls (mouse drag to rotate, scroll to zoom)
2. THE UE5_Client SHALL support pan controls (right-click drag or WASD keys)
3. WHEN a student clicks on a simulated object, THE UE5_Client SHALL highlight it and display its current properties
4. THE UE5_Client SHALL provide a reset camera button to return to the default view

**Note:** VR headset support is planned for future releases and is not part of the MVP.

### Requirement 14: Simulation Manifest Schema

**User Story:** As a developer, I want a well-defined JSON schema for simulation manifests, so that the UE5_Client can reliably parse and render them.

#### Acceptance Criteria

1. THE Simulation_Manifest SHALL include a version field for schema versioning
2. THE Simulation_Manifest SHALL include an objects array with position, rotation, scale, and physics properties
3. THE Simulation_Manifest SHALL include a parameters array defining all adjustable Physics_Parameters
4. THE Simulation_Manifest SHALL include a physics_type field (classical_mechanics, electromagnetism, special_relativity)
5. WHEN the Asset_Processor validates a manifest, THE Asset_Processor SHALL verify compliance with the JSON schema definition
6. THE System SHALL provide a pretty printer for manifests to aid debugging
7. FOR ALL valid Simulation_Manifest objects, parsing then printing then parsing SHALL produce an equivalent object (round-trip property)

### Requirement 15: Image-Based Simulation Generation

**User Story:** As a student, I want to upload images of circuits, diagrams, or physical spaces, so that I can generate simulations based on real-world scenarios.

#### Acceptance Criteria

1. THE UE5_Client SHALL provide an image upload interface accepting PNG, JPG, and JPEG formats up to 10MB
2. WHEN an image is uploaded, THE System SHALL send it to Bedrock with vision capabilities (Claude 3.5 Sonnet)
3. THE Bedrock_Service SHALL analyze the image and extract physics objects, relationships, and parameters
4. THE System SHALL generate a Simulation_Manifest based on the extracted information within 8 seconds
5. THE System SHALL support circuit diagrams, schematic sketches, and photos of physical spaces
6. WHEN Bedrock returns a confidence score < 0.7 for image analysis, THE System SHALL prompt the student with clarifying questions (e.g., "Is this resistor 100Ω or 1kΩ?") before generating the final manifest
7. THE System SHALL cache image-based manifests using a hash of the image content

### Requirement 16: Asynchronous Processing for Complex Simulations

**User Story:** As a student, I want to request complex simulations without waiting, so that I can continue exploring while it generates.

#### Acceptance Criteria

1. WHEN a simulation is estimated to take more than 30 seconds, THE System SHALL queue it via AWS SQS
2. THE System SHALL return a job_id and status "PENDING" immediately to the student
3. THE UE5_Client SHALL display a "Your simulation is being generated" notification with the job_id
4. WHEN the background Lambda completes processing, THE System SHALL update the job status to "READY"
5. THE UE5_Client SHALL poll the job status every 5 seconds or receive a notification when ready
6. WHEN a job completes, THE System SHALL store the manifest and notify the student via in-app notification
7. THE System SHALL retain completed job results for 24 hours before cleanup

### Requirement 17: First-Person Immersive Mode

**User Story:** As a student, I want to explore simulations from a first-person perspective, so that I feel like I'm inside the physics phenomenon.

#### Acceptance Criteria

1. THE UE5_Client SHALL provide a "First-Person Mode" toggle button in the simulation interface
2. WHEN first-person mode is activated, THE camera SHALL be positioned inside or near the simulation environment
3. THE Student SHALL be able to move around using WASD keys and mouse look controls like a game character
4. THE UE5_Client SHALL render physics effects (electric fields, magnetic field lines, particles) from the player's viewpoint
5. THE Student SHALL be able to "walk through" electric fields or "fly alongside" projectiles in motion
6. WHEN in first-person mode, THE UE5_Client SHALL display a velocity indicator and position coordinates
7. THE System SHALL maintain 60 FPS performance in first-person mode on recommended hardware

### Requirement 18: Circuit Breaker for Bedrock API Failures

**User Story:** As a platform operator, I want to prevent system overload when Bedrock is unavailable, so that the platform degrades gracefully.

#### Acceptance Criteria

1. WHEN Bedrock API calls fail 5 times within 60 seconds, THE System SHALL open the circuit breaker
2. WHEN the circuit breaker is open, THE System SHALL return featured simulation suggestions instead of calling Bedrock
3. THE System SHALL attempt to close the circuit breaker after 30 seconds with a test request. IF the test succeeds, resume normal operation. IF the test fails, return to OPEN state for another 30 seconds before retrying.
4. WHEN the circuit breaker is open, THE System SHALL display: "AI generation temporarily unavailable. Try a featured simulation."
5. THE System SHALL log all circuit breaker state changes to CloudWatch
6. WHEN the circuit breaker closes successfully, THE System SHALL resume normal Bedrock API calls

### Requirement 19: Fallback Simulation Library

**User Story:** As a student, I want to access common simulations instantly when AI generation fails, so that I'm not blocked from learning.

#### Acceptance Criteria

1. THE System SHALL maintain at least 20 pre-generated "Featured Simulations" covering common physics topics
2. WHEN Bedrock is unavailable OR generation fails, THE System SHALL suggest 3 relevant featured simulations based on the query
3. Featured simulations SHALL include: projectile motion, simple pendulum, elastic collision, capacitor charging, magnetic induction, time dilation, length contraction, and others
4. Featured simulations SHALL load within 500ms without requiring any API calls
5. THE UE5_Client SHALL clearly label featured simulations as "Pre-built Simulation" to distinguish from custom generations
6. THE System SHALL track usage of featured simulations to identify popular topics for optimization

### Requirement 20: Failed Job Recovery via Dead Letter Queue

**User Story:** As a platform operator, I want failed simulation jobs logged, so that I can investigate and recover from errors.

#### Acceptance Criteria

1. WHEN a simulation job fails after 3 retries, THE System SHALL move it to the Dead Letter Queue (DLQ)
2. THE System SHALL log the failure reason to CloudWatch including: timeout, invalid JSON, Bedrock error, or validation failure
3. WHEN DLQ depth exceeds 10 messages, THE System SHALL trigger a CloudWatch alarm to alert operators
4. WHEN a student's job fails permanently, THE System SHALL display: "Generation failed. Please try rephrasing your request or try a featured simulation."
5. THE System SHALL store DLQ messages for 14 days for debugging and analysis
6. Platform operators SHALL be able to manually retry DLQ messages after investigating failures

### Requirement 21: Retry Logic for Transient Failures

**User Story:** As a platform operator, I want automatic retries for failed API calls, so that temporary glitches don't result in student-facing errors.

#### Acceptance Criteria

1. WHEN a Bedrock API call fails with a retriable error (timeout, 429 rate limit, 500 server error), THE System SHALL automatically retry
2. THE System SHALL use exponential backoff with delays of 1 second, 2 seconds, and 4 seconds between retries
3. THE System SHALL attempt up to 3 retries before marking the request as permanently failed
4. WHEN all retries are exhausted, THE System SHALL log the error and trigger the circuit breaker or DLQ flow as appropriate
5. THE System SHALL NOT retry non-retriable errors (400 bad request, 401 unauthorized, 403 forbidden)
6. THE System SHALL track retry counts and success rates in CloudWatch metrics
