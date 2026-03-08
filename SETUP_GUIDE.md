# NewtonAI Setup Guide - Gemini Integration

## Overview
NewtonAI now uses Google Gemini 2.5 Pro (via AI Studio) instead of AWS Bedrock, with multiple API keys for load balancing and chat integrated directly into the ControlPanel.

## Key Changes
✅ **Gemini 2.5 Pro** instead of AWS Bedrock
✅ **Multiple API keys** (up to 5) for load balancing
✅ **Chat integrated** into ControlPanel (no separate dialog)
✅ **In-memory session storage** (no DynamoDB required)
✅ **Simulation history** persists in localStorage

---

## Backend Setup

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure API Keys
Create a `.env` file in the `backend/` directory:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` and add your Gemini API keys:
```env
GEMINI_API_KEY_1=your_first_api_key_here
GEMINI_API_KEY_2=your_second_api_key_here
GEMINI_API_KEY_3=your_third_api_key_here
GEMINI_API_KEY_4=your_fourth_api_key_here
GEMINI_API_KEY_5=your_fifth_api_key_here
```

**How to get API keys:**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Get API Key"
3. Create new API keys (you can create up to 5 for load balancing)
4. Copy each key into your `.env` file

**Note:** You can use 1-5 keys. The system will automatically load balance across all available keys.

### 3. Run the Backend
```bash
cd backend
uvicorn main:app --reload --port 8000
```

You should see:
```
✓ Loaded 5 Gemini API key(s)
🚀 NewtonAI backend started
📊 Using 5 Gemini API key(s) for load balancing
```

---

## Frontend Setup

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Run the Frontend
```bash
npm run dev
```

Open http://localhost:5173

---

## Testing the Integration

### 1. Generate a Simulation
1. Enter a prompt: "Show me a bouncing ball"
2. Wait 2-5 seconds for generation
3. Simulation appears with controls on the right

### 2. Check API Key Rotation
Look at backend logs - you'll see:
```
Using API key #1/5
Using API key #2/5
Using API key #3/5
...
```

This confirms load balancing is working!

### 3. Test Chat Integration
1. Click "Open Chat" button in ControlPanel (top-right)
2. Chat interface appears **inside the control panel**
3. Controls are hidden while chat is open
4. Ask: "Why does the ball bounce?"
5. Get tutor response
6. Click "Show Controls" to return to sliders

### 4. Test Simulation History
1. Generate multiple simulations
2. Go back to landing page
3. See all your simulations in the left sidebar (cyan color)
4. Example demos appear below (slate color)
5. Refresh page - history persists!

---

## Architecture

### Backend (Python + FastAPI)
- **Model**: `gemini-2.0-flash-exp` (Gemini 2.0 Flash - Free Tier)
- **API Keys**: Round-robin load balancing across 1-5 keys
- **Session Storage**: In-memory dictionary (no database required)
- **Endpoints**:
  - `POST /generate` - Generate simulation from prompt
  - `POST /chat` - Ask questions about simulation
  - `GET /health` - Check API status

### Frontend (React + Three.js)
- **ControlPanel**: Integrated chat interface (toggles with controls)
- **Simulation History**: localStorage (`newton_simulation_history`)
- **Session Management**: localStorage (`newton_session_id`)

### Data Flow
```
User Prompt
    ↓
Frontend (React)
    ↓
Backend (FastAPI)
    ↓
Gemini API (Round-robin key selection)
    ↓
JSON Validation (Pydantic)
    ↓
