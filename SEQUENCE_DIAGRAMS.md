# UML Sequence Diagrams - Twilio ConversationRelay + Meta Llama

This directory contains UML sequence diagrams showing the complete interaction flow between:
- **Twilio TwiML** - Handles incoming calls and generates XML responses
- **Twilio Conversation Relay WebSocket** - Real-time bidirectional communication
- **This Server** - Express/WebSocket server orchestrating the flow
- **Meta Llama API** - AI language model for generating responses

## Diagram Files

### 1. `sequence-diagram.puml`
**Complete interaction flow** including:
- Call initiation and TwiML generation
- WebSocket connection setup
- Voice prompt processing loop
- Llama API integration
- User interruptions handling
- DTMF (keypad) input processing
- Call termination scenarios
- Heartbeat/ping-pong mechanism

### 2. `sequence-diagram-simplified.puml`
**Simplified main flow** showing:
- Basic call setup
- Core conversation loop
- Essential message flow

## How to Render the Diagrams

### Option 1: PlantUML Online Server
1. Visit https://www.plantuml.com/plantuml/uml/
2. Copy the contents of either `.puml` file
3. Paste into the text editor
4. The diagram will render automatically

### Option 2: VS Code Extension
1. Install the PlantUML extension in VS Code
2. Open either `.puml` file
3. Press `Alt+D` to preview the diagram

### Option 3: Command Line
```bash
# Install PlantUML
java -jar plantuml.jar sequence-diagram.puml

# This generates sequence-diagram.png
```

### Option 4: Export as SVG
```bash
java -jar plantuml.jar -tsvg sequence-diagram.puml
```

## Key Interaction Flows

### 1. Initial Call Setup
1. Caller dials Twilio phone number
2. Twilio webhooks to server's `/api/voice/incoming`
3. Server returns TwiML with ConversationRelay WebSocket URL
4. Twilio establishes WebSocket connection to server

### 2. Voice Processing Loop
1. User speaks → Twilio transcribes to text
2. Twilio sends PROMPT message via WebSocket
3. Server calls Meta Llama API with conversation context
4. Llama returns AI-generated response
5. Server sends TEXT message back to Twilio
6. Twilio converts text to speech and plays to caller

### 3. Message Types

#### Twilio → Server (WebSocket)
- `setup` - Initialize session with call details
- `prompt` - User's transcribed voice input
- `interrupt` - User interrupted TTS playback
- `dtmf` - Keypad digit pressed
- `end` - Call termination
- `ping` - Heartbeat

#### Server → Twilio (WebSocket)
- `text` - Text for TTS conversion
- `play` - Media file playback
- `language` - Language settings
- `end` - Terminate call
- `pong` - Heartbeat response

### 4. Key Components

#### Server Components
- **TwiML Controller** - Generates TwiML XML responses
- **WebSocket Service** - Manages WebSocket connections
- **Message Handler** - Routes and processes messages
- **Session Manager** - Maintains conversation state
- **Llama Service** - Interfaces with Meta Llama API

#### External Services
- **Twilio Platform** - Voice processing, transcription, TTS
- **Meta Llama API** - AI text generation

## Architecture Highlights

- **Real-time Communication**: WebSocket for low-latency voice interactions
- **Session Management**: Conversation history tracked per call
- **Voice Optimization**: System prompts and response formatting for natural speech
- **Error Handling**: Graceful degradation and user-friendly error messages
- **Scalability**: Supports multiple concurrent calls via WebSocket

## Related Files

- `src/controllers/twiml.controller.ts` - TwiML generation
- `src/services/websocket/websocket.service.ts` - WebSocket server
- `src/services/websocket/message.handler.ts` - Message processing
- `src/services/llama/llama.service.ts` - Llama API integration
- `src/types/websocket.types.ts` - Message type definitions