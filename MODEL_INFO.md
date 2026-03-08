# Model Information

## Current Model: Gemini 2.0 Flash (FREE TIER)

**Model ID**: `gemini-2.0-flash-exp`

### Why This Model?
- ✅ **100% FREE** - No credit card required
- ✅ **Fast responses** - Optimized for speed
- ✅ **Good quality** - Sufficient for physics simulations
- ✅ **High quota** - 15 requests/minute per API key

### Free Tier Limits
- **Requests per minute**: 15 per API key
- **Requests per day**: 1,500 per API key
- **With 5 keys**: 75 requests/minute, 7,500 requests/day

### Alternative Models

#### Gemini 2.5 Pro
- **Model ID**: `gemini-2.5-pro`
- **Cost**: Paid tier required
- **Quality**: Higher quality responses
- **Speed**: Slower than Flash
- **Use case**: Production with budget

#### Gemini 1.5 Flash
- **Model ID**: `gemini-1.5-flash`
- **Cost**: FREE tier available
- **Quality**: Good
- **Speed**: Fast
- **Use case**: Alternative free option

### How to Switch Models

Edit `backend/main.py` and change the model name:

```python
# For simulation generation (line ~133)
model = genai.GenerativeModel(
    model_name="gemini-2.0-flash-exp",  # Change this
    generation_config={
        "temperature": 0.1,
        "max_output_tokens": max_tokens,
    },
    system_instruction=SYSTEM_PROMPT
)

# For chat (line ~288)
model = genai.GenerativeModel(
    model_name="gemini-2.0-flash-exp",  # Change this
    generation_config={
        "temperature": 0.7,
        "max_output_tokens": 300,
    },
    system_instruction=CHAT_SYSTEM_PROMPT
)
```

### Performance Comparison

| Model | Speed | Quality | Cost | Free Tier |
|-------|-------|---------|------|-----------|
| Gemini 2.0 Flash | ⚡⚡⚡ | ⭐⭐⭐ | FREE | ✅ 15 RPM |
| Gemini 1.5 Flash | ⚡⚡ | ⭐⭐⭐ | FREE | ✅ 15 RPM |
| Gemini 2.5 Pro | ⚡ | ⭐⭐⭐⭐⭐ | PAID | ❌ |

### Recommended Setup

**For Development/Testing:**
- Use `gemini-2.0-flash-exp` (current)
- Add 3-5 API keys for load balancing
- Completely free!

**For Production (Low Budget):**
- Use `gemini-2.0-flash-exp`
- Add 5+ API keys
- Monitor usage
- Still free!

**For Production (High Quality):**
- Use `gemini-2.5-pro`
- Budget for API costs
- Better simulation quality
- More accurate physics

### Current Configuration

```
Model: gemini-2.0-flash-exp
Temperature (Simulation): 0.1 (precise)
Temperature (Chat): 0.7 (conversational)
Max Tokens (Simulation): 8192
Max Tokens (Chat): 300
Cost: $0.00 (FREE)
```

### Monitoring Usage

Check your usage at:
https://aistudio.google.com/app/apikey

Each API key shows:
- Requests today
- Requests per minute
- Quota remaining

### Tips for Free Tier

1. **Use multiple keys** - Distribute load across 5 keys
2. **Cache results** - Store common simulations
3. **Rate limit frontend** - Prevent spam requests
4. **Monitor usage** - Check quota daily
5. **Rotate keys** - System does this automatically

### Upgrading to Paid

If you need more quota:
1. Go to Google Cloud Console
2. Enable billing
3. Switch to `gemini-2.5-pro`
4. Monitor costs

**Note**: With 5 free API keys, you get 7,500 requests/day - more than enough for most use cases!
