# NewtonAI Quick Start Guide

Get NewtonAI running in 5 minutes!

## Prerequisites
- Python 3.8+ installed
- Node.js 16+ installed
- Google AI Studio account (free)

---

## Step 1: Get API Keys (2 minutes)

1. Go to https://aistudio.google.com/app/apikey
2. Click "Get API Key"
3. Create 1-5 API keys
4. Copy them (you'll need them in Step 3)

---

## Step 2: Clone & Install (1 minute)

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend (in new terminal)
cd frontend
npm install
```

---

## Step 3: Configure API Keys (1 minute)

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and paste your API keys:
```env
GEMINI_API_KEY_1=paste_your_first_key_here
GEMINI_API_KEY_2=paste_your_second_key_here
GEMINI_API_KEY_3=paste_your_third_key_here
GEMINI_API_KEY_4=paste_your_fourth_key_here
GEMINI_API_KEY_5=paste_your_fifth_key_here
```

**Note:** You can use 1-5 keys. More keys = better load balancing!

---

## Step 4: Run (1 minute)

**Terminal 1 - Backend:**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

Wait for:
```
✓ Loaded X Gemini API key(s)
🚀 NewtonAI backend started
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Wait for:
```
Local: http://localhost:5173
```

---

## Step 5: Test! (30 seconds)

1. Open http://localhost:5173
2. Type: "Show me a bouncing ball"
3. Wait 2-5 seconds
4. See your simulation!
5. Click "Open Chat" in control panel
6. Ask: "Why does the ball bounce?"
7. Get instant tutor response!

---

## Troubleshooting

### "No Gemini API keys found"
- Check `.env` file exists in `backend/` directory
- Verify at least one key is set
- Restart backend

### "Failed to reach Gemini API"
- Check API keys are valid
- Try generating a new key
- Check internet connection

### "CORS error"
- Make sure backend is running on port 8000
- Make sure frontend is running on port 5173

### "Module not found"
- Backend: `pip install -r requirements.txt`
- Frontend: `npm install`

---

## What's Next?

### Learn More
- Read `SETUP_GUIDE.md` for detailed instructions
- Read `ARCHITECTURE.md` to understand the system
- Read `MIGRATION_SUMMARY.md` to see what changed

### Customize
- Add more API keys for better load balancing
- Modify system prompts in `backend/bedrock_prompt.py`
- Adjust UI colors in `frontend/src/components/`

### Deploy
- Backend: Railway, Render, or Fly.io
- Frontend: Vercel, Netlify, or Cloudflare Pages
- See `SETUP_GUIDE.md` for deployment instructions

---

## Quick Reference

### Backend
```bash
cd backend
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm run dev
```

### Health Check
```bash
curl http://localhost:8000/health
```

### View Logs
- Backend: Check terminal running uvicorn
- Frontend: F12 → Console tab in browser

---

## Features to Try

1. **Generate Simulations**
   - "Show me a pendulum"
   - "Bouncing ball on the moon"
   - "Two spheres colliding"

2. **Use Chat**
   - Click "Open Chat" in control panel
   - Ask questions about the physics
   - Get instant explanations

3. **Adjust Controls**
   - Move sliders to change parameters
   - See real-time updates
   - Click "Reset" to start over

4. **View History**
   - Generate multiple simulations
   - See them in left sidebar
   - Click to reload any simulation

---

## Success Checklist

- [ ] Backend starts without errors
- [ ] Frontend opens in browser
- [ ] Can generate a simulation
- [ ] Simulation appears in sidebar history
- [ ] Can open chat in control panel
- [ ] Can ask questions and get responses
- [ ] Can adjust sliders
- [ ] Can reset simulation

**All checked? You're ready to go! 🚀**

---

## Need Help?

1. Check `SETUP_GUIDE.md` for detailed instructions
2. Check `TROUBLESHOOTING.md` for common issues
3. Check backend logs for errors
4. Check browser console (F12) for frontend errors

---

## Pro Tips

💡 **Use multiple API keys** to avoid rate limiting during testing

💡 **Keep backend terminal visible** to see API key rotation

💡 **Use "Open Chat" button** in control panel (not a separate icon)

💡 **History persists** across page refreshes (stored in localStorage)

💡 **Session continues** across simulations (stored in backend memory)

---

**Happy simulating! 🎉**
