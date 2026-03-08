# NewtonAI Chatbot & History Implementation Summary

## Overview
Added conversational AI tutoring capabilities with session persistence (DynamoDB) and simulation history tracking (localStorage).

## Key Features
✅ Chat integration using existing "Open Chat" button in ControlPanel
✅ No redundant floating chat icon
✅ User-generated simulations appear in sidebar history
✅ Persistent simulation history across sessions
✅ Conversation context maintained via DynamoDB

## Backend Changes (backend/main.py)

### New Dependencies
- `uuid`, `os`, `datetime`, `timezone`
- `boto3.dynamodb.conditions.Key`, `botocore.exceptions.ClientError`
- `typing.Optional`, `mangum.Mangum`

### DynamoDB Session Storage
- Table: `newton_ai_sessions` (auto-created on startup)
- Schema: session_id (HASH), timestamp (RANGE), role, content
- Stores last 5 messages for conversation context

### Updated `/generate` Endpoint
- Accepts optional `session_id` parameter
- Returns `{ session_id, simulation }` format
- Saves conversation to DynamoDB

### New `/chat` Endpoint
- Request: `{ session_id, question, simulation_id }`
- Response: `{ session_id, answer }`
- Physics tutor system prompt (plain English, <100 words)
- Temperature: 0.7, Max tokens: 300

### Converse API Migration
- Switched from `invoke_model` to `converse` API
- Enables multi-turn conversations

## Frontend Changes

### ControlPanel.tsx
- Added `onOpenChat` callback prop
- "Open Chat" button now functional

### SimulationChatbot.tsx
- Removed internal toggle button
- Now accepts `isOpen` and `onClose` props
- Controlled by parent (SimulationView)
- User messages: right-aligned blue (#3b82f6)
- Tutor messages: left-aligned dark gray (#334155)

### App.tsx - Simulation History
**localStorage Key**: `newton_simulation_history`

**Features**:
- Loads history on mount
- Saves on changes
- Limits to 10 most recent
- Deduplicates by simulation_id

**UI Changes**:
- User simulations shown first (cyan, prominent)
- Example demos shown below with separator (slate)
- Clear visual hierarchy

### App.tsx - Chat Integration
**SimulationView**:
- Added `chatOpen` state
- Passes `onOpenChat={() => setChatOpen(true)}` to ControlPanel
- Passes `isOpen={chatOpen}` and `onClose={() => setChatOpen(false)}` to SimulationChatbot

## localStorage Keys
- `newton_session_id` - Conversation session ID
- `newton_simulation_history` - User-generated simulations (max 10)

## Testing Flow
1. Generate simulation → appears in sidebar history
2. Click "Open Chat" in control panel
3. Ask question → get tutor response
4. Ask follow-up → context maintained
5. Generate another simulation → both appear in history
6. Refresh page → history persists

## AWS Resources
- DynamoDB table: `newton_ai_sessions` (PAY_PER_REQUEST)
- IAM permissions: Bedrock Converse + DynamoDB (CreateTable, PutItem, Query)

## Cost Estimate
~$55/month for 1000 students ($0.055 per student)
- DynamoDB: ~$5/month
- Bedrock: ~$50/month (10 chats per student)
