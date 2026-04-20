#  PolicyTracer — Agentic AI Platform

Enterprise-grade agentic AI workflow for insurance policy investigation and CloudWatch log tracing.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LOCAL MACHINE                                 │
│                                                                      │
│  ┌──────────────────┐          ┌──────────────────────────────────┐  │
│  │  React Frontend  │          │       Express Backend            │  │
│  │   port 5173      │◄────────►│         port 4000               │  │
│  │                  │  SSE +   │                                  │  │
│  │  AgentPanel      │  REST    │  POST /api/agent/query           │  │
│  │  TraceCards      │          │  GET  /api/policies/:num         │  │
│  │  PolicySidebar   │          │  GET  /api/health                │  │
│  └──────────────────┘          └────────────┬─────────────────────┘  │
│                                             │                        │
│                                             │ Ollama SDK             │
│                                             ▼                        │
│                                  ┌──────────────────┐               │
│                                  │   Ollama (LLM)   │               │
│                                  │    llama3.2      │               │
│                                  │   port 11434     │               │
│                                  └────────┬─────────┘               │
│                                           │                         │
│                              tool_calls[] │ (up to 8 iterations)    │
│                                           ▼                         │
│                                  ┌──────────────────┐               │
│                                  │  dispatchTool()  │               │
│                                  └──┬───────────┬───┘               │
│                                     │           │                   │
│              POLICY_LAMBDA_URL set? │           │ CW tools always   │
│                                     │           │ run locally       │
└─────────────────────────────────────┼───────────┼───────────────────┘
                                      │           │
                           HTTP POST  │           │ FilterLogEvents
                                      ▼           ▼
                   ┌──────────────────────┐   ┌──────────────────────────┐
                   │    AWS Lambda        │   │   AWS CloudWatch Logs    │
                   │   policy-service     │   │                          │
                   │                      │   │  /aws/lambda/            │
                   │  POST /policy-status │──►│    policy-service  ◄──┐ │
                   │  POST /policy-events │   │                       │ │
                   │                      │   │  /aws/ecs/            │ │
                   │  Logs every          │   │    policy-processor   │ │
                   │  correlationId to    │   │                       │ │
                   │  stdout (→ CW auto)  │   └───────────────────────┼─┘
                   └──────────┬───────────┘                           │
                              │                       search_cloudwatch_logs
                              │ mongoose              cloudwatch_insights_query
                              ▼                       (local backend reads CW)
                   ┌──────────────────────┐
                   │    MongoDB Atlas      │
                   │  policy_tracer DB     │
                   │                      │
                   │  policies            │
                   │  policy_events       │
                   │  (correlationId idx) │
                   └──────────────────────┘
```

### Cross-system Trace Flow

```
1. Agent calls get_policy_events(correlationId: "abc-123")
         │
         ▼
2. Local backend  ──HTTP POST──►  Lambda /policy-events
         │
         ▼
3. Lambda queries MongoDB, then logs structured JSON to stdout:
   { "level":"INFO", "message":"policy_event",
     "correlationId":"abc-123", "eventType":"CLAIM_SUBMITTED", ... }
         │
         ▼  (automatic)
4. CloudWatch captures log under /aws/lambda/policy-service
         │
         ▼
5. Agent calls search_cloudwatch_logs(uniqueIdentifier: "abc-123")
         │
         ▼
6. cloudwatchTool queries CloudWatch → finds the Lambda log lines
         │
         ▼
7. Agent synthesises MongoDB data + CloudWatch trace → final answer
   streamed to frontend as SSE events
```

### SSE Event Stream

```
agent:thinking   →  "I'll use get_policy_status to look up this policy..."
agent:tool_call  →  { toolName: "get_policy_status", parameters: { policyNumber: "POL-2024-AUTO-001" } }
agent:tool_result→  { success: true, data: { policy: { status: "ACTIVE", ... } } }
agent:tool_call  →  { toolName: "search_cloudwatch_logs", parameters: { uniqueIdentifier: "abc-123" } }
agent:tool_result→  { success: true, data: { events: [...] } }
agent:response   →  ### Policy Overview\n...  (final markdown answer)
agent:done       →  { totalSteps: 3, totalMs: 4200 }
```

## Stack

| Layer       | Technology                              |
|-------------|----------------------------------------|
| AI Model    | Llama 3.2 via Ollama (local)            |
| Backend     | Node.js 22, TypeScript, Express         |
| Policy API  | AWS Lambda (Node 22) + API Gateway HTTP |
| Database    | MongoDB Atlas (Mongoose ODM)            |
| Logs        | AWS CloudWatch Logs                     |
| Streaming   | Server-Sent Events (SSE)                |
| Frontend    | React 18, Vite, TypeScript, Tailwind v3 |
| IaC         | AWS SAM (`lambda/template.yaml`)        |

## Prerequisites

- Node.js >= 22
- MongoDB Atlas URI
- [Ollama](https://ollama.ai) installed and running
- AWS credentials configured (`aws configure`)

## Quick Start

### 1. Install Ollama and pull model
```bash
ollama pull llama3.2
ollama serve   # starts automatically on macOS
```

### 2. Backend setup
```bash
cd backend
cp .env.example .env
# Edit .env — set MONGO_URI, AWS credentials, POLICY_LAMBDA_URL
npm install
npm run dev         # starts on :4000, auto-seeds MongoDB on first run
```

### 3. Frontend setup
```bash
cd frontend
npm install
npm run dev         # starts on :5173
```

### 4. Deploy Lambda (generates real CloudWatch logs)
```bash
cd lambda
npm install
./deploy.sh         # reads MONGO_URI from backend/.env, deploys to AWS
# Copy the output PolicyApiUrl into backend/.env as POLICY_LAMBDA_URL
```

### 5. Open http://localhost:5173

## Environment Variables (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB Atlas connection string |
| `OLLAMA_BASE_URL` | Ollama endpoint (default: `http://localhost:11434`) |
| `OLLAMA_MODEL` | Model name (default: `llama3.2`) |
| `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `CW_LOG_GROUPS` | Comma-separated CloudWatch log groups to search |
| `POLICY_LAMBDA_URL` | API Gateway URL for deployed Lambda (enables real CW logs) |
| `AWS_ENDPOINT_OVERRIDE` | Set to `http://localhost:4566` for LocalStack |

## Features

- **Agentic AI**: Multi-step reasoning with Llama 3.2, up to 8 tool-calling iterations
- **4 Tools**: MongoDB policy lookup, event history, CloudWatch log search, CloudWatch Insights analytics
- **Real-time SSE**: Stream agent reasoning steps, tool calls, and results live to the UI
- **Lambda-backed policy API**: Deployed to AWS — every query generates real structured CloudWatch logs
- **Cross-system tracing**: `correlationId` links MongoDB events to CloudWatch log lines for end-to-end traces
- **Enterprise patterns**: Rate limiting, Helmet, CORS, Zod validation, structured logging, graceful shutdown
