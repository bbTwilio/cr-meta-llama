# Twilio ConversationRelay with Meta Llama Integration

A voice-enabled AI assistant that integrates Twilio's ConversationRelay with Meta's Llama chat completions API. This system handles incoming phone calls through Twilio, processes voice input in real-time, generates AI responses using Llama models, and streams natural-sounding speech back to the caller.

## ✨ Features

- **🎙️ Real-time Voice Processing**: Handles voice input through Twilio ConversationRelay
- **🤖 AI-Powered Responses**: Integrates with Meta Llama API for intelligent conversation
- **🔌 WebSocket Communication**: Bidirectional real-time communication with Twilio
- **📱 DTMF Support**: Handles touch-tone input for menu navigation
- **🎯 Interruption Handling**: Gracefully manages user interruptions during AI responses
- **🎨 Enhanced Logging**: Beautiful colored logs with icons and smart formatting
- **🚀 Simplified Architecture**: Clean, minimal code without complex state management (60% less code!)

## 📋 Prerequisites

- Node.js v18+ and npm
- Twilio account with phone number
- Meta Llama API access key
- ngrok or public URL for webhooks (development)

## 🚀 Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy the environment template and configure:

```bash
cp .env.example .env
```

3. Edit `.env` with your credentials (see Configuration section)

## ⚙️ Configuration

### Required Environment Variables

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Your Twilio Account SID
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx      # Your Twilio Auth Token
TWILIO_WELCOME_GREETING="Hello! How can I assist you today?"  # Initial greeting

# Meta Llama API
LLAMA_API_KEY=your_api_key_here                        # Your Llama API key
LLAMA_API_URL=https://api.llama.com/v1/chat/completions  # API endpoint
LLAMA_MODEL=Llama-4-Maverick-17B-128E-Instruct-FP8     # Model to use

# External URL (for webhooks)
PUBLIC_URL=https://your-domain.ngrok.io                # Your public URL

# Logging (enhanced with colors and icons)
LOG_LEVEL=info                                         # debug, info, warn, error
LOG_FORMAT=simple                                      # 'simple' for pretty colors, 'json' for production
```

### All Configuration Options

See `.env.example` for the complete list of configuration options including:
- Server settings (port, environment)
- Llama model parameters (temperature, max tokens, system prompt)
- WebSocket configuration (path, heartbeat, max payload)

## 💻 Usage

### Development Mode

Start the server with hot reload and pretty logging:

```bash
npm run dev
```

You'll see a beautiful startup banner:
```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🤖 CR-META-LLAMA  v1.0.0                                  ║
║   Twilio ConversationRelay + Meta Llama Integration          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

### Production Mode

Build and start:

```bash
npm run build
npm start
```

### Testing

Run tests:

```bash
npm test
```

## 📞 Setting Up Twilio

### 1. Expose Local Server (for development)

```bash
ngrok http 3000
```

### 2. Configure Twilio Phone Number

In your Twilio Console:
- Go to Phone Numbers > Manage > Active Numbers
- Select your phone number
- Set the Voice webhook to: `https://your-ngrok-url.ngrok.io/api/voice/incoming`
- Method: POST
- Set the Status Callback URL to: `https://your-ngrok-url.ngrok.io/api/voice/status`

### 3. Update Environment

Set `PUBLIC_URL` in your `.env` file to your ngrok URL.

## 🌐 API Endpoints

### HTTP Endpoints

- `POST /api/voice/incoming` - Handles incoming voice calls, returns TwiML
- `POST /api/voice/action` - Handles Connect action callbacks
- `POST /api/voice/status` - Receives call status updates
- `GET /health` - Health check endpoint

### WebSocket Endpoint

- `wss://[PUBLIC_URL]/ws` - ConversationRelay WebSocket connection

## 🏗️ Architecture

### Components

1. **HTTP Server (Express)**
   - Handles Twilio webhooks
   - Generates TwiML responses with ConversationRelay
   - Simple routing and health checks

2. **WebSocket Server**
   - Real-time bidirectional communication
   - Implements Twilio ConversationRelay protocol
   - Basic connection handling

3. **Llama Service**
   - Meta Llama API integration
   - Response generation
   - Conversation context from session

4. **Session Manager**
   - Simple call tracking
   - Conversation history (last 20 messages)
   - Automatic memory management

### Message Flow

1. Twilio sends call to `/api/voice/incoming`
2. Server returns TwiML with ConversationRelay element
3. Twilio establishes WebSocket connection
4. Setup message initializes session (welcome greeting via TwiML)
5. Voice prompts are transcribed and sent as WebSocket messages
6. Prompts are processed through Llama API
7. Responses are sent back as text tokens for TTS
8. Session ends on hangup or timeout

### WebSocket Message Format

The system implements the [Twilio ConversationRelay WebSocket protocol](https://www.twilio.com/docs/voice/conversationrelay/websocket-messages):

**Messages FROM Twilio:**
- `setup` - Connection initialization with session details
- `prompt` - Transcribed voice input from caller
- `dtmf` - Touch-tone digit input
- `interrupt` - Caller interrupted TTS playback
- `error` - Error notifications

**Messages TO Twilio:**
- `text` - Text to be converted to speech
- `end` - End the session
- (Additional message types supported but not yet implemented)

## 📊 Monitoring & Logging

### Enhanced Logging with Colors and Icons

The system features beautiful, color-coded logging with icons:

- 💬 **INFO** (Cyan) - Normal operations
- ⚠️ **WARN** (Yellow) - Warnings
- ❌ **ERROR** (Red) - Errors
- 🔍 **DEBUG** (Gray) - Debug information

Service-specific icons:
- 📞 Twilio events
- 🤖 Llama API calls
- 🔌 WebSocket connections
- 🔐 Session management
- ⚡ Performance metrics

### Log Configuration

```env
LOG_LEVEL=info          # Verbosity: debug, info, warn, error
LOG_FORMAT=simple       # 'simple' for colors, 'json' for structured
```

### Production Logging

Logs are written to files in production:
- `logs/error.log` - Error-level logs only
- `logs/combined.log` - All logs (JSON format)
- Automatic rotation at 5MB, keeps last 5 files

### Metrics

The session manager tracks:
- Total/active sessions
- Average session duration
- Message counts
- API call counts

Access metrics via:

```typescript
const metrics = sessionManager.getMetrics();
```

## 🔧 Troubleshooting

### Common Issues

1. **WebSocket Connection Fails**
   - Verify PUBLIC_URL is accessible
   - Check firewall/security group settings
   - Ensure WebSocket path matches configuration (`/ws`)

2. **Llama API Errors**
   - Verify API key is valid
   - Check API endpoint URL
   - Monitor rate limits in logs

## 🔒 Security Considerations

- Always validate Twilio webhook signatures in production
- Store sensitive credentials in environment variables
- Use HTTPS/WSS in production
- Implement rate limiting for API endpoints
- Regularly rotate API keys
- Never commit `.env` file to version control

## ⚡ Performance Optimization

- Conversation history limited to 20 messages per call
- No background tasks or timers
- Minimal memory footprint
- Fast startup and shutdown
- Efficient resource usage

