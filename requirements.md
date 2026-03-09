# NewtonAI - Requirements Document

## Project Overview

NewtonAI is an educational 3D physics simulator that generates interactive physics simulations from natural language prompts. Students can describe a physics scenario in plain English, and the system generates a fully interactive 3D simulation with runtime controls for exploration.

## Core Requirements

### 1. AI-Powered Simulation Generation

**REQ-1.1: Natural Language Input**
- System MUST accept natural language physics prompts
- Prompts can be simple ("bouncing ball") or detailed ("ball rolling down ramp")
- Maximum prompt length: 500 characters
- Minimum prompt length: 3 characters

**REQ-1.2: Multi-Stage Generation Pipeline**
- Stage 1: Physics reasoning in plain English
- Stage 2: JSON encoding with structured output
- Stage 3: Validation and automatic error correction
- Each stage MUST have comprehensive logging for debugging

**REQ-1.3: Complexity Validation**
- System MUST validate prompt complexity before generation
- Maximum 5 objects per simulation
- Maximum 3 links/constraints per simulation
- Reject prompts outside allowed domains (circuits, fluids, quantum, etc.)

### 2. AI Model Integration

**REQ-2.1: Primary Model - Google Gemini**
- Use Google Gemini 3 Flash Preview as primary model
- Support 1-5 API keys for load balancing
- Round-robin key rotation
- Automatic rate limit detection

**REQ-2.2: Fallback Model - AWS Bedrock Nova Pro**
- Automatically switch to Bedrock when all Gemini keys exhausted
- Detect 429 errors, quota errors, rate limit errors
- Track failed keys and reset on success
- Seamless fallback without user intervention

**REQ-2.3: Model Configuration**
- Centralized model name configuration
- Token limits: Stage 1=2048, Stage 2=8192, Stage 3=8192
- Temperature settings: Stage 1=0.7, Stage 2=0.1, Stage 3=0.0
- JSON MIME type enforcement for structured output

### 3. Scope Constraints

**REQ-3.1: Allowed Domains**
- Simple mechanical physics (balls, pendulums, springs, ramps, collisions)
- Basic electrostatics (charged particles, electric fields)

**REQ-3.2: Forbidden Domains**
- Circuits (electrical)
- Fluids (hydrodynamics)
- Quantum mechanics
- Thermodynamics
- Optics
- Complex multi-body mechanics

**REQ-3.3: Complexity Limits**
- Maximum 5 objects per simulation
- Maximum 3 links/constraints
- Simple scenarios only (beginner to intermediate difficulty)

### 4. User Interface

**REQ-4.1: Integrated Control Panel**
- Chat interface integrated into control panel
- Toggle between controls and chat
- Button text changes: "Open Chat" ↔ "Show Controls"
- No separate dialog windows

**REQ-4.2: Simulation History**
- User-generated simulations appear in left sidebar
- Maximum 10 recent simulations stored
- Automatic deduplication by simulation_id
- localStorage-based persistence
- User simulations in cyan, examples in slate

**REQ-4.3: Generation Feedback**
- Real-time elapsed timer during generation
- Average time estimate display (~60-90s)
- Timer updates every second
- Clear error messages with suggestions

**REQ-4.4: Visual Branding**
- Custom favicon with atom logo
- Page title: "NewtonAI - Physics Simulator"
- Consistent color scheme

### 5. Runtime Controls

**REQ-5.1: Control Design Philosophy**
- PREFER runtime properties over initial conditions
- Runtime controls: gravity, material properties, object sizes, link properties
- Initial conditions only when they are the primary learning objective
- 2-4 controls per simulation minimum

**REQ-5.2: Auto-Reset Behavior**
- Simulation auto-resets when initial condition sliders change
- Position, velocity, rotation changes trigger reset
- Material/geometry changes trigger full remount
- Smooth user experience without manual reset

**REQ-5.3: Slider Controls**
- All controls MUST affect simulation behavior
- Changes apply immediately (runtime) or on reset (initial conditions)
- Clear labels and units
- Educational notes explaining what each control teaches

### 6. Error Handling

**REQ-6.1: Structured Error Responses**
- Error type classification: out_of_scope, too_complex, ambiguous, rejected
- User-friendly error messages
- Actionable suggestions for fixing prompts
- Technical details for debugging (when DEBUG_MODE enabled)

**REQ-6.2: Error Recovery**
- Stage 3 automatic error correction
- Retry logic for malformed JSON
- Best-effort payload fallback
- Graceful degradation

**REQ-6.3: Example Prompts**
- Provide example buttons: Bouncing Ball, Simple Pendulum, Rolling Ball, Charged Particles
- Help users understand acceptable prompt format
- Reduce error rate through guidance

### 7. Session Management

**REQ-7.1: Session Storage**
- DynamoDB for persistent session storage
- In-memory fallback if DynamoDB unavailable
- Session ID generation for new users
- Message history for chat context

