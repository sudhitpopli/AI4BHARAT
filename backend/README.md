# NewtonAI Backend

FastAPI backend using Google Gemini 2.5 Pro for physics simulation generation.

## Quick Start

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure API keys:**
   ```bash
   cp .env.example .env
   # Edit .env and add your Gemini API keys
   ```

3. **Run the server:**
   ```bash
   uvicorn main:app --reload --port 8000
   ```

## Get API Keys

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Get API Key"
3. Create 1-5 API keys
4. Add to `.env` file

## Environment Variables

```env
# Required: At least one API key
GEMINI_API_KEY_1=your_key_here
GEMINI_API_KEY_2=your_key_here  # Optional
GEMINI_API_KEY_3=your_key_here  # Optional
GEMINI_API_KEY_4=your_key_here  # Optional
GEMINI_API_KEY_5=your_key_here  # Optional
```

## API Endpoints

### POST /generate
Generate a physics simulation from natural language.

**Request:**
```json
{
  "prompt": "Show me a bouncing ball",
  "session_id": "optional-session-id"
}
```

**Response:**
```json
{
  "session_id": "uuid",
  "simulation": { /* PhysicsSchema JSON */ }
}
```

### POST /chat
Ask questions about the current simulation.

**Request:**
```json
{
  "session_id": "uuid",
  "question": "Why does the ball bounce?",
  "simulation_id": "bouncing-ball-001"
}
```

**Response:**
```json
{
  "session_id": "uuid",
  "answer": "The ball bounces because..."
}
```

### GET /health
Check API status.

**Response:**
```json
{
  "status": "ok",
  "model": "gemini-2.0-flash-exp",
  "api_keys_loaded": 5
}
```

## Load Balancing

The backend automatically rotates through all configured API keys using round-robin:

```
Request 1 → Key #1
Request 2 → Key #2
Request 3 → Key #3
Request 4 → Key #1 (wraps around)
...
```

This prevents rate limiting during heavy testing.

## Session Storage

Currently uses in-memory storage (dictionary). For production, consider:
- Redis (recommended)
- PostgreSQL
- MongoDB

## Development

```bash
# Install dev dependencies
pip install -r requirements.txt

# Run with auto-reload
uvicorn main:app --reload --port 8000

# Run tests (if available)
pytest
```

## Production Deployment

1. Use a proper database for session storage
2. Set environment variables on hosting platform
3. Enable HTTPS
4. Add rate limiting per user
5. Configure CORS for your domain

## Troubleshooting

**"No Gemini API keys found"**
- Check `.env` file exists
- Verify at least one `GEMINI_API_KEY_X` is set
- Restart server after editing `.env`

**"Failed to reach Gemini API"**
- Check API keys are valid
- Verify internet connection
- Check [Google AI Studio status](https://status.cloud.google.com/)

**"Model not found"**
- Update `google-generativeai` package:
  ```bash
  pip install --upgrade google-generativeai
  ```