Frontend Rendering (Three.js)
```

---

## Load Balancing Strategy

### How It Works
1. Backend loads all API keys from `.env` on startup
2. Maintains a `current_key_index` counter
3. Each request uses the next key in rotation
4. Wraps around to first key after reaching the last

### Example with 3 Keys
```
Request 1 → Key #1
Request 2 → Key #2
Request 3 → Key #3
Request 4 → Key #1 (wraps around)
Request 5 → Key #2
...
```

### Benefits
- **Prevents rate limiting** during heavy testing
- **Distributes load** across multiple quotas
- **Automatic failover** (if one key fails, others continue)

---

## Chat Integration

### Old Design (Separate Dialog)
- Floating chat icon (bottom-right)
- Separate dialog box
- Redundant UI element

### New Design (Integrated)
- Chat **inside** ControlPanel
- Toggles with controls (one or the other)
- Cleaner, more cohesive UI

### UI States
1. **Controls Mode**: Sliders visible, chat hidden
2. **Chat Mode**: Chat visible, sliders hidden
3. Button text changes: "Open Chat" ↔ "Show Controls"

---

## Troubleshooting

### "No Gemini API keys found"
- Check `.env` file exists in `backend/` directory
- Verify at least one `GEMINI_API_KEY_X` is set
- Restart backend after editing `.env`

### "Failed to reach Gemini API"
- Check API keys are valid
- Verify internet connection
- Check [Google AI Studio status](https://status.cloud.google.com/)

### Chat not working
- Check browser console for errors
- Verify `newton_session_id` exists in localStorage
- Check backend logs for API errors

### Simulation history not persisting
- Check browser localStorage is enabled
- Look for `newton_simulation_history` key
- Try clearing localStorage and regenerating

---

## Cost Estimates

### Gemini 2.5 Pro Pricing (as of 2024)
- **Free tier**: 15 requests/minute, 1500 requests/day
- **Paid tier**: $0.00025 per 1K input tokens, $0.001 per 1K output tokens

### Estimated Costs (1000 students/month)
- **Simulation generation**: ~2K tokens/request × 10 requests/student = 20K tokens
- **Chat interactions**: ~500 tokens/request × 10 chats/student = 5K tokens
- **Total**: 25K tokens/student × 1000 students = 25M tokens/month
- **Cost**: ~$25/month (vs. $55/month with AWS Bedrock)

**Savings: 55% cheaper than AWS Bedrock!**

---

## Migration from AWS Bedrock

### What Changed
- ❌ Removed: `boto3`, `mangum`, DynamoDB
- ✅ Added: `google-generativeai`, `python-dotenv`
- ✅ Changed: Session storage (DynamoDB → in-memory)
- ✅ Changed: Chat UI (separate dialog → integrated)

### What Stayed the Same
- Pydantic schemas (PhysicsSchema, Mode2Schema)
- Frontend rendering (Three.js, Rapier)
- Simulation history (localStorage)
- API endpoints (`/generate`, `/chat`)

---

## Production Deployment

### Backend
1. Set environment variables on your hosting platform
2. Use a proper database (PostgreSQL, MongoDB) instead of in-memory storage
3. Add rate limiting per user
4. Enable HTTPS

### Frontend
1. Update API endpoint from `http://localhost:8000` to production URL
2. Use environment variables for API_BASE_URL
3. Enable production build optimizations

### Recommended Stack
- **Backend**: Railway, Render, or Fly.io
- **Frontend**: Vercel, Netlify, or Cloudflare Pages
- **Database**: Supabase (PostgreSQL) or MongoDB Atlas

---

## Future Enhancements
- [ ] Persistent session storage (Redis/PostgreSQL)
- [ ] User authentication
- [ ] Rate limiting per user
- [ ] Export simulation as shareable link
- [ ] Voice input for chat
- [ ] Multi-language support
- [ ] Analytics dashboard

---

## Support

### Getting Help
- Check backend logs: `uvicorn main:app --reload --port 8000`
- Check browser console: F12 → Console tab
- Verify API keys: `GET http://localhost:8000/health`

### Common Issues
1. **"Model not found"**: Update to latest `google-generativeai` package
2. **"Rate limit exceeded"**: Add more API keys or wait for quota reset
3. **"CORS error"**: Backend must be running on port 8000

---

## Quick Start Checklist
- [ ] Install backend dependencies (`pip install -r requirements.txt`)
- [ ] Create `.env` file with at least 1 API key
- [ ] Start backend (`uvicorn main:app --reload --port 8000`)
- [ ] Install frontend dependencies (`npm install`)
- [ ] Start frontend (`npm run dev`)
- [ ] Open http://localhost:5173
- [ ] Generate a simulation
- [ ] Test chat integration
- [ ] Verify history persistence

**You're all set! 🚀**