**REQ-7.2: Chat History**
- Store last 5 messages per session
- Format for Gemini API compatibility
- Chronological ordering (oldest → newest)
- Separate storage for user and assistant messages

### 8. Performance

**REQ-8.1: Generation Time**
- Target: 60-90 seconds per simulation
- Stage 1: 10-20 seconds
- Stage 2: 30-60 seconds
- Stage 3: 10-20 seconds (if triggered)

**REQ-8.2: Optimization Strategies**
- No conversation history in simulation generation
- Efficient token limits
- Minimal database queries
- Round-robin load balancing

**REQ-8.3: Performance Monitoring**
- Log stage durations
- Track total generation time
- Monitor API key usage
- Alert on performance degradation

### 9. Logging and Debugging

**REQ-9.1: Debug Mode**
- Environment variable: DEBUG_MODE=true/false
- Comprehensive logging when enabled
- Log all Gemini inputs and outputs
- Stage-by-stage execution tracking

**REQ-9.2: CloudWatch Integration**
- Request ID tracking for all operations
- Structured log format for parsing
- Timestamp all log entries
- Include context: session_id, prompt, duration

**REQ-9.3: Log Levels**
- INFO: Normal operations, stage completions
- WARNING: Validation errors, correction attempts
- ERROR: Failures, exceptions, rejections
- Startup banner with configuration summary

### 10. Deployment

**REQ-10.1: AWS Lambda Compatibility**
- Mangum handler for Lambda deployment
- Environment variable configuration
- No hardcoded credentials
- Stateless operation

**REQ-10.2: Environment Configuration**
- .env file for local development
- Environment variables for production
- .env.example template provided
- Clear documentation for all variables

**REQ-10.3: Dependencies**
- Python 3.9+ compatibility
- FastAPI for API framework
- Google Generative AI SDK
- Boto3 for AWS services
- Pydantic for validation

### 11. Security

**REQ-11.1: API Key Management**
- Never log full API keys
- Rotate keys via environment variables
- Support multiple keys for redundancy
- Automatic failover on key exhaustion

**REQ-11.2: Input Validation**
- Sanitize user prompts
- Validate prompt length
- Reject malicious patterns
- Rate limiting (future enhancement)

**REQ-11.3: CORS Configuration**
- Allow frontend origins
- Restrict in production
- Credentials support
- Method and header restrictions

### 12. Monitoring and Health

**REQ-12.1: Health Endpoint**
- GET /health endpoint
- Return system status
- Show model configuration
- Display API key count
- Indicate Bedrock availability
- Show debug mode status

**REQ-12.2: Metrics**
- Track failed keys count
- Monitor generation success rate
- Log API usage patterns
- Alert on anomalies

## Non-Functional Requirements

### Performance
- 95th percentile generation time < 120 seconds
- API response time < 5 seconds for health checks
- Support 10 concurrent users minimum

### Reliability
- 99% uptime target
- Automatic failover to Bedrock
- Graceful error handling
- No data loss on failures

### Scalability
- Horizontal scaling via Lambda
- Stateless design
- Load balancing across API keys
- DynamoDB for distributed sessions

### Maintainability
- Comprehensive logging
- Clear code documentation
- Modular architecture
- Configuration via environment variables

### Usability
- Intuitive natural language interface
- Clear error messages
- Helpful suggestions
- Example prompts provided

## Future Enhancements

### Phase 2 (Not Required Now)
- Caching for common simulations
- Streaming JSON generation
- Advanced physics domains
- Multi-language support
- User accounts and saved simulations
- Collaborative features
- Mobile app

### Phase 3 (Future)
- Custom physics engines
- VR/AR support
- Classroom management features
- Assessment and grading tools
- Curriculum integration
- Analytics dashboard

## Success Criteria

1. **Generation Success Rate**: >95% of valid prompts generate working simulations
2. **Performance**: Average generation time 60-90 seconds
3. **User Satisfaction**: Clear error messages, helpful suggestions
4. **Reliability**: Automatic fallback to Bedrock when Gemini exhausted
5. **Debugging**: Comprehensive logs for troubleshooting in CloudWatch
6. **Scope Compliance**: Reject out-of-scope prompts with helpful feedback

## Acceptance Criteria

- [ ] System generates simulations from natural language prompts
- [ ] Three-stage pipeline with validation and correction
- [ ] Gemini primary, Bedrock fallback working
- [ ] Complexity validation rejects invalid prompts
- [ ] Integrated chat in control panel
- [ ] Simulation history in sidebar
- [ ] Auto-reset on initial condition changes
- [ ] Comprehensive logging for CloudWatch
- [ ] Health endpoint returns system status
- [ ] Error messages are clear and actionable
- [ ] Generation time 60-90 seconds average
- [ ] All controls affect simulation behavior
- [ ] Example prompts provided
- [ ] Documentation complete and accurate
